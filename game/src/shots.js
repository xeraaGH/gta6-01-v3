// Isla Dorada — screenshot staging (?shot=cover|drive|mission|city).
// Sets time, player/car placement and a fixed cinematic camera for real renders.
import { S } from './state.js';
import { createCar } from './vehicles.js';
import { spawnEnemy } from './people.js';
import { startMission, MISSIONS } from './missions.js';

function placePlayerCar(scene, x, z, angle, color) {
  const c = createCar(scene, color, x, z, angle);
  c.isPlayer = true;
  S.car = c;
  S.inCar = true;
  S.player.x = x; S.player.z = z; S.player.angle = angle;
  return c;
}

export function stageShot(name, scene) {
  S.started = true;
  S.paused = false;
  if (name === 'cover') {
    S.time = 17.0;
    S.money = 12500;
    S.wanted = 0; S.wantedHeat = 0;
    S.objective = 'Isla Dorada — 10 story missions · crew · street races · district standing';
    const c = placePlayerCar(scene, 250, 175, Math.PI * 0.85, 0xc23a2a);
    c.speed = 0;
    S.inCar = false; // stand next to the car
    S.player.x = 246; S.player.z = 170; S.player.angle = Math.PI * 0.8;
    S.shotCam = { pos: [241, 5, 161], look: [250, 2, 176] };
  } else if (name === 'drive') {
    S.time = 18.0;
    S.objective = 'Beachfront drive — Playa Dorada';
    // car cruises +x along the beach road at a forced 12 u/s; the screenshot is
    // taken at 2 game-seconds, so it is at x≈118 (the camera look point)
    const c = placePlayerCar(scene, 94, 240, Math.PI / 2, 0x2a6ac2);
    c.speed = 12;
    S.shotDrive = true;
    S.shotCam = { pos: [108, 4, 224], look: [118, 1, 242] };
  } else if (name === 'mission') {
    S.time = 13.2;
    S.armor = 50;
    S.objective = 'Mission 5/10 — Gang War: clear the market of Los Tiburones';
    startMission(scene, 4); // Gang War at the market
    S.player.x = 185; S.player.z = -215; S.player.angle = Math.PI * 0.9;
    S.weapon = 'rifle';
    // player in the lower foreground, enemies + beacon beyond
    S.shotCam = { pos: [170, 7, -202], look: [200, 1.5, -240] };
  } else if (name === 'city') {
    S.time = 21.4;
    S.money = 14200;
    S.wanted = 0; S.wantedHeat = 0;
    S.objective = 'Isla Dorada at night — six districts, one city to take back';
    placePlayerCar(scene, 60, 60, 0, 0xd8a83a);
    S.inCar = false;
    S.player.x = 58; S.player.z = 56; S.player.angle = 0;
    S.shotCam = { pos: [-40, 150, 300], look: [0, 0, -60] };
  } else {
    S.shotCam = null;
  }
  return S.shotCam;
}
