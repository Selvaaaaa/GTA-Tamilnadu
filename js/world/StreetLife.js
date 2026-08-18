import * as THREE from 'three';
import { AssetRegistry, ASSET_CATALOG } from './AssetRegistry.js';

/* ═══════════════════════════════════════════════
   Chennai Street Life — Props, Signs & Detail
   Uses imported GLB assets with variety limits
   ═══════════════════════════════════════════════ */

export class StreetLife {
  constructor(scene) {
    this.scene = scene;

    // FIX #3: Shared singleton — counts track what City and Landmarks already placed.
    this.registry = AssetRegistry.getInstance();
  }

  build(city) {
    const rng = this._rng(99);

    this._placeGLBProps(city, rng);
    this._addBusStops(city, rng);
    this._addDrainage(city, rng);
    this._addPoliticalBanners(city, rng);
    this._addStreetLevelSigns(city, rng);

    // FIX #8: These two methods were defined but never called in build().
    // Wiring them in here restores the EB pole wires and metro pillars.
    this._addEBPoles(city, rng);
    this._addMetroPillars(city, rng);
  }

  _addStreetLevelSigns(city, rng) {
    const candidates = (city.buildings || []).filter(b => !b.noDecor && !b.boundary && b.h < 18);
    for (const b of candidates.slice(0, 55)) {
      if (rng() < 0.7) this._addTamilSign(b, rng);
      if (rng() < 0.45) this._addPoster(b, rng);
    }
  }

  /* ── Tamil Signboards ── */
  _addTamilSign(b, rng) {
    const tamilTexts = [
      'அருணா உணவகம்', 'ஸ்ரீ லட்சுமி ஸ்டோர்ஸ்', 'முருகன் மார்ட்',
      'கார்த்திக் மெடிக்கல்ஸ்', 'பாலாஜி டெக்ஸ்டைல்ஸ்', 'அன்பு கடை',
      'மீனாட்சி ஜுவல்லரி', 'சரவணா பவன்', 'குமார் ஸ்டேஷனரி',
      'ராஜா இடியாப்பம்', 'செல்வம் மார்க்கெட்', 'தமிழ் சினிமா',
      'நண்பன் மொபைல்ஸ்', 'விஜய் இலக்ட்ரானிக்ஸ்', 'அம்மா மெஸ்'
    ];
    const colors = [0xdd2233, 0x2244bb, 0xdd8800, 0x228833, 0xaa22aa, 0xcc6600, 0x3366cc];

    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    const bgColor = colors[Math.floor(rng() * colors.length)];
    ctx.fillStyle = '#' + bgColor.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 256, 80);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 72);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tamilTexts[Math.floor(rng() * tamilTexts.length)], 128, 38);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), mat);
    const side = rng() > 0.5 ? 1 : -1;
    sign.position.set(
      b.x + side * (b.w / 2 + 0.08),
      (b.h || 8) * 0.6,
      b.z
    );
    sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(sign);
  }

  /* ── Movie / Political Posters ── */
  _addPoster(b, rng) {
    const posterColors = [0xff4444, 0x44aaff, 0xffcc00, 0xff6600, 0x44dd44];
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 192;
    const ctx = canvas.getContext('2d');
    const bg = posterColors[Math.floor(rng() * posterColors.length)];
    ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0');
    ctx.fillRect(0, 0, 128, 192);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(8, 8, 112, 60);
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const titles = ['தளபதி', 'விஜய்', 'அஜித்', 'ரஜினி', 'கமல்', 'DMK', 'AIADMK', 'PMK'];
    ctx.fillText(titles[Math.floor(rng() * titles.length)], 64, 42);
    ctx.font = '12px sans-serif';
    ctx.fillText('★ ★ ★ ★ ★', 64, 100);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), mat);
    const side = rng() > 0.5 ? 1 : -1;
    poster.position.set(
      b.x + side * (b.w / 2 + 0.06),
      2 + rng() * 3,
      b.z + (rng() - 0.5) * b.d * 0.6
    );
    poster.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(poster);
  }

  /* ── EB Poles with Wires ── */
  // FIX #8: Now called inside build() — previously defined but never invoked.
  _addEBPoles(city, rng) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.4 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x222222 });
    const half = city.halfCity;
    const cell = city.cellSize;
    const prevPoles = [];

    for (let i = 0; i <= city.grid; i++) {
      const roadX = -half + i * cell;
      for (let j = 0; j < 6; j++) {
        const z = -half + 40 + j * (half * 2 - 80) / 5;
        if (rng() > 0.6) continue;

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 9, 6), poleMat);
        pole.position.set(roadX + 6, 4.5, z);
        pole.castShadow = true;
        this.scene.add(pole);

        // Cross arm
        const arm = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 0.1), poleMat);
        arm.position.set(roadX + 6, 8.8, z);
        this.scene.add(arm);

        // Wire to previous pole
        if (prevPoles.length > 0) {
          const prev = prevPoles[prevPoles.length - 1];
          const pts = [
            new THREE.Vector3(prev.x, prev.y, prev.z),
            new THREE.Vector3(roadX + 6, 8.5, z)
          ];
          this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts), wireMat
          ));
        }
        prevPoles.push(new THREE.Vector3(roadX + 6, 8.8, z));
      }
    }
  }

  /* ── Bus Stops ── */
  _addBusStops(city, rng) {
    const half = city.halfCity;
    const cell = city.cellSize;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x335577, roughness: 0.5, metalness: 0.4 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8 });
    const signMat = new THREE.MeshStandardMaterial({ color: 0x1155bb, roughness: 0.5 });
    let count = 0;

    for (let i = 1; i < city.grid && count < 5; i += 2) {
      const roadX = -half + i * cell;
      const z = -half + cell * (2 + Math.floor(rng() * (city.grid - 3)));
      const g = new THREE.Group();

      g.add(this._box(5, 0.2, 2.5, roofMat, 0, 3.2, 0));  // roof
      g.add(this._box(0.12, 3.2, 0.12, baseMat, -2.2, 1.6, 1.1));  // post L
      g.add(this._box(0.12, 3.2, 0.12, baseMat, 2.2, 1.6, 1.1));  // post R
      g.add(this._box(4.6, 2.8, 0.08, baseMat, 0, 1.4, 1.2));  // back panel
      g.add(this._box(3.5, 0.1, 0.7, baseMat, 0, 0.5, 0.4));  // bench
      g.add(this._box(2, 0.5, 0.08, signMat, 0, 3.5, 1.2));  // route sign

      g.position.set(roadX + 8, 0, z);
      this.scene.add(g);
      count++;
    }
  }

  /* ── Place GLB Props with Registry Limits ── */
  _placeGLBProps(city, rng) {
    const half = city.halfCity;
    const reg = this.registry;

    const propPlacements = [
      { key: 'tea_shop', x: -half + 100, z: 50, footprint: 6 },
      { key: 'tea_shop', x: 30, z: -half + 120, footprint: 5 },
      { key: 'tea_shop', x: half - 80, z: -30, footprint: 5.5 },
      { key: 'dustbin', x: -20, z: 40, footprint: 1.5 },
      { key: 'dustbin', x: half - 60, z: 20, footprint: 1.5 },
      { key: 'dustbin', x: -half + 70, z: -60, footprint: 1.5 },
      { key: 'post_box', x: 50, z: 80, footprint: 1.2 },
      { key: 'post_box', x: -half + 90, z: -40, footprint: 1.2 },
      { key: 'water_tank', x: -60, z: 100, footprint: 4 },
      { key: 'water_tank', x: half - 90, z: half - 80, footprint: 3.5 },
      { key: 'water_tank', x: -half + 60, z: half - 60, footprint: 4 },
      { key: 'clothes_line', x: -30, z: 60, footprint: 5 },
      { key: 'clothes_line', x: -half + 110, z: 30, footprint: 4.5 },
      { key: 'clothes_line', x: 80, z: -50, footprint: 5 },
      { key: 'flower_vendor', x: 10, z: -30, footprint: 4 },
      { key: 'flower_vendor', x: -60, z: -80, footprint: 3.5 },
      { key: 'flower_vendor', x: half - 70, z: 60, footprint: 4 },
      { key: 'junction_box_shrine', x: -80, z: -20, footprint: 3 },
      { key: 'junction_box_shrine', x: 60, z: half - 70, footprint: 3 },
      { key: 'street_lamp', x: -half + 50, z: 80, footprint: 2 },
      { key: 'street_lamp', x: 20, z: -70, footprint: 2 },
      { key: 'street_lamp', x: half - 40, z: -half + 90, footprint: 2 },
      { key: 'residential_street', x: -40, z: half - 100, footprint: 18 },
      { key: 'residential_street', x: -half + 130, z: 80, footprint: 16 },
    ];

    for (const pp of propPlacements) {
      if (!reg.canPlace('props', pp.key)) continue;
      if (city.isRoad && city.isRoad(pp.x, pp.z)) continue;
      if (city.isInsideBuilding && city.isInsideBuilding(pp.x, pp.z, pp.footprint, pp.footprint, 2)) continue;

      reg.recordPlacement('props', pp.key);

      reg.loadAsset('props', pp.key, model => {
        const groundY = city.getTerrainHeight ? city.getTerrainHeight(pp.x, pp.z) : 0;

        AssetRegistry.fitModel(model, { targetFootprint: pp.footprint, groundY });
        AssetRegistry.applyVariation(model, this._rng(Math.abs(Math.floor(pp.x * 77 + pp.z))));

        // FIX #4: set absolute position — not += which accumulates fitModel's offset.
        model.position.x = pp.x;
        model.position.z = pp.z;
        AssetRegistry.snapToGround(model, groundY);

        this.scene.add(model);

        if (city.buildings) {
          city.buildings.push({ x: pp.x, z: pp.z, w: pp.footprint, d: pp.footprint, h: 5 });
        }
      });
    }

    this._plantPalms(city, rng);
  }

  _plantPalms(city, rng) {
    const half = city.halfCity;
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x3a6e2a, roughness: 0.8 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.9 });

    for (let i = 0; i < 60; i++) {
      const x = -half + rng() * half * 2;
      const z = -half + rng() * half * 2;

      if (city.isRoad && city.isRoad(x, z)) continue;
      if (city.isInsideBuilding && city.isInsideBuilding(x, z, 3, 3, 1)) continue;
      if (z > half - 35) continue; // keep out of deep water

      const height = 5 + rng() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, height, 6), trunkMat);
      trunk.position.set(x, height / 2, z);
      trunk.castShadow = true;
      this.scene.add(trunk);

      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 3.5), treeMat);
        frond.position.set(x, height, z);
        frond.rotation.set(0.6 + rng() * 0.2, f * Math.PI / 3, 0);
        frond.castShadow = true;
        this.scene.add(frond);
      }

      if (city.buildings) {
        city.buildings.push({ x, z, w: 2, d: 2, h: height });
      }
    }
  }

  /* ── Drainage Channels ── */
  _addDrainage(city, rng) {
    const half = city.halfCity;
    const cell = city.cellSize;
    const drainMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.95 });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2a5a4a, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.6
    });

    for (let i = 0; i <= city.grid; i++) {
      const roadX = -half + i * cell;
      if (rng() > 0.5) continue;

      const drain = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, half * 1.6), drainMat);
      drain.position.set(roadX + 5.2, -0.15, 0);
      this.scene.add(drain);

      const water = new THREE.Mesh(new THREE.PlaneGeometry(0.9, half * 1.4), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(roadX + 5.2, 0.12, 0);
      this.scene.add(water);
    }
  }

  /* ── Metro Pillars in IT Corridor ── */
  // FIX #8: Now called inside build() — previously defined but never invoked.
  _addMetroPillars(city, rng) {
    const half = city.halfCity;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xbbbbaa, roughness: 0.6, metalness: 0.1 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5, metalness: 0.2 });
    const roadX = half - city.cellSize * 2;

    for (let i = 0; i < 8; i++) {
      const z = -half + 40 + i * 50;

      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 14, 8), pillarMat);
      pillar.position.set(roadX, 7, z);
      pillar.castShadow = true;
      this.scene.add(pillar);

      const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 4), beamMat);
      beam.position.set(roadX, 14.5, z);
      this.scene.add(beam);
    }
  }

  /* ── Political Banners ── */
  _addPoliticalBanners(city, rng) {
    const half = city.halfCity;
    const bannerTexts = ['அ.தி.மு.க', 'தி.மு.க', 'வாக்களியுங்கள்', 'நல்வரவு', 'வணக்கம்'];
    const bannerColors = [0xdd2222, 0xffcc00, 0x2266dd, 0x22aa44, 0xff6600];

    for (let i = 0; i < 6; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const bg = bannerColors[Math.floor(rng() * bannerColors.length)];
      ctx.fillStyle = '#' + bg.toString(16).padStart(6, '0');
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bannerTexts[Math.floor(rng() * bannerTexts.length)], 128, 50);
      ctx.font = '16px sans-serif';
      ctx.fillText('★ தமிழ்நாடு ★', 128, 95);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), mat);
      banner.position.set(
        -half + rng() * half * 2,
        6 + rng() * 4,
        -half + rng() * half * 2
      ); 
      banner.rotation.y = rng() * Math.PI;
      this.scene.add(banner);
    }
  }

  // ── Helpers ───────────────────────────────────────────────

  _box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  _rng(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
} 