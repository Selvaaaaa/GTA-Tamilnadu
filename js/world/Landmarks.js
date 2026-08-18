import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AssetRegistry } from './AssetRegistry.js';

/* ═══════════════════════════════════════════════════════════════
   Chennai Landmarks — All GLB Models Used Once
   Chennai Central · Temples · SRM Tech Park
   India Street · Slum Environment
   ═══════════════════════════════════════════════════════════════ */

// FIX #9: Use a module-level cache so _loadAndPlaceGLB never starts a
// second network request for a URL that is already loading or loaded.
const _glbCache = new Map();   // url → THREE.Object3D (raw scene)
const _glbPending = new Map();   // url → [callback array]
const _glbLoader = new GLTFLoader();

function normalizeImportedMaterial(mat, fallbackColor = 0x8d7a66) {
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  if (mat.emissive) mat.emissive.setHex(0x000000);
  if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.55;
  if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.75, 0.68);
  if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.3);
  mat.toneMapped = true;
  if (mat.color && !mat.map && mat.color.r > 0.84 && mat.color.g > 0.84 && mat.color.b > 0.84) {
    mat.color.setHex(fallbackColor);
  }
}

export class Landmarks {
  constructor(scene) {
    this.scene = scene;
    this.interactables = [];
    this._toastTimer = 0;

    // FIX #3: Shared singleton — placement counts are visible across all modules.
    this.registry = AssetRegistry.getInstance();

    // city ref set at the start of build() — used by _terrainY
    this.city = null;
  }

  build(city) {
    // FIX #6: Set this.city FIRST before any method calls that use _terrainY().
    // Previously this.city was assigned on the same line as cityHalf was read,
    // so the first _terrainY() call (inside _chennaiCentral) saw this.city = null.
    this.city = typeof city === 'number' ? null : city;
    const cityHalf = typeof city === 'number' ? city : city.halfCity;

    // Unique landmarks — each placed ONCE
    this._chennaiCentral(0, -cityHalf + 100, city);
    this._oldTempleSite(-cityHalf + 80, cityHalf - 120, city);
    this._uthirakosamangaiTemple(cityHalf - 100, 40);
    this._southIndianTemple(-40, 20);
    this._srmTechPark(cityHalf - 60, -30);
    this._indiaStreet(-cityHalf + 50, -cityHalf + 60);
  }

  update(dt, game) {
    const prompt = document.getElementById('landmark-prompt');
    const toast = document.getElementById('landmark-toast');
    const title = document.getElementById('landmark-toast-title');
    const body = document.getElementById('landmark-toast-body');

    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) toast?.classList.add('hidden');
    }

    if (!game.player || game.player.inVehicle) {
      prompt?.classList.add('hidden');
      return;
    }

    const nearest = this._nearestLandmark(game.player.position);
    if (!nearest) {
      prompt?.classList.add('hidden');
      return;
    }

    if (prompt) {
      prompt.innerHTML = `Press <kbd>E</kbd> to inspect ${nearest.name}`;
      prompt.classList.remove('hidden');
    }

    if (game.input.justPressed('KeyE')) {
      if (title) title.textContent = nearest.name;
      if (body) body.textContent = nearest.description;
      toast?.classList.remove('hidden');
      this._toastTimer = 5;
    }
  }

  _nearestLandmark(pos) {
    let best = null, bestDist = Infinity;
    for (const item of this.interactables) {
      const dx = item.position.x - pos.x;
      const dz = item.position.z - pos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < item.radius && dist < bestDist) { best = item; bestDist = dist; }
    }
    return best;
  }

  _registerLandmark({ id, name, description, x, z, radius = 30 }) {
    this.interactables.push({
      id, name, description,
      position: new THREE.Vector3(x, 0, z),
      radius
    });
  }

  // FIX: _addLandmarkMarker was defined but never called.
  // Now called at the end of each landmark placement method.
  _addLandmarkMarker(name, x, z) {
    const marker = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffb347, transparent: true, opacity: 0.26, depthWrite: false
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.4, 28, 20, 1, true), beamMat
    );
    beam.position.y = 14; marker.add(beam);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5, 0.12, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.75 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; marker.add(ring);

    const label = this._makeLabelSprite(name);
    label.position.y = 31; marker.add(label);

    marker.position.set(x, 0, z);
    this.scene.add(marker);
  }

  _makeLabelSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(10, 12, 16, 0.72)';
    ctx.fillRect(0, 20, 512, 88);
    ctx.strokeStyle = 'rgba(255, 190, 96, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(8, 28, 496, 72);
    ctx.font = '700 34px Inter, sans-serif';
    ctx.fillStyle = '#ffd38a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.toUpperCase(), 256, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
    );
    sprite.scale.set(18, 4.5, 1);
    return sprite;
  }

  // ── Shared GLB loader with caching ────────────────────────
  // FIX #9: Replaces `new GLTFLoader()` per call with a module-level cache.
  _loadAndPlaceGLB(url, group, options = {}) {
    const {
      targetFootprint,
      yOffset = 0,
      fallbackColor = 0x8d7a66,
      groundMode = 'bounds',
    } = options;

    const applyToGroup = (rawScene) => {
      const model = rawScene.clone(true);
      model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.material) {
          const mats = (Array.isArray(obj.material) ? obj.material : [obj.material])
            .map(m => m.clone());
          for (const mat of mats) { normalizeImportedMaterial(mat, fallbackColor); mat.needsUpdate = true; }
          obj.material = Array.isArray(obj.material) ? mats : mats[0];
        }
      });

      if (targetFootprint) {
        if (groundMode === 'origin') {
          this._fitModelOriginGround(model, { targetFootprint, yOffset });
        } else {
          AssetRegistry.fitModel(model, { targetFootprint, groundY: yOffset });
        }
      } else {
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.set(-center.x, -box.min.y + yOffset, -center.z);
      }

      group.add(model);

      if (groundMode === 'bounds') this._snapGroupToTerrain(group);
      else group.position.y = this._terrainY(group.position.x, group.position.z);
    };

    if (_glbCache.has(url)) {
      applyToGroup(_glbCache.get(url));
      return;
    }
    if (_glbPending.has(url)) {
      _glbPending.get(url).push(applyToGroup);
      return;
    }
    _glbPending.set(url, [applyToGroup]);
    _glbLoader.load(
      url,
      gltf => {
        _glbCache.set(url, gltf.scene);
        const cbs = _glbPending.get(url) || [];
        _glbPending.delete(url);
        for (const cb of cbs) cb(gltf.scene);
      },
      undefined,
      err => {
        console.warn(`Landmark GLB failed: ${url}`, err);
        _glbPending.delete(url);
      }
    );
  }

  _fitModelOriginGround(model, { targetFootprint, targetHeight, yOffset = 0 }) {
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    let size = box.getSize(new THREE.Vector3());

    const footprint = Math.max(size.x, size.z, 0.001);
    const scaleByFoot = targetFootprint ? targetFootprint / footprint : Infinity;
    const scaleByH = targetHeight ? targetHeight / Math.max(size.y, 0.001) : Infinity;
    const scale = Math.min(scaleByFoot, scaleByH);
    if (Number.isFinite(scale)) model.scale.multiplyScalar(scale);

    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y = yOffset;
  }

  _snapGroupToTerrain(group) {
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const groundY = this._terrainY(group.position.x, group.position.z);
    if (!Number.isFinite(box.min.y)) return;
    group.position.y += groundY - box.min.y;
    group.updateMatrixWorld(true);
  }

  // ── Individual landmark builders ──────────────────────────

  /* ════ Chennai Central Railway Station ════ */
  _chennaiCentral(x, z, city) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    this.scene.add(g);

    this._registerLandmark({
      id: 'central', name: 'Chennai Central',
      description: 'Chennai Central Railway Station — the iconic red Victorian building, gateway to Tamil Nadu.',
      x, z, radius: 90
    });
    this._addLandmarkMarker('Chennai Central', x, z);

    this._loadAndPlaceGLB('/models/landmarks/chennai_central.glb', g, {
      targetFootprint: 105, fallbackColor: 0xa05236, groundMode: 'origin'
    });
  }

  /* ════ Old Temple Site ════ */
  _oldTempleSite(x, z, city) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    g.rotation.y = -0.35;
    this.scene.add(g);

    this._registerLandmark({
      id: 'temple', name: 'Ancient Temple Ruins',
      description: 'A quiet stone temple ruin — sacred ground preserved through centuries.',
      x, z, radius: 70
    });
    this._addLandmarkMarker('Ancient Temple Ruins', x, z);

    this._loadAndPlaceGLB('/models/landmarks/old_temple_site_in_nepal.glb', g, {
      targetFootprint: 46, fallbackColor: 0x7d7467
    });
  }

  /* ════ Uthirakosamangai Temple ════ */
  _uthirakosamangaiTemple(x, z) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    this.scene.add(g);

    this._registerLandmark({
      id: 'uthira_temple', name: 'Sri Uthirakosamangai Temple',
      description: 'An ancient Dravidian temple with intricate carvings — one of the 108 Divya Desams.',
      x, z, radius: 55
    });
    this._addLandmarkMarker('Sri Uthirakosamangai Temple', x, z);

    this._loadAndPlaceGLB('/models/landmarks/uthirakosamangai_temple.glb', g, {
      targetFootprint: 40, fallbackColor: 0x7d7467, groundMode: 'origin'
    });
  }

  /* ════ South Indian Temple ════ */
  _southIndianTemple(x, z) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    this.scene.add(g);

    this._registerLandmark({
      id: 'south_temple', name: 'Kapaleeshwarar-Style Temple',
      description: 'A vibrant Dravidian gopuram temple in the heart of T Nagar — inspired by Mylapore.',
      x, z, radius: 50
    });
    this._addLandmarkMarker('Kapaleeshwarar-Style Temple', x, z);

    this._loadAndPlaceGLB('/models/landmarks/south_indian_temple_modular.glb', g, {
      targetFootprint: 35, fallbackColor: 0x8a7058
    });
  }

  /* ════ SRM Tech Park ════ */
  _srmTechPark(x, z) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    this.scene.add(g);

    this._registerLandmark({
      id: 'srm_tech', name: 'SRM Tech Park',
      description: 'A modern IT campus on the OMR IT Corridor — the silicon valley of Chennai.',
      x, z, radius: 45
    });
    this._addLandmarkMarker('SRM Tech Park', x, z);

    this._loadAndPlaceGLB('/models/landmarks/srm_tech_park.glb', g, {
      targetFootprint: 30, fallbackColor: 0x667788
    });
  }

  /* ════ India Street / North Bazaar ════ */
  _indiaStreet(x, z) {
    const g = new THREE.Group();
    g.position.set(x, this._terrainY(x, z), z);
    this.scene.add(g);

    this._registerLandmark({
      id: 'india_street', name: 'North Chennai Bazaar',
      description: 'A bustling North Chennai market street — filled with vendors, noise, and life.',
      x, z, radius: 60
    });
    this._addLandmarkMarker('North Chennai Bazaar', x, z);

    // Uses the 'buildings' path — this is intentional; it's a street-scene asset not a single-structure landmark.
    this._loadAndPlaceGLB('/models/buildings/india_street.glb', g, {
      targetFootprint: 50, fallbackColor: 0x6a5a4a
    });
  }

  /* ════ LIC Building (utility — kept for optional future use) ════ */
  _licBuilding(x, z) {
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x2a4466, roughness: 0.1, metalness: 0.75, transparent: true, opacity: 0.88 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x556666, roughness: 0.4, metalness: 0.5 });
    const podiumMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.6, metalness: 0.1 });
    const g = new THREE.Group();
    const bW = 38, bD = 22, bH = 55, podH = 8;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(bW, bH, bD), glassMat);
    tower.position.set(0, bH / 2 + podH, 0); tower.castShadow = true; g.add(tower);
    for (let y = podH + 2; y < bH + podH; y += 3.5) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(bW + 0.3, 0.2, bD + 0.3), frameMat);
      band.position.set(0, y, 0); g.add(band);
    }
    const podium = new THREE.Mesh(new THREE.BoxGeometry(bW + 12, podH, bD + 8), podiumMat);
    podium.position.set(0, podH / 2, 0); podium.castShadow = true; g.add(podium);
    g.position.set(x, 0, z);
    this.scene.add(g);
  }

  /* ════ Napier Bridge (utility — kept for optional future use) ════ */
  _napierBridge(x, z) {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.5, metalness: 0.15 });
    const deckMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.6, metalness: 0.1 });
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x2a7a6a, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.85 });
    const g = new THREE.Group();
    const bridgeL = 120, bridgeW = 18, deckH = 3.5, deckTop = deckH + 0.5;
    const river = new THREE.Mesh(new THREE.PlaneGeometry(bridgeL + 100, 70), waterMat);
    river.rotation.x = -Math.PI / 2; river.position.set(0, -0.8, 0); g.add(river);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(bridgeL, 1.0, bridgeW), deckMat);
    deck.position.set(0, deckH, 0); deck.castShadow = true; g.add(deck);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(bridgeL - 2, bridgeW - 4), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, deckTop + 0.01, 0); g.add(road);
    for (const sz of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(bridgeL, 0.8, 0.3), whiteMat);
      rail.position.set(0, deckTop + 0.8, sz * (bridgeW / 2 - 0.3)); g.add(rail);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
  }

  // ── Helpers ───────────────────────────────────────────────

  _box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  /**
   * FIX #6: this.city is now always set before any landmark method runs,
   * so getTerrainHeight will never be called on a null reference.
   */
  _terrainY(x, z) {
    return this.city?.getTerrainHeight ? this.city.getTerrainHeight(x, z) : 0;
  }
}