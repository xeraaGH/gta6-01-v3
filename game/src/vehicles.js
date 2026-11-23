// Isla Dorada — cars: factory, arcade driving, traffic AI, car theft.
// Imports state + city (road graph, collision).
import * as THREE from '../vendor/three.min.js';
import { S, CFG, rand, randi, pick, clamp, dist2, angDiff, addWanted, flash } from './state.js';
import { collideCircle } from './city.js';

const CAR_COLORS = [0xc23a2a, 0x2a6ac2, 0xd8a83a, 0x3a9a5a, 0xe8e2d2, 0x2a2a2e, 0x7a3a8a, 0x4a9a8a, 0xd86a2a];

export function createCar(scene, color, x, z, angle) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x18202e, roughness: 0.15, metalness: 0.7 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.25, -0.2); cabin.castShadow = true; g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    g.add(w); wheels.push(w);
  }
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffedb0, emissiveIntensity: 0.6 });
  for (const wx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), lightMat);
    h.position.set(wx, 0.7, 2.22); g.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xc22a2a, emissive: 0x8a1010, emissiveIntensity: 0.6 });
  for (const wx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), tailMat);
    t.position.set(wx, 0.7, -2.22); g.add(t);
  }
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  scene.add(g);
  return { group: g, x, z, angle, speed: 0, color, wheels, isPlayer: false, route: null, waitT: 0, parked: false };
}

export function spawnTraffic(scene, intersections) {
  const cars = [];
  for (let i = 0; i < 14; i++) {
    const it = pick(intersections);
    const c = createCar(scene, pick(CAR_COLORS), it.x + rand(-3, 3), it.z + rand(-3, 3), rand(0, Math.PI * 2));
    c.route = [pick(intersections), pick(intersections)];
    c.speed = rand(7, 11);
    cars.push(c);
  }
  // parked cars along roads
  for (let i = 0; i < 10; i++) {
    const it = pick(intersections);
    const along = Math.random() < 0.5;
    const c = createCar(scene, pick(CAR_COLORS), it.x + (along ? rand(-24, 24) : (Math.random() < 0.5 ? 7.5 : -7.5)), it.z + (along ? (Math.random() < 0.5 ? 7.5 : -7.5) : rand(-24, 24)), along ? 0 : Math.PI / 2);
    c.parked = true;
    cars.push(c);
  }
  S.traffic = cars;
  return cars;
}

function nearestIntersection(intersections, x, z) {
  let best = intersections[0], bd = 1e9;
  for (const it of intersections) { const d = dist2(x, z, it.x, it.z); if (d < bd) { bd = d; best = it; } }
  return best;
}

function updateTrafficCar(c, dt, colliders, intersections, allCars) {
  if (c.parked || c.isPlayer) return;
  // pick next target when close
  const target = c.route[0];
  if (!target || dist2(c.x, c.z, target.x, target.z) < 4) {
    const cur = nearestIntersection(intersections, c.x, c.z);
    const neigh = intersections.filter((it) => (Math.abs(it.x - cur.x) === 60 && it.z === cur.z) || (Math.abs(it.z - cur.z) === 60 && it.x === cur.x));
    c.route = [neigh.length ? pick(neigh) : pick(intersections)];
    return;
  }
  // car ahead? brake
  let blocked = false;
  for (const o of allCars) {
    if (o === c || o.parked) continue;
    const dx = o.x - c.x, dz = o.z - c.z;
    const fwd = Math.sin(c.angle), fwdZ = Math.cos(c.angle);
    const along = dx * fwd + dz * fwdZ;
    const side = Math.abs(dx * fwdZ - dz * fwd);
    if (along > 0 && along < 9 && side < 2.4) { blocked = true; break; }
  }
  const want = blocked ? 0 : rand(8, 11);
  c.speed += clamp(want - c.speed, -14 * dt, 8 * dt);
  const wantAngle = Math.atan2(target.x - c.x, target.z - c.z);
  c.angle += clamp(angDiff(c.angle, wantAngle), -2.2 * dt, 2.2 * dt);
  c.x += Math.sin(c.angle) * c.speed * dt;
  c.z += Math.cos(c.angle) * c.speed * dt;
  const fixed = collideCircle(colliders, c.x, c.z, 2.2);
  c.x = fixed.x; c.z = fixed.z;
  c.group.position.set(c.x, 0, c.z);
  c.group.rotation.y = c.angle;
  for (const w of c.wheels) w.rotation.x += c.speed * dt * 2.4;
}

export function updateTraffic(dt, colliders, intersections) {
  for (const c of S.traffic) updateTrafficCar(c, dt, colliders, intersections, S.traffic);
}

// Player driving. input: {fwd, back, left, right, handbrake, nitro}
export function updatePlayerCar(dt, input, colliders) {
  const c = S.car;
  if (!c) return;
  const maxFwd = S.nitroUntil > S.clock ? 52 : 38;
  const maxRev = -13;
  if (input.fwd) c.speed += 26 * dt;
  else if (input.back) c.speed -= 30 * dt;
  else c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 12 * dt);
  if (input.handbrake) c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 26 * dt);
  c.speed = clamp(c.speed, maxRev, maxFwd);
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const grip = input.handbrake ? 1.9 : 1.15;
  c.angle += steer * grip * dt * clamp(Math.abs(c.speed) / 9, 0, 1) * (c.speed < 0 ? -1 : 1);
  c.x += Math.sin(c.angle) * c.speed * dt;
  c.z += Math.cos(c.angle) * c.speed * dt;
  // stay in the world
  c.x = clamp(c.x, -295, 295); c.z = clamp(c.z, -295, 298); // stay on land (beach ends at z 300)
  const fixed = collideCircle(colliders, c.x, c.z, 2.3);
  if (fixed.x !== c.x || fixed.z !== c.z) {
    c.speed *= 0.55;
    if (Math.abs(c.speed) > 14) addWanted(2, 'crash');
    c.x = fixed.x; c.z = fixed.z;
  }
  // bump other cars
  for (const o of S.traffic) {
    if (o === c || o.parked) continue;
    const d = dist2(c.x, c.z, o.x, o.z);
    if (d < 4.4 && d > 0.01) {
      const push = (4.4 - d) / 2;
      const nx = (c.x - o.x) / d, nz = (c.z - o.z) / d;
      c.x += nx * push; c.z += nz * push;
      o.x -= nx * push; o.z -= nz * push;
      if (Math.abs(c.speed) > 12) { addWanted(2, 'hit and run'); c.speed *= 0.7; }
    }
  }
  c.group.position.set(c.x, 0, c.z);
  c.group.rotation.y = c.angle;
  for (const w of c.wheels) w.rotation.x += c.speed * dt * 2.4;
  if (S.shotDrive) c.speed = 12; // screenshot staging: steady cruise, no input needed
  S.player.x = c.x; S.player.z = c.z; S.player.angle = c.angle; S.player.speed = c.speed;
}

export function tryEnterCar() {
  // nearest car within 4 units
  let best = null, bd = 4;
  for (const c of S.traffic) {
    const d = dist2(S.player.x, S.player.z, c.x, c.z);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) { flash('No car nearby — get closer and press E.', 2); return false; }
  const wasParked = best.parked;
  best.parked = false;
  best.isPlayer = true;
  S.traffic = S.traffic.filter((c) => c !== best);
  S.car = best;
  S.inCar = true;
  if (!wasParked) {
    addWanted(12, 'car stolen');
    S.carsStolen++;
    flash('Car stolen! The owner ran — the law noticed.', 3);
  } else {
    flash('You took the car.', 2);
  }
  return true;
}

export function exitCar() {
  const c = S.car;
  if (!c) return;
  c.isPlayer = false;
  c.speed = 0;
  S.traffic.push(c);
  S.car = null;
  S.inCar = false;
  S.player.x = c.x + Math.sin(c.angle + Math.PI / 2) * 3;
  S.player.z = c.z + Math.cos(c.angle + Math.PI / 2) * 3;
  S.player.speed = 0;
}
