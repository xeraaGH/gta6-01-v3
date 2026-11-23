// Isla Dorada — save/load via localStorage.
import { S } from './state.js';

const KEY = 'isla-dorada-save-v1';

export function saveGame() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      money: S.money,
      missionsDone: S.missionsDone,
      missionIdx: S.missionIdx,
      standing: S.standing,
      collectibles: S.collectibles,
      collectiblesGot: S.collectiblesGot,
      lead: S.lead,
      weapon: S.weapon,
      ammo: S.ammo,
      health: S.health,
      armor: S.armor,
      time: S.time,
    }));
  } catch (e) { /* storage unavailable (headless) — fine */ }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S.money = d.money ?? S.money;
    S.missionsDone = d.missionsDone ?? [];
    S.missionIdx = d.missionIdx ?? 0;
    S.standing = { ...S.standing, ...(d.standing ?? {}) };
    S.collectibles = d.collectibles ?? 0;
    S.collectiblesGot = d.collectiblesGot ?? [];
    S.lead = d.lead ?? 'dario';
    S.weapon = d.weapon ?? 'pistol';
    S.ammo = { ...S.ammo, ...(d.ammo ?? {}) };
    S.health = d.health ?? 100;
    S.armor = d.armor ?? 0;
    S.time = d.time ?? 17.4;
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
