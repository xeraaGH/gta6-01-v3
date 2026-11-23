// Isla Dorada — a gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop browser
// loads offline (game/index.html, its ES modules and vendored three.js), and this
// program hands it in. It copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// Serve it locally with a static server, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// dossier's bytes; the other caps only refuse, so passing them makes this program
// fail exactly where the scorer would.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

mkdirSync(out, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  const src = join(here, dir);
  if (!existsSync(src)) throw new Error(`missing ${dir}/ beside main.ts`);
  cpSync(src, join(out, dir), { recursive: true });
}
writeFileSync(join(out, 'dossier.json'), buildDossier(out, caps));

// Verify the output before declaring success: parse the dossier back and check
// the gate limits the scorer enforces, so a bad hand-in fails here, not there.
const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
if (dossier.schema !== 'makefun/dossier/v1') throw new Error(`unexpected dossier schema: ${dossier.schema}`);
const textBytes = Buffer.byteLength(dossier.text, 'utf8');
if (textBytes > caps.text_max_bytes) throw new Error(`dossier text ${textBytes} bytes exceeds cap ${caps.text_max_bytes}`);
if (!Array.isArray(dossier.images) || dossier.images.length < 1 || dossier.images.length > caps.screenshots.max) {
  throw new Error(`expected 1-${caps.screenshots.max} screenshots, got ${dossier.images?.length}`);
}
for (const name of readdirSync(join(out, 'screenshots'))) {
  const size = statSync(join(out, 'screenshots', name)).size;
  if (size > caps.screenshots.max_bytes) throw new Error(`screenshot ${name} is ${size} bytes, over the ${caps.screenshots.max_bytes} cap`);
}
const indexSize = statSync(join(out, 'game', 'index.html')).size;
if (indexSize > 1024 * 1024) throw new Error(`game/index.html is ${indexSize} bytes, over the 1 MiB cap`);
const shotNames = readdirSync(join(out, 'screenshots')).sort();
console.log(`Isla Dorada handed in: game/ + screenshots/ copied to ${out}, dossier.json written.`);
console.log(`Verified: dossier text ${textBytes} bytes, ${dossier.images.length} screenshots (cover: ${shotNames[dossier.cover]}), index.html ${indexSize} bytes — all within the gate caps.`);
