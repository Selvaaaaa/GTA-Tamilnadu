import * as THREE from 'three';

/* ────────────────────────
   Combat & Weapons System
   ──────────────────────── */

const WEAPONS = [
  { name:'Fists', damage:15, range:2.5, fireRate:0.4, auto:false, ammo:Infinity, maxAmmo:Infinity, reloadTime:0, type:'melee' },
  { name:'Pistol', damage:25, range:200, fireRate:0.3, auto:false, ammo:12, maxAmmo:12, reloadTime:1.2, type:'gun' },
  { name:'SMG', damage:12, range:150, fireRate:0.08, auto:true, ammo:30, maxAmmo:30, reloadTime:1.8, type:'gun' },
  { name:'Shotgun', damage:40, range:50, fireRate:0.7, auto:false, ammo:8, maxAmmo:8, reloadTime:2.2, type:'gun' },
];

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.weaponIndex = 0;
    this.ammo = WEAPONS.map(w => w.maxAmmo);
    this.fireCooldown = 0;
    this.reloading = false;
    this.reloadTimer = 0;
    this.muzzleFlashes = [];
    this.bulletTrails = [];
    this.impactMarkers = [];

    // Raycaster for shooting
    this.raycaster = new THREE.Raycaster();

    // Muzzle flash light
    this.flashLight = new THREE.PointLight(0xffaa44, 0, 15);
    scene.add(this.flashLight);
  }

  get weapon() { return WEAPONS[this.weaponIndex]; }
  get currentAmmo() { return this.ammo[this.weaponIndex]; }

  update(dt, input, player, camera, game) {
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    // Weapon switching
    if (input.justPressed('Digit1')) this._switchWeapon(0);
    if (input.justPressed('Digit2')) this._switchWeapon(1);
    if (input.justPressed('Digit3')) this._switchWeapon(2);
    if (input.justPressed('Digit4')) this._switchWeapon(3);

    // Reload
    if (input.justPressed('KeyR') && !this.reloading && this.weapon.type === 'gun') {
      this.reloading = true;
      this.reloadTimer = this.weapon.reloadTime;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.ammo[this.weaponIndex] = this.weapon.maxAmmo;
        this.reloading = false;
      }
      return;
    }

    // Fire
    const shouldFire = this.weapon.auto ? input.mouseDown : input.mouseJustPressed;
    if (shouldFire && this.fireCooldown <= 0 && this.currentAmmo > 0 && input.locked) {
      this._fire(player, camera, game);
      this.fireCooldown = this.weapon.fireRate;
      if (this.weapon.type === 'gun') this.ammo[this.weaponIndex]--;
    }

    // Update effects
    this._updateEffects(dt);

    // Dim flash light
    this.flashLight.intensity *= 0.85;
  }

  _switchWeapon(idx) {
    if (idx >= 0 && idx < WEAPONS.length) {
      this.weaponIndex = idx;
      this.reloading = false;
    }
  }

  _fire(player, camera, game) {
    const w = this.weapon;
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);

    if (w.type === 'melee') {
      // Melee: check NPCs in range in front of player
      this._meleeAttack(player, game);
      return;
    }

    // Gunshot
    if (w.name === 'Shotgun') {
      // Spread shot
      for (let i = 0; i < 6; i++) {
        const spread = dir.clone();
        spread.x += (Math.random()-0.5) * 0.1;
        spread.y += (Math.random()-0.5) * 0.1;
        spread.z += (Math.random()-0.5) * 0.1;
        spread.normalize();
        this._shootRay(origin, spread, w, game);
      }
    } else {
      const spread = dir.clone();
      spread.x += (Math.random()-0.5) * 0.02;
      spread.y += (Math.random()-0.5) * 0.02;
      this._shootRay(origin, spread, w, game);
    }

    // Muzzle flash
    this.flashLight.position.copy(origin).addScaledVector(dir, 2);
    this.flashLight.intensity = 3;

    // Alert nearby NPCs
    if (game.npcManager) game.npcManager.alertNearby(player.position, 40);

    // Add wanted level for shooting
    if (game.wanted) game.wanted.onShot();
  }

  _shootRay(origin, dir, weapon, game) {
    this.raycaster.set(origin, dir);
    this.raycaster.far = weapon.range;

    // Check NPC hits
    const allNPCs = game.npcManager ? game.npcManager.getNPCsAndPolice() : [];
    const npcMeshes = allNPCs.map(n => n.mesh).filter(m => m.visible);
    const hits = this.raycaster.intersectObjects(npcMeshes, true);

    if (hits.length > 0) {
      const hitObj = hits[0];
      // Find which NPC was hit
      for (const npc of allNPCs) {
        let parent = hitObj.object;
        while (parent) {
          if (parent === npc.mesh) {
            npc.takeDamage(weapon.damage);
            if (npc.isPolice && game.wanted) game.wanted.onAttackPolice();
            else if (game.wanted) game.wanted.onAttackCivilian();
            break;
          }
          parent = parent.parent;
        }
      }
      this._addImpact(hitObj.point);
    }

    // Bullet trail
    const end = hits.length > 0 ? hits[0].point : origin.clone().addScaledVector(dir, weapon.range);
    this._addTrail(origin.clone().addScaledVector(dir, 2), end);
  }

  _meleeAttack(player, game) {
    const allNPCs = game.npcManager ? game.npcManager.getNPCsAndPolice() : [];
    for (const npc of allNPCs) {
      if (npc.mesh.position.distanceTo(player.position) < this.weapon.range) {
        npc.takeDamage(this.weapon.damage);
        if (npc.isPolice && game.wanted) game.wanted.onAttackPolice();
        else if (game.wanted) game.wanted.onAttackCivilian();
        break;
      }
    }
  }

  _addTrail(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.6 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTrails.push({ mesh: line, life: 0.1 });
  }

  _addImpact(point) {
    const geo = new THREE.SphereGeometry(0.15, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(point);
    this.scene.add(mesh);
    this.impactMarkers.push({ mesh, life: 0.3 });
  }

  _updateEffects(dt) {
    for (let i = this.bulletTrails.length - 1; i >= 0; i--) {
      this.bulletTrails[i].life -= dt;
      if (this.bulletTrails[i].life <= 0) {
        this.scene.remove(this.bulletTrails[i].mesh);
        this.bulletTrails[i].mesh.geometry.dispose();
        this.bulletTrails.splice(i, 1);
      }
    }
    for (let i = this.impactMarkers.length - 1; i >= 0; i--) {
      this.impactMarkers[i].life -= dt;
      if (this.impactMarkers[i].life <= 0) {
        this.scene.remove(this.impactMarkers[i].mesh);
        this.impactMarkers[i].mesh.geometry.dispose();
        this.impactMarkers.splice(i, 1);
      }
    }
  }
}
