import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ═══════════════════════════════════════════════════════════════════
   Chennai Vehicle System — Strict GLB Traffic Mode
   Runtime traffic only spawns imported vehicle assets from public/models/vehicles.
   ═══════════════════════════════════════════════════════════════════ */

// ─── Shared Material Library ──────────────────────────────────────
const MAT = {
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0x88aacc, roughness: 0.05, metalness: 0.0, transmission: 0.7, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.05, metalness: 1.0 }),
  tire: () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 }),
  rim: () => new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.12, metalness: 0.95 }),
  black: () => new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.7, metalness: 0.1 }),
  darkPlastic: () => new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.85, metalness: 0.0 }),
  headlight: () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2 }),
  taillight: () => new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.1 }),
  turnSignal: () => new THREE.MeshStandardMaterial({ color: 0xff8800, emissive: 0xff5500, emissiveIntensity: 0.4, roughness: 0.2 }),
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9, metalness: 0.0 }),
  paint: (color, metallic = 0.6) => new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: metallic, envMapIntensity: 1.2 }),
  mattePaint: (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15 }),
  interior: (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05 }),
  wood: () => new THREE.MeshStandardMaterial({ color: 0x8B6347, roughness: 0.85, metalness: 0.0 }),
  indicator: (on) => new THREE.MeshStandardMaterial({ color: on ? 0xffaa00 : 0xff4400, emissive: on ? 0xff8800 : 0x330000, emissiveIntensity: on ? 1.2 : 0.1 }),
};

// ─── Rounded Box Helper (simulates body panels) ──────────────────
function roundedBox(w, h, d, r, segs = 4) {
  // Build a box with chamfered edges using shape extrusion
  const shape = new THREE.Shape();
  const hw = w / 2, hh = h / 2;
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.5, bevelSegments: segs });
  geo.center();
  return geo;
}

// ─── Realistic Wheel Assembly ─────────────────────────────────────
function buildWheel(radius, width, rimColor = 0xc0c0c0) {
  const group = new THREE.Group();

  // Tire (toroidal profile via lathe)
  const tirePts = [];
  const inner = radius * 0.72, outer = radius;
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 2;
    const cr = (outer - inner) * 0.5, cx = (inner + outer) * 0.5;
    tirePts.push(new THREE.Vector2(cx + Math.cos(t) * cr, Math.sin(t) * width * 0.5));
  }
  const tireGeo = new THREE.LatheGeometry(tirePts.map(p => new THREE.Vector2(Math.abs(p.x), p.y)), 28);
  const tire = new THREE.Mesh(tireGeo, MAT.tire());
  tire.castShadow = true;
  group.add(tire);

  // Rim face
  const rimGeo = new THREE.CylinderGeometry(inner * 0.98, inner * 0.98, width * 0.15, 24);
  const rim = new THREE.Mesh(rimGeo, new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.1, metalness: 0.95 }));
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  // Spokes (5-spoke alloy design)
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(inner * 0.14, inner * 0.78, width * 0.12),
      new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.08, metalness: 0.98 })
    );
    spoke.rotation.z = angle;
    spoke.position.set(Math.cos(angle) * inner * 0.35, Math.sin(angle) * inner * 0.35, 0);
    spoke.rotation.x = Math.PI / 2;
    // Redo rotation properly
    const sg = new THREE.Group();
    sg.rotation.z = angle;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(inner * 0.11, inner * 0.75, width * 0.1),
      new THREE.MeshStandardMaterial({ color: rimColor, roughness: 0.08, metalness: 0.98 })
    );
    bar.position.y = inner * 0.36;
    bar.castShadow = true;
    sg.add(bar);
    sg.rotation.x = Math.PI / 2;
    group.add(sg);
  }

  // Center hub
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(inner * 0.12, inner * 0.12, width * 0.2, 12),
    new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.05, metalness: 1.0 })
  );
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  // Brake disc visible behind rim
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(inner * 0.85, inner * 0.85, width * 0.04, 20),
    new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.4, metalness: 0.8 })
  );
  disc.rotation.x = Math.PI / 2;
  disc.position.z = width * 0.06;
  group.add(disc);

  group.userData.isWheel = true;
  return group;
}

// ─── Seat Helper ──────────────────────────────────────────────────
function buildSeat(w, d, h, color = 0x2a2a2a) {
  const g = new THREE.Group();
  // Seat base
  const base = new THREE.Mesh(roundedBox(w, h * 0.35, d, 0.04, 3),
    MAT.interior(color));
  base.position.y = h * 0.175;
  g.add(base);
  // Seat back
  const back = new THREE.Mesh(roundedBox(w, h * 0.75, 0.08, 0.04, 3),
    MAT.interior(color));
  back.position.set(0, h * 0.5, -d * 0.45);
  back.rotation.x = 0.12;
  g.add(back);
  // Headrest
  const hr = new THREE.Mesh(roundedBox(w * 0.55, h * 0.22, 0.09, 0.04, 3),
    MAT.interior(color));
  hr.position.set(0, h * 0.97, -d * 0.42);
  hr.rotation.x = 0.1;
  g.add(hr);
  return g;
}

// ─── VEHICLE TYPES ────────────────────────────────────────────────
const TYPES = {
  auto: { name: 'Auto Rickshaw', w: 1.4, h: 1.5, l: 2.5, wheelR: 0.28, maxSpeed: 28, accel: 18, brake: 25, steer: 3.2, colors: [0xDDAA00, 0xD4A000, 0xCCA200] },
  sedan: { name: 'Sedan', w: 1.8, h: 1.3, l: 4.4, wheelR: 0.33, maxSpeed: 50, accel: 22, brake: 32, steer: 2.2, colors: [0xcccccc, 0x888888, 0x444444, 0xaa2222, 0x2244aa, 0x224422] },
  bike: { name: 'KTM Duke', w: 0.7, h: 1.1, l: 2.1, wheelR: 0.32, maxSpeed: 65, accel: 32, brake: 35, steer: 3.0, colors: [0xDD6600, 0xff6600, 0x111111, 0xcc5500] },
  bus: { name: 'SETC Bus', w: 2.8, h: 3.4, l: 10.5, wheelR: 0.52, maxSpeed: 32, accel: 8, brake: 20, steer: 1.2, colors: [0xcc2222] },
  tnstc_bus: { name: 'TNSTC Bus', w: 2.6, h: 3.2, l: 9.8, wheelR: 0.50, maxSpeed: 30, accel: 7, brake: 18, steer: 1.2, colors: [0x2255aa] },
  balaji_bus: { name: 'Balaji Bus', w: 2.4, h: 3.0, l: 8.5, wheelR: 0.48, maxSpeed: 35, accel: 9, brake: 20, steer: 1.3, colors: [0xdd6600] },
  lorry: { name: 'TN Lorry', w: 2.6, h: 3.6, l: 9.2, wheelR: 0.52, maxSpeed: 28, accel: 7, brake: 18, steer: 1.0, colors: [0x2266aa, 0xcc3333, 0x33aa44, 0xdd8800] },
  ashok_truck: { name: 'Ashok Leyland', w: 2.8, h: 3.8, l: 10.0, wheelR: 0.55, maxSpeed: 25, accel: 6, brake: 16, steer: 0.9, colors: [0x335577] },
  maruti: { name: 'Maruti 800', w: 1.5, h: 1.3, l: 3.4, wheelR: 0.28, maxSpeed: 42, accel: 16, brake: 28, steer: 2.8, colors: [0xcccccc, 0x884422, 0x446688, 0xffffff] },
  maruti_ac: { name: 'Maruti 800 AC', w: 1.55, h: 1.35, l: 3.45, wheelR: 0.28, maxSpeed: 42, accel: 16, brake: 28, steer: 2.8, colors: [0xeeeeee, 0x446688, 0x884422] },
  hundai: { name: 'Hyundai Car', w: 1.85, h: 1.45, l: 4.25, wheelR: 0.32, maxSpeed: 46, accel: 18, brake: 30, steer: 2.4, colors: [0xffffff, 0x333333, 0x2266aa] },
  motorcycle: { name: 'Motorcycle', w: 0.85, h: 1.45, l: 2.45, wheelR: 0.34, maxSpeed: 58, accel: 28, brake: 32, steer: 3.2, colors: [0xcc2222] },
  tuk_tuk: { name: 'Tuk Tuk', w: 1.7, h: 2.05, l: 3.45, wheelR: 0.30, maxSpeed: 30, accel: 20, brake: 26, steer: 3.5, colors: [0xDDAA00, 0x33aa44] },
  suv: { name: 'SUV', w: 2.0, h: 1.75, l: 4.9, wheelR: 0.42, maxSpeed: 48, accel: 20, brake: 30, steer: 1.9, colors: [0x222222, 0xffffff, 0x444444, 0x993322] },
  police: { name: 'Police Car', w: 1.9, h: 1.35, l: 4.6, wheelR: 0.35, maxSpeed: 55, accel: 28, brake: 35, steer: 2.1, colors: [0xeeeeee] },
  mtb: { name: 'Mountain Bike', w: 0.5, h: 1.1, l: 1.9, wheelR: 0.36, maxSpeed: 22, accel: 14, brake: 38, steer: 4.0, colors: [0x22aa22, 0xaa2222, 0x2222aa, 0xff8800] },
};

const IMPORTED_VEHICLE_MODELS = {
  bus: '/models/vehicles/tamilnadu_setc_bus_2017-2026.glb',
  lorry: '/models/vehicles/tamilnadu_lorry.glb',
  tnstc_bus: '/models/vehicles/tamilnadu_tnstc_bus.glb',
  balaji_bus: '/models/vehicles/balaji_bus.glb',
  ashok_truck: '/models/vehicles/ashok_leyland_truck.glb',
  maruti: '/models/vehicles/maruti_800.glb',
  maruti_ac: '/models/vehicles/maruti_800_ac.glb',
  hundai: '/models/vehicles/hundai car.glb',
  motorcycle: '/models/vehicles/red_motorcycle.glb',
  tuk_tuk: '/models/vehicles/tuk_tuk_rikshaw.glb',
};

const vehicleModelLoader = new GLTFLoader();
const vehicleModelCache = new Map();
const vehicleModelPending = new Map();

// ═══════════════════════════════════════════════════════════════════
class Vehicle {
  constructor(scene, typeName, position) {
    const type = TYPES[typeName] || TYPES.sedan;
    this.type = type; this.typeName = typeName; this.scene = scene;
    this.speed = 0; this.steerAngle = 0; this.occupied = false;
    this.isPolice = typeName === 'police'; this.sirenTime = 0;
    this.mesh = new THREE.Group();
    this.aiDriving = false; this.aiSpeed = 0; this.aiDir = 0; this.aiStopTimer = 0;
    this._wheelGroups = [];
    this.importedOnly = Boolean(IMPORTED_VEHICLE_MODELS[typeName]);

    const color = type.colors[Math.floor(Math.random() * type.colors.length)];

    if (!this.importedOnly) {
      console.warn(`Vehicle type "${typeName}" has no GLB asset and was skipped by strict asset-only mode.`);
    } else {
      this.userColor = color;
    }

    if (false) {
      switch (typeName) {
        case 'auto': this._buildAuto(color); break;
        case 'bike': this._buildBike(color); break;
        case 'mtb': this._buildMTB(color); break;
        case 'bus': this._buildBus(color); break;
        case 'lorry': this._buildLorry(color); break;
        case 'police': this._buildPolice(color); break;
        case 'suv': this._buildSUV(color); break;
        default: this._buildSedan(color); break;
      }
    }

    this.mesh.position.copy(position);
    this.mesh.position.y = 0;
    scene.add(this.mesh);
    this._loadImportedBody();
  }

  // ── Wheel placement ───────────────────────────────────────────
  _placeWheel(x, z, radius, width, rimColor) {
    const w = buildWheel(radius, width, rimColor);
    w.position.set(x, 0, z);
    w.rotation.z = Math.PI / 2;
    w.castShadow = true;
    this.mesh.add(w);
    this._wheelGroups.push(w);
    return w;
  }

  // ── Mesh helpers ──────────────────────────────────────────────
  _box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    this.mesh.add(m);
    return m;
  }

  _rbox(w, h, d, r, mat, x, y, z) {
    const m = new THREE.Mesh(roundedBox(w, h, d, r), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    this.mesh.add(m);
    return m;
  }

  _cyl(rt, rb, h, segs, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    this.mesh.add(m);
    return m;
  }

  _loadImportedBody() {
    const url = IMPORTED_VEHICLE_MODELS[this.typeName];
    if (!url) return;

    const attachModel = source => {
      const model = source.clone(true);
      this._fitImportedBody(model);
      model.userData.importedVehicleBody = true;
      this.mesh.add(model);

      for (const child of this.mesh.children) {
        if (child === model) continue;
        child.visible = false;
      }
    };

    if (vehicleModelCache.has(url)) {
      attachModel(vehicleModelCache.get(url));
      return;
    }

    if (vehicleModelPending.has(url)) {
      vehicleModelPending.get(url).push(attachModel);
      return;
    }

    vehicleModelPending.set(url, [attachModel]);

    vehicleModelLoader.load(
      url,
      gltf => {
        const source = gltf.scene;
        source.traverse(obj => {
          if (!obj.isMesh) return;
          obj.castShadow = true;
          obj.receiveShadow = true;
          if (!obj.material) return;
          const materials = (Array.isArray(obj.material) ? obj.material : [obj.material]).map(mat => mat.clone());
          for (const mat of materials) {
            this._normalizeImportedMaterial(mat);
            mat.needsUpdate = true;
          }
          obj.material = Array.isArray(obj.material) ? materials : materials[0];
        });
        vehicleModelCache.set(url, source);
        const waiting = vehicleModelPending.get(url) || [];
        vehicleModelPending.delete(url);
        for (const attach of waiting) attach(source);
      },
      undefined,
      err => {
        vehicleModelPending.delete(url);
        console.warn(`Imported ${this.typeName} GLB failed to load. No procedural fallback is allowed in strict asset-only mode.`, err);
      }
    );
  }

  _normalizeImportedMaterial(mat) {
    if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
    if (mat.emissive) mat.emissive.setHex(0x000000);
    if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
    if ('envMapIntensity' in mat) mat.envMapIntensity = 0.65;
    if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.75, 0.65);
    if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.35);
    mat.toneMapped = true;

    if (mat.color && !mat.map && mat.color.r > 0.86 && mat.color.g > 0.86 && mat.color.b > 0.86) {
      mat.color.setHex(this.userColor || (this.typeName === 'bus' ? 0xcc3430 : 0x3f6f8a));
    }
  }

  _fitImportedBody(model) {
    const t = this.type;
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());

    if (size.x > size.z) {
      model.rotation.y = Math.PI / 2;
      model.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(model);
      size = box.getSize(new THREE.Vector3());
    }

    const scale = Math.min(
      (t.w * 1.05) / Math.max(size.x, 0.001),
      (t.h * 1.05) / Math.max(size.y, 0.001),
      (t.l * 1.05) / Math.max(size.z, 0.001)
    );
    model.scale.multiplyScalar(scale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= box.min.y;
    model.position.z -= center.z;

    // FIX: Imported models face +Z, but the vehicle engine logic drives them forward towards -Z.
    // By default they were driving backward, so we rotate them 180 degrees here.
    model.rotation.y += Math.PI;
  }

  // ── SEDAN / CAR body ──────────────────────────────────────────
  _buildSedan(color) {
    const t = this.type;
    const paint = MAT.paint(color);
    const W = t.w, H = t.h, L = t.l;

    // Main lower body — shaped like a real car lower section
    this._rbox(W, H * 0.45, L, 0.06, paint, 0, H * 0.22, 0);

    // Hood — slightly angled
    const hoodShape = new THREE.Shape();
    hoodShape.moveTo(-W / 2, 0);
    hoodShape.lineTo(W / 2, 0);
    hoodShape.lineTo(W / 2 - 0.05, 0.06);
    hoodShape.lineTo(-W / 2 + 0.05, 0.06);
    const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, { depth: L * 0.36, bevelEnabled: false });
    const hood = new THREE.Mesh(hoodGeo, paint);
    hood.position.set(-W / 2, H * 0.44, L * 0.5);
    hood.rotation.set(-0.08, 0, 0);
    hood.castShadow = true;
    this.mesh.add(hood);

    // Cabin — tapered on both ends using a trapezoid extrude
    const cabShape = new THREE.Shape();
    const cw = W * 0.9, cw2 = W * 0.72;
    cabShape.moveTo(-cw / 2, 0);
    cabShape.lineTo(cw / 2, 0);
    cabShape.lineTo(cw2 / 2, H * 0.48);
    cabShape.lineTo(-cw2 / 2, H * 0.48);
    const cabGeo = new THREE.ExtrudeGeometry(cabShape, {
      depth: L * 0.44,
      bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3
    });
    const cabin = new THREE.Mesh(cabGeo, MAT.paint(color, 0.5));
    cabin.position.set(-cw / 2, H * 0.43, -L * 0.22 + L * 0.44);
    cabin.rotation.y = Math.PI;
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // Windshield front
    this._rbox(W * 0.82, H * 0.35, 0.05, 0.03, MAT.glass(), 0, H * 0.63, -L * 0.12);
    // Windshield rear
    this._rbox(W * 0.82, H * 0.31, 0.05, 0.03, MAT.glass(), 0, H * 0.63, L * 0.15);
    // Side windows
    for (const sx of [-1, 1]) {
      this._rbox(0.04, H * 0.27, L * 0.2, 0.02, MAT.glass(), sx * W * 0.46, H * 0.63, -L * 0.08);
      this._rbox(0.04, H * 0.25, L * 0.17, 0.02, MAT.glass(), sx * W * 0.46, H * 0.62, L * 0.1);
    }

    // A-pillars
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, H * 0.43, 8), MAT.paint(color, 0.4));
      pil.position.set(sx * W * 0.42, H * 0.57, -L * 0.22);
      pil.rotation.x = 0.35 * sx * 0 + 0.35; // lean forward
      pil.castShadow = true;
      this.mesh.add(pil);
    }

    // Door panels with subtle crease line
    for (const sx of [-1, 1]) {
      this._rbox(0.06, H * 0.38, L * 0.38, 0.04, paint, sx * W * 0.48, H * 0.22, -L * 0.06);
      // Door handle recess
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.15), MAT.chrome());
      handle.position.set(sx * (W * 0.52), H * 0.25, -L * 0.05);
      this.mesh.add(handle);
    }

    // Trunk
    this._rbox(W, H * 0.08, L * 0.28, 0.04, paint, 0, H * 0.44, L * 0.32);

    // Front bumper — shaped
    this._rbox(W + 0.1, H * 0.13, 0.25, 0.06, MAT.darkPlastic(), 0, H * 0.08, -L * 0.52);
    // Rear bumper
    this._rbox(W + 0.1, H * 0.13, 0.25, 0.06, MAT.darkPlastic(), 0, H * 0.08, L * 0.52);

    // Headlights — multi-part (housing + lens + DRL)
    for (const sx of [-1, 1]) {
      // Housing
      this._rbox(W * 0.24, H * 0.1, 0.08, 0.03, MAT.darkPlastic(), sx * W * 0.33, H * 0.37, -L * 0.51);
      // Lens
      const lens = new THREE.Mesh(new THREE.BoxGeometry(W * 0.22, H * 0.085, 0.04),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.0, metalness: 0.0, transmission: 0.9, transparent: true, opacity: 0.9 }));
      lens.position.set(sx * W * 0.33, H * 0.37, -L * 0.52);
      this.mesh.add(lens);
      // Inner bulb
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), MAT.headlight());
      bulb.position.set(sx * W * 0.33, H * 0.37, -L * 0.49);
      this.mesh.add(bulb);
      // DRL strip
      const drl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.18, 0.025, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7 }));
      drl.position.set(sx * W * 0.33, H * 0.31, -L * 0.52);
      this.mesh.add(drl);

      // Taillights
      this._rbox(W * 0.2, H * 0.09, 0.06, 0.03, MAT.taillight(), sx * W * 0.33, H * 0.34, L * 0.52);
    }

    // Side skirts
    for (const sx of [-1, 1]) {
      this._rbox(0.08, H * 0.09, L * 0.88, 0.03, MAT.darkPlastic(), sx * W * 0.53, H * 0.04, 0);
    }

    // Exhaust pipe
    this._cyl(0.04, 0.035, 0.25, 8, MAT.chrome(), W * 0.25, H * 0.06, L * 0.54, Math.PI / 2);

    // Wiper blades
    for (const sx of [-1, 1]) {
      this._box(0.02, 0.015, L * 0.16, MAT.rubber(), sx * W * 0.2, H * 0.44, -L * 0.16);
    }

    // Grille
    this._rbox(W * 0.62, H * 0.12, 0.06, 0.04, MAT.darkPlastic(), 0, H * 0.33, -L * 0.52);
    // Grille bars
    for (let i = 0; i < 5; i++) {
      this._box(W * 0.62, 0.015, 0.07, MAT.chrome(), 0, H * 0.27 + i * 0.025, -L * 0.525);
    }

    // Roof rails (on sedan = sunroof tint)
    this._box(W * 0.5, 0.015, L * 0.2, MAT.glass(), 0, H * 0.92, -L * 0.04);

    // Side mirror housings
    for (const sx of [-1, 1]) {
      this._rbox(0.06, 0.09, 0.14, 0.02, paint, sx * (W * 0.53), H * 0.56, -L * 0.21);
    }

    // Wheels
    const wr = t.wheelR, ww = 0.22;
    this._placeWheel(-W * 0.54, -L * 0.34, wr, ww, 0xbbbbbb);
    this._placeWheel(W * 0.54, -L * 0.34, wr, ww, 0xbbbbbb);
    this._placeWheel(-W * 0.54, L * 0.34, wr, ww, 0xbbbbbb);
    this._placeWheel(W * 0.54, L * 0.34, wr, ww, 0xbbbbbb);

    // Interior peek
    this._box(W * 0.7, 0.025, L * 0.38, MAT.interior(0x1a1a1a), 0, H * 0.5, -L * 0.05);
    // Dashboard
    this._rbox(W * 0.82, H * 0.1, 0.2, 0.04, MAT.interior(0x151515), 0, H * 0.47, -L * 0.23);
    // Steering wheel
    const swg = new THREE.Group();
    const swRim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 8, 20), MAT.black());
    swRim.rotation.x = 1.1; swRim.castShadow = true; swg.add(swRim);
    swg.position.set(-0.15, H * 0.54, -L * 0.18);
    this.mesh.add(swg);

    // Seats (2 front visible through glass)
    const s1 = buildSeat(0.44, 0.38, 0.52, 0x222222);
    s1.position.set(-W * 0.22, H * 0.32, -L * 0.06);
    this.mesh.add(s1);
    const s2 = buildSeat(0.44, 0.38, 0.52, 0x222222);
    s2.position.set(W * 0.22, H * 0.32, -L * 0.06);
    this.mesh.add(s2);
  }

  // ── SUV ───────────────────────────────────────────────────────
  _buildSUV(color) {
    const t = this.type;
    const paint = MAT.paint(color);
    const W = t.w, H = t.h, L = t.l;

    // Main body — taller, boxier
    this._rbox(W, H * 0.5, L, 0.08, paint, 0, H * 0.25, 0);

    // Upper greenhouse — nearly vertical sides
    const cabShape = new THREE.Shape();
    cabShape.moveTo(-W * 0.88 / 2, 0);
    cabShape.lineTo(W * 0.88 / 2, 0);
    cabShape.lineTo(W * 0.82 / 2, H * 0.5);
    cabShape.lineTo(-W * 0.82 / 2, H * 0.5);
    const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: L * 0.66, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 });
    const cab = new THREE.Mesh(cabGeo, MAT.paint(color, 0.5));
    cab.position.set(-W * 0.44, H * 0.48, L * 0.5 - L * 0.66);
    cab.rotation.y = Math.PI;
    cab.castShadow = true;
    this.mesh.add(cab);

    // Hood sloped
    this._rbox(W, H * 0.07, L * 0.3, 0.05, paint, 0, H * 0.5, -L * 0.34);

    // Windshield (more upright than sedan)
    this._rbox(W * 0.85, H * 0.39, 0.05, 0.04, MAT.glass(), 0, H * 0.75, -L * 0.11);
    this._rbox(W * 0.85, H * 0.36, 0.05, 0.04, MAT.glass(), 0, H * 0.73, L * 0.24);

    for (const sx of [-1, 1]) {
      // Three side windows (front, rear-front, rear)
      this._rbox(0.05, H * 0.3, L * 0.15, 0.03, MAT.glass(), sx * W * 0.46, H * 0.73, -L * 0.13);
      this._rbox(0.05, H * 0.3, L * 0.22, 0.03, MAT.glass(), sx * W * 0.46, H * 0.73, L * 0.06);
      this._rbox(0.05, H * 0.28, L * 0.14, 0.03, MAT.glass(), sx * W * 0.46, H * 0.73, L * 0.25);

      // Running boards (lower step)
      this._rbox(0.12, 0.06, L * 0.72, 0.03, MAT.darkPlastic(), sx * W * 0.57, H * 0.05, 0);

      // Fender flares
      this._rbox(0.15, H * 0.15, 0.6, 0.05, MAT.darkPlastic(), sx * W * 0.56, H * 0.18, -L * 0.34);
      this._rbox(0.15, H * 0.15, 0.6, 0.05, MAT.darkPlastic(), sx * W * 0.56, H * 0.18, L * 0.3);

      // LED headlights (signature strip)
      const drl = new THREE.Mesh(new THREE.BoxGeometry(W * 0.15, 0.03, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }));
      drl.position.set(sx * W * 0.35, H * 0.46, -L * 0.51);
      this.mesh.add(drl);

      this._rbox(W * 0.18, H * 0.09, 0.07, 0.03, MAT.taillight(), sx * W * 0.38, H * 0.38, L * 0.52);
      // Side mirror
      this._rbox(0.08, 0.1, 0.18, 0.03, paint, sx * W * 0.57, H * 0.64, -L * 0.22);
    }

    // Grille — large crossbar style
    this._rbox(W * 0.58, H * 0.14, 0.07, 0.05, MAT.darkPlastic(), 0, H * 0.36, -L * 0.52);
    for (let i = 0; i < 4; i++) {
      this._box(W * 0.57, 0.018, 0.08, MAT.chrome(), 0, H * 0.30 + i * 0.036, -L * 0.525);
    }
    // Front & rear bumpers
    this._rbox(W + 0.2, H * 0.16, 0.3, 0.07, MAT.darkPlastic(), 0, H * 0.08, -L * 0.53);
    this._rbox(W + 0.2, H * 0.16, 0.3, 0.07, MAT.darkPlastic(), 0, H * 0.08, L * 0.53);

    // Roof rack
    for (const rz of [-0.25, 0.25]) {
      this._box(W + 0.1, 0.04, 0.04, MAT.chrome(), 0, H * 1.02, rz);
    }
    this._box(0.04, 0.04, L * 0.55, MAT.chrome(), -W * 0.44, H * 1.02, 0);
    this._box(0.04, 0.04, L * 0.55, MAT.chrome(), W * 0.44, H * 1.02, 0);

    // Spare tire on rear (common on body-on-frame SUVs)
    const spare = buildWheel(t.wheelR * 0.9, 0.2, 0xaaaaaa);
    spare.position.set(0, H * 0.42, L * 0.54);
    spare.rotation.set(0, Math.PI / 2, 0);
    this.mesh.add(spare);

    // Exhaust (dual)
    for (const sx of [-1, 1]) {
      this._cyl(0.045, 0.04, 0.22, 8, MAT.chrome(), sx * W * 0.28, H * 0.07, L * 0.54, Math.PI / 2);
    }

    // Wheels (larger, offroad-ish rims)
    const wr = t.wheelR, ww = 0.27;
    this._placeWheel(-W * 0.56, -L * 0.36, wr, ww, 0x888888);
    this._placeWheel(W * 0.56, -L * 0.36, wr, ww, 0x888888);
    this._placeWheel(-W * 0.56, L * 0.36, wr, ww, 0x888888);
    this._placeWheel(W * 0.56, L * 0.36, wr, ww, 0x888888);
  }

  // ── AUTO RICKSHAW ─────────────────────────────────────────────
  _buildAuto(color) {
    const t = this.type;
    const paint = MAT.paint(color, 0.35);
    const W = t.w, H = t.h, L = t.l;

    // Main body (rear passenger cab)
    this._rbox(W, H * 0.65, L * 0.62, 0.07, paint, 0, H * 0.37, L * 0.08);

    // Roof — slightly domed
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-W * 0.55, 0);
    roofShape.lineTo(W * 0.55, 0);
    roofShape.quadraticCurveTo(W * 0.52, 0.12, W * 0.48, 0.12);
    roofShape.lineTo(-W * 0.48, 0.12);
    roofShape.quadraticCurveTo(-W * 0.52, 0.12, -W * 0.55, 0);
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: L * 0.6, bevelEnabled: false });
    const roof = new THREE.Mesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.75 }));
    roof.position.set(-W * 0.55, H * 0.72, -L * 0.22);
    roof.rotation.y = Math.PI;
    roof.castShadow = true;
    this.mesh.add(roof);

    // Front driver section (open cockpit)
    this._rbox(W * 0.9, H * 0.38, L * 0.3, 0.06, paint, 0, H * 0.28, -L * 0.34);

    // Windshield (small, triangular auto glass)
    this._rbox(W * 0.82, H * 0.3, 0.04, 0.03, MAT.glass(), 0, H * 0.52, -L * 0.26);

    // Yellow-black stripe on body
    this._box(W + 0.02, 0.08, L * 0.63, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }), 0, H * 0.57, L * 0.08);
    this._box(W + 0.02, 0.05, L * 0.63, new THREE.MeshStandardMaterial({ color: color, roughness: 0.4 }), 0, H * 0.63, L * 0.08);

    // Fare meter box on dash
    this._rbox(0.12, 0.15, 0.08, 0.02, MAT.darkPlastic(), -W * 0.2, H * 0.46, -L * 0.17);

    // Handlebar
    this._box(W * 1.1, 0.04, 0.04, MAT.chrome(), 0, H * 0.55, -L * 0.42);
    this._cyl(0.025, 0.025, H * 0.15, 8, MAT.chrome(), 0, H * 0.48, -L * 0.42, 0, 0, 0);

    // CNG cylinder under rear seat
    this._cyl(0.14, 0.14, 0.7, 10, new THREE.MeshStandardMaterial({ color: 0x228866, roughness: 0.3, metalness: 0.7 }), 0, H * 0.08, L * 0.25, 0, 0, Math.PI / 2);

    // Passenger bench (wood slat)
    this._rbox(W * 0.75, 0.07, 0.5, 0.04, MAT.wood(), 0, H * 0.18, L * 0.2);
    this._rbox(W * 0.75, 0.25, 0.06, 0.04, MAT.wood(), 0, H * 0.32, L * 0.42);

    // Side open panels (auto has open sides)
    for (const sx of [-1, 1]) {
      // Roof support pillar
      this._cyl(0.03, 0.03, H * 0.52, 8, MAT.paint(color, 0.3), sx * W * 0.5, H * 0.46, L * 0.36);
      // Entry grab handle
      this._cyl(0.02, 0.02, 0.35, 6, MAT.chrome(), sx * W * 0.5, H * 0.55, L * 0.1);
    }

    // Headlight (round, very characteristic of autos)
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), MAT.headlight());
    hl.position.set(0, H * 0.42, -L * 0.51);
    this.mesh.add(hl);
    // Headlight bezel
    this._cyl(0.13, 0.13, 0.04, 12, MAT.chrome(), 0, H * 0.42, -L * 0.5);

    // Side indicator lights
    for (const sx of [-1, 1]) {
      const ind = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), MAT.turnSignal());
      ind.position.set(sx * W * 0.48, H * 0.38, -L * 0.49);
      this.mesh.add(ind);
    }

    // Tail light bar
    this._rbox(W * 0.8, 0.08, 0.04, 0.02, MAT.taillight(), 0, H * 0.35, L * 0.4);

    // Front fender / mudguard
    for (const sx of [-1, 1]) {
      this._rbox(0.12, 0.16, 0.35, 0.05, paint, sx * W * 0.3, H * 0.22, -L * 0.4);
    }

    // 3-wheel config: 1 front, 2 rear
    this._placeWheel(0, -L * 0.42, t.wheelR, 0.18, 0xaaaaaa);
    this._placeWheel(-W * 0.44, L * 0.28, t.wheelR, 0.2, 0x999999);
    this._placeWheel(W * 0.44, L * 0.28, t.wheelR, 0.2, 0x999999);
  }

  // ── MTC BUS ───────────────────────────────────────────────────
  _buildBus(color) {
    const t = this.type;
    const W = t.w, H = t.h, L = t.l;
    const paint = MAT.mattePaint(color);
    const creamPaint = MAT.mattePaint(0xF5E6CC);

    // Lower body (red)
    this._rbox(W, H * 0.48, L, 0.06, paint, 0, H * 0.24, 0);
    // Upper cream section
    this._rbox(W, H * 0.52, L, 0.06, creamPaint, 0, H * 0.76, 0);

    // Red-cream divider stripe (chrome)
    this._box(W + 0.04, 0.04, L + 0.04, MAT.chrome(), 0, H * 0.5, 0);

    // Windshield — large bus glass
    this._rbox(W * 0.88, H * 0.36, 0.06, 0.05, MAT.glass(), 0, H * 0.72, -L * 0.5);

    // Front destination board
    this._rbox(W * 0.7, 0.22, 0.06, 0.03, new THREE.MeshStandardMaterial({ color: 0xffffff }), 0, H * 0.96, -L * 0.5);

    // Side windows — upper row (cream section)
    for (let i = 0; i < 8; i++) {
      const wz = -L * 0.42 + i * (L * 0.84 / 7);
      for (const sx of [-1, 1]) {
        this._rbox(0.06, H * 0.24, 1.05, 0.04, MAT.glass(), sx * W * 0.52, H * 0.75, wz);
      }
    }

    // Side windows — lower row (smaller emergency windows)
    for (let i = 0; i < 6; i++) {
      const wz = -L * 0.35 + i * (L * 0.7 / 5);
      for (const sx of [-1, 1]) {
        this._rbox(0.06, H * 0.1, 0.7, 0.03, MAT.glass(), sx * W * 0.52, H * 0.42, wz);
      }
    }

    // Entry door (right side cutout + handle)
    this._rbox(0.06, H * 0.42, 0.95, 0.04, MAT.darkPlastic(), W * 0.52, H * 0.38, -L * 0.38);
    this._cyl(0.025, 0.025, 0.5, 8, MAT.chrome(), W * 0.56, H * 0.42, -L * 0.38, 0, 0, 0);

    // Rear emergency door
    this._rbox(W * 0.5, H * 0.42, 0.06, 0.04, MAT.darkPlastic(), 0, H * 0.38, L * 0.52);

    // Bumpers
    this._rbox(W + 0.1, H * 0.1, 0.35, 0.06, MAT.darkPlastic(), 0, H * 0.06, -L * 0.53);
    this._rbox(W + 0.1, H * 0.1, 0.35, 0.06, MAT.darkPlastic(), 0, H * 0.06, L * 0.53);

    // Headlight clusters
    for (const sx of [-1, 1]) {
      this._rbox(W * 0.22, H * 0.1, 0.08, 0.04, MAT.headlight(), sx * W * 0.35, H * 0.62, -L * 0.51);
      this._rbox(W * 0.22, H * 0.08, 0.06, 0.03, MAT.taillight(), sx * W * 0.35, H * 0.58, L * 0.51);
    }

    // Side destination board
    this._rbox(0.06, 0.18, 1.8, 0.03, new THREE.MeshStandardMaterial({ color: 0xffffff }), W * 0.52, H * 0.94, -L * 0.1);

    // Roof details — vents / hatches
    for (let i = 0; i < 3; i++) {
      this._rbox(0.6, 0.08, 0.5, 0.04, MAT.darkPlastic(), 0, H + 0.04, -L * 0.3 + i * 0.6);
    }

    // Undercarriage structure
    this._box(W * 0.8, 0.12, L * 0.9, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }), 0, -0.05, 0);

    // Wheels (dual rear axle)
    const wr = t.wheelR, ww = 0.28;
    this._placeWheel(-W * 0.48, -L * 0.36, wr, ww, 0x888888);
    this._placeWheel(W * 0.48, -L * 0.36, wr, ww, 0x888888);
    this._placeWheel(-W * 0.52, L * 0.3, wr, ww, 0x888888);
    this._placeWheel(W * 0.52, L * 0.3, wr, ww, 0x888888);
    // Inner duals on rear
    this._placeWheel(-W * 0.32, L * 0.3, wr, ww * 0.85, 0x777777);
    this._placeWheel(W * 0.32, L * 0.3, wr, ww * 0.85, 0x777777);
  }

  // ── INDIAN LORRY ──────────────────────────────────────────────
  _buildLorry(color) {
    const t = this.type;
    const W = t.w, H = t.h, L = t.l;
    const paint = MAT.paint(color, 0.35);
    // Art colors — Indian lorries are ORNATE
    const artColors = [0xff2222, 0x22bb22, 0xffcc00, 0xff8800, 0x2244ff];
    const art = artColors[Math.floor(Math.random() * artColors.length)];
    const artMat = MAT.paint(art, 0.2);

    // ── Cabin ──
    this._rbox(W, H * 0.55, L * 0.28, 0.07, paint, 0, H * 0.38, -L * 0.34);
    // Cabin roof with overhang
    this._rbox(W + 0.2, H * 0.08, L * 0.31, 0.05, MAT.paint(0x222222, 0.3), 0, H * 0.68, -L * 0.34);
    // Sunvisor (classic Indian lorry feature)
    this._rbox(W + 0.1, 0.08, 0.4, 0.04, artMat, 0, H * 0.72, -L * 0.5);

    // Windshield
    this._rbox(W * 0.82, H * 0.33, 0.06, 0.04, MAT.glass(), 0, H * 0.51, -L * 0.47);
    // Small vent windows (quarter glass)
    for (const sx of [-1, 1]) {
      this._rbox(0.06, H * 0.2, 0.3, 0.03, MAT.glass(), sx * W * 0.46, H * 0.47, -L * 0.48);
    }

    // Ornate front bumper — layered art panels
    this._rbox(W + 0.3, H * 0.14, 0.3, 0.06, artMat, 0, H * 0.1, -L * 0.51);
    this._rbox(W + 0.25, 0.04, 0.32, 0.03, MAT.chrome(), 0, H * 0.18, -L * 0.51);
    // Mud flaps on front
    for (const sx of [-1, 1]) {
      this._box(0.6, 0.22, 0.04, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }), sx * W * 0.35, H * 0.0, -L * 0.46);
    }

    // Horn decoration on cabin top
    this._rbox(0.9, 0.18, 0.22, 0.04, artMat, 0, H * 0.73, -L * 0.4);

    // Headlights (dual, chrome ringed)
    for (const sx of [-1, 1]) {
      this._cyl(0.13, 0.13, 0.04, 12, MAT.chrome(), sx * W * 0.35, H * 0.4, -L * 0.505);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), MAT.headlight());
      bulb.position.set(sx * W * 0.35, H * 0.4, -L * 0.49);
      this.mesh.add(bulb);
      // Turn signals (orange)
      const ts = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.05), MAT.turnSignal());
      ts.position.set(sx * W * 0.5, H * 0.35, -L * 0.5);
      this.mesh.add(ts);
    }

    // ── Cargo Bed ──
    this._rbox(W, H * 0.08, L * 0.65, 0.04, MAT.wood(), 0, H * 0.09, L * 0.12);
    // Side walls
    for (const sx of [-1, 1]) {
      this._rbox(0.1, H * 0.45, L * 0.65, 0.04, MAT.paint(0x776644, 0.1), sx * W * 0.52, H * 0.32, L * 0.12);
      // Planks visible on side wall
      for (let p = 0; p < 5; p++) {
        this._box(0.12, 0.035, L * 0.64, MAT.wood(), sx * W * 0.53, H * 0.1 + p * 0.085, L * 0.12);
      }
    }
    // Rear tailgate with art
    this._rbox(W + 0.05, H * 0.45, 0.1, 0.05, artMat, 0, H * 0.32, L * 0.46);
    // "HORN OK PLEASE" sign on rear
    const hornSign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.6, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffee00, roughness: 0.6, side: THREE.DoubleSide }));
    hornSign.position.set(0, H * 0.12, L * 0.51);
    this.mesh.add(hornSign);

    // Cab-to-body gap (visible chassis rails)
    for (const sx of [-1, 1]) {
      this._box(0.15, 0.14, L * 0.98, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8, metalness: 0.5 }), sx * W * 0.38, H * 0.07, 0);
    }

    // Exhaust stack (vertical, on cabin side — very Indian lorry)
    this._cyl(0.06, 0.05, H * 0.7, 10, MAT.chrome(), W * 0.52, H * 0.7, -L * 0.28, 0, 0, 0);
    const smokeCap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 10), MAT.chrome());
    smokeCap.position.set(W * 0.52, H * 1.08, -L * 0.28);
    this.mesh.add(smokeCap);

    // Tail lights
    for (const sx of [-1, 1]) {
      this._rbox(0.2, 0.14, 0.06, 0.03, MAT.taillight(), sx * W * 0.48, H * 0.38, L * 0.47);
    }

    // Fuel tank (chrome cylinder on side)
    this._cyl(0.22, 0.22, 0.9, 14, MAT.chrome(), -W * 0.56, H * 0.25, -L * 0.12, 0, 0, Math.PI / 2);

    // Wheels (6 total, duals on rear)
    const wr = t.wheelR, ww = 0.27;
    this._placeWheel(-W * 0.48, -L * 0.36, wr, ww, 0x999999);
    this._placeWheel(W * 0.48, -L * 0.36, wr, ww, 0x999999);
    this._placeWheel(-W * 0.52, L * 0.28, wr, ww, 0x999999);
    this._placeWheel(W * 0.52, L * 0.28, wr, ww, 0x999999);
    this._placeWheel(-W * 0.33, L * 0.28, wr * 0.92, ww * 0.8, 0x888888);
    this._placeWheel(W * 0.33, L * 0.28, wr * 0.92, ww * 0.8, 0x888888);
  }

  // ── KTM DUKE (MOTORCYCLE) ─────────────────────────────────────
  _buildBike(color) {
    const t = this.type;
    const W = t.w, H = t.h, L = t.l;
    const paint = MAT.paint(color, 0.55);
    const black = MAT.black();
    const chrome = MAT.chrome();

    // Trellis frame (exposed lattice — KTM signature)
    const framePoints = [
      [0, H * 0.3, -L * 0.1], [0, H * 0.55, -L * 0.05],
      [0, H * 0.55, L * 0.12], [0, H * 0.28, L * 0.22],
    ];
    for (let i = 0; i < framePoints.length - 1; i++) {
      const p1 = new THREE.Vector3(...framePoints[i]);
      const p2 = new THREE.Vector3(...framePoints[i + 1]);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const len = p1.distanceTo(p2);
      const dir = p2.clone().sub(p1).normalize();
      for (const sx of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.8 }));
        bar.position.copy(mid).add(new THREE.Vector3(sx * W * 0.28, 0, 0));
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        bar.castShadow = true;
        this.mesh.add(bar);
      }
    }

    // Engine block (bare, visible — naked bike style)
    this._rbox(W * 0.78, H * 0.28, L * 0.32, 0.05, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.45, metalness: 0.8 }), 0, H * 0.25, -L * 0.02);
    // Engine fins
    for (let i = 0; i < 6; i++) {
      this._box(W * 0.85, 0.018, L * 0.1, new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 }), 0, H * 0.16 + i * 0.035, -L * 0.03);
    }

    // Fuel tank (prominent, KTM angular shape)
    const tankShape = new THREE.Shape();
    tankShape.moveTo(-W * 0.38, 0);
    tankShape.lineTo(W * 0.38, 0);
    tankShape.lineTo(W * 0.35, H * 0.18);
    tankShape.lineTo(W * 0.3, H * 0.2);
    tankShape.lineTo(-W * 0.3, H * 0.2);
    tankShape.lineTo(-W * 0.35, H * 0.18);
    const tankGeo = new THREE.ExtrudeGeometry(tankShape, { depth: L * 0.34, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3 });
    const tank = new THREE.Mesh(tankGeo, paint);
    tank.position.set(-W * 0.38, H * 0.45, -L * 0.09);
    tank.rotation.y = Math.PI;
    tank.castShadow = true;
    this.mesh.add(tank);

    // Headlight (round, LED ring — KTM Duke signature)
    const hlBkg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 12), black);
    hlBkg.rotation.x = Math.PI / 2;
    hlBkg.position.set(0, H * 0.6, -L * 0.44);
    this.mesh.add(hlBkg);
    const hlLens = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), MAT.headlight());
    hlLens.position.set(0, H * 0.6, -L * 0.475);
    hlLens.rotation.x = Math.PI;
    this.mesh.add(hlLens);
    const drlRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.0 }));
    drlRing.position.set(0, H * 0.6, -L * 0.47);
    drlRing.rotation.x = Math.PI / 2;
    this.mesh.add(drlRing);

    // Front fairing (minimal — naked bike)
    this._rbox(W * 0.85, H * 0.22, 0.09, 0.04, paint, 0, H * 0.62, -L * 0.4);

    // Seat unit (single-piece, aggressive)
    const seatUnit = new THREE.Mesh(roundedBox(W * 0.72, 0.08, L * 0.32, 0.035), black);
    seatUnit.position.set(0, H * 0.62, L * 0.09);
    seatUnit.castShadow = true;
    this.mesh.add(seatUnit);
    // Seat stitching lines
    for (let i = 0; i < 4; i++) {
      this._box(W * 0.6, 0.012, 0.02, new THREE.MeshStandardMaterial({ color: 0x333333 }), 0, H * 0.665, L * 0.0 + i * 0.08);
    }

    // Tail unit (sharp, angled)
    const tailShape = new THREE.Shape();
    tailShape.moveTo(-W * 0.4, 0);
    tailShape.lineTo(W * 0.4, 0);
    tailShape.lineTo(W * 0.15, -H * 0.12);
    tailShape.lineTo(-W * 0.15, -H * 0.12);
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: L * 0.22, bevelEnabled: false });
    const tail = new THREE.Mesh(tailGeo, paint);
    tail.position.set(-W * 0.4, H * 0.57, L * 0.24);
    tail.rotation.y = Math.PI;
    tail.castShadow = true;
    this.mesh.add(tail);
    // Tail light (LED strip style)
    const tlStrip = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.025, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.8 }));
    tlStrip.position.set(0, H * 0.52, L * 0.45);
    this.mesh.add(tlStrip);

    // Handlebar (wide supermoto style)
    this._box(W * 1.55, 0.03, 0.03, chrome, 0, H * 0.74, -L * 0.36);
    // Handlebar ends (bar ends)
    for (const sx of [-1, 1]) {
      this._cyl(0.025, 0.02, 0.08, 8, MAT.darkPlastic(), sx * W * 0.8, H * 0.74, -L * 0.36, 0, 0, Math.PI / 2);
    }
    // Brake/clutch levers
    for (const sx of [-1, 1]) {
      this._box(0.03, 0.02, 0.14, chrome, sx * W * 0.66, H * 0.73, -L * 0.365);
    }

    // Front fork (USD — upside down, chrome)
    for (const sx of [-1, 1]) {
      this._cyl(0.03, 0.032, H * 0.45, 8, chrome, sx * W * 0.18, H * 0.35, -L * 0.38, -0.12, 0, 0);
    }

    // Swingarm (rear suspension)
    for (const sx of [-1, 1]) {
      this._box(0.04, 0.06, L * 0.35, new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 }), sx * W * 0.15, H * 0.2, L * 0.2);
    }

    // Exhaust (short, upswept — Duke style)
    const exhPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(W * 0.35, H * 0.2, -L * 0.0),
      new THREE.Vector3(W * 0.42, H * 0.22, L * 0.1),
      new THREE.Vector3(W * 0.44, H * 0.3, L * 0.28),
      new THREE.Vector3(W * 0.42, H * 0.38, L * 0.37),
    ]);
    const exhGeo = new THREE.TubeGeometry(exhPath, 16, 0.038, 8, false);
    const exhaust = new THREE.Mesh(exhGeo, chrome);
    exhaust.castShadow = true;
    this.mesh.add(exhaust);
    // Exhaust end cap (carbon look)
    this._cyl(0.06, 0.05, 0.06, 10, new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 }), W * 0.42, H * 0.38, L * 0.4);

    // Front brake caliper
    this._rbox(0.1, 0.1, 0.06, 0.02, new THREE.MeshStandardMaterial({ color: 0xee4400, roughness: 0.4 }), 0, -t.wheelR * 0.55, -L * 0.4);

    // Instruments cluster
    this._rbox(0.2, 0.14, 0.06, 0.03, black, 0, H * 0.78, -L * 0.4);

    // Foot pegs
    for (const sx of [-1, 1]) {
      this._cyl(0.02, 0.015, 0.22, 6, chrome, sx * W * 0.52, H * 0.14, L * 0.08, 0, 0, Math.PI / 2);
    }

    // Wheels (narrow, sporty)
    this._placeWheel(0, -L * 0.42, t.wheelR, 0.16, 0xdddddd);
    this._placeWheel(0, L * 0.38, t.wheelR, 0.16, 0xdddddd);
  }

  // ── MOUNTAIN BIKE ─────────────────────────────────────────────
  _buildMTB(color) {
    const t = this.type;
    const W = t.w, H = t.h, L = t.l;
    const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.7 });
    const blackMat = MAT.black();
    const alum = MAT.chrome();

    // Full suspension frame — proper tube shapes
    // Down tube (head tube to BB)
    const dt = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, H * 0.6, -L * 0.28),
      new THREE.Vector3(0, H * 0.45, -L * 0.05),
      new THREE.Vector3(0, H * 0.22, L * 0.08),
    ]);
    this.mesh.add(new THREE.Mesh(new THREE.TubeGeometry(dt, 12, 0.025, 8), frameMat));

    // Top tube
    const tt = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, H * 0.6, -L * 0.25),
      new THREE.Vector3(0, H * 0.58, 0),
      new THREE.Vector3(0, H * 0.54, L * 0.15),
    ]);
    this.mesh.add(new THREE.Mesh(new THREE.TubeGeometry(tt, 8, 0.02, 8), frameMat));

    // Seat tube
    this._cyl(0.022, 0.022, H * 0.38, 8, frameMat, 0, H * 0.42, L * 0.12, -0.08, 0, 0);

    // Chain stays (rear triangle)
    for (const sx of [-1, 1]) {
      const cs = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.04, H * 0.22, L * 0.1),
        new THREE.Vector3(sx * 0.05, H * 0.19, L * 0.32),
      ]);
      this.mesh.add(new THREE.Mesh(new THREE.TubeGeometry(cs, 6, 0.015, 6), frameMat));
    }
    // Seat stays
    for (const sx of [-1, 1]) {
      const ss = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.04, H * 0.54, L * 0.13),
        new THREE.Vector3(sx * 0.05, H * 0.19, L * 0.32),
      ]);
      this.mesh.add(new THREE.Mesh(new THREE.TubeGeometry(ss, 6, 0.014, 6), frameMat));
    }

    // Head tube
    this._cyl(0.04, 0.04, 0.12, 10, alum, 0, H * 0.62, -L * 0.28, 0.3, 0, 0);

    // Front fork (suspension, chunky)
    for (const sx of [-1, 1]) {
      const fork = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx * 0.04, H * 0.6, -L * 0.28),
        new THREE.Vector3(sx * 0.04, H * 0.42, -L * 0.36),
        new THREE.Vector3(sx * 0.04, H * 0.18, -L * 0.38),
      ]);
      this.mesh.add(new THREE.Mesh(new THREE.TubeGeometry(fork, 8, 0.022, 8), alum));
    }
    // Fork crown
    this._box(W * 0.6, 0.04, 0.06, alum, 0, H * 0.6, -L * 0.3);

    // Bottom bracket
    this._cyl(0.05, 0.05, W * 0.7, 10, alum, 0, H * 0.2, L * 0.1, 0, 0, Math.PI / 2);

    // Crank arms + pedals
    for (const sx of [-1, 1]) {
      this._box(0.018, 0.1, 0.024, blackMat, sx * W * 0.36, H * 0.21, L * 0.1);
      this._box(0.1, 0.016, 0.06, blackMat, sx * W * 0.38, H * 0.14, L * 0.1);
    }
    // Chainring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 24), new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(W * 0.3, H * 0.21, L * 0.1);
    this.mesh.add(ring);

    // Handlebar stem + bars
    this._cyl(0.018, 0.018, 0.16, 8, alum, 0, H * 0.64, -L * 0.24, -0.2, 0, 0);
    this._box(W * 1.4, 0.03, 0.03, blackMat, 0, H * 0.7, -L * 0.25);
    // Grips
    for (const sx of [-1, 1]) {
      this._cyl(0.02, 0.02, 0.12, 8, new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.95 }), sx * W * 0.72, H * 0.7, -L * 0.25, 0, 0, Math.PI / 2);
    }

    // Saddle
    const sadShape = new THREE.Shape();
    sadShape.moveTo(-0.06, 0); sadShape.lineTo(0.06, 0);
    sadShape.quadraticCurveTo(0.05, 0.05, 0, 0.05);
    sadShape.quadraticCurveTo(-0.05, 0.05, -0.06, 0);
    const sadGeo = new THREE.ExtrudeGeometry(sadShape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015 });
    const sad = new THREE.Mesh(sadGeo, blackMat);
    sad.position.set(-0.06, H * 0.65, L * 0.06);
    sad.rotation.y = Math.PI;
    sad.castShadow = true;
    this.mesh.add(sad);

    // Seat post
    this._cyl(0.018, 0.018, H * 0.16, 8, alum, 0, H * 0.58, L * 0.13, -0.08, 0, 0);

    // Rear shock (coilover look)
    this._cyl(0.025, 0.025, 0.25, 8, alum, 0, H * 0.37, L * 0.16, 0.5, 0, 0);

    // Disc brakes (both wheels)
    for (const sx of [-1, 1]) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(t.wheelR * 0.72, t.wheelR * 0.72, 0.025, 18),
        new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.85, roughness: 0.3 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.set(sx * 0.06, 0, -L * 0.38);
      this.mesh.add(disc);
    }

    // Thin MTB wheels
    this._placeWheel(0, -L * 0.38, t.wheelR, 0.1, 0x999999);
    this._placeWheel(0, L * 0.35, t.wheelR, 0.1, 0x999999);
  }

  // ── POLICE CAR ────────────────────────────────────────────────
  _buildPolice(color) {
    // Build on sedan base
    this._buildSedan(color);
    const t = this.type;
    const H = t.h;

    // Police livery stripe (white body, blue/black stripe)
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.06, H * 0.42), new THREE.MeshStandardMaterial({ color: 0x003399, roughness: 0.7, side: THREE.DoubleSide }));
      stripe.position.set(sx * (t.w * 0.485), H * 0.22, 0);
      stripe.rotation.y = Math.PI / 2;
      this.mesh.add(stripe);
    }

    // Light bar on roof (LED push bar style)
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.85, 0.06, 0.55), MAT.darkPlastic());
    barBase.position.set(0, H * 0.94, -t.l * 0.06);
    this.mesh.add(barBase);

    // LED sections: red | white | blue
    const ledColors = [{ c: 0xff0000, e: 0xff0000 }, { c: 0xffffff, e: 0xffffff }, { c: 0x0033ff, e: 0x0033ff }];
    for (let i = 0; i < 3; i++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(t.w * 0.24, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: ledColors[i].c, emissive: ledColors[i].e, emissiveIntensity: 1.2 }));
      led.position.set(-t.w * 0.28 + i * t.w * 0.28, H * 0.98, -t.l * 0.06);
      this.mesh.add(led);
      if (i === 0) this.sirenLeft = led;
      if (i === 2) this.sirenRight = led;
    }

    // Push bumper (heavy duty front bull bar)
    this._rbox(t.w + 0.3, H * 0.22, 0.4, 0.06, new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.4 }), 0, H * 0.15, -t.l * 0.55);
    for (const sx of [-1, 1]) {
      this._cyl(0.04, 0.04, H * 0.22, 8, MAT.chrome(), sx * t.w * 0.4, H * 0.15, -t.l * 0.55);
    }
  }

  // ─── Physics / AI Update Methods (unchanged from original) ─────
  updateDriving(dt, input) {
    if (!this.occupied) return;
    const t = this.type;
    const throttle = input.isDown('KeyW') ? 1 : (input.isDown('KeyS') ? -0.6 : 0);
    const braking = input.isDown('Space');
    if (throttle !== 0) this.speed += throttle * t.accel * dt; else this.speed *= 0.98;
    if (braking) { this.speed *= (1 - t.brake * dt * 0.05); if (Math.abs(this.speed) < 0.5) this.speed = 0; }
    this.speed = Math.max(-t.maxSpeed * 0.3, Math.min(t.maxSpeed, this.speed));
    const si = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
    this.steerAngle = si * t.steer * Math.min(1, Math.abs(this.speed) / 5);
    if (Math.abs(this.speed) > 0.1) this.mesh.rotation.y += this.steerAngle * dt * Math.sign(this.speed);
    const dir = new THREE.Vector3(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
    this.mesh.position.addScaledVector(dir, this.speed * dt);
    this.mesh.position.y = 0;
    for (const w of this._wheelGroups) w.rotation.x += this.speed * dt * 2;
  }

  updateAI(dt, city, allVehicles) {
    if (this.occupied || !this.aiDriving) return;
    if (this.aiStopTimer > 0) { this.aiStopTimer -= dt; return; }
    
    let targetSpeed = this.type.maxSpeed * 0.36;
    let targetDir = this.aiDir;

    // Traffic detection (Indian weaving style)
    let distAhead = Infinity;
    let obstacle = null;
    if (allVehicles) {
      for (const other of allVehicles) {
        if (other === this || other.occupied) continue;
        const dx = other.mesh.position.x - this.mesh.position.x;
        const dz = other.mesh.position.z - this.mesh.position.z;
        // Dot product to check if in front
        const fwdX = -Math.sin(this.aiDir);
        const fwdZ = -Math.cos(this.aiDir);
        const dot = dx * fwdX + dz * fwdZ;
        if (dot > 0 && dot < 25) {
          // Distance sideways
          const sideDist = Math.abs(dx * fwdZ - dz * fwdX);
          if (sideDist < this.type.w * 1.5) {
            if (dot < distAhead) {
              distAhead = dot;
              obstacle = other;
            }
          }
        }
      }
    }

    if (distAhead < 8) {
      targetSpeed = 0; // Stop
    } else if (distAhead < 20) {
      targetSpeed *= 0.5; // Slow down
      // Indian traffic weave: try to shift lane slightly
      targetDir += (Math.random() > 0.5 ? 0.05 : -0.05);
    }

    if (city) {
      const p = this.mesh.position;
      if (city.isNearBoundary?.(p.x, p.z, 28)) {
        const toCenter = Math.atan2(p.x, p.z);
        targetDir = toCenter + Math.PI;
        this.aiDir = targetDir;
        targetSpeed *= 0.55;
      }
      const intersectionDist = city.getNearestIntersectionDistance?.(p.x, p.z) ?? Infinity;
      if (intersectionDist < 7) targetSpeed *= 0.62;
      if (city.isInsideBuilding?.(p.x, p.z, this.type.w + 1.2, this.type.l + 1.2, 0.5)) {
        targetSpeed = 0;
        this.aiDir += Math.PI / 2;
        targetDir = this.aiDir;
      }
    }

    // Auto rickshaws and buses randomly stop to pick up passengers
    if ((this.typeName === 'auto' || this.typeName === 'bus' || this.typeName === 'tuk_tuk') && Math.random() < 0.001) {
       this.aiStopTimer = 3 + Math.random() * 4;
       targetSpeed = 0;
    } else if (Math.random() < 0.0005) {
       this.aiStopTimer = 1 + Math.random(); // Random traffic slow down
    }

    this.aiSpeed = THREE.MathUtils.lerp(this.aiSpeed || 0, targetSpeed, dt * 2);
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetDir, dt * 2);

    const dir = new THREE.Vector3(-Math.sin(this.mesh.rotation.y), 0, -Math.cos(this.mesh.rotation.y));
    this.mesh.position.addScaledVector(dir, this.aiSpeed * dt);
    this.mesh.position.y = 0;
    
    if (this.mesh.visible) {
      for (const w of this._wheelGroups) w.rotation.x += this.aiSpeed * dt * 2;
    }

    if (city?.clampToWorld) city.clampToWorld(this.mesh.position, Math.max(this.type.w, this.type.l) * 0.45);
  }

  updateSiren(dt) {
    if (!this.isPolice || !this.mesh.visible) return;
    this.sirenTime += dt * 5;
    const f = Math.sin(this.sirenTime) > 0;
    if (this.sirenLeft) this.sirenLeft.material.emissiveIntensity = f ? 2.5 : 0.05;
    if (this.sirenRight) this.sirenRight.material.emissiveIntensity = f ? 0.05 : 2.5;
  }
}

// ═══════════════════════════════════════════════════════════════════
export class VehicleManager {
  constructor(scene) { this.scene = scene; this.vehicles = []; }

  spawnVehicles(city) {
    const half = city.halfCity;
    const cell = city.cellSize || 62;
    const grid = city.grid || 8;
    const rng = this._rng(42);
    
    const allTypes = [
      'motorcycle',
      'motorcycle',
      'motorcycle',
      'tuk_tuk',
      'tuk_tuk',
      'tuk_tuk',
      'maruti',
      'maruti_ac',
      'maruti',
      'motorcycle',
      'tuk_tuk',
      'maruti',
      'hundai',
      'bus',
      'tnstc_bus',
      'balaji_bus',
      'lorry',
      'ashok_truck',
    ];
    
    const nsLanes = [
      { x: -3.2, dir: 1 }, { x: -6.2, dir: 1 },
      { x: 3.2, dir: -1 }, { x: 6.2, dir: -1 }
    ];
    const ewLanes = [
      { z: -3.2, dir: -1 }, { z: 3.2, dir: 1 }
    ];

    const occupiedSpots = [];
    const isTooClose = (pos) => occupiedSpots.some(p => p.distanceTo(pos) < 18);

    for (let i = 0; i < 58; i++) {
      const type = allTypes[Math.floor(rng() * allTypes.length)];
      const isNS = rng() > 0.5;
      
      let pos = new THREE.Vector3();
      let rotY = 0;
      let attempts = 0;
      
      do {
        if (isNS) {
          const roadIdx = Math.floor(rng() * (grid + 1));
          const roadX = -half + roadIdx * cell;
          const lane = nsLanes[Math.floor(rng() * nsLanes.length)];
          pos.x = roadX + lane.x;
          pos.z = -city.playableHalf + 12 + rng() * (city.playableHalf * 2 - 24);
          rotY = lane.dir > 0 ? 0 : Math.PI;
        } else {
          const roadIdx = Math.floor(rng() * (grid + 1));
          const roadZ = -half + roadIdx * cell;
          const lane = ewLanes[Math.floor(rng() * ewLanes.length)];
          pos.z = roadZ + lane.z;
          pos.x = -city.playableHalf + 12 + rng() * (city.playableHalf * 2 - 24);
          rotY = lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        attempts++;
      } while (isTooClose(pos) && attempts < 12);

      const v = new Vehicle(this.scene, type, pos);
      v.mesh.rotation.y = rotY;
      const parked = i % 7 === 0;
      if (parked) {
        const sideOffset = isNS ? Math.sign(pos.x || 1) * 3.2 : Math.sign(pos.z || 1) * 3.2;
        if (isNS) pos.x += sideOffset;
        else pos.z += sideOffset;
      }
      v.mesh.position.copy(pos);
      v.aiDriving = !parked;
      v.aiDir = rotY;
      this.vehicles.push(v);
      occupiedSpots.push(pos.clone());
    }
  }

  spawnPolice(position) {
    // Police cars are procedural in this prototype. Keep vehicle spawns GLB-only.
  }

  update(dt, input, player, city) {
    if (input.justPressed('KeyF')) {
      if (player.inVehicle) player.exitVehicle();
      else { const n = this.getNearestVehicle(player.position, 15); if (n && !n.occupied) player.enterVehicle(n); }
    }
    
    for (const v of this.vehicles) {
      // Distance-based frustum culling
      if (player && !v.occupied) {
        const dist = v.mesh.position.distanceTo(player.position);
        v.mesh.visible = dist < 280; // keep more traffic visible across the city
        if (dist < 9 && v.aiDriving) v.aiSpeed *= 0.72;
      } else {
        v.mesh.visible = true; // Always visible if occupied or player not ready
      }

      if (v.occupied) v.updateDriving(dt, input);
      else if (v.aiDriving) v.updateAI(dt, city, this.vehicles); // AI runs even if culled (to prevent traffic jams), but graphics update is skipped
      if (city?.clampToWorld) city.clampToWorld(v.mesh.position, Math.max(v.type.w, v.type.l) * 0.45);
      if (v.isPolice) v.updateSiren(dt);
    }
    
    if (!player.inVehicle) this.checkProximity(player.position);
    else document.getElementById('interaction-prompt')?.classList.add('hidden');
  }

  getNearestVehicle(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const v of this.vehicles) { 
      // Use 2D distance for entering vehicles to ignore height differences
      const dx = v.mesh.position.x - pos.x;
      const dz = v.mesh.position.z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bd) { bd = d; best = v; } 
    }
    return best;
  }

  checkProximity(pp) {
    const el = document.getElementById('interaction-prompt');
    const n = this.getNearestVehicle(pp, 15);
    if (n && !n.occupied) el?.classList.remove('hidden'); else el?.classList.add('hidden');
  }

  _rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
}
