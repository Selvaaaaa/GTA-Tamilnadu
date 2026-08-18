/* ──────────
   HUD System
   ────────── */

export class HUD {
  constructor() {
    this.healthFill = document.getElementById('health-fill');
    this.healthText = document.getElementById('health-text');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoCurrent = document.getElementById('ammo-current');
    this.ammoMax = document.getElementById('ammo-max');
    this.speedContainer = document.getElementById('speed-container');
    this.speedValue = document.getElementById('speed-value');
    this.wantedStars = document.querySelectorAll('.wanted-star');
  }

  update(game) {
    const player = game.player;
    const combat = game.combat;
    const wanted = game.wanted;

    if (!player) return;

    // Health
    const hp = Math.max(0, player.health);
    const pct = (hp / player.maxHealth) * 100;
    if (this.healthFill) {
      this.healthFill.style.width = pct + '%';
      // Color gradient: green → yellow → red
      if (pct > 60) this.healthFill.style.background = 'linear-gradient(90deg,#00e676,#66ff66)';
      else if (pct > 30) this.healthFill.style.background = 'linear-gradient(90deg,#ffaa00,#ffcc44)';
      else this.healthFill.style.background = 'linear-gradient(90deg,#ff2d55,#ff6666)';
    }
    if (this.healthText) this.healthText.textContent = Math.ceil(hp);

    // Weapon & ammo
    if (combat) {
      const w = combat.weapon;
      if (this.weaponName) {
        this.weaponName.textContent = combat.reloading ? 'RELOADING…' : w.name;
      }
      if (w.type === 'melee') {
        if (this.ammoCurrent) this.ammoCurrent.textContent = '—';
        if (this.ammoMax) this.ammoMax.textContent = '—';
      } else {
        if (this.ammoCurrent) this.ammoCurrent.textContent = combat.currentAmmo;
        if (this.ammoMax) this.ammoMax.textContent = w.maxAmmo;
      }
    }

    // Wanted stars
    if (wanted) {
      this.wantedStars.forEach((star, i) => {
        star.classList.toggle('active', i < wanted.level);
      });
    }

    // Speed (vehicle)
    if (player.inVehicle && player.currentVehicle) {
      const kmh = Math.abs(Math.round(player.currentVehicle.speed * 3.6));
      if (this.speedContainer) this.speedContainer.classList.remove('hidden');
      if (this.speedValue) this.speedValue.textContent = kmh;
    } else {
      if (this.speedContainer) this.speedContainer.classList.add('hidden');
    }

    // Game over check
    if (player.health <= 0 && game.state === 'playing') {
      game.setState('gameover');
    }
  }
}
