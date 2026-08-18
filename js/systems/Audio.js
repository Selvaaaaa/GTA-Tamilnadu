/* ═══════════════════════════════════════
   Chennai Ambient Audio
   Web Audio API oscillator-based sounds
   ═══════════════════════════════════════ */

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.hornTimer = 3 + Math.random() * 5;
    this.bellTimer = 15 + Math.random() * 20;
    this.trainTimer = 18 + Math.random() * 25;
    this.radioTimer = 10 + Math.random() * 18;
    this.constructionTimer = 7 + Math.random() * 14;
    this.footstepTimer = 0;
    this.rainGain = null;
    this.rainNode = null;
    this.trafficGain = null;
    this.trafficNode = null;
    this._init();
  }

  _init() {
    // Start on first user interaction
    const start = () => {
      if (this.ctx) return;
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this._startTrafficHum();
        this._startCrowdBed();
        this.enabled = true;
      } catch (e) { /* Web Audio not supported */ }
      document.removeEventListener('click', start);
      document.removeEventListener('keydown', start);
    };
    document.addEventListener('click', start);
    document.addEventListener('keydown', start);
  }

  _startTrafficHum() {
    if (!this.ctx) return;
    // Low frequency hum simulating city traffic
    const osc = this.ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 80;
    const gain = this.ctx.createGain(); gain.gain.value = 0.03;
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start();
    this.trafficNode = osc; this.trafficGain = gain;

    // Second harmonic
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine'; osc2.frequency.value = 120;
    const gain2 = this.ctx.createGain(); gain2.gain.value = 0.015;
    osc2.connect(gain2); gain2.connect(this.ctx.destination);
    osc2.start();
  }

  update(dt, raining) {
    if (!this.enabled || !this.ctx) return;

    // Random horn honks
    this.hornTimer -= dt;
    if (this.hornTimer <= 0) {
      this._playHorn();
      this.hornTimer = 2 + Math.random() * 6;
    }

    // Temple bells
    this.bellTimer -= dt;
    if (this.bellTimer <= 0) {
      this._playBell();
      this.bellTimer = 20 + Math.random() * 40;
    }

    this.trainTimer -= dt;
    if (this.trainTimer <= 0) {
      this._playTrainHorn();
      this.trainTimer = 28 + Math.random() * 42;
    }

    this.radioTimer -= dt;
    if (this.radioTimer <= 0) {
      this._playTamilRadioSting();
      this.radioTimer = 14 + Math.random() * 22;
    }

    this.constructionTimer -= dt;
    if (this.constructionTimer <= 0) {
      this._playConstructionHit();
      this.constructionTimer = 5 + Math.random() * 11;
    }

    // Rain sound
    if (raining && !this.rainNode) this._startRain();
    if (!raining && this.rainNode) this._stopRain();
  }

  footstep(dt, sprinting) {
    if (!this.enabled || !this.ctx) return;
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = sprinting ? 0.25 : 0.4;
      this._playClick(800 + Math.random() * 400, 0.02, 0.03);
    }
  }

  _playHorn() {
    if (!this.ctx) return;
    const freq = 300 + Math.random() * 200;
    const osc = this.ctx.createOscillator();
    osc.type = 'square'; osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.3);
  }

  _playBell() {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine'; osc.frequency.value = 800 + i * 200;
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.4;
      gain.gain.setValueAtTime(0.025, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.8);
    }
  }

  _startCrowdBed() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 46;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.45;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.012;
    osc.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    osc.start();
  }

  _playTrainHorn() {
    if (!this.ctx) return;
    for (const f of [185, 233]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = f;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.018, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.6);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(); osc.stop(this.ctx.currentTime + 1.6);
    }
  }

  _playTamilRadioSting() {
    if (!this.ctx) return;
    const notes = [392, 440, 523, 440, 349];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.012, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(t); osc.stop(t + 0.18);
    });
  }

  _playConstructionHit() {
    if (!this.ctx) return;
    this._playClick(95 + Math.random() * 40, 0.018, 0.08);
    setTimeout(() => this._playClick(130 + Math.random() * 60, 0.012, 0.04), 90);
  }

  _playClick(freq, vol, dur) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + dur);
  }

  _startRain() {
    if (!this.ctx || this.rainNode) return;
    // White noise for rain
    const bufSize = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;

    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const gain = this.ctx.createGain(); gain.gain.value = 0.06;

    // Low-pass filter for realistic rain
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 3000;

    src.connect(filter); filter.connect(gain); gain.connect(this.ctx.destination);
    src.start();
    this.rainNode = src; this.rainGain = gain;
  }

  _stopRain() {
    if (this.rainNode) {
      try { this.rainNode.stop(); } catch (e) { }
      this.rainNode = null; this.rainGain = null;
    }
  }
}
