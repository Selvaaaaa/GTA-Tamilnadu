import * as THREE from 'three';

/* ═══════════════════════════════════════════════════════════════════════════
   Chennai Environment v2 — Cinematic Realism
   ─────────────────────────────────────────────────────────────────────────
   Features:
   • Procedural city: multi-storey buildings, glass facades, neon signs
   • GTA-style AI traffic: cars, auto-rickshaws, buses — lane-following,
     turn signals, headlights, brake lights
   • Animated palm trees (vertex shader wind)
   • Static Chennai daylight
   • Road markings, zebra crossings, kerbs, drain covers
   • Post-processing ready: exposes bloom / depth-of-field targets
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Inline GLSL helpers ─────────────────────────────────────────────────────

const PALM_VERT = /* glsl */`
  uniform float uTime;
  uniform float uWind;
  varying vec2 vUv;
  varying vec3 vNorm;
  void main() {
    vUv = uv;
    vNorm = normalMatrix * normal;
    vec3 pos = position;
    float heightFactor = clamp(pos.y / 6.0, 0.0, 1.0);
    float wave = sin(uTime * 1.4 + pos.y * 0.6) * uWind * heightFactor;
    float wave2 = cos(uTime * 0.9 + pos.y * 0.4) * uWind * 0.4 * heightFactor;
    pos.x += wave;
    pos.z += wave2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const PALM_FRAG = /* glsl */`
  uniform vec3 uColor;
  varying vec2 vUv;
  varying vec3 vNorm;
  void main() {
    float light = dot(normalize(vNorm), normalize(vec3(0.5,1.0,0.3))) * 0.5 + 0.5;
    gl_FragColor = vec4(uColor * light, 1.0);
  }
`;

// ─── Shared materials (created once, reused) ─────────────────────────────────

function makeMats() {
  return {
    road: new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.92, metalness: 0.05 }),
    kerb: new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 }),
    pavement: new THREE.MeshStandardMaterial({ color: 0x9a9080, roughness: 0.95 }),
    roadLine: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
    zebra: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, metalness: 0.1, roughness: 0.05,
      transmission: 0.6, transparent: true, opacity: 0.7,
      envMapIntensity: 1.5
    }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xb0a898, roughness: 0.85 }),
    neonOrange: new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2.0 }),
    neonCyan: new THREE.MeshStandardMaterial({ color: 0x00ffee, emissive: 0x00ddcc, emissiveIntensity: 2.0 }),
    palmTrunk: null, // ShaderMaterial per-tree
    palmLeaf: null,
    lampPost: new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.7, metalness: 0.5 }),
    lampGlow: new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffcc44, emissiveIntensity: 0, transparent: true, opacity: 0.9 }),
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function rng(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rng(min, max + 1)); }

// ─── Main Environment class ───────────────────────────────────────────────────

export class Environment {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 13;
    this.timeSpeed = 0;
    this._clock = { now: 0 };

    this.mats = makeMats();
    this.palmUniforms = [];
    this.streetlamps = [];
    this.vehicles = [];
    this.neonSigns = [];

    // ── Lighting ────────────────────────────────────────────────────────────
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sunLight.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 1, far: 600 });
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    scene.add(this.sunLight, this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(0x334488, 0.0);
    this.moonLight.position.set(-100, 80, -50);
    scene.add(this.moonLight);

    this.ambientLight = new THREE.AmbientLight(0x806040, 0.5);
    scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xddc090, 0x665533, 0.5);
    scene.add(this.hemiLight);

    // ── Sky dome ─────────────────────────────────────────────────────────────
    const skyGeo = new THREE.SphereGeometry(1400, 32, 16);
    this.skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0xB8D4E8 });
    this.skyDome = new THREE.Mesh(skyGeo, this.skyMat);
    scene.add(this.skyDome);

    // ── Fog ──────────────────────────────────────────────────────────────────
    scene.fog = new THREE.FogExp2(0xC8B8A0, 0.0014);

    // The main city geometry is owned by City.js. Environment only adds
    // atmosphere and light-weight dressing so the scene does not double-build.

    // Strict asset-only world mode: visible dressing is owned by City/StreetLife
    // and loaded from public/models assets. Environment only controls lighting,
    // sky, fog, and exposure.

    this.raining = false;

    // ── Color tables ─────────────────────────────────────────────────────────
    this.skyColors = {
      night: new THREE.Color(0x0a0e1a),
      dawn: new THREE.Color(0xff8844),
      day: new THREE.Color(0xB8D4E8),
      sunset: new THREE.Color(0xff5522)
    };
    this.fogColors = {
      night: new THREE.Color(0x080c18),
      dawn: new THREE.Color(0x886644),
      day: new THREE.Color(0xC8B8A0),
      sunset: new THREE.Color(0x773322)
    };

    this._updateLighting();
  }

  // ── Ground plane ─────────────────────────────────────────────────────────────

  _buildGround() {
    // Large dirt/scrub ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.98, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  // ── City blocks ──────────────────────────────────────────────────────────────

  _buildCityBlocks() {
    const blockDefs = [
      // [x, z, width, depth, floors, styleIndex]
      [-45, -45, 18, 14, 8, 0], [-45, -15, 12, 18, 5, 1], [-45, 20, 16, 12, 12, 2],
      [-45, 50, 14, 16, 4, 1], [-45, 75, 20, 14, 7, 0],
      [45, -50, 14, 14, 10, 2], [45, -20, 18, 12, 6, 1], [45, 15, 14, 18, 15, 0],
      [45, 50, 16, 14, 5, 2], [45, 78, 12, 16, 8, 1],
      [-80, -60, 16, 12, 6, 0], [-80, -5, 18, 16, 4, 1], [-80, 55, 14, 18, 9, 2],
      [80, -55, 14, 16, 7, 0], [80, 0, 20, 14, 11, 2], [80, 60, 16, 12, 5, 1],
      [-20, -80, 22, 12, 6, 0], [20, -80, 18, 14, 8, 2],
      [-20, 95, 20, 14, 5, 1], [20, 95, 16, 18, 13, 0],
    ];

    blockDefs.forEach(([x, z, w, d, floors, style]) => {
      this._buildBuilding(x, z, w, d, floors, style);
    });
  }

  _buildBuilding(cx, cz, w, d, floors, style) {
    const floorH = 3.2;
    const totalH = floors * floorH;
    const scene = this.scene;

    // Base concrete
    const baseMat = new THREE.MeshStandardMaterial({
      color: style === 0 ? 0xc8b89a : style === 1 ? 0xb0b8c8 : 0xd4c8a8,
      roughness: 0.85, metalness: 0.05
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(w, totalH, d), baseMat);
    body.position.set(cx, totalH / 2, cz);
    body.castShadow = true;
    body.receiveShadow = true;
    scene.add(body);

    // Window grid
    const winRows = floors;
    const winColsX = Math.floor(w / 2.2);
    const winColsZ = Math.floor(d / 2.2);

    const winGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, roughness: 0.05, metalness: 0.1,
      transmission: 0.5, transparent: true, opacity: 0.75,
      emissive: 0x223344, emissiveIntensity: 0.2
    });
    const litWinMat = new THREE.MeshStandardMaterial({
      color: 0xffeedd, emissive: 0xffcc88, emissiveIntensity: 0.8
    });

    const winW = 1.0, winH = 1.4, winD = 0.08;

    // Front & back faces
    [1, -1].forEach(side => {
      for (let row = 0; row < winRows; row++) {
        for (let col = 0; col < winColsX; col++) {
          const wx = cx - (w / 2) + (w / (winColsX + 1)) * (col + 1);
          const wy = floorH * row + 1.8;
          const wz = cz + side * (d / 2 + 0.05);
          const mat = Math.random() < 0.6 ? litWinMat.clone() : winGlassMat.clone();
          const win = new THREE.Mesh(new THREE.BoxGeometry(winW, winH, winD), mat);
          win.position.set(wx, wy, wz);
          scene.add(win);
        }
      }
    });

    // Side faces
    [1, -1].forEach(side => {
      for (let row = 0; row < winRows; row++) {
        for (let col = 0; col < winColsZ; col++) {
          const wz = cz - (d / 2) + (d / (winColsZ + 1)) * (col + 1);
          const wy = floorH * row + 1.8;
          const wx = cx + side * (w / 2 + 0.05);
          const mat = Math.random() < 0.5 ? litWinMat.clone() : winGlassMat.clone();
          const win = new THREE.Mesh(new THREE.BoxGeometry(winD, winH, 0.95), mat);
          win.position.set(wx, wy, wz);
          scene.add(win);
        }
      }
    });

    // Rooftop details
    if (style === 2) {
      // Water tower
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.5, 10),
        new THREE.MeshStandardMaterial({ color: 0x887766, roughness: 0.8 }));
      tower.position.set(cx + w * 0.25, totalH + 1.25, cz);
      scene.add(tower);
    }
    if (style === 0 && floors > 6) {
      // Telecom dish
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 4, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8 }));
      dish.position.set(cx - w * 0.2, totalH + 0.6, cz + d * 0.2);
      dish.rotation.x = Math.PI / 4;
      scene.add(dish);
    }

    // AC units on side
    for (let f = 0; f < Math.min(floors, 5); f++) {
      const acMat = new THREE.MeshStandardMaterial({ color: 0xd0d0c8, roughness: 0.7 });
      const ac = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.35), acMat);
      ac.position.set(cx + w / 2 + 0.15, f * floorH + 1.2 + rng(-0.3, 0.3), cz + rng(-d / 3, d / 3));
      scene.add(ac);
    }
  }

  // ── Roads ─────────────────────────────────────────────────────────────────────

  _buildRoads() {
    const m = this.mats;
    const scene = this.scene;

    // Main N-S road (Z axis)
    const mainRoad = new THREE.Mesh(new THREE.PlaneGeometry(20, 400), m.road);
    mainRoad.rotation.x = -Math.PI / 2;
    mainRoad.position.set(0, 0.01, 0);
    mainRoad.receiveShadow = true;
    scene.add(mainRoad);

    // E-W cross roads
    [-50, 0, 50, 100].forEach(z => {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 14), m.road);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, z);
      road.receiveShadow = true;
      scene.add(road);
    });

    // Kerbs along main road
    [-10.5, 10.5].forEach(x => {
      const kerb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 400), m.kerb);
      kerb.position.set(x, 0.09, 0);
      scene.add(kerb);
    });

    // Pavement strips
    [-13, 13].forEach(x => {
      const pave = new THREE.Mesh(new THREE.PlaneGeometry(4, 400), m.pavement);
      pave.rotation.x = -Math.PI / 2;
      pave.position.set(x, 0.02, 0);
      scene.add(pave);
    });

    // Centre line dashes
    for (let z = -190; z < 190; z += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 4), m.roadLine);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.03, z);
      scene.add(dash);
    }

    // Lane dividers
    [-3.5, 3.5].forEach(x => {
      for (let z = -190; z < 190; z += 6) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.5), m.roadLine);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.03, z);
        scene.add(d);
      }
    });

    // Zebra crossing at z=0
    for (let i = -4; i <= 4; i++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 10), m.zebra);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(i * 1.4, 0.035, 5);
      scene.add(stripe);
    }

    // Drain covers (decorative circles)
    [[-8, -20], [8, 40], [-8, 80], [8, -60]].forEach(([x, z]) => {
      const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.7, roughness: 0.6 }));
      cover.position.set(x, 0.02, z);
      scene.add(cover);
    });
  }

  // ── Palm trees ───────────────────────────────────────────────────────────────

  _plantPalms(count) {
    const positions = [];
    const candidates = [
      ...Array.from({ length: 20 }, (_, i) => [-14, -100 + i * 20]),
      ...Array.from({ length: 20 }, (_, i) => [14, -100 + i * 20]),
    ];
    const extra = Array.from({ length: count - 40 }, () => [rng(-120, 120), rng(-120, 120)]);
    [...candidates, ...extra].forEach(([x, z]) => {
      if (Math.abs(x) < 12) return; // keep off road
      this._plantPalm(x, z);
    });
  }

  _plantPalm(x, z) {
    const height = rng(5, 9);
    const windU = { value: rng(0.02, 0.06) };
    const timeU = { value: 0 };

    const trunkMat = new THREE.ShaderMaterial({
      uniforms: { uTime: timeU, uWind: windU, uColor: { value: new THREE.Color(0x7a5c3a) } },
      vertexShader: PALM_VERT, fragmentShader: PALM_FRAG
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, height, 8), trunkMat);
    trunk.position.set(x, height / 2, z);
    trunk.castShadow = true;
    this.scene.add(trunk);

    // Fronds
    const leafMat = new THREE.ShaderMaterial({
      uniforms: { uTime: timeU, uWind: { value: windU.value * 1.5 }, uColor: { value: new THREE.Color(0x3a6e2a) } },
      vertexShader: PALM_VERT, fragmentShader: PALM_FRAG,
      side: THREE.DoubleSide
    });

    const frondCount = randInt(5, 8);
    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.4, rng(1.8, 2.8), 1, 6), leafMat.clone());
      frond.position.set(
        x + Math.cos(angle) * 0.8,
        height + 0.3,
        z + Math.sin(angle) * 0.8
      );
      frond.rotation.set(0.6, angle, -0.5);
      frond.castShadow = true;
      this.scene.add(frond);
    }

    this.palmUniforms.push(timeU);
  }

  // ── Streetlamps ──────────────────────────────────────────────────────────────

  _placeStreetlamps() {
    const m = this.mats;
    [[-11.5, -80], [-11.5, -40], [-11.5, 0], [-11.5, 40], [-11.5, 80],
    [11.5, -80], [11.5, -40], [11.5, 0], [11.5, 40], [11.5, 80]].forEach(([x, z]) => {
      this._buildLamp(x, z);
    });
  }

  _buildLamp(x, z) {
    const g = new THREE.Group();

    // Post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 7, 8), this.mats.lampPost);
    post.position.y = 3.5;
    g.add(post);

    // Arm
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.08), this.mats.lampPost);
    arm.position.set(x < 0 ? 0.75 : -0.75, 7.1, 0);
    g.add(arm);

    // Lamp head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), this.mats.lampGlow.clone());
    head.position.set(x < 0 ? 1.5 : -1.5, 6.9, 0);
    g.add(head);

    // Point light
    const pt = new THREE.PointLight(0xffee88, 0, 22, 1.8);
    pt.position.set(x < 0 ? 1.5 : -1.5, 6.7, 0);
    g.add(pt);

    g.position.set(x, 0, z);
    this.scene.add(g);
    this.streetlamps.push({ headMat: head.material, pt, on: false });
  }

  // ── Neon signs ───────────────────────────────────────────────────────────────

  _placeNeonSigns() {
    const labels = ['HOTEL', 'CHAI', 'BIRYANI', 'SWEET', 'MOBILE', 'BANK', 'MEDIC'];
    const colors = [0xff3366, 0x00ffcc, 0xff9900, 0xff00ff, 0x00aaff, 0x88ff00, 0xff4400];

    [[-40, 3, -38], [42, 3, -48], [-44, 5, 18], [44, 3, 12],
    [-43, 8, -15], [43, 6, 50], [-44, 4, 48]].forEach(([x, y, z], i) => {
      const c = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({
        color: c, emissive: new THREE.Color(c), emissiveIntensity: 0,
        transparent: true, opacity: 0.9
      });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.6, 0.1), mat);
      sign.position.set(x, y, z);
      this.scene.add(sign);
      this.neonSigns.push({ mat, baseIntensity: 2.5 });

      // Glow point light
      const pt = new THREE.PointLight(c, 0, 12, 2);
      pt.position.set(x, y, z + 0.5);
      this.scene.add(pt);
      this.neonSigns[this.neonSigns.length - 1].pt = pt;
    });
  }

  // ── Traffic ───────────────────────────────────────────────────────────────────
  update(dt) {
    this._clock.now += dt;

    for (const u of this.palmUniforms) u.value = this._clock.now;
  }

  _updateLighting() {
    const t = this.timeOfDay;
    const night = this.skyColors.night;
    const dawn = this.skyColors.dawn;
    const day = this.skyColors.day;
    const sunset = this.skyColors.sunset;
    const nightFog = this.fogColors.night;
    const dawnFog = this.fogColors.dawn;
    const dayFog = this.fogColors.day;
    const sunsetFog = this.fogColors.sunset;

    if (t < 5) this._lerp(night, night, nightFog, nightFog, 0, 0.05, 0.22);
    else if (t < 7) this._lerp(night, dawn, nightFog, dawnFog, (t - 5) / 2, 0.7, 0.35);
    else if (t < 17) this._lerp(dawn, day, dawnFog, dayFog, Math.min((t - 7) / 3, 1), 1.8, 0.5);
    else if (t < 19) this._lerp(day, sunset, dayFog, sunsetFog, (t - 17) / 2, 0.9, 0.4);
    else if (t < 21) this._lerp(sunset, night, sunsetFog, nightFog, (t - 19) / 2, 0.15, 0.25);
    else this._lerp(night, night, nightFog, nightFog, 0, 0.05, 0.22);

    const sunAngle = (t / 24) * Math.PI * 2 - Math.PI / 2;
    this.sunLight.position.set(Math.cos(sunAngle) * 120, Math.max(12, Math.sin(sunAngle) * 120), 60);

    const nightFactor = t < 6 || t > 18 ? 1 : 0;
    for (const lamp of this.streetlamps) {
      lamp.pt.intensity = nightFactor ? 1.4 : 0;
      lamp.headMat.emissiveIntensity = nightFactor ? 1.6 : 0;
    }
    for (const sign of this.neonSigns) {
      sign.mat.emissiveIntensity = nightFactor ? sign.baseIntensity : 0;
      if (sign.pt) sign.pt.intensity = nightFactor ? 0.8 : 0;
    }

  }

  _lerp(skyA, skyB, fogA, fogB, t, sunI, ambI) {
    const sky = skyA.clone().lerp(skyB, t);
    const fog = fogA.clone().lerp(fogB, t);
    this.skyMat.color.copy(sky);
    this.scene.fog.color.copy(fog);
    this.scene.fog.density = 0.0014;
    this.sunLight.intensity = sunI;
    this.ambientLight.intensity = ambI;
    this.hemiLight.intensity = ambI * 0.75;

    if (sunI < 0.5) this.sunLight.color.set(0x334466);
    else if (sky.r > 0.5) this.sunLight.color.set(0xff9955);
    else this.sunLight.color.set(0xffeedd);
  }

  // FIX #11 preserved: followPlayer only sets X/Z; Y managed by shader uniform.
  followPlayer(pos) {
    this.sunLight.target.position.set(pos.x, 0, pos.z);
  }

  setRenderer(renderer) {
    if (!renderer) return;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0xB8D4E8);
      envScene.add(new THREE.HemisphereLight(0xddc090, 0x665533, 1.0));
      const rt = pmrem.fromScene(envScene, 0, 0.1, 1000);
      this.scene.environment = rt.texture;

      // Apply env map to glass materials (puddles, windows, vehicle paint)
      this.scene.traverse(obj => {
        if (obj.isMesh && obj.material && obj.material.envMapIntensity !== undefined) {
          obj.material.envMap = rt.texture;
          obj.material.needsUpdate = true;
        }
      });
      pmrem.dispose();
    } catch (e) { /* graceful fallback */ }
  }
}
