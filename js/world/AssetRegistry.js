import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/* ═══════════════════════════════════════════════════════════════
   Asset Registry — Central asset loading & placement controller
   • Singleton pattern — all files share one instance and one set
     of placement counts, so maxCount limits actually work.
   • Enforces landmark-once / generic 2-3x max rules
   • Provides randomized variation for repeated placements
   • Caches loaded models for efficient instancing
   ═══════════════════════════════════════════════════════════════ */

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const modelCache = new Map();   // url → THREE.Object3D (raw loaded scene)
const pendingLoads = new Map();   // url → [{prepare, onError}]

export const CATEGORY_SCALE_PRESETS = {
  small_shop: { targetFootprint: 11, targetHeight: 5.2 },
  apartment: { targetFootprint: 24, targetHeight: 18 },
  villa: { targetFootprint: 15, targetHeight: 7.2 },
  temple: { targetFootprint: 45, targetHeight: 28 },
  commercial: { targetFootprint: 20, targetHeight: 14 },
  it_building: { targetFootprint: 35, targetHeight: 35 },
  landmark: { targetFootprint: 80 },
  prop: { targetFootprint: 3.5 },
  vehicle_bike: { targetFootprint: 2.1, targetHeight: 1.25 },
  vehicle_auto: { targetFootprint: 2.8, targetHeight: 1.8 },
  vehicle_car: { targetFootprint: 4.2, targetHeight: 1.45 },
  vehicle_bus: { targetFootprint: 11.0, targetHeight: 3.5 },
  vehicle_truck: { targetFootprint: 10.5, targetHeight: 3.6 },
};

// ── Master catalog of ALL assets ─────────────────────────────
// FIX #5: The key 'india_street' existed in BOTH landmarks and buildings,
// causing canPlace() and recordPlacement() calls to collide and the
// landmark version to never be placed via the registry correctly.
// Renamed the landmark entry to 'north_bazaar' to make keys unique per section.
export const ASSET_CATALOG = {
  // LANDMARKS — max 1 placement each
  landmarks: {
    chennai_central: { url: '/models/landmarks/chennai_central.glb', maxCount: 1, category: 'landmark' },
    old_temple: { url: '/models/landmarks/old_temple_site_in_nepal.glb', maxCount: 1, category: 'landmark' },
    uthirakosamangai: { url: '/models/landmarks/uthirakosamangai_temple.glb', maxCount: 1, category: 'landmark' },
    south_indian_temple: { url: '/models/landmarks/south_indian_temple_modular.glb', maxCount: 1, category: 'landmark' },
    srm_tech_park: { url: '/models/landmarks/srm_tech_park.glb', maxCount: 1, category: 'landmark' },
    north_bazaar: { url: '/models/buildings/india_street.glb', maxCount: 1, category: 'landmark' }, // was 'india_street' — renamed to avoid key collision with buildings section
    churchs: { url: '/models/landmarks/churchs.glb', maxCount: 1, category: 'landmark' },
  },
  // BUILDINGS — higher maxCount for district repetition
  buildings: {
    indian_shop: { url: '/models/buildings/indian_shop.glb', maxCount: 40, category: 'small_shop', scale: 'small_shop' },
    indian_house_old: { url: '/models/buildings/indian_house_old.glb', maxCount: 38, category: 'villa', scale: 'villa' },
    kirana_shop: { url: '/models/buildings/indian_village_kirana_shop.glb', maxCount: 36, category: 'small_shop', scale: 'small_shop' },
    store_one: { url: '/models/buildings/store_one.glb', maxCount: 34, category: 'commercial', scale: 'commercial' },
    phone_booth_coffee: { url: '/models/buildings/phone_booth_coffee_shop.glb', maxCount: 34, category: 'small_shop', scale: 'small_shop' },
    india_street: { url: '/models/buildings/india_street.glb', maxCount: 16, category: 'commercial', scale: 'commercial' },
    environment_block: { url: '/models/buildings/Environment.fbx', maxCount: 14, category: 'commercial', scale: 'commercial', isFBX: true },
  },
  // PROPS — max 2-3 each
  props: {
    water_tank: { url: '/models/props/chennai_water_tank.glb', maxCount: 3, category: 'prop' },
    clothes_line: { url: '/models/props/clothes_line.glb', maxCount: 3, category: 'prop' },
    street_lamp: { url: '/models/props/street_lamp.glb', maxCount: 3, category: 'prop' },
    flower_vendor: { url: '/models/props/flower_vendor.glb', maxCount: 3, category: 'prop' },
    junction_box_shrine: { url: '/models/props/junction_box_shrine.glb', maxCount: 2, category: 'prop' },
    residential_street: { url: '/models/props/residential_street.glb', maxCount: 2, category: 'prop' },
    tea_shop: { url: '/models/props/tea_shop.glb', maxCount: 3, category: 'prop' },
    dustbin: { url: '/models/props/dustbin.glb', maxCount: 3, category: 'prop' },
    post_box: { url: '/models/props/post_box.glb', maxCount: 2, category: 'prop' },
    street_wall: { url: '/models/props/street_wall.fbx', maxCount: 2, category: 'prop', isFBX: true },
  },
  // VEHICLES — no maxCount (spawned by traffic system)
  vehicles: {
    lorry: { url: '/models/vehicles/tamilnadu_lorry.glb', category: 'vehicle' },
    setc_bus: { url: '/models/vehicles/tamilnadu_setc_bus_2017-2026.glb', category: 'vehicle' },
    tnstc_bus: { url: '/models/vehicles/tamilnadu_tnstc_bus.glb', category: 'vehicle' },
    balaji_bus: { url: '/models/vehicles/balaji_bus.glb', category: 'vehicle' },
    ashok_truck: { url: '/models/vehicles/ashok_leyland_truck.glb', category: 'vehicle' },
    maruti_800: { url: '/models/vehicles/maruti_800.glb', category: 'vehicle' },
    maruti_800_ac: { url: '/models/vehicles/maruti_800_ac.glb', category: 'vehicle' },
    hundai_car: { url: '/models/vehicles/hundai car.glb', category: 'vehicle' },
    red_motorcycle: { url: '/models/vehicles/red_motorcycle.glb', category: 'vehicle' },
    tuk_tuk: { url: '/models/vehicles/tuk_tuk_rikshaw.glb', category: 'vehicle' },
  },
  // CHARACTERS
  characters: {
    village_woman: { url: '/models/characters/village_woman.glb', category: 'character' },
  },
};

// ── Fallback tint colors by asset URL pattern ─────────────────
const FALLBACK_COLORS = [
  { test: 'water_tank', color: 0x2d3a42 },
  { test: 'street_lamp', color: 0x4a4235 },
  { test: 'junction', color: 0x8d7a62 },
  { test: 'flower', color: 0x9a5a32 },
  { test: 'clothes', color: 0x7f735f },
  { test: 'tea_shop', color: 0x7a5532 },
  { test: 'dustbin', color: 0x3a4a3d },
  { test: 'post_box', color: 0x8a2222 },
  { test: 'temple', color: 0x7d7467 },
  { test: 'shop', color: 0x8a7a5a },
  { test: 'house', color: 0x9a8a6a },
  { test: 'store', color: 0x7a6a5a },
  { test: 'street', color: 0x6a6055 },
  { test: 'slum', color: 0x6a5a4a },
  { test: 'phone_booth', color: 0x5a4a3a },
];

function getFallbackColor(url) {
  const lc = url.toLowerCase();
  const match = FALLBACK_COLORS.find(item => lc.includes(item.test));
  return match ? match.color : 0x8a7f6d;
}

// ── Singleton storage ─────────────────────────────────────────
// FIX #3: A single shared instance so City, StreetLife, and Landmarks
// all read/write the same placementCounts map — maxCount limits are
// enforced globally across all three modules, not just within each one.
let _sharedInstance = null;

export class AssetRegistry {

  constructor() {
    this.placementCounts = new Map();
  }

  /**
   * FIX #3: Singleton accessor.
   * Always use AssetRegistry.getInstance() instead of new AssetRegistry()
   * so placement counts are shared across City, StreetLife, and Landmarks.
   */
  static getInstance() {
    if (!_sharedInstance) _sharedInstance = new AssetRegistry();
    return _sharedInstance;
  }

  /** Reset the singleton — call this when loading a new scene. */
  static resetInstance() {
    _sharedInstance = null;
    modelCache.clear();
    pendingLoads.clear();
  }

  // ── Placement tracking ──────────────────────────────────────

  /**
   * Check if an asset can still be placed (has not exceeded maxCount).
   * FIX #11: Now logs a warning when the key is entirely unknown, making
   * typos/missing catalog entries visible during development.
   */
  canPlace(catalogSection, assetKey) {
    const entry = ASSET_CATALOG[catalogSection]?.[assetKey];
    if (!entry) {
      console.warn(`AssetRegistry.canPlace: unknown asset "${catalogSection}/${assetKey}"`);
      return false;
    }
    if (!entry.maxCount) return true; // vehicles/characters have no placement limit
    const key = `${catalogSection}/${assetKey}`;
    const count = this.placementCounts.get(key) || 0;
    return count < entry.maxCount;
  }

  /** Record that one instance of the asset has been placed. */
  recordPlacement(catalogSection, assetKey) {
    const key = `${catalogSection}/${assetKey}`;
    this.placementCounts.set(key, (this.placementCounts.get(key) || 0) + 1);
  }

  /** Return how many times the asset has been placed so far. */
  getCount(catalogSection, assetKey) {
    return this.placementCounts.get(`${catalogSection}/${assetKey}`) || 0;
  }

  // ── Asset loading ───────────────────────────────────────────

  /**
   * Load a model from the catalog and call onLoad with a prepared clone.
   * Handles caching, pending-load queuing, material normalisation, and shadows.
   */
  loadAsset(catalogSection, assetKey, onLoad, onError) {
    const entry = ASSET_CATALOG[catalogSection]?.[assetKey];
    if (!entry) {
      const msg = `Asset not found in catalog: ${catalogSection}/${assetKey}`;
      console.warn(msg);
      onError?.(msg);
      return;
    }

    const url = entry.url;
    const fallbackColor = getFallbackColor(url);

    const prepare = (source) => {
      const model = source.clone(true);
      model.traverse(obj => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (!obj.material) return;
        const materials = (Array.isArray(obj.material) ? obj.material : [obj.material])
          .map(m => m.clone());
        for (const mat of materials) {
          normalizeImportedMaterial(mat, fallbackColor);
          mat.needsUpdate = true;
        }
        obj.material = Array.isArray(obj.material) ? materials : materials[0];
      });
      onLoad(model);
    };

    // Cache hit
    if (modelCache.has(url)) {
      prepare(modelCache.get(url));
      return;
    }

    // Already loading — queue up
    if (pendingLoads.has(url)) {
      pendingLoads.get(url).push({ prepare, onError });
      return;
    }

    // First request for this URL — start loading
    pendingLoads.set(url, [{ prepare, onError }]);

    const loader = entry.isFBX ? fbxLoader : gltfLoader;
    loader.load(
      url,
      result => {
        const scene = entry.isFBX ? result : result.scene;
        if (!AssetRegistry.hasRenderableMesh(scene)) {
          console.warn(`Asset loaded without any renderable mesh: ${url}`);
          const waiting = pendingLoads.get(url) || [];
          pendingLoads.delete(url);
          for (const item of waiting) item.onError?.(new Error(`No renderable mesh in ${url}`));
          return;
        }
        modelCache.set(url, scene);
        const waiting = pendingLoads.get(url) || [];
        pendingLoads.delete(url);
        for (const item of waiting) item.prepare(scene);
      },
      undefined,
      err => {
        console.warn(`Failed to load ${url}:`, err);
        const waiting = pendingLoads.get(url) || [];
        pendingLoads.delete(url);
        for (const item of waiting) item.onError?.(err);
      }
    );
  }

  // ── Static helpers ──────────────────────────────────────────

  /**
   * Scale and ground a model to fit target dimensions.
   * Centers the model at world origin — callers must then set
   * model.position.x/z explicitly (never +=) to place in the world.
   */
  static fitModel(model, { targetFootprint, targetHeight, groundY = 0 }) {
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

    // Center horizontally, sit on ground
    model.position.x -= center.x;
    model.position.y += groundY - box.min.y;
    model.position.z -= center.z;

    model.updateMatrixWorld(true);
    return AssetRegistry.measure(model);
  }

  static fitByCategory(model, category, overrides = {}) {
    const preset = CATEGORY_SCALE_PRESETS[category] || {};
    return AssetRegistry.fitModel(model, { ...preset, ...overrides });
  }

  static measure(model) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    return { box, size, footprint: Math.max(size.x, size.z) };
  }

  static hasRenderableMesh(model) {
    let found = false;
    model?.traverse?.(obj => { if (obj.isMesh && obj.geometry) found = true; });
    return found;
  }

  /**
   * Snap a model so its lowest bounding-box point sits exactly on groundY.
   * Corrects floating/sunken assets caused by off-centre root nodes.
   */
  static snapToGround(model, groundY = 0) {
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    model.position.y += groundY - box.min.y;
    model.updateMatrixWorld(true);
  }

  /**
   * Apply randomised variation to a repeated placement to avoid obvious copy-paste.
   * Varies rotation, scale, tint, and roughness within tight ranges.
   */
  static applyVariation(model, rng, options = {}) {
    const { rotationRange = 0.3, scaleRange = 0.08, tintShift = true } = options;

    model.rotation.y += (rng() - 0.5) * rotationRange * 2;

    const scaleJitter = 1 + (rng() - 0.5) * scaleRange * 2;
    model.scale.multiplyScalar(scaleJitter);

    if (tintShift) {
      model.traverse(obj => {
        if (!obj.isMesh || !obj.material) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of mats) {
          if (!mat.map && mat.color) {
            const hsl = {};
            mat.color.getHSL(hsl);
            hsl.h += (rng() - 0.5) * 0.04;
            hsl.l *= 0.9 + rng() * 0.2;
            mat.color.setHSL(hsl.h, hsl.s, hsl.l);
          }
          if ('roughness' in mat) {
            mat.roughness = Math.min(1, mat.roughness + rng() * 0.1);
          }
        }
      });
    }
  }
}

// ── Material normalisation ────────────────────────────────────
/** Calibrate an imported material to blend with the scene's Chennai lighting. */
function normalizeImportedMaterial(mat, fallbackColor = 0x8d7a66) {
  if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
  if (mat.emissive) mat.emissive.setHex(0x000000);
  if ('emissiveIntensity' in mat) mat.emissiveIntensity = 0;
  if ('envMapIntensity' in mat) mat.envMapIntensity = 0.45;
  if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.75, 0.65);
  if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.3);
  mat.toneMapped = true;

  if (mat.color && !mat.map) {
    if (mat.color.r > 0.8 && mat.color.g > 0.8 && mat.color.b > 0.8) {
      // Near-white — replace with the asset-appropriate fallback tint
      mat.color.setHex(fallbackColor);
      mat.color.lerp(new THREE.Color(0xd4ac79), 0.15); // warm sunlight overlay
    } else {
      // Clamp saturation and add a dusty Chennai tone
      const hsl = {};
      mat.color.getHSL(hsl);
      mat.color.setHSL(hsl.h, Math.min(hsl.s, 0.6), hsl.l);
      mat.color.lerp(new THREE.Color(0xbba588), 0.1);
    }
  }
}