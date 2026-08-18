import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/* ═══════════════════════════════════════════════
   Cinematic Player Character
   Smooth geometry, reference-matched appearance
   Grey henley shirt, Indian skin tone
   ═══════════════════════════════════════════════ */

const WALK_SPEED = 5, RUN_SPEED = 10, SPRINT_SPEED = 16;
const GRAVITY = 25, JUMP_FORCE = 10;
const CAM_DIST = 8, CAM_HEIGHT = 4, MOUSE_SENS = 0.002;
const PLAYER_MODEL_URL = '/models/player/model.fbx';
const MODEL_HEIGHT = 2.15;
const MODEL_YAW_OFFSET = Math.PI;

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.health = 100; this.maxHealth = 100;
    // Spawn player on an intersection (x=0, z=0)
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0.3;
    this.onGround = true; this.inVehicle = false;
    this.currentVehicle = null;
    this.moving = false; this.sprinting = false;
    this.animTime = 0; this.breathTime = 0;
    this.headBobTime = 0; this.landSquash = 0;

    // Spring-damped camera
    this.camVel = new THREE.Vector3();
    this.camPos = new THREE.Vector3(0, 10, 20);
    this.camTarget = new THREE.Vector3();

    this.group = new THREE.Group();
    this.fallbackRoot = new THREE.Group();
    this.group.add(this.fallbackRoot);
    this.modelRoot = null;
    this.modelBaseY = 0;
    this.modelReady = false;
    this.modelMixer = null;
    this.walkAction = null;
    this._buildCharacter();
    this._loadCharacterModel();
    scene.add(this.group);
  }

  _buildCharacter() {
    // Materials matching reference: Indian skin, grey henley zip shirt, black pants
    const skinTone = 0xb5845a;
    const shirtColor = 0x8899aa;  // grey henley
    const pantsColor = 0x1a1a22;  // black pants
    const shoeColor = 0x0a0a0a;
    const hairColor = 0x0a0a0a;
    const beltColor = 0x2a1a0a;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.55, metalness: 0.05 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75, metalness: 0.02 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.7, metalness: 0.02 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: shoeColor, roughness: 0.6, metalness: 0.1 });
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85, metalness: 0 });
    const beltMat = new THREE.MeshStandardMaterial({ color: beltColor, roughness: 0.5, metalness: 0.2 });

    // ── Head (high-segment sphere for smoothness) ──
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 16, 12), skinMat);
    this.head.scale.set(1, 1.12, 0.95); this.head.position.y = 2.0;
    this.head.castShadow = true; this.fallbackRoot.add(this.head);

    // Nose
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 8), skinMat);
    nose.rotation.x = Math.PI / 2; nose.position.set(0, 1.97, -0.27);
    this.fallbackRoot.add(nose);

    // Ears
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), skinMat);
      ear.scale.set(0.5, 1, 0.7); ear.position.set(sx * 0.26, 2.0, 0);
      this.fallbackRoot.add(ear);
    }

    // ── Wavy dark hair (layered spheres for volume) ──
    const hairBase = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hairBase.position.y = 2.08; this.fallbackRoot.add(hairBase);
    // Side volume
    for (const sx of [-1, 1]) {
      const sideH = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), hairMat);
      sideH.position.set(sx * 0.2, 2.12, -0.05); sideH.scale.set(1, 1.2, 1.1);
      this.fallbackRoot.add(sideH);
    }
    // Back hair
    const backH = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), hairMat);
    backH.position.set(0, 2.0, 0.12); backH.scale.set(1.3, 0.8, 0.6);
    this.fallbackRoot.add(backH);

    // ── Thalapathy Signature (Sunglasses & Beard) ──
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.02), glassMat);
      lens.position.set(sx * 0.11, 2.03, -0.26);
      lens.rotation.y = sx * 0.1;
      this.fallbackRoot.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), glassMat);
    bridge.position.set(0, 2.04, -0.27);
    this.fallbackRoot.add(bridge);

    const beard = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 12, Math.PI), hairMat);
    beard.rotation.x = Math.PI / 2 + 0.2;
    beard.rotation.z = Math.PI;
    beard.position.set(0, 1.88, -0.15);
    this.fallbackRoot.add(beard);

    // ── Neck ──
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 12), skinMat);
    neck.position.y = 1.78; this.fallbackRoot.add(neck);

    // ── Torso (shirt — slightly tapered) ──
    this.torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.28, 0.85, 14),
      shirtMat
    );
    this.torso.position.y = 1.3; this.torso.castShadow = true; this.fallbackRoot.add(this.torso);

    // Shirt zip detail (dark line down center)
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    zip.position.set(0, 1.45, -0.29); this.fallbackRoot.add(zip);

    // Collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 16, Math.PI), shirtMat);
    collar.rotation.x = -0.3; collar.position.set(0, 1.72, -0.1);
    this.fallbackRoot.add(collar);

    // ── Shoulders ──
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), shirtMat);
      sh.position.set(sx * 0.4, 1.68, 0); this.fallbackRoot.add(sh);
    }

    // ── Belt ──
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.06, 14), beltMat);
    belt.position.y = 0.86; this.fallbackRoot.add(belt);
    // Buckle
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.2 }));
    buckle.position.set(0, 0.86, -0.3); this.fallbackRoot.add(buckle);

    // ── Arms ──
    this.leftArm = this._createArm(shirtMat, skinMat);
    this.leftArm.position.set(-0.48, 1.62, 0); this.fallbackRoot.add(this.leftArm);
    this.rightArm = this._createArm(shirtMat, skinMat);
    this.rightArm.position.set(0.48, 1.62, 0); this.fallbackRoot.add(this.rightArm);

    // ── Legs ──
    this.leftLeg = this._createLeg(pantsMat, shoeMat);
    this.leftLeg.position.set(-0.16, 0.82, 0); this.fallbackRoot.add(this.leftLeg);
    this.rightLeg = this._createLeg(pantsMat, shoeMat);
    this.rightLeg.position.set(0.16, 0.82, 0); this.fallbackRoot.add(this.rightLeg);
  }

  _loadCharacterModel() {
    const loader = new FBXLoader();
    loader.load(
      PLAYER_MODEL_URL,
      model => {
        this._prepareLoadedModel(model);
        this.modelRoot = model;
        this._setupModelAnimations(model);
        this.group.add(model);
        this.fallbackRoot.visible = false;
        this.modelReady = true;
        console.log('Player model loaded:', PLAYER_MODEL_URL);
      },
      undefined,
      err => {
        console.warn('Player FBX failed to load, using fallback character.', err);
      }
    );
  }

  _prepareLoadedModel(model) {
    model.rotation.y = MODEL_YAW_OFFSET;
    model.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const mat of materials) {
          mat.side = THREE.FrontSide;
          mat.needsUpdate = true;
        }
      }
    });

    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? MODEL_HEIGHT / size.y : 1;
    model.scale.setScalar(scale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    this.modelBaseY = model.position.y;
  }

  _setupModelAnimations(model) {
    if (!model.animations || model.animations.length === 0) return;

    this.modelMixer = new THREE.AnimationMixer(model);
    this.walkAction = this.modelMixer.clipAction(model.animations[0]);
    this.walkAction.enabled = true;
    this.walkAction.setLoop(THREE.LoopRepeat);
    this.walkAction.play();
    this.walkAction.paused = true;
  }

  _createArm(clothMat, skinMat) {
    const pivot = new THREE.Group();
    // Upper arm (sleeve)
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.42, 12), clothMat);
    upper.position.y = -0.2; upper.castShadow = true; pivot.add(upper);
    // Lower arm (skin — exposed forearm)
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.38, 12), skinMat);
    lower.position.y = -0.52; lower.castShadow = true; pivot.add(lower);
    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat);
    hand.scale.set(1, 0.7, 1.2); hand.position.y = -0.74; pivot.add(hand);
    // Fingers (4 small cylinders)
    for (let f = 0; f < 4; f++) {
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.01, 0.06, 6), skinMat);
      finger.position.set(-0.025 + f * 0.018, -0.79, -0.03);
      finger.rotation.x = 0.3; pivot.add(finger);
    }
    // Thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.05, 6), skinMat);
    thumb.position.set(0.04, -0.73, -0.04); thumb.rotation.z = 0.5; pivot.add(thumb);
    return pivot;
  }

  _createLeg(pantsMat, shoeMat) {
    const pivot = new THREE.Group();
    // Upper leg
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.4, 12), pantsMat);
    upper.position.y = -0.2; upper.castShadow = true; pivot.add(upper);
    // Lower leg
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.38, 12), pantsMat);
    lower.position.y = -0.52; lower.castShadow = true; pivot.add(lower);
    // Shoe
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.2), shoeMat);
    shoe.position.set(0, -0.74, 0.03); pivot.add(shoe);
    // Sole
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.02, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 }));
    sole.position.set(0, -0.78, 0.03); pivot.add(sole);
    return pivot;
  }

  update(dt, input, camera, game) {
    if (this.inVehicle) { this._updateInVehicle(dt, input, camera); return; }

    // Mouse look
    const md = input.getMouseDelta();
    if (input.locked) {
      this.yaw -= md.x * MOUSE_SENS;
      this.pitch -= md.y * MOUSE_SENS;
      this.pitch = Math.max(-0.5, Math.min(1.2, this.pitch));
    }

    // Movement
    this.sprinting = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = this.sprinting ? SPRINT_SPEED : (input.isDown('KeyW') || input.isDown('KeyS') ? RUN_SPEED : WALK_SPEED);

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const moveDir = new THREE.Vector3();
    if (input.isDown('KeyW')) moveDir.add(forward);
    if (input.isDown('KeyS')) moveDir.sub(forward);
    if (input.isDown('KeyA')) moveDir.sub(right);
    if (input.isDown('KeyD')) moveDir.add(right);

    this.moving = moveDir.lengthSq() > 0.01;
    if (this.moving) {
      moveDir.normalize().multiplyScalar(speed);
      this.velocity.x = moveDir.x; this.velocity.z = moveDir.z;
    } else {
      this.velocity.x *= 0.85; this.velocity.z *= 0.85;
    }

    // Jump
    if (input.justPressed('Space') && this.onGround) {
      this.velocity.y = JUMP_FORCE; this.onGround = false;
    }

    // Gravity
    if (!this.onGround) this.velocity.y -= GRAVITY * dt;

    // Apply movement
    const newPos = this.position.clone();
    newPos.x += this.velocity.x * dt;
    newPos.z += this.velocity.z * dt;
    newPos.y += this.velocity.y * dt;

    // Building collision
    if (game.city && game.city.isInsideBuilding(newPos.x, newPos.z, 0.8)) {
      const testX = this.position.clone(); testX.x = newPos.x;
      const testZ = this.position.clone(); testZ.z = newPos.z;
      if (!game.city.isInsideBuilding(testX.x, testX.z, 0.8)) newPos.z = this.position.z;
      else if (!game.city.isInsideBuilding(testZ.x, testZ.z, 0.8)) newPos.x = this.position.x;
      else { newPos.x = this.position.x; newPos.z = this.position.z; }
    }

    // Ground
    const wasAirborne = !this.onGround;
    if (newPos.y <= 0) {
      newPos.y = 0; this.velocity.y = 0; this.onGround = true;
      if (wasAirborne) this.landSquash = 0.3;
    }

    this.position.copy(newPos);
    if (game.city?.clampToWorld) {
      game.city.clampToWorld(this.position, 0.9);
    } else {
      const bound = game.city ? game.city.halfCity : 500;
      this.position.x = Math.max(-bound, Math.min(bound, this.position.x));
      this.position.z = Math.max(-bound, Math.min(bound, this.position.z));
    }

    // Update mesh
    this.group.position.copy(this.position);
    if (this.moving) {
      this.group.rotation.y = Math.atan2(this.velocity.x, this.velocity.z);
    }

    this._animateLimbs(dt);
    this._animateBreathing(dt);
    this._animateLandSquash(dt);
    this._updateModelAnimation(dt);
    this._animateLoadedModel(dt);
    this._updateCamera(dt, camera);

    if (game.environment) game.environment.followPlayer(this.position);
    if (game.audio && this.moving && this.onGround) game.audio.footstep(dt, this.sprinting);
  }

  _animateLimbs(dt) {
    if (this.moving) {
      const rate = this.sprinting ? 12 : 8;
      this.animTime += dt * rate;
      const swing = Math.sin(this.animTime) * (this.sprinting ? 0.8 : 0.5);
      this.leftArm.rotation.x = swing; this.rightArm.rotation.x = -swing;
      this.leftLeg.rotation.x = -swing; this.rightLeg.rotation.x = swing;
      if (this.sprinting) {
        this.torso.rotation.x = 0.08; this.head.rotation.x = -0.05;
      } else {
        this.torso.rotation.x *= 0.9; this.head.rotation.x *= 0.9;
      }
    } else {
      this.animTime = 0;
      for (const l of [this.leftArm, this.rightArm, this.leftLeg, this.rightLeg]) l.rotation.x *= 0.85;
      this.torso.rotation.x *= 0.9; this.head.rotation.x *= 0.9;
    }
  }

  _animateBreathing(dt) {
    this.breathTime += dt * 2.5;
    const b = Math.sin(this.breathTime) * 0.008;
    this.torso.scale.set(1, 1 + b, 1 + b * 0.6);
    if (!this.moving) {
      this.leftArm.rotation.z = Math.sin(this.breathTime * 0.7) * 0.015;
      this.rightArm.rotation.z = -Math.sin(this.breathTime * 0.7) * 0.015;
    }
  }

  _animateLoadedModel(dt) {
    if (!this.modelRoot) return;

    if (this.moving && this.onGround) {
      const bob = this.walkAction ? 0 : Math.abs(Math.sin(this.animTime)) * (this.sprinting ? 0.06 : 0.035);
      this.modelRoot.position.y = this.modelBaseY + bob;
      this.modelRoot.rotation.x = THREE.MathUtils.lerp(this.modelRoot.rotation.x, this.sprinting ? 0.06 : 0.025, dt * 8);
    } else {
      const idle = Math.sin(this.breathTime) * 0.012;
      this.modelRoot.position.y = this.modelBaseY + idle;
      this.modelRoot.rotation.x = THREE.MathUtils.lerp(this.modelRoot.rotation.x, 0, dt * 6);
    }
  }

  _updateModelAnimation(dt) {
    if (!this.modelMixer || !this.walkAction) return;

    if (this.moving && this.onGround) {
      this.walkAction.paused = false;
      this.walkAction.timeScale = this.sprinting ? 1.45 : 1.0;
      this.modelMixer.update(dt);
    } else {
      this.walkAction.paused = true;
      this.walkAction.time = 0;
      this.modelMixer.setTime(0);
    }
  }

  _animateLandSquash(dt) {
    if (this.landSquash > 0) {
      this.landSquash -= dt * 3;
      const s = Math.max(0, this.landSquash);
      this.group.scale.set(1 + s * 0.15, 1 - s * 0.2, 1 + s * 0.15);
    } else {
      this.group.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8);
    }
  }

  _updateCamera(dt, camera) {
    this.camTarget.set(this.position.x, this.position.y + 2.2, this.position.z);

    const dist = CAM_DIST;
    let idealX = this.position.x + Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
    let idealY = this.position.y + CAM_HEIGHT + Math.sin(this.pitch) * dist * 0.5;
    let idealZ = this.position.z + Math.cos(this.yaw) * Math.cos(this.pitch) * dist;

    // Head bob
    if (this.moving && this.onGround) {
      this.headBobTime += dt * (this.sprinting ? 14 : 9);
      idealY += Math.sin(this.headBobTime) * 0.05;
      idealX += Math.cos(this.headBobTime * 0.5) * 0.02;
    }

    // Spring-damped camera (critically damped for cinematic feel)
    const stiffness = 8, damping = 5.6;
    const ideal = new THREE.Vector3(idealX, idealY, idealZ);
    const force = ideal.clone().sub(this.camPos).multiplyScalar(stiffness);
    this.camVel.add(force.multiplyScalar(dt));
    this.camVel.multiplyScalar(Math.exp(-damping * dt));
    this.camPos.add(this.camVel.clone().multiplyScalar(dt));

    camera.position.copy(this.camPos);
    camera.lookAt(this.camTarget);
  }

  _updateInVehicle(dt, input, camera) {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle;
    this.position.copy(v.mesh.position);
    this.group.position.copy(v.mesh.position); this.group.position.y += 0.5;
    this.group.visible = false;

    const vRot = v.mesh.rotation.y;
    const idealX = v.mesh.position.x + Math.sin(vRot) * 12;
    const idealY = v.mesh.position.y + 5;
    const idealZ = v.mesh.position.z + Math.cos(vRot) * 12;

    const t = 1 - Math.exp(-4 * dt);
    this.camPos.lerp(new THREE.Vector3(idealX, idealY, idealZ), t);
    camera.position.copy(this.camPos);
    camera.lookAt(v.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  }

  enterVehicle(vehicle) {
    this.inVehicle = true; this.currentVehicle = vehicle;
    vehicle.occupied = true; this.group.visible = false;
  }

  exitVehicle() {
    if (!this.currentVehicle) return;
    const v = this.currentVehicle; v.occupied = false;
    const side = new THREE.Vector3(Math.cos(v.mesh.rotation.y) * 3, 0, -Math.sin(v.mesh.rotation.y) * 3);
    this.position.copy(v.mesh.position).add(side); this.position.y = 0;
    this.inVehicle = false; this.currentVehicle = null;
    this.group.visible = true; this.yaw = v.mesh.rotation.y + Math.PI;
  }

  takeDamage(amount) { this.health = Math.max(0, this.health - amount); }
  heal(amount) { this.health = Math.min(this.maxHealth, this.health + amount); }
  respawn() {
    this.health = this.maxHealth; this.position.set(0, 0, 0); this.velocity.set(0, 0, 0);
    if (this.inVehicle) this.exitVehicle(); this.group.visible = true;
  }
}
