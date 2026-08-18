/* ═══════════════════════════════════════════
   CHENNAI VICE — Open World 3D Prototype
   Main entry point — Next-Gen Edition
   ═══════════════════════════════════════════ */

import { Game } from './engine/Game.js';
import { City } from './world/City.js';
import { Environment } from './world/Environment.js';
import { Landmarks } from './world/Landmarks.js';
import { StreetLife } from './world/StreetLife.js';
import { Player } from './entities/Player.js';
import { VehicleManager } from './entities/Vehicle.js';
import { NPCManager } from './entities/NPC.js';
import { Combat } from './systems/Combat.js';
import { WantedSystem } from './systems/Wanted.js';
import { Audio } from './systems/Audio.js';
import { HUD } from './ui/HUD.js';
import { Minimap } from './ui/Minimap.js';

async function init() {
  const game = new Game();
  game.setState('loading');
  game.start();

  // City
  game.setLoadingProgress(5, 'Initializing engine…');
  await delay(100);

  const city = new City(game.scene);
  game.city = city;
  city.generate((pct, msg) => game.setLoadingProgress(pct, msg));
  await delay(100);

  // Landmarks
  game.setLoadingProgress(55, 'Building Chennai Central…');
  const landmarks = new Landmarks(game.scene);
  landmarks.build(city);
  game.landmarks = landmarks;
  await delay(80);

  // Street Life
  game.setLoadingProgress(60, 'Placing street assets…');
  const streetLife = new StreetLife(game.scene);
  streetLife.build(city);
  game.streetLife = streetLife;
  await delay(80);

  // Wildlife disabled in strict asset-only world mode.
  game.setLoadingProgress(65, 'Preparing asset-only streets…');
  await delay(80);

  // Environment
  game.setLoadingProgress(70, 'Setting Chennai atmosphere…');
  const environment = new Environment(game.scene);
  environment.setRenderer(game.renderer);
  game.environment = environment;
  await delay(80);

  // Player
  game.setLoadingProgress(75, 'Creating player…');
  const player = new Player(game.scene);
  game.player = player;
  await delay(50);

  // Vehicles
  game.setLoadingProgress(80, 'Spawning traffic…');
  const vehicleManager = new VehicleManager(game.scene);
  vehicleManager.spawnVehicles(city);
  game.vehicleManager = vehicleManager;
  await delay(80);

  // NPCs
  game.setLoadingProgress(85, 'Populating Chennai streets…');
  const npcManager = new NPCManager(game.scene);
  game.npcManager = npcManager;
  await delay(50);

  // Combat
  game.setLoadingProgress(88, 'Arming player…');
  const combat = new Combat(game.scene);
  game.combat = combat;
  const wanted = new WantedSystem();
  game.wanted = wanted;
  await delay(50);

  // Audio
  game.setLoadingProgress(92, 'Tuning ambient audio…');
  const audio = new Audio();
  game.audio = audio;
  await delay(50);

  // UI
  game.setLoadingProgress(95, 'Building HUD…');
  const hud = new HUD();
  game.hud = hud;
  const minimap = new Minimap(city);
  game.minimap = minimap;
  await delay(100);

  // Done
  game.setLoadingProgress(100, 'Vanakkam Chennai!');
  await delay(500);
  game.setState('title');

  // Buttons
  document.getElementById('btn-play')?.addEventListener('click', () => game.setState('playing'));
  document.getElementById('btn-resume')?.addEventListener('click', () => game.setState('playing'));
  document.getElementById('btn-respawn')?.addEventListener('click', () => {
    player.respawn();
    wanted.reset();
    combat.ammo = combat.ammo.map((_, i) => [Infinity, 12, 30, 8][i]);
    game.setState('playing');
  });

  document.addEventListener('click', () => {
    if (game.state === 'playing' && !game.input.locked) game.input.requestLock();
  });

  console.log('🎮 Chennai Vice Next-Gen loaded! Vanakkam!');
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

init().catch(err => {
  console.error(err);
  const txt = document.getElementById('loading-text');
  if (txt) txt.textContent = `Startup error: ${err?.message || err}`;
});
