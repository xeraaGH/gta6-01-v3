// Isla Dorada — missions: 10 story jobs, street races, taxi fares, collectibles.
// Imports state, city, vehicles, people (enemies), audio (stinger/cash).
import * as THREE from '../vendor/three.min.js';
import { S, CFG, DISTRICTS, rand, randi, pick, clamp, dist2, addStanding, setObjective, flash, fmtMoney, districtAt } from './state.js';
import { createCar } from './vehicles.js';
import { spawnEnemy } from './people.js';
import { playStinger, playCash } from './audio.js';

const GARAGE = { x: -210, z: -240 };
const DOCKS = { x: -250, z: -250 };
const CASINO = { x: 210, z: 30 };
const STADIUM = { x: -180, z: 30 };
const MARINA = { x: 260, z: 180 };
const PIER = { x: -240, z: 300 };

export const MISSIONS = [
  { id: 1, title: 'First Wheels', brief: 'Dario needs wheels. Steal any car and bring it to the garage in Puerto Viejo.', payout: 400, steps: [
    { type: 'car', text: 'Steal a car (press E near one)' },
    { type: 'drive', at: GARAGE, r: 10, text: 'Drive it to the garage in Puerto Viejo' } ] },
  { id: 2, title: 'The Package', brief: 'A crate came in at the docks. Pick it up and drop it in Barrio Luna.', payout: 600, steps: [
    { type: 'goto', at: DOCKS, r: 9, text: 'Pick up the crate at the docks' },
    { type: 'goto', at: { x: 200, z: -180 }, r: 9, text: 'Deliver it to the drop in Barrio Luna' } ] },
  { id: 3, title: 'Hot Wheels', brief: 'The crew needs to know you can shake a tail. Get the cops on you — then lose them.', payout: 800, steps: [
    { type: 'stars', n: 2, text: 'Get a 2-star wanted level (steal a car or fire a shot)' },
    { type: 'escape', text: 'Lose the cops — break line of sight until the stars clear' } ] },
  { id: 4, title: 'Race the Dawn', brief: 'Carmen has a race lined up along the beachfront. Win it.', payout: 1000, steps: [
    { type: 'race', cps: [{ x: 240, z: 240 }, { x: 60, z: 240 }, { x: -120, z: 240 }, { x: -240, z: 240 }, { x: -240, z: 60 }], time: 80, text: 'Win the beachfront race — hit every checkpoint' } ] },
  { id: 5, title: 'Gang War', brief: 'Los Tiburones are taxing the Barrio Luna market. Clear them out.', payout: 1200, steps: [
    { type: 'clear', at: { x: 200, z: -240 }, r: 26, n: 5, text: 'Clear the Tiburones from the market' } ] },
  { id: 6, title: 'The Getaway', brief: 'Carmen is at the Casino Estrella with the heat on. Get her to the marina — fast.', payout: 1400, steps: [
    { type: 'goto', at: CASINO, r: 10, text: 'Pick up Carmen at the Casino Estrella', onStart: () => { S.wantedHeat = 40; S.wanted = 2; flash('The cops are onto you — 2 stars!', 3); } },
    { type: 'timed', at: MARINA, r: 10, time: 90, text: 'Drive Carmen to the marina before the clock runs out' } ] },
  { id: 7, title: 'Midnight Run', brief: 'Smuggle a crate from Zona Franca to the pier. Keep it quiet — no heat.', payout: 1500, steps: [
    { type: 'goto', at: { x: 30, z: 30 }, r: 9, text: 'Collect the crate in Zona Franca' },
    { type: 'goto', at: PIER, r: 9, text: 'Deliver it to the pier — stay under the radar' } ] },
  { id: 8, title: 'Stadium Heist', brief: 'A gold trophy car is parked at the stadium. Take it to the garage.', payout: 1800, steps: [
    { type: 'car', text: 'Steal the gold trophy car at the stadium', onStart: (scene) => {
        const c = createCar(scene, 0xd8a83a, STADIUM.x + 8, STADIUM.z + 8, 0);
        c.parked = true; S.traffic.push(c); S.mission.trophyCar = c;
      } },
    { type: 'drive', at: GARAGE, r: 10, text: 'Bring the trophy car to the garage' } ] },
  { id: 9, title: 'Casino Hit', brief: 'The Casino Estrella vault is full tonight. Get in, grab it, get out.', payout: 2500, steps: [
    { type: 'goto', at: CASINO, r: 10, text: 'Reach the Casino Estrella' },
    { type: 'clear', at: CASINO, r: 22, n: 4, text: 'Clear the casino guards' },
    { type: 'goto', at: { x: 210, z: 12 }, r: 6, text: 'Grab the vault cash' },
    { type: 'timed', at: MARINA, r: 10, time: 75, text: 'Escape to the marina' } ] },
  { id: 10, title: 'The Shark', brief: 'Rico "El Tiburón" Vane runs the docks. End him, end the gang.', payout: 3000, steps: [
    { type: 'goto', at: DOCKS, r: 12, text: 'Reach the docks — Vane is waiting' },
    { type: 'clear', at: DOCKS, r: 30, n: 6, text: 'Take down Vane and his crew', boss: true } ] },
];

let beacon = null;
function makeBeacon(scene) {
  if (beacon) return beacon;
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3, 34, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd83a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  cyl.position.y = 17; g.add(cyl);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), new THREE.MeshBasicMaterial({ color: 0xffd83a }));
  gem.position.y = 26; g.add(gem);
  g.userData.gem = gem;
  scene.add(g);
  beacon = g;
  return g;
}
function removeBeacon(scene) {
  if (beacon) { scene.remove(beacon); beacon = null; }
}

export function startMission(scene, idx) {
  if (idx >= MISSIONS.length) { setObjective('All 10 story missions done — Isla Dorada is yours. Free roam!'); return; }
  const def = MISSIONS[idx];
  S.mission = { def, stepIdx: 0, timer: 0, spawned: [], trophyCar: null };
  runStepStart(scene);
  setObjective(`Mission ${def.id}/10 — ${def.title}: ${def.steps[0].text}`);
  flash(`MISSION: ${def.title} — ${def.brief}`, 5);
  playStinger();
}

function runStepStart(scene) {
  const m = S.mission;
  const step = m.def.steps[m.stepIdx];
  m.timer = step.time || 0;
  m.spawned = [];
  if (step.onStart) step.onStart(scene);
  if (step.type === 'clear') {
    for (let i = 0; i < step.n; i++) {
      const e = spawnEnemy(scene, step.at.x + rand(-step.r, step.r), step.at.z + rand(-step.r, step.r));
      if (step.boss && i === 0) { e.hp = 220; e.group.scale.setScalar(1.25); }
      m.spawned.push(e);
    }
  }
  if (step.type === 'race') { m.cpIdx = 0; }
  const b = makeBeacon(scene);
  const at = step.at || (step.cps && step.cps[0]);
  if (at) { b.position.set(at.x, 0, at.z); b.visible = true; }
  else b.visible = false;
}

function stepTarget(step, m) {
  if (step.type === 'race') return step.cps[m.cpIdx];
  return step.at || null;
}

function failStep(scene, why) {
  flash(why + ' — restarting this step.', 3);
  runStepStart(scene);
  const m = S.mission;
  setObjective(`Mission ${m.def.id}/10 — ${m.def.title}: ${m.def.steps[m.stepIdx].text}`);
}

export function updateMissions(dt, scene, colliders) {
  const m = S.mission;
  if (!m) return;
  const step = m.def.steps[m.stepIdx];
  if (!step) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failStep(scene, 'Too slow'); return; }
  }
  const px = S.player.x, pz = S.player.z;
  const at = stepTarget(step, m);
  if (beacon && at) {
    beacon.position.set(at.x, 0, at.z);
    beacon.userData.gem.rotation.y += dt * 2;
    beacon.userData.gem.position.y = 26 + Math.sin(S.clock * 2) * 1.2;
  }
  let done = false;
  switch (step.type) {
    case 'goto': case 'drive': case 'timed':
      if (at && dist2(px, pz, at.x, at.z) < step.r) done = true;
      break;
    case 'car':
      if (S.inCar) done = true;
      break;
    case 'stars':
      if (S.wanted >= step.n) done = true;
      break;
    case 'escape':
      if (S.wanted === 0) done = true;
      break;
    case 'clear':
      if (m.spawned.every((e) => e.dead || e.hp <= 0)) done = true;
      break;
    case 'race': {
      const cp = step.cps[m.cpIdx];
      if (cp && dist2(px, pz, cp.x, cp.z) < 9) {
        m.cpIdx++;
        playCash();
        if (m.cpIdx >= step.cps.length) done = true;
        else flash(`Checkpoint ${m.cpIdx}/${step.cps.length}`, 1.5);
      }
      break;
    }
  }
  if (!done) return;
  m.stepIdx++;
  if (m.stepIdx >= m.def.steps.length) {
    completeMission(scene);
    return;
  }
  runStepStart(scene);
  setObjective(`Mission ${m.def.id}/10 — ${m.def.title}: ${m.def.steps[m.stepIdx].text}`);
}

function completeMission(scene) {
  const m = S.mission;
  S.money += m.def.payout;
  S.missionsDone.push(m.def.id);
  S.missionIdx = m.def.id; // next mission index (ids are 1-based, array 0-based)
  addStanding(districtAt(S.player.x, S.player.z), 8);
  playCash();
  flash(`MISSION COMPLETE — ${m.def.title}: +${fmtMoney(m.def.payout)}`, 4);
  removeBeacon(scene);
  S.mission = null;
  if (S.missionIdx < MISSIONS.length) {
    const nx = MISSIONS[S.missionIdx];
    setObjective(`Next mission: ${nx.title} — press M to start.`);
  } else {
    setObjective('All 10 story missions done — Isla Dorada is yours. Free roam!');
    flash('ALL MISSIONS DONE — you own Isla Dorada!', 5);
  }
}

// --- street races (R key) ---
const RACE_ROUTES = [
  { name: 'Beachfront Sprint', cps: [{ x: 240, z: 240 }, { x: 60, z: 240 }, { x: -120, z: 240 }, { x: -240, z: 240 }], time: 70 },
  { name: 'Downtown Loop', cps: [{ x: 60, z: -180 }, { x: 60, z: 60 }, { x: -180, z: 60 }, { x: -180, z: -180 }], time: 80 },
  { name: 'Harbor Run', cps: [{ x: -240, z: -240 }, { x: -240, z: 60 }, { x: 60, z: 60 }, { x: 60, z: -240 }], time: 80 },
];
export function startRace(scene) {
  if (S.race) { flash('A race is already running.', 2); return; }
  const route = pick(RACE_ROUTES);
  S.race = { ...route, cpIdx: 0, timer: route.time };
  makeBeacon(scene).position.set(route.cps[0].x, 0, route.cps[0].z);
  beacon.visible = true;
  setObjective(`Street race — ${route.name}: hit every checkpoint!`);
  flash(`RACE: ${route.name} — ${route.time}s on the clock!`, 3);
}
export function updateRace(dt, scene) {
  const r = S.race;
  if (!r) return;
  r.timer -= dt;
  const cp = r.cps[r.cpIdx];
  if (beacon && cp) beacon.position.set(cp.x, 0, cp.z);
  if (cp && dist2(S.player.x, S.player.z, cp.x, cp.z) < 9) {
    r.cpIdx++;
    playCash();
    if (r.cpIdx >= r.cps.length) {
      const win = 500 + Math.round(r.timer) * 5;
      S.money += win;
      addStanding(districtAt(S.player.x, S.player.z), 2);
      flash(`RACE WON — ${r.name}: +${fmtMoney(win)}`, 4);
      setObjective('Race won! Press R for another, or M for the next story mission.');
      S.race = null;
      removeBeacon(scene);
      return;
    }
    flash(`Checkpoint ${r.cpIdx}/${r.cps.length}`, 1.5);
  }
  if (r.timer <= 0) {
    flash('Race lost — too slow. Press R to try again.', 3);
    S.race = null;
    removeBeacon(scene);
  }
}

// --- taxi fares (T key) ---
export function startTaxi(scene) {
  if (S.taxi) { flash('You already have a fare.', 2); return; }
  if (!S.inCar) { flash('You need a car for a taxi fare.', 2); return; }
  const drop = pick([{ x: 200, z: -180 }, { x: -37, z: -277 }, { x: 260, z: 180 }, { x: -240, z: -240 }, { x: 30, z: 30 }]);
  S.taxi = { drop, fare: randi(50, 120), timer: 60 };
  makeBeacon(scene).position.set(drop.x, 0, drop.z);
  beacon.visible = true;
  setObjective('Taxi fare — deliver your passenger to the marker.');
  flash('Taxi fare picked up — deliver fast for a tip!', 3);
}
export function updateTaxi(dt, scene) {
  const t = S.taxi;
  if (!t) return;
  t.timer -= dt;
  if (dist2(S.player.x, S.player.z, t.drop.x, t.drop.z) < 9) {
    const tip = Math.round(t.timer) * 2;
    const total = t.fare + tip;
    S.money += total;
    addStanding(districtAt(S.player.x, S.player.z), 1);
    flash(`Fare delivered — +${fmtMoney(total)} (fare ${fmtMoney(t.fare)} + tip ${fmtMoney(tip)})`, 3);
    S.taxi = null;
    removeBeacon(scene);
    setObjective('Fare done. Press T for another, or M for the next story mission.');
    return;
  }
  if (t.timer <= 0 || !S.inCar) {
    flash('Fare lost.', 2);
    S.taxi = null;
    removeBeacon(scene);
  }
}

// --- hidden packages ---
export function spawnPackages(scene) {
  const spots = [];
  for (let i = 0; i < 20; i++) spots.push({ x: rand(-280, 280), z: rand(-280, 230) });
  const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffd83a, emissive: 0xa8820a, emissiveIntensity: 1 });
  for (const s of spots) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, 1.2, s.z);
    scene.add(m);
    S.packages.push({ ...s, mesh: m, got: false });
  }
}
export function updatePackages(dt) {
  for (const p of S.packages) {
    if (p.got) continue;
    p.mesh.rotation.y += dt;
    p.mesh.position.y = 1.2 + Math.sin(S.clock * 2 + p.x) * 0.25;
    if (dist2(S.player.x, S.player.z, p.x, p.z) < 3) {
      p.got = true;
      p.mesh.visible = false;
      S.collectibles++;
      S.collectiblesGot.push([p.x, p.z]);
      S.money += 250;
      playCash();
      flash(`Hidden package found (${S.collectibles}/20) — +$250`, 2.5);
    }
  }
}
