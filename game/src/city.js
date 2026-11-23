// Isla Dorada — the city: ground, roads, buildings, landmarks, ocean, sky.
// Imports state only. Exports buildCity(scene) -> { colliders, intersections, sun, hemi, ocean, oceanTex, clouds, beacons }.
import * as THREE from '../vendor/three.min.js';
import { CFG, DISTRICTS, rand, randi, pick, clamp } from './state.js';

const WORLD = 600; // -300..300
const HALF = WORLD / 2;

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// A building facade texture: tinted wall with lit/unlit windows.
function facadeTex(base, lit) {
  return canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 16) {
      for (let x = 8; x < s - 8; x += 14) {
        const on = Math.random() < lit;
        g.fillStyle = on ? '#ffd98a' : (Math.random() < 0.5 ? '#20242e' : '#2e3542');
        g.fillRect(x, y, 8, 10);
      }
    }
  });
}

function groundTexture() {
  const S = 2048, k = S / WORLD; // px per world unit
  const toPx = (v) => (v + HALF) * k;
  return canvasTex(S, (g) => {
    g.fillStyle = '#5f5f5c'; g.fillRect(0, 0, S, S);
    // block fill (sidewalk / lots)
    for (let ix = -5; ix < 5; ix++) {
      for (let iz = -5; iz < 5; iz++) {
        const x0 = ix * 60, z0 = iz * 60;
        g.fillStyle = (ix + iz) % 3 === 0 ? '#6e6e68' : '#676761';
        g.fillRect(toPx(x0 + 7), toPx(z0 + 7), 46 * k, 46 * k);
      }
    }
    // beach strip z 240..300
    g.fillStyle = '#d9c08a'; g.fillRect(0, toPx(240), S, 60 * k);
    g.fillStyle = '#c9ae72';
    for (let i = 0; i < 300; i++) g.fillRect(Math.random() * S, toPx(240) + Math.random() * 60 * k, 3, 2);
    // park in Colina Verde
    g.fillStyle = '#4a7a44'; g.fillRect(toPx(-300 + 7), toPx(-60 + 7), 46 * k, 46 * k);
    g.fillStyle = '#3a6a38';
    for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(toPx(-300 + 14 + Math.random() * 32), toPx(-60 + 14 + Math.random() * 32), 4 + Math.random() * 7, 0, 7); g.fill(); }
    // plaza in El Centro
    g.fillStyle = '#9a948a'; g.fillRect(toPx(-60 + 7), toPx(-300 + 7), 46 * k, 46 * k);
    g.fillStyle = '#7a94b8'; g.beginPath(); g.arc(toPx(-37), toPx(-277), 9 * k, 0, 7); g.fill();
    // roads
    for (let i = -5; i <= 5; i++) {
      const p = i * 60;
      g.fillStyle = '#232326';
      g.fillRect(0, toPx(p - 6), S, 12 * k); // horizontal road (along x)
      g.fillRect(toPx(p - 6), 0, 12 * k, S); // vertical road (along z)
      // dashes
      g.fillStyle = '#d8b93a';
      for (let d = -300; d < 300; d += 12) {
        g.fillRect(toPx(d), toPx(p - 0.6), 6 * k, 1.2 * k);
        g.fillRect(toPx(p - 0.6), toPx(d), 1.2 * k, 6 * k);
      }
      // edge lines
      g.fillStyle = '#cfcfc8';
      g.fillRect(0, toPx(p - 6), S, 0.5 * k); g.fillRect(0, toPx(p + 5.5), S, 0.5 * k);
      g.fillRect(toPx(p - 6), 0, 0.5 * k, S); g.fillRect(toPx(p + 5.5), 0, 0.5 * k, S);
    }
  });
}

function oceanTexture() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#1468a8'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      g.beginPath();
      const y = Math.random() * s;
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.1 + i) * 4);
      g.stroke();
    }
  });
}

export function buildCity(scene) {
  const colliders = []; // {x0,z0,x1,z1}
  const intersections = [];
  for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) intersections.push({ x: ix * 60, z: iz * 60 });

  // ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ocean (south of the beach)
  const oceanTex = oceanTexture();
  oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping;
  oceanTex.repeat.set(6, 3);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 420),
    new THREE.MeshPhongMaterial({ map: oceanTex, color: 0x2a7ab8, shininess: 120, transparent: true, opacity: 0.94 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.6, 300 + 210);
  scene.add(ocean);

  // facade textures
  const facades = [
    facadeTex('#8a7a68', 0.35), facadeTex('#6a7a8a', 0.3), facadeTex('#a8845a', 0.35),
    facadeTex('#7a6a7a', 0.3), facadeTex('#5a6a5a', 0.25), facadeTex('#9a8a7a', 0.35),
  ];
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 1 });

  const addBuilding = (x, z, w, d, h, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    // rooftop box
    const r = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 1.2, d * 0.3), roofMat);
    r.position.set(x + w * 0.15, h + 0.6, z);
    scene.add(r);
    return m;
  };

  // buildings per block
  for (let ix = -5; ix < 5; ix++) {
    for (let iz = -5; iz < 5; iz++) {
      const cx = ix * 60 + 30, cz = iz * 60 + 30;
      if (cz >= 240) continue; // beach
      if (ix === -5 && iz === -1) continue; // park block
      if (ix === -1 && iz === -5) continue; // plaza block
      const dist = DISTRICTS.find((d) => cx >= d.x0 && cx < d.x1 && cz >= d.z0 && cz < d.z1);
      const tall = dist && dist.tall === 1;
      const n = tall ? randi(1, 2) : randi(2, 4);
      for (let b = 0; b < n; b++) {
        const w = rand(12, 20), d = rand(12, 20);
        const x = cx + rand(-12, 12), z = cz + rand(-12, 12);
        const h = tall ? rand(22, 58) : rand(6, 16);
        addBuilding(x, z, w, d, h, new THREE.MeshStandardMaterial({ map: pick(facades), roughness: 0.9 }));
      }
    }
  }

  // landmarks
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a83a, emissive: 0x8a6a10, roughness: 0.4, metalness: 0.6 });
  // Casino Estrella (Marina del Sol)
  const casino = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 24), new THREE.MeshStandardMaterial({ color: 0x7a2a4a, roughness: 0.6 }));
  casino.position.set(210, 7, 30); casino.castShadow = true; scene.add(casino);
  colliders.push({ x0: 193, z0: 18, x1: 227, z1: 42 });
  const casinoSign = new THREE.Mesh(new THREE.BoxGeometry(30, 3, 1), gold);
  casinoSign.position.set(210, 15.5, 18); scene.add(casinoSign);
  // City Hall with dome (El Centro plaza)
  const hall = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 18), new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.8 }));
  hall.position.set(-37, 6, -277); hall.castShadow = true; scene.add(hall);
  colliders.push({ x0: -49, z0: -286, x1: -25, z1: -268 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  dome.position.set(-37, 12, -277); scene.add(dome);
  // Stadium (Colina Verde)
  const stadium = new THREE.Mesh(new THREE.CylinderGeometry(26, 28, 10, 24), new THREE.MeshStandardMaterial({ color: 0x4a6a8a, roughness: 0.8 }));
  stadium.position.set(-180, 5, 30); stadium.castShadow = true; scene.add(stadium);
  colliders.push({ x0: -208, z0: 2, x1: -152, z1: 58 });
  // Lighthouse Faro del Sol at the pier end
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.7 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.7 });
  const lh = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(3.2 - i * 0.35, 3.6 - i * 0.35, 5, 12), i % 2 ? redMat : lightMat);
    seg.position.y = 2.5 + i * 5; seg.castShadow = true; lh.add(seg);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: 0xffc83a, emissiveIntensity: 2 }));
  lamp.position.y = 22; lh.add(lamp);
  lh.position.set(-240, 0, 330);
  scene.add(lh);
  colliders.push({ x0: -244, z0: 326, x1: -236, z1: 334 });
  // Pier planks
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x7a5a34, roughness: 1 });
  for (let z = 300; z < 330; z += 6) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 5.4), pierMat);
    p.position.set(-240, 0.4, z); p.receiveShadow = true; scene.add(p);
  }
  // Cerro Dorado mountain on the northern horizon
  const mountain = new THREE.Mesh(new THREE.ConeGeometry(150, 130, 8), new THREE.MeshStandardMaterial({ color: 0x5a6a52, roughness: 1 }));
  mountain.position.set(60, 30, -480); scene.add(mountain);
  const snow = new THREE.Mesh(new THREE.ConeGeometry(42, 36, 8), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.9 }));
  snow.position.set(60, 95, -480); scene.add(snow);
  // Marina yachts
  for (let i = 0; i < 5; i++) {
    const y = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.5 }));
    hull.position.y = 0.4; y.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), new THREE.MeshStandardMaterial({ color: 0x8a8a86 }));
    mast.position.y = 5; y.add(mast);
    y.position.set(150 + i * 22, 0, 320 + (i % 2) * 24);
    y.rotation.y = rand(-0.3, 0.3);
    scene.add(y);
  }
  // Shipping containers (Zona Franca)
  const contCols = [0xc25a2a, 0x2a6ac2, 0x4a9a3a, 0xd8a83a];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 2.6, 2.6), new THREE.MeshStandardMaterial({ color: pick(contCols), roughness: 0.8 }));
    c.position.set(rand(-40, 100), 1.3 + (i % 3) * 0, rand(-40, 100));
    c.rotation.y = (i % 2) * Math.PI / 2;
    c.castShadow = true; scene.add(c);
    colliders.push({ x0: c.position.x - 6, z0: c.position.z - 1.3, x1: c.position.x + 6, z1: c.position.z + 1.3 });
  }

  // streetlights at intersections (emissive heads, toggled by time in main.js)
  const lampHeads = [];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 });
  for (const it of intersections) {
    if ((it.x + it.z) % 120 !== 0) continue;
    if (it.z >= 240) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
    pole.position.set(it.x + 7, 3.5, it.z + 7); scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd860, emissiveIntensity: 0 }));
    head.position.set(it.x + 7, 7.2, it.z + 7); scene.add(head);
    lampHeads.push(head);
  }

  // clouds
  const clouds = [];
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.BoxGeometry(rand(14, 26), rand(3, 5), rand(8, 14)), cloudMat);
      puff.position.set(j * 10 - 10, rand(-1, 1), rand(-3, 3));
      cl.add(puff);
    }
    cl.position.set(rand(-300, 300), rand(90, 130), rand(-300, 300));
    scene.add(cl);
    clouds.push(cl);
  }

  // lights
  const sun = new THREE.DirectionalLight(0xffe0b0, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0x9ab8e8, 0x3a3a34, 0.9);
  scene.add(hemi);

  return { colliders, intersections, sun, hemi, ocean, oceanTex, clouds, lampHeads };
}

// Circle (player/car) vs building AABB push-out. Returns corrected {x,z} or null when free.
export function collideCircle(colliders, x, z, r) {
  let nx = x, nz = z;
  for (const c of colliders) {
    const cx = clamp(x, c.x0, c.x1), cz = clamp(z, c.z0, c.z1);
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r; nz = cz + (dz / d) * r;
      } else {
        // inside: push out along the smallest penetration axis
        const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) nx = c.x0 - r; else if (m === pr) nx = c.x1 + r; else if (m === pt) nz = c.z0 - r; else nz = c.z1 + r;
      }
      x = nx; z = nz;
    }
  }
  return { x: nx, z: nz };
}
