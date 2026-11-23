// Isla Dorada — sound: fully synthesized WebAudio. No audio files.
import { S } from './state.js';

let ctx = null, master = null, engineOsc = null, engineOsc2 = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenOn = false;
let radioTimer = null, radioStep = 0, nextNoteT = 0;

// 3 stations: 16-step bass + lead patterns (semitone offsets from a root).
const STATIONS = [
  { name: 'SOL FM', root: 110, bpm: 96, bass: [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5], lead: [12, -1, 15, -1, 19, -1, 15, 12, -1, 17, -1, 15, 12, -1, 10, -1] },
  { name: 'TIBURON FM', root: 130.8, bpm: 120, bass: [0, -1, 0, 3, -1, 0, 5, 3, 0, -1, 0, 3, 7, 5, 3, 0], lead: [12, -1, -1, 15, -1, 17, -1, 19, 17, -1, 15, -1, 12, -1, 10, 12] },
  { name: 'DORADA FM', root: 98, bpm: 132, bass: [0, 0, 0, 7, 0, 0, 10, 7, 0, 0, 0, 7, 12, 0, 10, 7], lead: [12, 12, -1, 15, -1, 19, 19, -1, 17, -1, 15, 12, -1, 10, 12, -1] },
];

function midi(root, semi) { return root * Math.pow(2, semi / 12); }

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    // engine hum
    engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator(); engineOsc2.type = 'square'; engineOsc2.frequency.value = 28;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    engineOsc.connect(lp); engineOsc2.connect(lp); lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
    // siren (two-tone via LFO on frequency)
    sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 750;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain(); sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain); sirenGain.connect(master);
    sirenOsc.start(); lfo.start();
    // radio scheduler
    nextNoteT = ctx.currentTime + 0.1;
    radioTimer = setInterval(scheduleRadio, 90);
  } catch (e) { ctx = null; }
}

function scheduleRadio() {
  if (!ctx || !S.radioOn || S.paused) return;
  const st = STATIONS[S.radio];
  const stepDur = 60 / st.bpm / 2;
  while (nextNoteT < ctx.currentTime + 0.25) {
    const i = radioStep % 16;
    const b = st.bass[i], l = st.lead[i];
    if (b >= 0) blip(midi(st.root, b) / 2, nextNoteT, stepDur * 0.9, 'triangle', 0.16);
    if (l >= 0 && radioStep % 2 === 0) blip(midi(st.root, l), nextNoteT, stepDur * 0.8, 'sine', 0.07);
    if (radioStep % 4 === 0) noiseHit(nextNoteT, 0.03, 0.05);
    radioStep++;
    nextNoteT += stepDur;
  }
}

function blip(freq, t, dur, type, vol) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseHit(t, dur, vol) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(g); g.connect(master);
  src.start(t);
}

export function updateEngine(speed, inCar) {
  if (!ctx) return;
  const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.003) : 0;
  engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
  const f = 50 + Math.abs(speed) * 4.2;
  engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
  engineOsc2.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.08);
  sirenGain.gain.setTargetAtTime(sirenOn ? 0.05 : 0, ctx.currentTime, 0.2);
}

export function playSiren() { sirenOn = true; }
export function stopSiren() { sirenOn = false; }

export function playShot(weapon) {
  if (!ctx) return;
  const t = ctx.currentTime;
  noiseHit(t, weapon === 'rifle' ? 0.16 : 0.09, weapon === 'rifle' ? 0.5 : 0.32);
  blip(weapon === 'smg' ? 220 : 160, t, 0.06, 'square', 0.12);
}
export function playHit() { if (ctx) blip(880, ctx.currentTime, 0.07, 'sine', 0.14); }
export function playHurt() { if (ctx) blip(90, ctx.currentTime, 0.18, 'sawtooth', 0.2); }
export function playCash() {
  if (!ctx) return;
  const t = ctx.currentTime;
  blip(988, t, 0.09, 'sine', 0.16);
  blip(1319, t + 0.09, 0.14, 'sine', 0.16);
}
export function playStinger() {
  if (!ctx) return;
  const t = ctx.currentTime;
  blip(220, t, 0.5, 'triangle', 0.16);
  blip(277, t, 0.5, 'triangle', 0.12);
  blip(330, t, 0.6, 'triangle', 0.12);
}
