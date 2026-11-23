// Isla Dorada — police: wanted level, cruisers, PIT, roadblocks, helicopter.
// Imports state, city (collision), vehicles (car factory), people (hurtPlayer).
import * as THREE from '../vendor/three.min.js';
import { S, clamp, dist2, angDiff, rand, randi, pick, addWanted, flash, fmtMoney } from './state.js';
import { collideCircle } from './city.js';
import { createCar } from './vehicles.js';
import { hurtPlayer } from './people.js';
import { playSiren } from './audio.js';

let bustT = 0;

function makeCruiser(scene, x, z, angle) {
  const c = createCar(scene, 0x1a1a22, x, z, angle);
  // white doors + light bar
  const doorMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.5 });
  for (const sx of [-1.02, 1.02]) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 2.0), doorMat);
    d.position.set(sx, 0.75, 0); c.group.add(d);
  }
  const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2020, emissiveIntensity: 2 }));
  barR.position.set(-0.4, 1.62, -0.2); c.group.add(barR);
  const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a4aff, emissive: 0x2030ff, emissiveIntensity: 2 }));
  barB.position.set(0.4, 1.62, -0.2); c.group.add(barB);
  c.barR = barR; c.barB = barB;
  c.isCop = true;
  return c;
}

function makeHeli(scene) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.2), new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.5, metalness: 0.4 }));
  body.castShadow = true; g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x1a2a4a }));
  tail.position.set(0, 0.2, -3.8); g.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222 }));
  rotor.position.y = 1.0; g.add(rotor);
  const spot = new THREE.SpotLight(0xfff2c0, 400, 90, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.6, 0);
  g.add(spot);
  g.add(spot.target);
  scene.add(g);
  return { group: g, rotor, spot, x: 0, z: 0, y: 55 };
}

export function updatePolice(dt, scene, colliders, intersections) {
  // spawn / despawn cruisers to match wanted stars
  const want = S.wanted;
  while (S.cops.length < want) {
    const a = rand(0, Math.PI * 2);
    const x = clamp(S.player.x + Math.sin(a) * rand(55, 80), -290, 290);
    const z = clamp(S.player.z + Math.cos(a) * rand(55, 80), -290, 290);
    const c = makeCruiser(scene, x, z, rand(0, Math.PI * 2));
    c.speed = 0;
    S.cops.push(c);
  }
  while (S.cops.length > want) {
    const c = S.cops.pop();
    scene.remove(c.group);
  }
  if (want > 0) playSiren();

  // cruisers chase
  for (const c of S.cops) {
    const d = dist2(c.x, c.z, S.player.x, S.player.z);
    const targetAngle = Math.atan2(S.player.x - c.x, S.player.z - c.z);
    c.angle += clamp(angDiff(c.angle, targetAngle), -2.6 * dt, 2.6 * dt);
    const top = 13 + want * 2.4;
    c.speed += clamp(top - c.speed, -18 * dt, 12 * dt);
    c.x += Math.sin(c.angle) * c.speed * dt;
    c.z += Math.cos(c.angle) * c.speed * dt;
    const fixed = collideCircle(colliders, c.x, c.z, 2.2);
    c.x = fixed.x; c.z = fixed.z;
    c.group.position.set(c.x, 0, c.z);
    c.group.rotation.y = c.angle;
    // light bar flash
    const on = Math.floor(S.clock * 6) % 2 === 0;
    c.barR.material.emissiveIntensity = on ? 2.5 : 0.2;
    c.barB.material.emissiveIntensity = on ? 0.2 : 2.5;
    // PIT / ram the player car
    if (S.inCar && d < 5 && c.speed > 10) {
      S.car.speed *= 0.86;
      c.speed *= 0.7;
      hurtPlayer(3);
      if (Math.random() < 0.3) addWanted(1, 'resisting');
    }
    // busted on foot
    if (!S.inCar && d < 3.6) {
      bustT += dt;
      if (bustT > 2) {
        bustT = 0;
        const fine = Math.min(150, S.money);
        S.money -= fine;
        S.wanted = 0; S.wantedHeat = 0;
        for (const cc of S.cops) scene.remove(cc.group);
        S.cops.length = 0;
        clearRoadblocks(scene);
        S.player.x = -37; S.player.z = -250; // police station, El Centro
        S.health = 100;
        flash(`BUSTED — you paid ${fmtMoney(fine)} bail and walked out of the El Centro station.`, 4);
      }
    } else bustT = Math.max(0, bustT - dt);
  }

  // roadblocks at 3+ stars
  if (want >= 3 && S.roadblocks.length === 0) {
    const a = S.player.angle || 0;
    const bx = S.player.x + Math.sin(a) * 34, bz = S.player.z + Math.cos(a) * 34;
    for (const off of [-6, 0, 6]) {
      const px = bx + Math.cos(a) * off, pz = bz - Math.sin(a) * off;
      const c = makeCruiser(scene, clamp(px, -290, 290), clamp(pz, -290, 290), a + Math.PI / 2);
      c.speed = 0;
      S.roadblocks.push(c);
    }
    flash('ROADBLOCK ahead — find another route!', 3);
  }
  if (want < 3 && S.roadblocks.length > 0) clearRoadblocks(scene);

  // helicopter at 4+ stars
  if (want >= 4 && !S.heli) {
    S.heli = makeHeli(scene);
    flash('Police helicopter overhead — break line of sight!', 3);
  }
  if (want < 4 && S.heli) {
    scene.remove(S.heli.group);
    S.heli = null;
  }
  if (S.heli) {
    const h = S.heli;
    h.x += (S.player.x - h.x) * Math.min(1, dt * 1.4);
    h.z += (S.player.z - h.z) * Math.min(1, dt * 1.4);
    h.group.position.set(h.x, h.y + Math.sin(S.clock * 1.3) * 1.5, h.z);
    h.group.rotation.y = Math.atan2(S.player.x - h.x, S.player.z - h.z);
    h.rotor.rotation.y += dt * 22;
    h.spot.target.position.set(S.player.x - h.x, -h.y, S.player.z - h.z);
  }

  // wanted decay when no cop is near and no recent crime
  const nearCop = S.cops.some((c) => dist2(c.x, c.z, S.player.x, S.player.z) < 45) || (S.heli && want >= 4);
  if (!nearCop && S.wanted > 0 && S.clock - (S.lastCrimeT || 0) > 6) {
    S.wantedHeat = Math.max(0, S.wantedHeat - dt * 2.2);
    const stars = S.wantedHeat <= 0 ? 0 : S.wantedHeat < 20 ? 1 : S.wantedHeat < 40 ? 2 : S.wantedHeat < 60 ? 3 : S.wantedHeat < 85 ? 4 : 5;
    if (stars !== S.wanted) {
      S.wanted = stars;
      if (stars === 0) flash('You lost them — the heat is off.', 3);
    }
  }
}

export function clearRoadblocks(scene) {
  for (const c of S.roadblocks) scene.remove(c.group);
  S.roadblocks.length = 0;
}
