/* ──────────────────────────────
   Minimap: top-down radar view
   ────────────────────────────── */

export class Minimap {
  constructor(city) {
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.city = city;
    this.radius = 100; // canvas is 200x200
    this.range = 180;   // world units visible
  }

  update(game) {
    if (!this.ctx || !game.player) return;
    const ctx = this.ctx;
    const cx = this.radius;
    const cy = this.radius;
    const player = game.player;
    const pp = player.position;
    const heading = player.inVehicle && player.currentVehicle
      ? player.currentVehicle.mesh.rotation.y
      : player.yaw;

    // Clear with dark background
    ctx.fillStyle = 'rgba(10,15,25,0.92)';
    ctx.fillRect(0, 0, 200, 200);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.radius - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(heading);

    // Draw buildings
    ctx.fillStyle = 'rgba(60,70,90,0.7)';
    for (const b of this.city.buildings) {
      const rx = (b.x - pp.x) / this.range * this.radius;
      const rz = (b.z - pp.z) / this.range * this.radius;
      if (Math.abs(rx) > this.radius || Math.abs(rz) > this.radius) continue;
      const bw = (b.w / this.range) * this.radius;
      const bd = (b.d / this.range) * this.radius;
      ctx.fillRect(rx - bw / 2, rz - bd / 2, bw, bd);
    }

    if (game.landmarks) {
      ctx.fillStyle = 'rgba(255, 190, 80, 0.95)';
      for (const item of game.landmarks.interactables) {
        const rx = (item.position.x - pp.x) / this.range * this.radius;
        const rz = (item.position.z - pp.z) / this.range * this.radius;
        if (Math.abs(rx) > this.radius || Math.abs(rz) > this.radius) continue;
        ctx.beginPath();
        ctx.arc(rx, rz, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw roads (simplified grid lines)
    const cell = this.city.cellSize || 48 + 14;
    const half = this.city.halfCity;
    ctx.strokeStyle = 'rgba(80,90,100,0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= (this.city.grid || 12); i++) {
      const roadPos = -half + i * cell;
      const rx = (roadPos - pp.x) / this.range * this.radius;
      const rz = (roadPos - pp.z) / this.range * this.radius;
      // Horizontal
      ctx.beginPath();
      ctx.moveTo(-this.radius, rz);
      ctx.lineTo(this.radius, rz);
      ctx.stroke();
      // Vertical
      ctx.beginPath();
      ctx.moveTo(rx, -this.radius);
      ctx.lineTo(rx, this.radius);
      ctx.stroke();
    }

    // Draw NPCs
    if (game.npcManager) {
      // Pedestrians: white dots
      ctx.fillStyle = 'rgba(200,200,200,0.5)';
      for (const n of game.npcManager.npcs) {
        const rx = (n.mesh.position.x - pp.x) / this.range * this.radius;
        const rz = (n.mesh.position.z - pp.z) / this.range * this.radius;
        if (Math.abs(rx) > this.radius || Math.abs(rz) > this.radius) continue;
        ctx.beginPath();
        ctx.arc(rx, rz, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Police: blue dots
      ctx.fillStyle = '#4488ff';
      for (const p of game.npcManager.policeNPCs) {
        const rx = (p.mesh.position.x - pp.x) / this.range * this.radius;
        const rz = (p.mesh.position.z - pp.z) / this.range * this.radius;
        if (Math.abs(rx) > this.radius || Math.abs(rz) > this.radius) continue;
        ctx.beginPath();
        ctx.arc(rx, rz, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw vehicles
    if (game.vehicleManager) {
      ctx.fillStyle = 'rgba(255,200,100,0.4)';
      for (const v of game.vehicleManager.vehicles) {
        if (v.occupied) continue;
        const rx = (v.mesh.position.x - pp.x) / this.range * this.radius;
        const rz = (v.mesh.position.z - pp.z) / this.range * this.radius;
        if (Math.abs(rx) > this.radius || Math.abs(rz) > this.radius) continue;
        ctx.fillRect(rx - 2, rz - 3, 4, 6);
      }
    }

    ctx.restore();

    // Player arrow (always center, pointing up)
    ctx.fillStyle = '#0ead00ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.closePath();
    ctx.fill();

    // Border ring
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, this.radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // Compass letters
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cx, 14);
    ctx.fillText('S', cx, 196);
    ctx.fillText('W', 8, cy + 4);
    ctx.fillText('E', 192, cy + 4);
  }
}
