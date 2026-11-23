// Isla Dorada — boot, game loop, input, camera, day/night, weather.
import * as THREE from '../vendor/three.min.js';
import { S, CFG, WEAPONS, clamp, lerp, rand, dist2, setObjective, flash, fmtMoney } from './state.js';
import { buildCity } from './city.js';
import { spawnTraffic, updateTraffic, updatePlayerCar, tryEnterCar, exitCar } from './vehicles.js';
import { createPlayerMesh, updatePlayer, spawnPeds, updatePeds, shoot, updateEnemies, updateTracers, hurtPlayer } from './people.js';
import { updatePolice, clearRoadblocks } from './police.js';
import { startMission, updateMissions, startRace, updateRace, startTaxi, updateTaxi, spawnPackages, updatePackages, MISSIONS } from './missions.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateEngine, playSiren, stopSiren, playCash } from './audio.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(1280, 720);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ab8e8);
scene.fog = new THREE.Fog(0x9ab8d8, 180, 700);
const camera = new THREE.PerspectiveCamera(62, 1280 / 720, 0.1, 1500);

const city = buildCity(scene);
spawnTraffic(scene, city.intersections);
spawnPeds(scene, city.colliders);
spawnPackages(scene);
createPlayerMesh(scene);
initHUD(city.colliders);
loadGame();
if (S.collectiblesGot.length) {
  for (const p of S.packages) if (S.collectiblesGot.some(([x, z]) => x === p.x && z === p.z)) { p.got = true; p.mesh.visible = false; }
}

// rain points
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(800 * 3);
for (let i = 0; i < 800; i++) { rainPos[i * 3] = rand(-40, 40); rainPos[i * 3 + 1] = rand(0, 30); rainPos[i * 3 + 2] = rand(-40, 40); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xaab8c8, size: 0.18, transparent: true, opacity: 0.6 }));
rain.visible = false;
scene.add(rain);

// input
const input = { fwd: false, back: false, left: false, right: false, run: false, handbrake: false };
let camYaw = Math.PI, camPitch = 0.32, mouseDX = 0, mouseDY = 0;
const KEYMAP = { KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake' };
let lastShotClick = 0;

addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  const k = KEYMAP[e.code];
  if (k) input[k] = true;
  if (e.repeat) return;
  initAudio();
  if (e.code === 'Enter' && !S.started) startGame();
  else if (e.code === 'KeyE' && S.started && !S.paused && !S.over) { if (S.inCar) exitCar(); else tryEnterCar(); }
  else if (e.code === 'KeyF' && S.started && !S.paused && !S.over) punch();
  else if (e.code === 'Digit1') S.weapon = 'pistol';
  else if (e.code === 'Digit2') S.weapon = 'smg';
  else if (e.code === 'Digit3') S.weapon = 'rifle';
  else if (e.code === 'KeyQ') useAbility();
  else if (e.code === 'KeyC' && S.started) switchLead();
  else if (e.code === 'KeyM' && S.started && !S.paused && !S.over) { if (!S.mission && S.missionIdx < MISSIONS.length) startMission(scene, S.missionIdx); else if (S.mission) flash('Mission already running: ' + S.mission.def.title, 2); }
  else if (e.code === 'KeyT' && S.started && !S.paused) startTaxi(scene);
  else if (e.code === 'KeyR' && S.started && !S.paused) { if (S.over) respawn(); else startRace(scene); }
  else if (e.code === 'KeyN') { S.radio = (S.radio + 1) % 3; flash('Radio: ' + ['SOL FM 88.1', 'TIBURON FM 95.5', 'DORADA FM 101.3'][S.radio], 2); }
  else if (e.code === 'KeyV') S.camMode = (S.camMode + 1) % 2;
  else if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  else if (e.code === 'KeyH') { const h = document.getElementById('help'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; }
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) input[k] = false; });
canvas.addEventListener('click', () => { if (S.started && !S.paused && document.pointerLockElement !== canvas) canvas.requestPointerLock(); });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  mouseDX += e.movementX; mouseDY += e.movementY;
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !S.started || S.paused || S.over) return;
  if (document.pointerLockElement !== canvas) return;
  if (S.clock - lastShotClick < 0.05) return;
  lastShotClick = S.clock;
  initAudio();
  shoot(camera, scene, city.colliders);
});

function startGame() {
  S.started = true;
  document.getElementById('title').style.display = 'none';
  canvas.requestPointerLock?.();
  initAudio();
  if (!S.mission && S.missionIdx < MISSIONS.length) {
    const nx = MISSIONS[S.missionIdx];
    setObjective(`Press M to start mission ${nx.id}/10 — ${nx.title}.`);
  } else if (!S.mission) setObjective('Free roam — press M for a mission, R to race, T for a taxi fare.');
  flash('Welcome to Isla Dorada. M = mission, E = enter car, H = help.', 4);
}

function togglePause() {
  if (!S.started || S.over) return;
  S.paused = !S.paused;
  if (S.paused) { document.exitPointerLock?.(); flash('Paused — press P to resume.', 2); }
}

function respawn() {
  S.over = false;
  S.health = 100; S.armor = 0;
  S.money = Math.max(0, Math.floor(S.money * 0.9));
  S.wanted = 0; S.wantedHeat = 0;
  S.player.x = -37; S.player.z = -250; S.player.angle = 0;
  if (S.car) { S.car.isPlayer = false; S.car = null; S.inCar = false; }
  for (const e of [...S.enemies]) { scene.remove(e.group); }
  S.enemies.length = 0;
  flash('Back on your feet at the El Centro hospital.', 3);
}

function punch() {
  for (const e of [...S.enemies]) {
    if (dist2(S.player.x, S.player.z, e.x, e.z) < 2.6) {
      e.hp -= 25;
      if (e.hp <= 0) {
        e.dead = true; scene.remove(e.group);
        S.enemies = S.enemies.filter((x) => x !== e);
        S.money += 50; S.kills++;
        flash('Knocked him out — +$50', 2);
      }
      return;
    }
  }
  // punching a pedestrian is a crime
  for (const p of S.peds) {
    if (dist2(S.player.x, S.player.z, p.x, p.z) < 2.2) { p.flee = 3; S.wantedHeat = Math.min(100, S.wantedHeat + 8); S.lastCrimeT = S.clock; flash('You hit a civilian — the cops were called!', 2); return; }
  }
}

function useAbility() {
  if (!S.abilityReady || S.over) return;
  if (S.lead === 'dario') {
    S.abilityUntil = S.clock + 4;
    S.abilityReady = false;
    setTimeout(() => { S.abilityReady = true; }, 12000);
    flash('FOCUS — time slows. Make every shot count.', 2.5);
  } else {
    if (!S.inCar) { flash('Nitro needs a car — get in one first.', 2); return; }
    S.nitroUntil = S.clock + 3;
    S.abilityReady = false;
    setTimeout(() => { S.abilityReady = true; }, 12000);
    flash('NITRO!', 1.5);
  }
}

function switchLead() {
  S.lead = S.lead === 'dario' ? 'carmen' : 'dario';
  const f = S.playerMesh;
  if (f) f.group.children[0].material.color.setHex(S.lead === 'dario' ? 0x2a3a5a : 0xc23a2a);
  flash(`Now playing ${S.lead === 'dario' ? 'Dario "D" Fontaine — Focus (Q) slows time' : 'Carmen "Comet" Duarte — Nitro (Q) boosts any car'}`, 3);
}

// day / night
const DAY_SKY = new THREE.Color(0x7ab8e8), DUSK_SKY = new THREE.Color(0xe88a4a), NIGHT_SKY = new THREE.Color(0x0a1226);
const DAY_FOG = new THREE.Color(0x9ab8d8), NIGHT_FOG = new THREE.Color(0x0a1226);
function updateSky(dt) {
  const t = S.time;
  const dayF = clamp(Math.sin(((t - 6) / 12) * Math.PI), 0, 1); // 1 at noon
  const duskF = clamp(1 - Math.abs(t - 18) / 1.6, 0, 1) + clamp(1 - Math.abs(t - 6) / 1.6, 0, 1);
  const sky = DAY_SKY.clone().lerp(NIGHT_SKY, 1 - dayF);
  if (duskF > 0) sky.lerp(DUSK_SKY, duskF * 0.55);
  scene.background.copy(sky);
  scene.fog.color.copy(sky).lerp(NIGHT_FOG, 0.3);
  const ang = ((t - 6) / 12) * Math.PI;
  city.sun.position.set(Math.cos(ang) * 320, Math.sin(ang) * 260 + 30, 140);
  city.sun.target.position.set(0, 0, 0);
  const night = dayF < 0.25;
  city.sun.intensity = night ? 0.35 : 2.2;
  city.sun.color.setHex(night ? 0x8aa8d8 : (duskF > 0.3 ? 0xffc080 : 0xffe0b0));
  city.hemi.intensity = night ? 0.35 : 0.9;
  for (const h of city.lampHeads) h.material.emissiveIntensity = night ? 2.2 : 0;
  city.oceanTex.offset.x += dt * 0.004;
  city.oceanTex.offset.y += dt * 0.002;
  for (const c of city.clouds) { c.position.x += dt * 1.2; if (c.position.x > 340) c.position.x = -340; }
  // weather
  S.weatherT -= dt;
  if (S.weatherT <= 0) {
    S.weatherT = rand(45, 90);
    S.weather = Math.random() < 0.7 ? 'clear' : (Math.random() < 0.5 ? 'rain' : 'fog');
    if (S.weather === 'rain') flash('Rain rolling in off the ocean.', 2);
  }
  rain.visible = S.weather === 'rain';
  scene.fog.near = S.weather === 'fog' ? 60 : S.weather === 'rain' ? 120 : 180;
  scene.fog.far = S.weather === 'fog' ? 320 : S.weather === 'rain' ? 520 : 700;
  if (rain.visible) {
    const pos = rainGeo.attributes.position.array;
    const px = S.player.x, pz = S.player.z;
    for (let i = 0; i < 800; i++) {
      pos[i * 3 + 1] -= 42 * dt;
      if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 30; pos[i * 3] = px + rand(-40, 40); pos[i * 3 + 2] = pz + rand(-40, 40); }
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
}

// camera
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (S.shotCam) {
    camera.position.set(...S.shotCam.pos);
    camera.lookAt(...S.shotCam.look);
    return;
  }
  camYaw -= mouseDX * 0.0026;
  camPitch = clamp(camPitch + mouseDY * 0.002, -0.05, 1.0);
  mouseDX = 0; mouseDY = 0;
  if (S.inCar && S.car) {
    const c = S.car;
    const want = c.angle + Math.PI;
    let d = want - camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    camYaw += d * Math.min(1, dt * 3.2);
    const dist = S.camMode === 0 ? 10 : 14;
    const cx = c.x - Math.sin(camYaw) * dist;
    const cz = c.z - Math.cos(camYaw) * dist;
    camera.position.set(cx, 4.2 + camPitch * 3, cz);
    camTarget.set(c.x + Math.sin(c.angle) * 8, 1.6, c.z + Math.cos(c.angle) * 8);
    camera.lookAt(camTarget);
  } else {
    const dist = S.camMode === 0 ? 7.5 : 11;
    const cx = S.player.x - Math.sin(camYaw) * dist * Math.cos(camPitch);
    const cz = S.player.z - Math.cos(camYaw) * dist * Math.cos(camPitch);
    camera.position.set(cx, 2.6 + Math.sin(camPitch) * dist * 0.9 + 1.2, cz);
    camTarget.set(S.player.x, 1.7, S.player.z);
    camera.lookAt(camTarget);
  }
}

// screenshot staging
if (shotName) {
  stageShot(shotName, scene);
  S.weather = 'clear'; S.weatherT = 999;
  document.getElementById('title').style.display = 'none';
}

// main loop
const clock = new THREE.Clock();
let saveT = 0;
function loop() {
  requestAnimationFrame(loop);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  S.clock += rawDt;
  const slowmo = S.abilityUntil > S.clock;
  const dt = S.paused || !S.started ? 0 : rawDt * (slowmo ? 1 : 1);
  const worldDt = dt * (slowmo ? 0.35 : 1); // enemies, traffic, police slow down in Focus
  if (dt > 0) {
    S.playT += dt;
    S.time = (S.time + dt / 60 * S.timeScale) % 24;
    if (S.messageT > 0) S.messageT -= dt;
    updateSky(rawDt);
    updatePlayer(dt, input, city.colliders, camYaw);
    if (S.inCar) updatePlayerCar(dt, input, city.colliders);
    updateTraffic(worldDt, city.colliders, city.intersections);
    updatePeds(worldDt, city.colliders);
    updateEnemies(worldDt, scene, city.colliders);
    updatePolice(worldDt, scene, city.colliders, city.intersections);
    updateMissions(dt, scene, city.colliders);
    updateRace(dt, scene);
    updateTaxi(dt, scene);
    updatePackages(dt);
    updateTracers(dt, scene);
    updateEngine(S.inCar ? S.player.speed : 0, S.inCar);
    if (S.wanted === 0) stopSiren();
    saveT += dt;
    if (saveT > 20) { saveT = 0; saveGame(); }
  }
  updateCamera(rawDt);
  updateHUD();
  renderer.render(scene, camera);
}
loop();
window.__game = { S, scene, camera };
