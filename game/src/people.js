// Isla Dorada — people: the player on foot, pedestrians, combat.
// Imports state, city (collision), vehicles (car enter/exit), audio (sounds).
import * as THREE from '../vendor/three.min.js';
import { S, WEAPONS, rand, randi, pick, clamp, dist2, angDiff, addWanted, flash, fmtMoney } from './state.js';
import { collideCircle } from './city.js';
import { playShot, playHit, playHurt } from './audio.js';

const SHIRT = [0xc23a2a, 0x2a6ac2, 0xd8a83a, 0x3a9a5a, 0xe8e2d2, 0x7a3a8a, 0x4a9a8a, 0xd86a2a, 0x8a8a86];

function makeFigure(shirt, pants) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.85, 0.34), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  body.position.y = 1.05; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.8 }));
  head.position.y = 1.68; head.castShadow = true; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.26), new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 }));
  legL.position.set(-0.17, 0.35, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.17; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }));
  armL.position.set(-0.42, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function createPlayerMesh(scene) {
  const f = makeFigure(0x2a3a5a, 0x222222);
  f.group.position.set(S.player.x, 0, S.player.z);
  scene.add(f.group);
  S.playerMesh = f;
  return f;
}

let walkPhase = 0;
export function updatePlayer(dt, input, colliders, camAngle) {
  if (S.inCar) return;
  const run = input.run ? 10 : 5.5;
  let mx = 0, mz = 0;
  if (input.fwd) { mx += Math.sin(camAngle); mz += Math.cos(camAngle); }
  if (input.back) { mx -= Math.sin(camAngle); mz -= Math.cos(camAngle); }
  if (input.left) { mx += Math.sin(camAngle - Math.PI / 2); mz += Math.cos(camAngle - Math.PI / 2); }
  if (input.right) { mx += Math.sin(camAngle + Math.PI / 2); mz += Math.cos(camAngle + Math.PI / 2); }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len; mz /= len;
    S.player.x += mx * run * dt;
    S.player.z += mz * run * dt;
    S.player.angle = Math.atan2(mx, mz);
    S.player.speed = run;
    walkPhase += dt * run * 1.6;
  } else S.player.speed = 0;
  S.player.x = clamp(S.player.x, -295, 295);
  S.player.z = clamp(S.player.z, -295, 335); // pier end; no walking on water
  const fixed = collideCircle(colliders, S.player.x, S.player.z, 0.9);
  S.player.x = fixed.x; S.player.z = fixed.z;
  const f = S.playerMesh;
  if (f) {
    f.group.position.set(S.player.x, 0, S.player.z);
    f.group.rotation.y = S.player.angle;
    const sw = S.player.speed > 0 ? Math.sin(walkPhase) * 0.5 : 0;
    f.legL.rotation.x = sw; f.legR.rotation.x = -sw;
    f.armL.rotation.x = -sw * 0.7; f.armR.rotation.x = sw * 0.7;
  }
}

// --- pedestrians ---
export function spawnPeds(scene, colliders) {
  const peds = [];
  for (let i = 0; i < 24; i++) {
    const x = rand(-280, 280), z = rand(-280, 230);
    const f = makeFigure(pick(SHIRT), pick([0x222222, 0x3a4a6a, 0x5a4a3a]));
    f.group.position.set(x, 0, z);
    scene.add(f.group);
    peds.push({ ...f, x, z, angle: rand(0, Math.PI * 2), speed: rand(1.2, 2.2), tx: x + rand(-40, 40), tz: z + rand(-40, 40), phase: rand(0, 6), flee: 0 });
  }
  S.peds = peds;
  return peds;
}

export function updatePeds(dt, colliders) {
  const shooting = S.clock - (S.lastShotT || -99) < 2;
  for (const p of S.peds) {
    const dPlayer = dist2(p.x, p.z, S.player.x, S.player.z);
    if ((shooting && dPlayer < 40) || S.wanted >= 3) p.flee = 2;
    let tx = p.tx, tz = p.tz, sp = p.speed;
    if (p.flee > 0) {
      p.flee -= dt;
      const a = Math.atan2(p.x - S.player.x, p.z - S.player.z);
      tx = p.x + Math.sin(a) * 20; tz = p.z + Math.cos(a) * 20; sp = 5;
    } else if (dist2(p.x, p.z, tx, tz) < 3) {
      p.tx = clamp(p.x + rand(-50, 50), -285, 285);
      p.tz = clamp(p.z + rand(-50, 50), -285, 230);
    }
    const want = Math.atan2(tx - p.x, tz - p.z);
    p.angle += clamp(angDiff(p.angle, want), -3 * dt, 3 * dt);
    p.x += Math.sin(p.angle) * sp * dt;
    p.z += Math.cos(p.angle) * sp * dt;
    const fixed = collideCircle(colliders, p.x, p.z, 0.8);
    p.x = fixed.x; p.z = fixed.z;
    p.group.position.set(p.x, 0, p.z);
    p.group.rotation.y = p.angle;
    p.phase += dt * sp * 2.2;
    const sw = Math.sin(p.phase) * 0.45;
    p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  }
}

// --- combat ---
const tracers = [];
function addTracer(scene, from, to, color) {
  const len = from.distanceTo(to);
  if (len < 0.5) return;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, len),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  m.position.copy(from).add(to).multiplyScalar(0.5);
  m.lookAt(to);
  scene.add(m);
  tracers.push({ m, life: 0.09 });
}
export function updateTracers(dt, scene) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    tracers[i].life -= dt;
    if (tracers[i].life <= 0) { scene.remove(tracers[i].m); tracers[i].m.geometry.dispose(); tracers[i].m.material.dispose(); tracers.splice(i, 1); }
  }
}

// Ray vs building AABB (slab test). Returns nearest hit distance or Infinity.
function rayBuildings(origin, dir, colliders, maxDist) {
  let best = Infinity;
  for (const c of colliders) {
    let tmin = 0, tmax = maxDist;
    // x slab (ray is in xz-plane mostly; use full 3D with y range 0..30)
    const axes = [
      [origin.x, dir.x, c.x0, c.x1],
      [origin.y, dir.y, 0, 30],
      [origin.z, dir.z, c.z0, c.z1],
    ];
    let ok = true;
    for (const [o, d, mn, mx] of axes) {
      if (Math.abs(d) < 1e-8) { if (o < mn || o > mx) { ok = false; break; } continue; }
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) { ok = false; break; }
    }
    if (ok && tmin < best) best = tmin;
  }
  return best;
}

export function shoot(camera, scene, colliders) {
  const w = WEAPONS[S.weapon];
  if (S.ammo[S.weapon] <= 0) { flash(`No ${w.name} ammo — pick up more from fallen enemies.`, 2); return; }
  if (S.clock - (S.lastShotT || -99) < w.rate) return;
  S.lastShotT = S.clock;
  S.ammo[S.weapon]--;
  const slowmo = S.abilityUntil > S.clock;
  const origin = new THREE.Vector3();
  camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.x += rand(-w.spread, w.spread) * (slowmo ? 0.4 : 1);
  dir.y += rand(-w.spread, w.spread) * (slowmo ? 0.4 : 1);
  dir.normalize();
  // nearest enemy hit
  let hitEnemy = null, hitDist = Infinity;
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    const toE = new THREE.Vector3(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
    const d = toE.length();
    if (d > w.range) continue;
    toE.normalize();
    const dot = toE.dot(dir);
    if (dot < 0.985) continue; // ~10 deg cone
    const perp = Math.sqrt(Math.max(0, 1 - dot * dot)) * d;
    if (perp < 1.1 && d < hitDist) { hitDist = d; hitEnemy = e; }
  }
  const wallDist = rayBuildings(origin, dir, colliders, w.range);
  const end = new THREE.Vector3().copy(origin).addScaledVector(dir, Math.min(hitDist, wallDist, w.range));
  addTracer(scene, origin.clone().addScaledVector(dir, 1.2), end, 0xffe9a0);
  playShot(S.weapon);
  if (hitEnemy && hitDist < wallDist) {
    hitEnemy.hp -= w.dmg;
    playHit();
    if (hitEnemy.hp <= 0) {
      hitEnemy.dead = true;
      scene.remove(hitEnemy.group);
      S.enemies = S.enemies.filter((e) => e !== hitEnemy);
      const cash = randi(40, 90);
      S.money += cash;
      S.kills++;
      flash(`Gang member down — +${fmtMoney(cash)}`, 2);
      S.ammo.pistol += 12; S.ammo.smg += 20; S.ammo.rifle += 6;
    }
  } else if (wallDist < w.range) {
    // bullet hit a wall: tiny spark via a second short tracer is skipped
  }
  if (!S.inCar) addWanted(1, 'shots fired');
}

export function spawnEnemy(scene, x, z) {
  const f = makeFigure(0x1a1a1a, 0x1a1a1a);
  f.group.position.set(x, 0, z);
  // red bandana
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), new THREE.MeshStandardMaterial({ color: 0xc22a2a }));
  band.position.y = 1.86; f.group.add(band);
  scene.add(f.group);
  const e = { ...f, x, z, angle: 0, hp: 60, cool: rand(0.5, 1.5), dead: false, phase: 0 };
  S.enemies.push(e);
  return e;
}

export function updateEnemies(dt, scene, colliders) {
  const muzzle = new THREE.Vector3();
  for (const e of S.enemies) {
    if (e.dead) continue;
    const d = dist2(e.x, e.z, S.player.x, S.player.z);
    if (d < 42) {
      const want = Math.atan2(S.player.x - e.x, S.player.z - e.z);
      e.angle += clamp(angDiff(e.angle, want), -4 * dt, 4 * dt);
      if (d > 9) {
        e.x += Math.sin(e.angle) * 4.2 * dt;
        e.z += Math.cos(e.angle) * 4.2 * dt;
      }
      e.cool -= dt;
      if (e.cool <= 0 && d < 38) {
        e.cool = rand(0.9, 1.6);
        // enemy shot: 30% hit chance, worse at range
        const hitCh = clamp(0.34 - d * 0.005, 0.08, 0.34);
        muzzle.set(e.x, 1.3, e.z);
        const target = new THREE.Vector3(S.player.x, S.inCar ? 1.0 : 1.2, S.player.z);
        addTracer(scene, muzzle, target, 0xff5a3a);
        if (Math.random() < hitCh) hurtPlayer(randi(6, 12));
      }
    }
    const fixed = collideCircle(colliders, e.x, e.z, 0.8);
    e.x = fixed.x; e.z = fixed.z;
    e.group.position.set(e.x, 0, e.z);
    e.group.rotation.y = e.angle;
    e.phase += dt * 6;
    const sw = Math.sin(e.phase) * 0.4;
    e.legL.rotation.x = sw; e.legR.rotation.x = -sw;
  }
}

export function hurtPlayer(dmg) {
  let left = dmg;
  if (S.armor > 0) { const ab = Math.min(S.armor, left); S.armor -= ab; left -= ab; }
  S.health -= left;
  playHurt();
  if (S.health <= 0) {
    S.health = 0;
    S.over = true;
    S.overText = 'WASTED — Isla Dorada got the better of you. Press R to try again.';
  }
}
