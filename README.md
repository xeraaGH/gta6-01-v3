[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/xeraaGH/gta6-01-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Isla Dorada — an open-world crime game

**Isla Dorada** is a complete 3D open-world crime game that runs offline in a
desktop browser from its own static files. It was built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01) ($1,666, top 100
paid) and is entirely original: its own city, characters, vehicles, names,
story, art, sound and music — nothing from any commercial game.

Built by an AI agent on make.fun — referral code `mk5wvbzz`.

## The city

Isla Dorada is a sun-soaked Caribbean island city: six districts (Puerto
Viejo, El Centro, Barrio Luna, Colina Verde, Zona Franca, Marina del Sol), a
beach (Playa Dorada) and ocean, a pier, the Faro del Sol lighthouse, the
Casino Estrella, a stadium, City Hall, and the volcano Cerro Dorado on the
horizon. A full day/night cycle, rain and fog roll over it while you play.

## Two leads

- **Dario "D" Fontaine** — ex-wheelman turned fixer. Crew ability **Focus** (Q)
  slows time when the shooting starts.
- **Carmen "Comet" Duarte** — street-race queen of the beachfront. Crew ability
  **Nitro** (Q) turns any car into a rocket.

Press **C** on foot to switch leads. Each district tracks your **standing** —
work a district and it opens up to you.

## What is in the game

- **A city on foot and by car** — third-person walking and arcade driving,
  with a chase camera and mouse-look.
- **Traffic and pedestrians** — cars that drive the road grid and stop for
  you, civilians who walk the sidewalks and flee gunfire.
- **Steal any car** — press E by a parked or driven car. The owner runs, the
  law notices.
- **Wanted 1–5 stars** — PD cruisers chase and PIT you, roadblocks seal
  streets at 3 stars, a helicopter with a spotlight hunts you at 4+. Break
  line of sight to cool off, or get busted and pay bail.
- **10 story missions, $14,200 purse** — steal a car, run a package, shake a
  tail, win a beachfront race, clear the market of Los Tiburones, a casino
  getaway, a midnight smuggling run, a stadium heist, a casino vault hit, and
  the final showdown with Rico "El Tiburón" Vane.
- **Combat** — pistol, SMG and rifle (1/2/3), punching (F), enemy gang
  members who shoot back.
- **Side work** — 3 street races (R), taxi fares (T), 20 hidden packages
  ($250 each).
- **HUD with a live minimap** — cash, wanted stars, health/armor, clock,
  district + standing, objective text, speed, weapon, radio station.
- **Title screen, pause menu and save** — progress (cash, missions, standing,
  collectibles) persists in localStorage.
- **Sound and music** — fully synthesized WebAudio: engine hum, two-tone
  sirens, gunshots, cash jingles, mission stingers, and three procedural
  radio stations (N to change).

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| SHIFT | Run |
| Mouse + click | Aim / shoot |
| E | Enter or steal a car |
| F | Punch |
| SPACE | Handbrake |
| Q | Crew ability (Focus / Nitro) |
| C | Switch lead |
| 1 / 2 / 3 | Pistol / SMG / Rifle |
| M | Next story mission |
| T | Taxi fare |
| R | Street race |
| N | Radio station |
| V | Camera distance |
| P / ESC | Pause |
| H | Help |

## Play it

Serve `game/` with any static HTTP server and open `game/index.html`, for
example:

```sh
cd game && python3 -m http.server 8080
```

No network request is made at runtime: three.js is vendored under
`game/vendor/`, all art is procedural, all sound is synthesized.

## Structure

```
main.ts                  entry program: copies game/ + screenshots/ to /output
                         and writes /output/dossier.json
vendor/makefun-game.ts   the kit's dossier library, unchanged
game/index.html          page, HUD, title/pause/wasted screens
game/vendor/three.min.js three.js 0.186.0 (MIT), vendored
game/src/main.js         boot, game loop, camera, input, day/night, weather
game/src/state.js        shared world state + helpers
game/src/city.js         Isla Dorada: districts, roads, landmarks, sky, ocean
game/src/vehicles.js     car factory, driving physics, traffic AI, car theft
game/src/people.js       the two leads on foot, pedestrians, combat
game/src/police.js       wanted 1–5, cruisers, PIT, roadblocks, helicopter
game/src/missions.js     10 story missions + races, taxi, collectibles
game/src/hud.js          HUD + live minimap
game/src/audio.js        synthesized WebAudio sound + radio
game/src/save.js         localStorage save/load
game/src/shots.js        screenshot staging (?shot=cover|drive|mission|city)
screenshots/             4 real renders of the game
```

## License

MIT — see [LICENSE](LICENSE). three.js is MIT-licensed (see
`game/vendor/THREE-LICENSE.txt`).
