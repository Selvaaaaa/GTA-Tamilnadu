/* ═══════════════════════════════
   Asset NPC System
   Pedestrians and police are loaded only from public/models/characters.
   Now with realistic Chennai behavior.
   ═══════════════════════════════ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MAX_NPCS = 52, SPAWN_R = 115, DESPAWN_R = 175, NPC_SPEED = 1.65, POLICE_SPEED = 7;
const NPC_HEIGHT = 1.75;
const PEDESTRIAN_MODELS = [
  '/models/characters/dhanush%20npc.glb',
  '/models/characters/rohit%20npc.glb',
  '/models/characters/indian%20npc.glb',
  '/models/characters/village_woman.glb',
  '/models/characters/SouthIndianWomen.fbx',
];
const POLICE_MODEL = '/models/characters/police.glb';

const gltfLoader = new GLTFLoader();
const fbxLoader = new FBXLoader();
const cache = new Map();
const pending = new Map();

function loadCharacter(url, onLoad) {
  const prepare = source => {
    const model = source.clone(true);
    model.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (!obj.material) return;
      const mats = (Array.isArray(obj.material) ? obj.material : [obj.material]).map(mat => mat.clone());
      for (const mat of mats) {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 0.7, 0.65);
        if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.25);
        mat.toneMapped = true;
        mat.needsUpdate = true;
      }
      obj.material = Array.isArray(obj.material) ? mats : mats[0];
    });
    fitCharacter(model);
    onLoad(model);
  };

  if (cache.has(url)) {
    prepare(cache.get(url));
    return;
  }
  if (pending.has(url)) {
    pending.get(url).push(prepare);
    return;
  }
  pending.set(url, [prepare]);

  const isFBX = url.toLowerCase().endsWith('.fbx');
  const loader = isFBX ? fbxLoader : gltfLoader;
  loader.load(
    url,
    result => {
      const source = isFBX ? result : result.scene;
      cache.set(url, source);
      const waiting = pending.get(url) || [];
      pending.delete(url);
      for (const callback of waiting) callback(source);
    },
    undefined,
    err => {
      pending.delete(url);
      console.warn(`NPC character asset failed: ${url}`, err);
    }
  );
}

function fitCharacter(model) {
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? NPC_HEIGHT / size.y : 1;
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= box.min.y;
  model.position.z -= center.z;
  model.userData.baseY = model.position.y;
  model.updateMatrixWorld(true);
}

class NPC {
  constructor(scene, x, z, isPolice = false, manager) {
    this.scene = scene;
    this.manager = manager;
    this.isPolice = isPolice;
    this.alive = true;
    this.health = isPolice ? 90 : 45;
    this.baseSpeed = isPolice ? POLICE_SPEED : (NPC_SPEED * (0.8 + Math.random() * 0.4));
    this.fleeing = false;
    this.chasing = false;
    this.state = 'walk'; // walk, idle, interact
    this.stateTimer = 0;
    this.animTime = Math.random() * 10;
    this.persona = isPolice ? 'police' : this._pickPersona(x, z);
    
    this.mesh = new THREE.Group();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);

    this.pickNewTarget(x, z);

    const url = isPolice ? POLICE_MODEL : PEDESTRIAN_MODELS[Math.floor(Math.random() * PEDESTRIAN_MODELS.length)];
    loadCharacter(url, model => {
      this.model = model;
      this.mesh.add(model);
    });
  }

  _pickPersona(x, z) {
    if (z > 130) return Math.random() > 0.5 ? 'fisher_family' : 'jogger';
    if (x > 100) return Math.random() > 0.5 ? 'it_employee' : 'college_student';
    if (Math.abs(x) < 80 && Math.abs(z) < 90) return Math.random() > 0.45 ? 'vendor' : 'shopper';
    return ['shopper', 'college_student', 'vendor', 'office_worker'][Math.floor(Math.random() * 4)];
  }

  pickNewTarget(x, z) {
    const city = this.manager?.city;
    if (city?.activityZones && Math.random() < 0.28) {
      const zone = city.activityZones[Math.floor(Math.random() * city.activityZones.length)];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * zone.radius;
      this.targetX = zone.x + Math.cos(a) * r;
      this.targetZ = zone.z + Math.sin(a) * r;
    } else if (city?.getRandomSidewalkPoint) {
      const p = city.getRandomSidewalkPoint(Math.random, new THREE.Vector3(x, 0, z), 85);
      this.targetX = p.x;
      this.targetZ = p.z;
    } else {
      this.targetX = x + (Math.random() - 0.5) * 40;
      this.targetZ = z + (Math.random() - 0.5) * 40;
    }

    if (city?.clampToWorld) {
      const p = city.clampToWorld(new THREE.Vector3(this.targetX, 0, this.targetZ), 2);
      this.targetX = p.x; this.targetZ = p.z;
    }
    this.stateTimer = 5 + Math.random() * 10;
  }

  update(dt, playerPos, wantedLevel, allNpcs) {
    if (!this.alive) return;
    const pos = this.mesh.position;
    const dx = playerPos.x - pos.x, dz = playerPos.z - pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    let speed = this.baseSpeed;

    this.stateTimer -= dt;

    if (this.isPolice && wantedLevel > 0) {
      this.chasing = true;
      speed = POLICE_SPEED + wantedLevel;
      const a = Math.atan2(dx, dz);
      pos.x += Math.sin(a) * speed * dt;
      pos.z += Math.cos(a) * speed * dt;
      if (this.manager?.city?.clampToWorld) this.manager.city.clampToWorld(pos, 1);
      this.targetRot = a;
    } else if (this.fleeing) {
      const a = Math.atan2(-dx, -dz);
      pos.x += Math.sin(a) * speed * 2 * dt;
      pos.z += Math.cos(a) * speed * 2 * dt;
      if (this.manager?.city?.clampToWorld) this.manager.city.clampToWorld(pos, 1);
      this.targetRot = a;
      if (dist > 65) this.fleeing = false;
    } else {
      if (this.state === 'idle') {
        speed = 0;
        if (this.stateTimer <= 0) {
          this.state = 'walk';
          this.pickNewTarget(pos.x, pos.z);
        }
      } else if (this.state === 'walk') {
        const tdx = this.targetX - pos.x, tdz = this.targetZ - pos.z;
        const td = Math.sqrt(tdx * tdx + tdz * tdz);
        
        if (td < 1.5 || this.stateTimer <= 0) {
          if (Math.random() > 0.7) {
            this.state = 'idle';
            this.stateTimer = 2 + Math.random() * 8; // Shop browsing / waiting
          } else {
            this.pickNewTarget(pos.x, pos.z);
          }
        } else {
          // Avoidance
          let avoidX = 0, avoidZ = 0;
          for (const n of allNpcs) {
            if (n === this) continue;
            const ndx = pos.x - n.mesh.position.x;
            const ndz = pos.z - n.mesh.position.z;
            const nd = ndx * ndx + ndz * ndz;
            if (nd > 0 && nd < 4) {
              const dSq = Math.sqrt(nd);
              avoidX += (ndx / dSq) * 1.5;
              avoidZ += (ndz / dSq) * 1.5;
            }
          }
          
          let ax = tdx + avoidX * td;
          let az = tdz + avoidZ * td;
          const city = this.manager?.city;
          if (city?.isInsideBuilding?.(pos.x + Math.sign(ax) * 1.2, pos.z + Math.sign(az) * 1.2, 0.8, 0.8, 0.6)) {
            this.pickNewTarget(pos.x, pos.z);
            ax = this.targetX - pos.x;
            az = this.targetZ - pos.z;
          }
          
          const a = Math.atan2(ax, az);
          pos.x += Math.sin(a) * speed * dt;
          pos.z += Math.cos(a) * speed * dt;
          if (city?.clampToWorld) city.clampToWorld(pos, 1);
          this.targetRot = a;
        }
      }
    }

    if (this.targetRot !== undefined) {
      // Smooth rotation
      let diff = this.targetRot - this.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.mesh.rotation.y += diff * 10 * dt;
    }

    this.animTime += dt * (speed > 0 ? (this.fleeing ? 10 : (this.chasing ? 9 : 4.5)) : 1);
    if (this.model) {
      if (speed > 0) {
        const movingBob = Math.abs(Math.sin(this.animTime)) * (this.chasing || this.fleeing ? 0.04 : 0.02);
        this.model.position.y = (this.model.userData.baseY || 0) + movingBob;
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, (this.chasing || this.fleeing) ? 0.06 : 0.02, dt * 6);
      } else {
        this.model.position.y = this.model.userData.baseY || 0;
        this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, 0, dt * 6);
      }
    }
  }

  flee() { this.fleeing = true; this.state = 'walk'; }
  takeDamage(a) {
    this.health -= a;
    if (this.health <= 0) {
      this.alive = false;
      this.mesh.visible = false;
    }
  }
  destroy() { this.scene.remove(this.mesh); }
}

export class NPCManager {
  constructor(scene) {
    this.scene = scene;
    this.npcs = [];
    this.policeNPCs = [];
    this.spawnTimer = 0;
    this.city = null;
  }

  update(dt, player, wanted, city) {
    this.city = city || this.city;
    const pp = player.position, wl = wanted ? wanted.level : 0;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.npcs.length < MAX_NPCS) {
      this.spawnTimer = 0.32;
      const p = this.city?.getRandomSidewalkPoint
        ? this.city.getRandomSidewalkPoint(Math.random, pp, SPAWN_R)
        : new THREE.Vector3(pp.x + Math.cos(Math.random() * Math.PI * 2) * SPAWN_R, 0, pp.z + Math.sin(Math.random() * Math.PI * 2) * SPAWN_R);
      if (!this.city?.isInsideBuilding?.(p.x, p.z, 1, 1, 0.5)) {
        this.npcs.push(new NPC(this.scene, p.x, p.z, false, this));
      }
    }

    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      n.update(dt, pp, 0, this.npcs);
      if (n.mesh.position.distanceTo(pp) > DESPAWN_R || !n.alive) {
        n.destroy();
        this.npcs.splice(i, 1);
      }
    }

    const targetP = wl * 2;
    while (this.policeNPCs.length < targetP) {
      const a = Math.random() * Math.PI * 2, d = 32 + Math.random() * 24;
      const p = new THREE.Vector3(pp.x + Math.cos(a) * d, 0, pp.z + Math.sin(a) * d);
      if (this.city?.clampToWorld) this.city.clampToWorld(p, 2);
      this.policeNPCs.push(new NPC(this.scene, p.x, p.z, true, this));
    }

    for (let i = this.policeNPCs.length - 1; i >= 0; i--) {
      const p = this.policeNPCs[i];
      p.update(dt, pp, wl, this.policeNPCs);
      if (!p.alive) {
        p.destroy();
        this.policeNPCs.splice(i, 1);
        continue;
      }
      if (p.chasing && p.mesh.position.distanceTo(pp) < 1.8) player.takeDamage(15 * dt);
    }

    if (wl === 0 && this.policeNPCs.length > 0) {
      for (const p of this.policeNPCs) p.destroy();
      this.policeNPCs = [];
    }
  }

  alertNearby(pos, r) {
    for (const n of this.npcs) if (n.mesh.position.distanceTo(pos) < r) n.flee();
  }
  getNPCsAndPolice() { return [...this.npcs, ...this.policeNPCs]; }
}
