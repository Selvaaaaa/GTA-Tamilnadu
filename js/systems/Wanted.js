/* ─────────────────────
   5-Star Wanted System
   ───────────────────── */

export class WantedSystem {
  constructor() {
    this.level = 0;        // 0-5 stars
    this.heat = 0;         // accumulates toward next star
    this.cooldown = 0;     // seconds since last offense
    this.cooldownThreshold = 12; // seconds to start losing stars
    this.policeSpawned = false;
  }

  update(dt, player) {
    if (this.level > 0) {
      this.cooldown += dt;
      // Cool down wanted level over time
      if (this.cooldown > this.cooldownThreshold) {
        this.heat -= dt * 8;
        if (this.heat <= 0) {
          this.level = Math.max(0, this.level - 1);
          this.heat = this.level > 0 ? 50 : 0;
          this.cooldown = 0;
        }
      }
    }

    // Check player death
    if (player.health <= 0 && this.level > 0) {
      this.level = 0;
      this.heat = 0;
    }
  }

  onShot() {
    this.cooldown = 0;
    this._addHeat(5);
  }

  onAttackCivilian() {
    this.cooldown = 0;
    this._addHeat(25);
  }

  onAttackPolice() {
    this.cooldown = 0;
    this._addHeat(40);
  }

  onVehicleDestruction() {
    this.cooldown = 0;
    this._addHeat(20);
  }

  _addHeat(amount) {
    this.heat += amount;
    while (this.heat >= 100 && this.level < 5) {
      this.level++;
      this.heat -= 100;
    }
    if (this.level >= 5) this.heat = Math.min(this.heat, 99);
  }

  reset() {
    this.level = 0;
    this.heat = 0;
    this.cooldown = 0;
  }
}
