// Isla Dorada — shared state, constants and helpers.
// No imports: every other module reads this one, so it must not import them.

export const CFG = {
  CITY: 600, // city spans -300..300 in x and z; ocean south of z > 240
  ROAD: 60, // road grid spacing
  ROAD_W: 12, // road width
  BLOCK: 48, // building block size inside a road cell
  MAX_WANTED: 5,
  MISSION_PURSE: 14200,
};

export const DISTRICTS = [
  { name: 'Puerto Viejo', x0: -300, z0: -300, x1: -60, z1: -60, color: 0x8a7a5a, tall: 0 },
  { name: 'El Centro', x0: -60, z0: -300, x1: 120, z1: -60, color: 0x5a6a8a, tall: 1 },
  { name: 'Barrio Luna', x0: 120, z0: -300, x1: 300, z1: -60, color: 0xd08a4a, tall: 0 },
  { name: 'Colina Verde', x0: -300, z0: -60, x1: -60, z1: 120, color: 0x4a8a5a, tall: 0 },
  { name: 'Zona Franca', x0: -60, z0: -60, x1: 120, z1: 120, color: 0x7a7a7a, tall: 0 },
  { name: 'Marina del Sol', x0: 120, z0: -60, x1: 300, z1: 240, color: 0x4a9a8a, tall: 0 },
];

export const LEADS = {
  dario: { name: 'Dario "D" Fontaine', role: 'ex-wheelman turned fixer', ability: 'Focus', abilityKey: 'Q', desc: 'Focus slows time when the shooting starts.' },
  carmen: { name: 'Carmen "Comet" Duarte', role: 'street-race queen of the beachfront', ability: 'Nitro', abilityKey: 'Q', desc: 'Nitro turns any car into a rocket.' },
};

export const WEAPONS = {
  pistol: { name: 'Pistol', dmg: 34, rate: 0.32, range: 90, spread: 0.012, auto: false },
  smg: { name: 'SMG', dmg: 18, rate: 0.11, range: 70, spread: 0.03, auto: true },
  rifle: { name: 'Rifle', dmg: 60, rate: 0.65, range: 140, spread: 0.004, auto: false },
};

// The single mutable game state. Modules read and write it; main.js owns the loop.
export const S = {
  started: false,
  paused: false,
  over: false,
  overText: '',
  time: 17.4, // hours, golden hour start
  timeScale: 1, // game hours per real minute
  money: 250,
  wanted: 0,
  wantedHeat: 0, // 0..100, drives star changes
  health: 100,
  armor: 0,
  lead: 'dario',
  abilityReady: true,
  abilityUntil: 0,
  nitroUntil: 0,
  standing: { 'Puerto Viejo': 10, 'El Centro': 0, 'Barrio Luna': 15, 'Colina Verde': 0, 'Zona Franca': 0, 'Marina del Sol': 5 },
  missionsDone: [],
  missionIdx: 0,
  mission: null, // active mission runtime {def, step, timer, ...}
  race: null, // active race {checkpoints, idx, time}
  taxi: null, // active taxi {pickup, drop, fare, timer}
  collectibles: 0,
  collectiblesGot: [],
  weapon: 'pistol',
  ammo: { pistol: 120, smg: 90, rifle: 60 },
  inCar: false,
  player: { x: -180, z: -180, angle: 0, speed: 0, onGround: true },
  car: null, // player car object (from vehicles.js) or null
  camMode: 0, // 0 near, 1 far
  radio: 0,
  radioOn: true,
  shotCam: null, // fixed cinematic camera for ?shot= staging
  shotDrive: false, // auto-cruise for the drive screenshot
  weather: 'clear', // clear | rain | fog
  weatherT: 0,
  kills: 0,
  carsStolen: 0,
  playT: 0, // seconds played
  objective: 'Press ENTER to start — Isla Dorada awaits.',
  message: '',
  messageT: 0,
  // runtime object pools, filled by modules
  traffic: [],
  peds: [],
  cops: [],
  roadblocks: [],
  heli: null,
  enemies: [],
  packages: [],
  markers: [],
  clock: 0,
};

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  if (z >= 240) return 'Playa Dorada';
  return 'Isla Dorada';
}

export function standingOf(name) { return S.standing[name] ?? 0; }
export function addStanding(name, n) {
  S.standing[name] = Math.max(0, Math.min(100, (S.standing[name] ?? 0) + n));
}

export function setObjective(t) { S.objective = t; }
export function flash(msg, secs = 3) { S.message = msg; S.messageT = secs; }

export function addWanted(n, reason) {
  S.wantedHeat = Math.max(0, Math.min(100, S.wantedHeat + n));
  S.lastCrimeT = S.clock;
  const stars = S.wantedHeat <= 0 ? 0 : S.wantedHeat < 20 ? 1 : S.wantedHeat < 40 ? 2 : S.wantedHeat < 60 ? 3 : S.wantedHeat < 85 ? 4 : 5;
  if (stars !== S.wanted) { S.wanted = stars; if (stars > 0) flash(`WANTED — ${stars} star${stars > 1 ? 's' : ''}${reason ? ' · ' + reason : ''}`, 3); }
}

// --- utils ---
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export const fmtMoney = (n) => '$' + Math.floor(n).toLocaleString('en-US');
export const fmtClock = (h) => { const hh = Math.floor(h) % 24; const mm = Math.floor((h % 1) * 60); return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
