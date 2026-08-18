import * as THREE from 'three';

/* ═══════════════════════════════════
   Chennai Wildlife
   Birds, stray dogs, stray cats
   ═══════════════════════════════════ */

export class Wildlife {
  constructor(scene) {
    this.scene = scene;
    this.birds = [];
    this.dogs = [];
    this.cats = [];
  }

  build(cityHalf) {
    this._spawnBirds(cityHalf);
    this._spawnDogs(cityHalf);
    this._spawnCats(cityHalf);
  }

  /* ── Birds — triangle flocks ── */
  _spawnBirds(half) {
    const birdMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, side: THREE.DoubleSide });

    for (let f = 0; f < 5; f++) {
      const cx = (Math.random() - 0.5) * half;
      const cz = (Math.random() - 0.5) * half;
      const baseH = 30 + Math.random() * 30;
      const flock = {
        cx, cz, baseH,
        angle: Math.random() * Math.PI * 2,
        radius: 20 + Math.random() * 30,
        // FIX #23: Give each flock a migration velocity so flocks drift across
        // the city instead of orbiting a fixed point forever.
        vx: (Math.random() - 0.5) * 2,
        vz: (Math.random() - 0.5) * 2,
        members: []
      };

      for (let b = 0; b < 6; b++) {
        const bird = new THREE.Group();

        const body = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 4), birdMat);
        body.rotation.x = Math.PI / 2; bird.add(body);

        const lWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), birdMat);
        lWing.position.set(-0.35, 0, 0); bird.add(lWing);

        const rWing = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), birdMat);
        rWing.position.set(0.35, 0, 0); bird.add(rWing);

        bird.position.set(
          cx + (Math.random() - 0.5) * 10,
          baseH + (Math.random() - 0.5) * 5,
          cz + (Math.random() - 0.5) * 10
        );
        bird.userData = {
          lWing, rWing,
          offset: Math.random() * Math.PI * 2,
          flockIdx: f
        };
        this.scene.add(bird);
        flock.members.push(bird);
      }
      this.birds.push(flock);
    }
  }

  /* ── Stray dogs ── */
  _spawnDogs(half) {
    const dogColors = [0x8B6914, 0x554422, 0x998877, 0x443322, 0xBBAA88];

    for (let i = 0; i < 5; i++) {
      const color = dogColors[Math.floor(Math.random() * dogColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
      const g = new THREE.Group();

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.9), mat);
      body.position.y = 0.4; body.castShadow = true; g.add(body);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 0.3), mat);
      head.position.set(0, 0.5, -0.5); g.add(head);

      // Snout
      const snout = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.1, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 })
      );
      snout.position.set(0, 0.45, -0.65); g.add(snout);

      // Ears
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.05), mat);
        ear.position.set(sx * 0.1, 0.62, -0.45); g.add(ear);
      }

      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.35, 6), mat);
      tail.position.set(0, 0.55, 0.4); tail.rotation.x = -0.6; g.add(tail);

      // Legs
      for (const sx of [-1, 1]) {
        for (const fz of [-0.3, 0.3]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6), mat);
          leg.position.set(sx * 0.15, 0.15, fz); g.add(leg);
        }
      }

      const x = (Math.random() - 0.5) * half;
      const z = (Math.random() - 0.5) * half;
      g.position.set(x, 0, z);
      g.userData = {
        targetX: x + (Math.random() - 0.5) * 40,
        targetZ: z + (Math.random() - 0.5) * 40,
        speed: 1 + Math.random() * 1.5,
        idle: Math.random() > 0.5,
        idleTimer: Math.random() * 8,
        tail,
        halfCity: half
      };
      this.scene.add(g);
      this.dogs.push(g);
    }
  }

  /* ── Stray cats ── */
  _spawnCats(half) {
    const catColors = [0x444444, 0xFFAA44, 0x222222, 0xBBBBBB, 0x886622];

    for (let i = 0; i < 4; i++) {
      const color = catColors[Math.floor(Math.random() * catColors.length)];
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
      const g = new THREE.Group();

      // Body
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.5), mat);
      body.position.y = 0.22; body.castShadow = true; g.add(body);

      // Head
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), mat);
      head.position.set(0, 0.3, -0.3); g.add(head);

      // Ears
      for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), mat);
        ear.position.set(sx * 0.06, 0.4, -0.3); g.add(ear);
      }

      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.3, 6), mat);
      tail.position.set(0, 0.28, 0.3); tail.rotation.x = -1; g.add(tail);

      // Legs
      for (const sx of [-1, 1]) {
        for (const fz of [-0.15, 0.15]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.15, 6), mat);
          leg.position.set(sx * 0.08, 0.08, fz); g.add(leg);
        }
      }

      const x = (Math.random() - 0.5) * half * 0.8;
      const z = (Math.random() - 0.5) * half * 0.8;
      g.position.set(x, 0, z);
      g.userData = {
        sitting: Math.random() > 0.4,
        walkTimer: Math.random() * 15,
        targetX: x,
        targetZ: z,
        speed: 0.5 + Math.random(),
        tail,
        halfCity: half * 0.8
      };
      this.scene.add(g);
      this.cats.push(g);
    }
  }

  update(dt) {
    this._updateBirds(dt);
    this._updateDogs(dt);
    this._updateCats(dt);
  }

  _updateBirds(dt) {
    const cityBound = 400; // soft boundary for flock migration

    for (const flock of this.birds) {
      flock.angle += dt * 0.3;

      // FIX #23: Advance flock center position so flocks migrate across the city.
      flock.cx += flock.vx * dt;
      flock.cz += flock.vz * dt;

      // Bounce off soft city boundary so flocks don't escape forever
      if (Math.abs(flock.cx) > cityBound) flock.vx *= -1;
      if (Math.abs(flock.cz) > cityBound) flock.vz *= -1;

      for (const bird of flock.members) {
        const off = bird.userData.offset;
        const a = flock.angle + off;

        bird.position.x = flock.cx + Math.cos(a) * flock.radius;
        bird.position.z = flock.cz + Math.sin(a) * flock.radius;
        bird.position.y = flock.baseH + Math.sin(a * 2 + off) * 3;
        bird.rotation.y = -a + Math.PI / 2;

        // Wing flap
        const flap = Math.sin(Date.now() * 0.008 + off * 10) * 0.5;
        bird.userData.lWing.rotation.z = flap;
        bird.userData.rWing.rotation.z = -flap;
      }
    }
  }

  _updateDogs(dt) {
    for (const dog of this.dogs) {
      const d = dog.userData;
      const half = d.halfCity;

      if (d.idle) {
        d.idleTimer -= dt;
        if (d.idleTimer <= 0) {
          d.idle = false;
          d.targetX = dog.position.x + (Math.random() - 0.5) * 40;
          d.targetZ = dog.position.z + (Math.random() - 0.5) * 40;
          // Keep target within city bounds
          d.targetX = Math.max(-half, Math.min(half, d.targetX));
          d.targetZ = Math.max(-half, Math.min(half, d.targetZ));
        }
        d.tail.rotation.z = Math.sin(Date.now() * 0.005) * 0.3;
      } else {
        const dx = d.targetX - dog.position.x;
        const dz = d.targetZ - dog.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 2) {
          d.idle = true;
          d.idleTimer = 3 + Math.random() * 8;
        } else {
          const a = Math.atan2(dx, dz);
          dog.position.x += Math.sin(a) * d.speed * dt;
          dog.position.z += Math.cos(a) * d.speed * dt;
          dog.rotation.y = a;
        }
        d.tail.rotation.z = Math.sin(Date.now() * 0.01) * 0.4;
      }
    }
  }

  _updateCats(dt) {
    for (const cat of this.cats) {
      const c = cat.userData;
      const half = c.halfCity;

      if (c.sitting) {
        c.walkTimer -= dt;
        if (c.walkTimer <= 0) {
          c.sitting = false;
          c.targetX = cat.position.x + (Math.random() - 0.5) * 15;
          c.targetZ = cat.position.z + (Math.random() - 0.5) * 15;
          // Keep target within city bounds
          c.targetX = Math.max(-half, Math.min(half, c.targetX));
          c.targetZ = Math.max(-half, Math.min(half, c.targetZ));
        }
        c.tail.rotation.z = Math.sin(Date.now() * 0.003) * 0.2;
      } else {
        const dx = c.targetX - cat.position.x;
        const dz = c.targetZ - cat.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < 1) {
          c.sitting = true;
          c.walkTimer = 5 + Math.random() * 15;
          // FIX #22: Animate tail while sitting after arriving (reset to idle wag).
          // The sitting branch already handles tail — this transition is now clean.
        } else {
          const a = Math.atan2(dx, dz);
          cat.position.x += Math.sin(a) * c.speed * dt;
          cat.position.z += Math.cos(a) * c.speed * dt;
          cat.rotation.y = a;
          // FIX #22: Cat tail now animates while walking, not just while sitting.
          c.tail.rotation.z = Math.sin(Date.now() * 0.006) * 0.15;
        }
      }
    }
  }
}
