// Isla Dorada — HUD: DOM readouts + live minimap canvas.
import { S, WEAPONS, fmtMoney, fmtClock, districtAt, standingOf } from './state.js';

let el = {};
let colliders = [];
let mapCv = null, mapCtx = null;
let frame = 0;

export function initHUD(colls) {
  colliders = colls;
  const ids = ['cash', 'stars', 'health', 'armor', 'clock', 'district', 'objective', 'speed', 'weapon', 'radio', 'message', 'timer', 'collect', 'title', 'help', 'over'];
  for (const id of ids) el[id] = document.getElementById(id);
  mapCv = document.getElementById('minimap');
  if (mapCv) mapCtx = mapCv.getContext('2d');
}

function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

export function updateHUD() {
  frame++;
  if (!el.cash) return;
  el.cash.textContent = fmtMoney(S.money);
  el.stars.textContent = stars(S.wanted);
  el.stars.style.color = S.wanted > 0 ? '#ff5a3a' : '#e8e2d2';
  el.health.style.width = S.health + '%';
  el.health.style.background = S.health > 50 ? '#4a9a3a' : S.health > 25 ? '#d8a83a' : '#c23a2a';
  el.armor.style.width = S.armor + '%';
  el.clock.textContent = fmtClock(S.time);
  const d = districtAt(S.player.x, S.player.z);
  el.district.textContent = d + ' · standing ' + standingOf(d);
  el.objective.textContent = S.objective;
  el.speed.textContent = S.inCar ? Math.round(Math.abs(S.player.speed) * 3.6) + ' km/h' : '';
  const w = WEAPONS[S.weapon];
  el.weapon.textContent = `${S.lead === 'dario' ? 'Dario' : 'Carmen'} · ${w.name} ${S.ammo[S.weapon]} · [${S.weapon === 'pistol' ? '1' : S.weapon === 'smg' ? '2' : '3'}]`;
  const stations = ['SOL FM 88.1', 'TIBURON FM 95.5', 'DORADA FM 101.3'];
  el.radio.textContent = S.radioOn ? '♪ ' + stations[S.radio] + ' (N)' : 'Radio off (N)';
  el.message.textContent = S.messageT > 0 ? S.message : '';
  el.collect.textContent = `Packages ${S.collectibles}/20 · Missions ${S.missionsDone.length}/10`;
  let t = '';
  if (S.mission && S.mission.timer > 0) t = '⏱ ' + Math.ceil(S.mission.timer) + 's';
  else if (S.race) t = '⏱ Race ' + Math.ceil(S.race.timer) + 's';
  else if (S.taxi) t = '⏱ Fare ' + Math.ceil(S.taxi.timer) + 's';
  el.timer.textContent = t;
  if (S.over) {
    el.over.style.display = 'block';
    el.over.textContent = S.overText;
  } else el.over.style.display = 'none';
  if (frame % 2 === 0) drawMinimap();
}

function drawMinimap() {
  if (!mapCtx) return;
  const W = 200, k = W / 600;
  const px = (x) => (x + 300) * k, pz = (z) => (z + 300) * k;
  mapCtx.fillStyle = '#101018';
  mapCtx.fillRect(0, 0, W, W);
  // ocean + beach
  mapCtx.fillStyle = '#1468a8';
  mapCtx.fillRect(0, pz(240), W, W - pz(240));
  mapCtx.fillStyle = '#d9c08a';
  mapCtx.fillRect(0, pz(240), W, pz(300) - pz(240));
  // roads
  mapCtx.strokeStyle = '#3a3a3e'; mapCtx.lineWidth = 4;
  for (let i = -5; i <= 5; i++) {
    mapCtx.beginPath(); mapCtx.moveTo(0, pz(i * 60)); mapCtx.lineTo(W, pz(i * 60)); mapCtx.stroke();
    mapCtx.beginPath(); mapCtx.moveTo(px(i * 60), 0); mapCtx.lineTo(px(i * 60), W); mapCtx.stroke();
  }
  // buildings
  mapCtx.fillStyle = '#5a5a62';
  for (const c of colliders) mapCtx.fillRect(px(c.x0), pz(c.z0), (c.x1 - c.x0) * k, (c.z1 - c.z0) * k);
  // packages
  mapCtx.fillStyle = '#ffd83a';
  for (const p of S.packages) if (!p.got) { mapCtx.beginPath(); mapCtx.arc(px(p.x), pz(p.z), 2, 0, 7); mapCtx.fill(); }
  // mission beacon / race / taxi target
  const target = S.mission ? currentMissionTarget() : S.race ? S.race.cps[S.race.cpIdx] : S.taxi ? S.taxi.drop : null;
  if (target) {
    mapCtx.fillStyle = '#ffd83a';
    mapCtx.beginPath(); mapCtx.arc(px(target.x), pz(target.z), 4, 0, 7); mapCtx.fill();
    mapCtx.strokeStyle = '#ffd83a'; mapCtx.lineWidth = 1.5;
    mapCtx.beginPath(); mapCtx.arc(px(target.x), pz(target.z), 7 + Math.sin(S.clock * 4) * 2, 0, 7); mapCtx.stroke();
  }
  // cops
  mapCtx.fillStyle = '#ff5a3a';
  for (const c of S.cops) { mapCtx.beginPath(); mapCtx.arc(px(c.x), pz(c.z), 3, 0, 7); mapCtx.fill(); }
  if (S.heli) { mapCtx.fillStyle = '#ff5a3a'; mapCtx.beginPath(); mapCtx.arc(px(S.heli.x), pz(S.heli.z), 4, 0, 7); mapCtx.fill(); }
  // enemies
  mapCtx.fillStyle = '#ff2a5a';
  for (const e of S.enemies) { mapCtx.beginPath(); mapCtx.arc(px(e.x), pz(e.z), 2.5, 0, 7); mapCtx.fill(); }
  // player arrow
  const x = px(S.player.x), y = pz(S.player.z);
  mapCtx.save();
  mapCtx.translate(x, y);
  mapCtx.rotate(Math.PI - S.player.angle);
  mapCtx.fillStyle = '#ffffff';
  mapCtx.beginPath(); mapCtx.moveTo(0, -6); mapCtx.lineTo(4.5, 5); mapCtx.lineTo(-4.5, 5); mapCtx.closePath(); mapCtx.fill();
  mapCtx.restore();
}

function currentMissionTarget() {
  const m = S.mission;
  if (!m) return null;
  const step = m.def.steps[m.stepIdx];
  if (!step) return null;
  if (step.type === 'race') return step.cps[m.cpIdx];
  return step.at || null;
}
