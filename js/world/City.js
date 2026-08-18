import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetRegistry, ASSET_CATALOG } from './AssetRegistry.js';

/* ═══════════════════════════════════════════
   Chennai City Generator — Handcrafted Vibe
   5 Chennai Districts with strict GLB asset rules
   ═══════════════════════════════════════════ */

const GRID = 8, BLOCK = 34, ROAD_W = 11, CELL = BLOCK + ROAD_W;
const HALF = (GRID * CELL) / 2;
const WORLD_BUFFER = 42;

const D = { OMR_IT: 1, RESIDENTIAL: 2, T_NAGAR: 3, STATION: 4, MARINA_BEACH: 5, NORTH_INDUSTRIAL: 6 };
const gltfLoader = new GLTFLoader();
const gltfCache = new Map();

const GLB_FALLBACK_COLORS = [
  { test: 'water_tank', color: 0x2d3a42 },
  { test: 'street_lamp', color: 0x4a4235 },
  { test: 'junction_box', color: 0x8d7a62 },
  { test: 'flower_vendor', color: 0x9a5a32 },
  { test: 'clothes_line', color: 0x7f735f },
];

function fallbackColorFor(url) {
  const match = GLB_FALLBACK_COLORS.find(item => url.includes(item.test));
  return match ? match.color : 0x8a7f6d;
}

export class City {
  constructor(scene) {
    this.scene = scene;
    this.buildings = [];
    this.landmarksPlaced = new Set();
    this.citySize = GRID * CELL;
    this.halfCity = HALF;
    this.playableHalf = HALF - 7;
    this.worldLimit = HALF + WORLD_BUFFER;
    this.grid = GRID;
    this.blockSize = BLOCK;
    this.roadWidth = ROAD_W;
    this.cellSize = CELL;

    // FIX #3: Use the shared singleton registry so placement counts
    // are visible to StreetLife and Landmarks — prevents exceeding maxCount.
    this.registry = AssetRegistry.getInstance();

    this._clock = 0;
    this.waterUniforms = {
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(0x1a6b7a) },
      uColor2: { value: new THREE.Color(0x2899a8) }
    };
    this.roadLines = [];
    this.sidewalkPoints = [];
    this.activityZones = [];
  }

  getDistrict(gx, gz) {
    if (gz >= GRID - 2) return D.MARINA_BEACH;
    if (gz <= 1) return D.NORTH_INDUSTRIAL;
    if (gx >= GRID - 2) return D.OMR_IT;
    if (gx >= 2 && gx <= 4 && gz >= 3 && gz <= 5) return D.T_NAGAR;
    if (gx === 1 && gz === 2) return D.STATION;
    return D.RESIDENTIAL;
  }

  generate(onP) {
    this._ground(); if (onP) onP(8, 'Laying Tamil Nadu roads…');
    this._roads(); if (onP) onP(16, 'Adding weathered road edges…');
    this._buildNavigationData();
    if (onP) onP(24, 'Building districts…');
    this._buildings(); if (onP) onP(34, 'Placing handcrafted GLB buildings…');
    this._placeGLBBuildings();
    // FIX #2: _placeLandmarks was missing from generate() entirely.
    this._placeLandmarks(); if (onP) onP(38, 'Placing Chennai landmarks…');
    this._props(); if (onP) onP(48, 'Snapping assets to terrain…');
    this._createBoundaryClosures();
    if (onP) onP(50, 'Closing the city with Chennai edges…');
    this._addChennaiInfrastructure();
    if (onP) onP(52, 'City ready');
  }

  update(dt) {
    this._clock += dt;
    this.waterUniforms.uTime.value = this._clock;
  }

  _buildings() {
    // Only GLB assets used — no procedural geometry.
  }

  getTerrainHeight(x, z) {
    const beachZ = HALF - CELL * 2;
    if (z > beachZ) {
      const dist = z - beachZ;
      return Math.max(-0.8, -dist * 0.005);
    }
    return 0;
  }

  clampToWorld(pos, radius = 1) {
    const min = -this.playableHalf + radius;
    const max = this.playableHalf - radius;
    pos.x = THREE.MathUtils.clamp(pos.x, min, max);
    pos.z = THREE.MathUtils.clamp(pos.z, min, max);
    return pos;
  }

  isNearBoundary(x, z, margin = 24) {
    return Math.abs(x) > this.playableHalf - margin || Math.abs(z) > this.playableHalf - margin;
  }

  getNearestIntersectionDistance(x, z) {
    let best = Infinity;
    for (let i = 0; i <= GRID; i++) {
      const p = -HALF + i * CELL;
      best = Math.min(best, Math.abs(x - p), Math.abs(z - p));
    }
    return best;
  }

  getRandomSidewalkPoint(rng = Math.random, near, radius = this.citySize) {
    const source = near
      ? this.sidewalkPoints.filter(p => {
        const dx = p.x - near.x, dz = p.z - near.z;
        return dx * dx + dz * dz < radius * radius;
      })
      : this.sidewalkPoints;
    const list = source.length ? source : this.sidewalkPoints;
    return list[Math.floor(rng() * list.length)]?.clone?.() || new THREE.Vector3(0, 0, 0);
  }

  _ground() {
    const s = this.citySize + 400;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s),
      new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.95 })
    );
    g.rotation.x = -Math.PI / 2; g.position.y = -0.05; g.receiveShadow = true;
    this.scene.add(g);

    // Marina Beach — wet sand
    const sandZ = HALF + 55;
    const wetSand = new THREE.Mesh(
      new THREE.PlaneGeometry(s, 60),
      new THREE.MeshStandardMaterial({ color: 0xc4a886, roughness: 0.4, metalness: 0.1 })
    );
    wetSand.rotation.x = -Math.PI / 2; wetSand.position.set(0, -0.2, sandZ + 50);
    this.scene.add(wetSand);

    // Dry sand
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(s, 140),
      new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.95 })
    );
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.0, sandZ - 30);
    sand.receiveShadow = true; this.scene.add(sand);

    // Animated ocean water
    const waterVert = `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 pos = position;
        pos.z += sin(pos.x * 0.05 + uTime * 1.5) * 0.8;
        pos.z += cos(pos.y * 0.1 + uTime * 1.0) * 0.5;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;
    const waterFrag = `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      varying vec2 vUv;
      void main() {
        float mixVal = sin(vUv.x * 20.0 + uTime) * 0.5 + 0.5;
        vec3 color = mix(uColor1, uColor2, mixVal);
        gl_FragColor = vec4(color, 0.85);
      }
    `;
    const waterMat = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: waterVert,
      fragmentShader: waterFrag,
      transparent: true,
      side: THREE.DoubleSide
    });
    const w = new THREE.Mesh(new THREE.PlaneGeometry(s, 250, 100, 10), waterMat);
    w.rotation.x = -Math.PI / 2; w.position.set(0, -0.4, HALF + 170);
    this.scene.add(w);
  }

  _roads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3835, roughness: 0.95, metalness: 0.02 });
    const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x6f604e, roughness: 1.0 });
    const swMat = new THREE.MeshStandardMaterial({ color: 0x7e7669, roughness: 0.92 });

    for (let i = 0; i <= GRID; i++) {
      const pos = -HALF + i * CELL;
      const isBeachRoad = (i === GRID - 2);

      const h = new THREE.Mesh(new THREE.PlaneGeometry(this.citySize, ROAD_W), roadMat);
      h.rotation.x = -Math.PI / 2; h.position.set(0, 0.01, pos);
      h.receiveShadow = true; this.scene.add(h);

      const v = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, this.citySize), roadMat);
      v.rotation.x = -Math.PI / 2; v.position.set(pos, 0.01, 0);
      v.receiveShadow = true; this.scene.add(v);

      // Dash lines
      for (let d = 0; d < this.citySize; d += 6) {
        if (d % 12 >= 6) continue;
        const lh = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.2),
          new THREE.MeshStandardMaterial({ color: 0xffffff }));
        lh.rotation.x = -Math.PI / 2; lh.position.set(-HALF + d, 0.02, pos);
        this.scene.add(lh);

        const lv = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3),
          new THREE.MeshStandardMaterial({ color: 0xffffff }));
        lv.rotation.x = -Math.PI / 2; lv.position.set(pos, 0.02, -HALF + d);
        this.scene.add(lv);
      }

      // Yellow medians on major roads
      if (i % 3 === 0 || isBeachRoad) {
        const dh = new THREE.Mesh(
          new THREE.BoxGeometry(this.citySize, 0.5, 0.6),
          new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.6 })
        );
        dh.position.set(0, 0.25, pos); this.scene.add(dh);

        const dv = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.5, this.citySize),
          new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.6 })
        );
        dv.position.set(pos, 0.25, 0); this.scene.add(dv);
      }

      // Sidewalks
      for (const side of [-1, 1]) {
        const edgeH = new THREE.Mesh(new THREE.PlaneGeometry(this.citySize, 2.1), shoulderMat);
        edgeH.rotation.x = -Math.PI / 2;
        edgeH.position.set(0, 0.012, pos + side * (ROAD_W / 2 + 1.05));
        edgeH.receiveShadow = true; this.scene.add(edgeH);

        const edgeV = new THREE.Mesh(new THREE.PlaneGeometry(2.1, this.citySize), shoulderMat);
        edgeV.rotation.x = -Math.PI / 2;
        edgeV.position.set(pos + side * (ROAD_W / 2 + 1.05), 0.012, 0);
        edgeV.receiveShadow = true; this.scene.add(edgeV);

        const sh = new THREE.Mesh(new THREE.BoxGeometry(this.citySize, 0.25, 3.5), swMat);
        sh.position.set(0, 0.125, pos + side * (ROAD_W / 2 + 2.8));
        sh.receiveShadow = true; this.scene.add(sh);

        const sv = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, this.citySize), swMat);
        sv.position.set(pos + side * (ROAD_W / 2 + 2.8), 0.125, 0);
        sv.receiveShadow = true; this.scene.add(sv);
      }
    }
    this._tamilNaduRoadWear();
  }

  _buildNavigationData() {
    this.roadLines = [];
    this.sidewalkPoints = [];
    this.activityZones = [
      { type: 'tea', x: -HALF + 100, z: 50, radius: 18 },
      { type: 'tea', x: 30, z: -HALF + 120, radius: 18 },
      { type: 'bus_stop', x: -HALF + CELL * 2 + 8, z: -HALF + CELL * 4, radius: 16 },
      { type: 'market', x: -CELL, z: CELL, radius: 38 },
      { type: 'beach', x: 0, z: HALF - 38, radius: 80 },
      { type: 'station', x: -HALF + CELL * 1.5, z: -HALF + CELL * 2.5, radius: 45 },
    ];

    for (let i = 0; i <= GRID; i++) {
      const p = -HALF + i * CELL;
      this.roadLines.push({ axis: 'z', x: p, min: -this.playableHalf, max: this.playableHalf });
      this.roadLines.push({ axis: 'x', z: p, min: -this.playableHalf, max: this.playableHalf });
      for (let t = -HALF + 18; t <= HALF - 18; t += 18) {
        for (const side of [-1, 1]) {
          this.sidewalkPoints.push(new THREE.Vector3(p + side * (ROAD_W / 2 + 4.6), 0, t));
          this.sidewalkPoints.push(new THREE.Vector3(t, 0, p + side * (ROAD_W / 2 + 4.6)));
        }
      }
    }
  }

  _tamilNaduRoadWear() {
    const rng = this._rng(31);
    const patchMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.98 });
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0x9b7f5c, roughness: 1, transparent: true, opacity: 0.6
    });

    for (let i = 0; i < 150; i++) {
      const onVertical = rng() > 0.5;
      const roadIdx = Math.floor(rng() * (GRID + 1));
      const roadPos = -HALF + roadIdx * CELL;
      const along = -HALF + rng() * this.citySize;
      const x = onVertical ? roadPos + (rng() - 0.5) * ROAD_W * 0.6 : along;
      const z = onVertical ? along : roadPos + (rng() - 0.5) * ROAD_W * 0.6;

      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8 + rng() * 5, 0.8 + rng() * 2.2), patchMat
      );
      patch.rotation.x = -Math.PI / 2; patch.rotation.z = rng() * Math.PI;
      patch.position.set(x, 0.025, z);
      this.scene.add(patch);
    }

    for (let i = 0; i < 60; i++) {
      const x = -HALF + rng() * this.citySize;
      const z = -HALF + rng() * this.citySize;
      if (this.isRoad(x, z)) continue;
      const dust = new THREE.Mesh(new THREE.CircleGeometry(3 + rng() * 8, 12), dustMat);
      dust.rotation.x = -Math.PI / 2; dust.position.set(x, 0.02, z);
      this.scene.add(dust);
    }
  }

  isRoad(px, pz) {
    const hw = ROAD_W / 2 + 4.5;
    for (let i = 0; i <= GRID; i++) {
      const pos = -HALF + i * CELL;
      if (Math.abs(px - pos) < hw) return true;
      if (Math.abs(pz - pos) < hw) return true;
    }
    return false;
  }

  // ── Landmarks ──────────────────────────────────────────────
  _placeLandmarks() {
    const rng = this._rng(42);
    const reg = this.registry;

    const landmarkPlacements = [
      { key: 'chennai_central', x: -HALF + CELL * 1.5, z: -HALF + CELL * 2.5, rot: 0, district: D.STATION },
      { key: 'srm_tech_park', x: HALF - CELL * 1.5, z: 0, rot: -Math.PI / 2, district: D.OMR_IT },
      { key: 'south_indian_temple', x: -CELL, z: CELL * 2, rot: Math.PI, district: D.T_NAGAR },
      { key: 'churchs', x: CELL * 2, z: -CELL * 2, rot: Math.PI / 2, district: D.RESIDENTIAL },
      { key: 'old_temple', x: -CELL * 2.5, z: -CELL * 1.5, rot: 0, district: D.NORTH_INDUSTRIAL },
    ];

    for (const lm of landmarkPlacements) {
      if (reg.canPlace('landmarks', lm.key)) {
        this._placeBuildingAsset(
          reg,
          { key: lm.key, footprint: 60, height: 40 },
          lm.x, lm.z, lm.rot, rng, true
        );
        this.landmarksPlaced.add(lm.key);
      }
    }
  }

  // ── GLB Buildings ──────────────────────────────────────────
  _placeGLBBuildings() {
    const rng = this._rng(200);
    const reg = this.registry;

    const districts = {
      [D.T_NAGAR]: [
        { key: 'store_one', footprint: 18, height: 14 },
        { key: 'indian_shop', footprint: 12, height: 6 },
        { key: 'phone_booth_coffee', footprint: 8, height: 5 },
        { key: 'india_street', footprint: 20, height: 12 },
      ],
      [D.RESIDENTIAL]: [
        { key: 'indian_house_old', footprint: 16, height: 8.5 },
        { key: 'kirana_shop', footprint: 10, height: 5.5 },
        { key: 'phone_booth_coffee', footprint: 9, height: 5 },
      ],
      [D.NORTH_INDUSTRIAL]: [
        { key: 'environment_block', footprint: 24, height: 16 },
        { key: 'store_one', footprint: 20, height: 14 },
        { key: 'india_street', footprint: 22, height: 12 },
      ],
      [D.OMR_IT]: [
        { key: 'environment_block', footprint: 31, height: 28 },
        { key: 'store_one', footprint: 24, height: 18 },
      ],
      [D.STATION]: [
        { key: 'indian_shop', footprint: 14, height: 7 },
        { key: 'kirana_shop', footprint: 10, height: 5.5 },
      ],
    };

    for (let gz = 0; gz < GRID; gz++) {
      for (let gx = 0; gx < GRID; gx++) {
        const dist = this.getDistrict(gx, gz);
        if (dist === D.MARINA_BEACH) continue;

        const seq = districts[dist] || districts[D.RESIDENTIAL];
        const cx = -HALF + CELL / 2 + gx * CELL;
        const cz = -HALF + CELL / 2 + gz * CELL;

        const margin = ROAD_W / 2 + 4.5;
        const blockInner = BLOCK - margin * 1.2;
        const qSize = blockInner / 2;

        const positions = [
          { dx: -qSize / 2, dz: -qSize / 2, rot: Math.PI },
          { dx: qSize / 2, dz: -qSize / 2, rot: -Math.PI / 2 },
          { dx: -qSize / 2, dz: qSize / 2, rot: Math.PI / 2 },
          { dx: qSize / 2, dz: qSize / 2, rot: 0 },
        ];

        for (const pos of positions) {
          if (rng() > 0.94) continue;
          const spec = seq[Math.floor(rng() * seq.length)];
          this._placeBuildingAsset(
            reg, spec, cx + pos.dx, cz + pos.dz, pos.rot, rng, false
          );
        }
      }
    }
  }

  _placeBuildingAsset(reg, spec, px, pz, rot, rng, isLandmark) {
    const catalogSection = isLandmark ? 'landmarks' : 'buildings';

    if (!isLandmark && !reg.canPlace(catalogSection, spec.key)) return;

    const margin = isLandmark ? 5 : 2;
    if (this.isInsideBuilding(px, pz, spec.footprint, spec.footprint, margin)) return;
    if (this.isRoad(px, pz)) return;

    if (!isLandmark) reg.recordPlacement(catalogSection, spec.key);

    const pendingId = `${spec.key}:${px}:${pz}`;
    this.buildings.push({
      pendingId, x: px, z: pz,
      w: spec.footprint, d: spec.footprint, h: spec.height,
      noDecor: false
    });

    reg.loadAsset(catalogSection, spec.key, model => {
      const groundY = this.getTerrainHeight(px, pz);

      // FIX #4: fitModel centers the model at origin. After that we use
      // model.position.set() for the world position — never += which would
      // double-accumulate the centering offset and shift everything off-grid.
      AssetRegistry.fitModel(model, {
        targetFootprint: spec.footprint,
        targetHeight: spec.height,
        groundY,
      });

      if (!isLandmark) {
        AssetRegistry.applyVariation(
          model,
          this._rng(Math.abs(Math.floor(px * 100 + pz))),
          { rotationRange: 0.05, scaleRange: 0.05 }
        );
      }

      model.rotation.y += rot;

      // Place at world position — set, not +=
      model.position.x = px;
      model.position.z = pz;

      AssetRegistry.snapToGround(model, groundY);
      this.scene.add(model);

      const finalMetrics = AssetRegistry.measure(model);
      const s = finalMetrics.size;
      const record = this.buildings.find(b => b.pendingId === pendingId);
      if (record) {
        Object.assign(record, {
          w: Math.max(s.x, 2),
          d: Math.max(s.z, 2),
          h: Math.max(s.y, 2),
          mesh: model
        });
      }
    });
  }

  // ── Boundary closures ──────────────────────────────────────
  _createBoundaryClosures() {
    const matIndustrial = new THREE.MeshStandardMaterial({ color: 0x4c4a43, roughness: 0.9, metalness: 0.08 });
    const matContainerA = new THREE.MeshStandardMaterial({ color: 0xb8402f, roughness: 0.75, metalness: 0.15 });
    const matContainerB = new THREE.MeshStandardMaterial({ color: 0x2f5f86, roughness: 0.75, metalness: 0.15 });
    const matConcrete = new THREE.MeshStandardMaterial({ color: 0xa89d8b, roughness: 0.95 });
    const matFence = new THREE.MeshStandardMaterial({ color: 0x5f6259, roughness: 0.75, metalness: 0.45 });
    const rng = this._rng(515);

    // North — industrial barrier + containers
    this._addBoundaryWall(0, -this.worldLimit, this.citySize + 90, 10, 8, matIndustrial, 'north industrial barrier');
    for (let i = 0; i < 36; i++) {
      const c = new THREE.Mesh(
        new THREE.BoxGeometry(12, 4 + (i % 3) * 1.7, 5.2),
        i % 2 ? matContainerA : matContainerB
      );
      c.position.set(
        -HALF + rng() * this.citySize,
        c.geometry.parameters.height / 2,
        -HALF - 19 - rng() * 24
      );
      c.rotation.y = (rng() - 0.5) * 0.28;
      c.castShadow = c.receiveShadow = true;
      this.scene.add(c);
    }

    // East — beach fence
    this._addBoundaryWall(0, this.worldLimit, this.citySize + 70, 8, 5.5, matFence, 'east beach fence');
    for (let i = 0; i < 46; i++) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), matFence);
      post.position.set(-HALF + i * (this.citySize / 45), 1.2, HALF + 24);
      this.scene.add(post);
    }

    // South — toll closure
    this._addBoundaryWall(this.worldLimit, 0, 8, this.citySize + 80, 6, matConcrete, 'south toll closure');
    for (let i = 0; i < 5; i++) {
      const booth = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 4), matConcrete);
      booth.position.set(HALF + 8, 1.6, -32 + i * 16);
      booth.castShadow = true;
      this.scene.add(booth);
    }

    // West — rail yard + hills
    this._addBoundaryWall(-this.worldLimit, 0, 8, this.citySize + 88, 7, matIndustrial, 'west rail yard');
    for (let i = 0; i < 18; i++) {
      const hill = new THREE.Mesh(
        new THREE.ConeGeometry(18 + rng() * 16, 22 + rng() * 18, 8),
        new THREE.MeshStandardMaterial({ color: 0x6f6a55, roughness: 1 })
      );
      hill.position.set(
        -HALF - 30 - rng() * 32,
        hill.geometry.parameters.height / 2 - 2,
        -HALF + rng() * this.citySize
      );
      hill.rotation.y = rng() * Math.PI;
      this.scene.add(hill);
    }

    // Fog planes at north/east edges
    const fogMat = new THREE.MeshBasicMaterial({
      color: 0xd8d2bd, transparent: true, opacity: 0.18, depthWrite: false
    });
    for (const z of [-HALF - 36, HALF + 52]) {
      const fog = new THREE.Mesh(new THREE.PlaneGeometry(this.citySize + 120, 55), fogMat);
      fog.position.set(0, 18, z);
      fog.rotation.x = -0.35;
      this.scene.add(fog);
    }
  }

  _addBoundaryWall(x, z, w, d, h, mat, name) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    wall.position.set(x, h / 2, z);
    wall.castShadow = wall.receiveShadow = true;
    wall.userData.boundary = name;
    this.scene.add(wall);
    this.buildings.push({ x, z, w, d, h, noDecor: true, boundary: true });
  }

  // ── Chennai Infrastructure ─────────────────────────────────
  _addChennaiInfrastructure() {
    this._addMetroWorks();
    this._addBeachDetails();
    this._addRoadsideUtilities();
  }

  _addMetroWorks() {
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xb8b2a3, roughness: 0.72 });
    const barricadeMat = new THREE.MeshStandardMaterial({ color: 0xd65a28, roughness: 0.68 });
    const roadX = HALF - CELL * 2;

    for (let z = -HALF + 24; z < HALF - 40; z += 28) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, 12, 10), pillarMat);
      pillar.position.set(roadX, 6, z);
      pillar.castShadow = true;
      this.scene.add(pillar);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(9, 1.1, 3.8), pillarMat);
      cap.position.set(roadX, 12.4, z);
      this.scene.add(cap);

      for (const side of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 0.35), barricadeMat);
        b.position.set(roadX + side * 4.8, 0.55, z + 5.5);
        b.rotation.y = side * 0.08;
        this.scene.add(b);
      }
    }
  }

  _addBeachDetails() {
    const rng = this._rng(901);
    const stallMat = new THREE.MeshStandardMaterial({ color: 0xd98b36, roughness: 0.76 });
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a3822, roughness: 0.85 });

    for (let i = 0; i < 18; i++) {
      const x = -HALF + 28 + i * ((this.citySize - 56) / 17);
      const z = HALF - 38 + (rng() - 0.5) * 16;

      const stall = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.4, 2.4), stallMat);
      stall.position.set(x, 1.2, z);
      stall.rotation.y = (rng() - 0.5) * 0.35;
      stall.castShadow = true;
      this.scene.add(stall);

      const shade = new THREE.Mesh(
        new THREE.ConeGeometry(3.1, 1.1, 4),
        new THREE.MeshStandardMaterial({ color: 0xeac25e, roughness: 0.7 })
      );
      shade.position.set(x, 3, z);
      shade.rotation.y = Math.PI / 4;
      this.scene.add(shade);

      if (i % 2 === 0) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(5, 0.35, 1), benchMat);
        bench.position.set(x + 6, 0.45, z + 10);
        this.scene.add(bench);
      }
    }
  }

  _addRoadsideUtilities() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x45423a, roughness: 0.8, metalness: 0.25 });
    const wireMat = new THREE.LineBasicMaterial({ color: 0x151515 });

    for (let i = 0; i <= GRID; i++) {
      const p = -HALF + i * CELL;
      let prev = null;
      for (let z = -HALF + 25; z <= HALF - 25; z += 38) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7.8, 6), poleMat);
        pole.position.set(p + ROAD_W / 2 + 5.8, 3.9, z);
        this.scene.add(pole);

        const top = new THREE.Vector3(p + ROAD_W / 2 + 5.8, 7.8, z);
        if (prev) {
          this.scene.add(new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([prev, top]),
            wireMat
          ));
        }
        prev = top;
      }
    }
  }

  // ── Props ──────────────────────────────────────────────────
  _props() {
    const rng = this._rng(77);
    this._placeGroundWaterTanks(rng);
    this._placeImportedChennaiProps(rng);
    this._weathering();
  }

  _addGroundWaterTank(x, z, rotationY = 0) {
    if (this.isRoad(x, z) || this.isInsideBuilding(x, z, 7, 7, 1)) return;
    this.buildings.push({ x, z, w: 7.0, d: 7.0, h: 5.5, mesh: null, noDecor: true });

    this._loadGLB('/models/props/chennai_water_tank.glb', model => {
      const groundY = this.getTerrainHeight(x, z);

      // FIX #1: was this._fitModel (doesn't exist on City). Use the static method.
      // FIX #4: use model.position.set() not += after fitModel centers to origin.
      AssetRegistry.fitModel(model, { targetFootprint: 7.0, targetHeight: 5.5, groundY });
      model.rotation.y += rotationY;
      model.position.x = x;
      model.position.z = z;
      AssetRegistry.snapToGround(model, groundY);
      this.scene.add(model);
    });
  }

  _placeGroundWaterTanks(rng) {
    const placements = [
      [-67.5 - 9.5, -67.5 - 9.5, 0.2],
      [22.5 + 9.5, -22.5 - 9.5, -0.5],
      [-22.5 + 9.5, 67.5 + 9.5, 0.8],
      [67.5 - 9.5, 22.5 + 9.5, -1.1],
    ];
    for (const [x, z, rot] of placements) {
      this._addGroundWaterTank(x, z, rot);
    }
  }

  _placeImportedChennaiProps(rng) {
    const placements = [
      { url: '/models/props/junction_box_shrine.glb', x: -22.5 - 8.5, z: -67.5 + 8.5, width: 2.5, rot: 0.2, collider: [2.5, 2.5] },
      { url: '/models/props/junction_box_shrine.glb', x: 67.5 + 8.5, z: 67.5 - 8.5, width: 2.5, rot: -1.1, collider: [2.5, 2.5] },
      { url: '/models/props/flower_vendor.glb', x: -67.5 + 8.5, z: 22.5 + 8.5, width: 6, rot: Math.PI * 0.7, collider: [6, 4] },
      { url: '/models/props/flower_vendor.glb', x: 22.5 - 8.5, z: -67.5 - 8.5, width: 6, rot: -0.4, collider: [6, 4] },
      { url: '/models/props/clothes_line.glb', x: 22.5 + 10, z: 22.5 - 10, width: 10, rot: Math.PI / 2, collider: [10, 3] },
    ];

    for (const p of placements) {
      if (this.isRoad(p.x, p.z) || this.isInsideBuilding(p.x, p.z, p.width, p.width, 1)) continue;
      this._addImportedProp(p.url, p.x, p.z, p.width, p.rot);
      const [w, d] = p.collider;
      this.buildings.push({ x: p.x, z: p.z, w, d, h: 4, mesh: null, noDecor: true });
    }
  }

  _addImportedProp(url, x, z, targetFootprint, rotationY = 0, targetHeight) {
    this._loadGLB(url, model => {
      const groundY = this.getTerrainHeight(x, z);

      // FIX #4: same position fix — set, not +=
      AssetRegistry.fitModel(model, { targetFootprint, targetHeight, groundY });
      model.rotation.y += rotationY;
      model.position.x = x;
      model.position.z = z;
      AssetRegistry.snapToGround(model, groundY);
      this.scene.add(model);
    });
  }

  _loadGLB(url, onLoad) {
    const prepare = source => {
      const model = source.clone(true);
      const fallbackColor = fallbackColorFor(url);
      model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (!obj.material) return;
        const materials = (Array.isArray(obj.material) ? obj.material : [obj.material])
          .map(mat => mat.clone());
        for (const mat of materials) {
          this._normalizeImportedMaterial(mat, fallbackColor);
          mat.needsUpdate = true;
        }
        obj.material = Array.isArray(obj.material) ? materials : materials[0];
      });
      onLoad(model);
    };

    if (gltfCache.has(url)) {
      prepare(gltfCache.get(url));
      return;
    }
    gltfLoader.load(url, gltf => {
      gltfCache.set(url, gltf.scene);
      prepare(gltf.scene);
    }, undefined, err => console.warn(`City._loadGLB failed: ${url}`, err));
  }

  _normalizeImportedMaterial(mat, fallbackColor) {
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissive) mat.emissive.setHex(0x000000);
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
    if ('envMapIntensity' in mat) mat.envMapIntensity = 0.25;
    if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
    if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.8, 0.85);
    mat.toneMapped = true;

    if (mat.color && !mat.map) {
      const whiteish = mat.color.r > 0.82 && mat.color.g > 0.82 && mat.color.b > 0.82;
      if (whiteish) mat.color.setHex(fallbackColor);
      else mat.color.multiplyScalar(0.75);
    }
  }

  // ── Weathering (speed bumps) ───────────────────────────────
  _weathering() {
    const rng = this._rng(13);
    const bumpMat = new THREE.MeshStandardMaterial({ color: 0xdddd00, roughness: 0.6 });

    for (let i = 0; i < 20; i++) {
      const rx = (rng() - 0.5) * this.citySize * 0.6;
      const rz = (rng() - 0.5) * this.citySize * 0.6;
      if (!this.isRoad(rx, rz)) continue;

      const bump = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W * 0.8, 0.15, 0.8), bumpMat);
      bump.position.set(rx, 0.075, rz);
      this.scene.add(bump);

      for (let s = -3; s <= 3; s++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.16, 0.6),
          new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 })
        );
        stripe.position.set(rx + s * 1.2, 0.08, rz);
        this.scene.add(stripe);
      }
    }
  }

  // ── Collision helpers ──────────────────────────────────────
  isInsideBuilding(px, pz, width, depth, margin = 1) {
    const hw = width / 2 + margin;
    const hd = depth / 2 + margin;
    for (const b of this.buildings) {
      const bhw = b.w / 2 + margin;
      const bhd = b.d / 2 + margin;
      if (Math.abs(px - b.x) < hw + bhw && Math.abs(pz - b.z) < hd + bhd) {
        return true;
      }
    }
    return false;
  }

  // ── Utilities ──────────────────────────────────────────────
  _pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  _rng(seed) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
}