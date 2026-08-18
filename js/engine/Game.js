import * as THREE from 'three';
import { Input } from './Input.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

/* ═══════════════════════════════════════════
   Chennai Vice — Cinematic Game Engine
   Post-processing: Bloom, SSAO, Color Grade
   ═══════════════════════════════════════════ */

// Cinematic color grading + vignette shader
const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.35 },
    warmth: { value: 0.08 },
    contrast: { value: 1.05 },
    saturation: { value: 1.1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteStrength;
    uniform float warmth;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;
    void main(){
      vec4 color=texture2D(tDiffuse,vUv);
      // Warm Chennai tint
      color.r+=warmth; color.b-=warmth*0.5;
      // Contrast
      color.rgb=(color.rgb-0.5)*contrast+0.5;
      // Saturation
      float lum=dot(color.rgb,vec3(0.299,0.587,0.114));
      color.rgb=mix(vec3(lum),color.rgb,saturation);
      // Vignette
      vec2 c=vUv-0.5;
      float v=1.0-dot(c,c)*vignetteStrength*2.0;
      color.rgb*=v;
      gl_FragColor=color;
    }
  `
};

export class Game {
  constructor() {
    this.canvas = document.createElement('canvas');
    document.getElementById('game-container').prepend(this.canvas);

    // Renderer — cinematic settings
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0015);

    // Camera — cinematic FOV
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 1500);
    this.camera.position.set(0, 10, 20);

    // Post-processing pipeline
    this._initPostProcessing();

    // Input
    this.input = new Input(this.canvas);

    // Clock & FPS
    this.clock = new THREE.Clock();
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.fpsDisplay = 0;

    // State
    this.state = 'loading';

    // Subsystems (assigned by main.js)
    this.city = null;
    this.environment = null;
    this.player = null;
    this.vehicleManager = null;
    this.npcManager = null;
    this.combat = null;
    this.wanted = null;
    this.hud = null;
    this.minimap = null;
    this.streetLife = null;
    this.wildlife = null;
    this.landmarks = null;
    this.audio = null;

    // Camera shake
    this.shakeIntensity = 0;
    this.shakeDecay = 5;

    // Resize
    window.addEventListener('resize', () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.composer.setSize(w, h);
    });
  }

  _initPostProcessing() {
    const w = window.innerWidth, h = window.innerHeight;

    this.composer = new EffectComposer(this.renderer);

    // 1. Base render
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // 2. SSAO is expensive on this scene, so keep it available but disabled.
    this.ssaoPass = new SSAOPass(this.scene, this.camera, w, h);
    this.ssaoPass.kernelRadius = 8;
    this.ssaoPass.minDistance = 0.005;
    this.ssaoPass.maxDistance = 0.12;
    this.ssaoPass.output = SSAOPass.OUTPUT.Default;
    this.ssaoPass.enabled = false;
    this.composer.addPass(this.ssaoPass);

    // 3. Bloom — cinematic glow
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.16, 0.45, 1.08);
    this.composer.addPass(this.bloomPass);

    // 4. SMAA — antialiasing (better than hardware AA)
    const smaaPass = new SMAAPass(w, h);
    this.composer.addPass(smaaPass);

    // 5. Cinematic color grading + vignette
    this.cinemaPass = new ShaderPass(CinematicShader);
    this.composer.addPass(this.cinemaPass);

    // 6. Output (color space conversion)
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  /* ── State management ── */
  setState(s) {
    this.state = s;
    const ids = ['loading-screen', 'title-screen', 'pause-screen', 'gameover-screen', 'hud'];
    ids.forEach(id => document.getElementById(id)?.classList.add('hidden'));

    if (s === 'loading') document.getElementById('loading-screen')?.classList.remove('hidden');
    if (s === 'title') document.getElementById('title-screen')?.classList.remove('hidden');
    if (s === 'playing') {
      document.getElementById('hud')?.classList.remove('hidden');
      this.input.requestLock();
    }
    if (s === 'paused') {
      document.getElementById('hud')?.classList.remove('hidden');
      document.getElementById('pause-screen')?.classList.remove('hidden');
    }
    if (s === 'gameover') {
      document.getElementById('hud')?.classList.remove('hidden');
      document.getElementById('gameover-screen')?.classList.remove('hidden');
    }
  }

  setLoadingProgress(pct, text) {
    const bar = document.getElementById('loading-bar');
    const txt = document.getElementById('loading-text');
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = text;
  }

  /* ── Camera shake ── */
  triggerShake(intensity) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /* ── Loop ── */
  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);

    // FPS counter
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 0.5) {
      this.fpsDisplay = Math.round(this.fpsFrames / this.fpsTime);
      this.fpsFrames = 0;
      this.fpsTime = 0;
      const el = document.getElementById('fps-counter');
      if (el) el.textContent = this.fpsDisplay + ' FPS';
    }

    if (this.state === 'playing') {
      // ESC → pause
      if (this.input.justPressed('Escape')) {
        this.setState('paused');
        document.exitPointerLock();
        this.input.endFrame();
        return;
      }

      if (this.environment) this.environment.update(dt);
      if (this.player) this.player.update(dt, this.input, this.camera, this);
      if (this.vehicleManager) this.vehicleManager.update(dt, this.input, this.player, this.city);
      if (this.npcManager) this.npcManager.update(dt, this.player, this.wanted, this.city);
      if (this.combat) this.combat.update(dt, this.input, this.player, this.camera, this);
      if (this.wanted) this.wanted.update(dt, this.player);
      if (this.wildlife) this.wildlife.update(dt);
      if (this.landmarks) this.landmarks.update(dt, this);
      if (this.audio) this.audio.update(dt, this.environment ? this.environment.raining : false);
      if (this.hud) this.hud.update(this);
      if (this.minimap) this.minimap.update(this);

      // Camera shake
      if (this.shakeIntensity > 0.01) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.3;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.2;
        this.shakeIntensity *= Math.exp(-this.shakeDecay * dt);
      }
    }

    this.input.endFrame();
  }

  render() {
    // Use post-processing composer instead of direct render
    this.composer.render();
  }

  loop() {
    requestAnimationFrame(() => this.loop());
    this.update();
    this.render();
  }

  start() {
    this.clock.start();
    this.loop();
  }
}
