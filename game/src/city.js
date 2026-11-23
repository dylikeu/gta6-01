// SOLARA round 6 — re-witnessed 23 Nov 2026.
// Role: Coral Bay's world — sky, sea, roads, buildings, palms, collisions.
// buildCity — Coral Bay itself: the sunset sky, the sea and beach, the road
// grid, the low-poly coloured buildings, the palms on Ocean Drive, the pier,
// street lights and every collision box the cars and the player bump into.
import * as THREE from 'three';
import { AVENUES, PALETTE, SEA_LINE, SAND_LINE, STREETS, WORLD_HALF, mulberry32, pick } from './config.js';

/** A canvas texture of lit windows, tinted per building by its material. */
function makeWindowTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 20) {
      const lit = rng() < 0.55;
      ctx.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : '#2a2f45';
      ctx.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A canvas texture for the sea: soft moving wave bands. */
function makeSeaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2fa8b8');
  grad.addColorStop(1, '#0e4d63');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i += 1) {
    const y = i * 10 + 4;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.09 + i) * 3);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The sunset sky dome: a big sphere with a vertical gradient shader. */
function makeSkyDome() {
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.sunsetTop) },
      mid: { value: new THREE.Color(PALETTE.sunsetMid) },
      low: { value: new THREE.Color(PALETTE.sunsetLow) },
    },
    vertexShader: 'varying vec3 vPos; void main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){ float h = normalize(vPos).y; vec3 c = h > 0.18 ? mix(mid, top, smoothstep(0.18, 0.65, h)) : mix(low, mid, smoothstep(-0.08, 0.18, h)); gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(geo, mat);
}

/** One palm tree: a leaning trunk and a crown of flat leaves. */
function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 7, 6), trunkMat);
  trunk.position.y = 3.5;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 7; i += 1) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.1, 7.1, Math.sin(a) * 1.1);
    leaf.rotation.z = Math.cos(a) * 1.15;
    leaf.rotation.x = -Math.sin(a) * 1.15;
    leaf.castShadow = true;
    group.add(leaf);
  }
  const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshStandardMaterial({ color: 0x7a4a21, roughness: 1 }));
  nuts.position.y = 6.7;
  group.add(nuts);
  return group;
}

/** One street light: a pole, an arm and a glowing bulb. */
function makeStreetLight() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6, 6), poleMat);
  pole.position.y = 3;
  pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
  arm.position.set(0.8, 5.9, 0);
  group.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc46b, emissiveIntensity: 2.2 }),
  );
  bulb.position.set(1.55, 5.85, 0);
  group.add(bulb);
  return group;
}

/**
 * Build the whole city into `scene` and return its collision boxes, the
 * road lines traffic drives on, and the named places missions point at.
 */
export function buildCity(scene, seed = 20261123) {
  const rng = mulberry32(seed);
  const colliders = [];
  const windowTex = makeWindowTexture(rng);

  // Sunset lighting: a low orange sun, a warm sky fill and a purple bounce.
  const sun = new THREE.DirectionalLight(0xffb066, 2.6);
  sun.position.set(-140, 90, -320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff9a5c, 0x3a2a55, 1.1));
  const bounce = new THREE.DirectionalLight(0x7a5cff, 0.35);
  bounce.position.set(200, 120, 200);
  scene.add(bounce);
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 620);

  scene.add(makeSkyDome());

  // The sun itself: a glowing disc low over the sea, due west of the beach.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sunDisc.position.set(-60, 42, -700);
  sunDisc.lookAt(0, 42, 0);
  scene.add(sunDisc);
  const sunGlow = new THREE.Mesh(
    new THREE.CircleGeometry(58, 40),
    new THREE.MeshBasicMaterial({ color: 0xff8a3d, transparent: true, opacity: 0.35, fog: false }),
  );
  sunGlow.position.set(-60, 42, -705);
  sunGlow.lookAt(0, 42, 0);
  scene.add(sunGlow);

  // Ground: city grass/concrete, then the sand strip, then the sea.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_HALF * 2 + 80, 1, WORLD_HALF * 2 + 80),
    new THREE.MeshStandardMaterial({ color: 0x6f7d5a, roughness: 1 }),
  );
  ground.position.set(0, -0.55, 40);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.BoxGeometry(WORLD_HALF * 2 + 80, 0.6, SEA_LINE * -1 + SAND_LINE * -1 + 40),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.position.set(0, -0.35, (SEA_LINE + SAND_LINE) / 2 - 6);
  sand.receiveShadow = true;
  scene.add(sand);

  const seaTex = makeSeaTexture();
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: seaTex, roughness: 0.35, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, SEA_LINE - 250);
  scene.add(sea);

  // Roads: dark asphalt strips with a dashed centre line.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xf5d76e, roughness: 0.8 });
  function roadStrip(x, z, w, d) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), roadMat);
    r.position.set(x, 0.02, z);
    r.receiveShadow = true;
    scene.add(r);
    const s = new THREE.Mesh(new THREE.BoxGeometry(w + 6, 0.1, d + 6), walkMat);
    s.position.set(x, -0.01, z);
    s.receiveShadow = true;
    scene.add(s);
  }
  for (const z of AVENUES) {
    roadStrip(0, z, WORLD_HALF * 2, 10);
    for (let x = -WORLD_HALF + 8; x < WORLD_HALF; x += 16) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(5, 0.05, 0.35), lineMat);
      dash.position.set(x, 0.1, z);
      scene.add(dash);
    }
  }
  for (const x of STREETS) {
    roadStrip(x, 0, 10, WORLD_HALF * 2);
    for (let z = -WORLD_HALF + 8; z < WORLD_HALF; z += 16) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 5), lineMat);
      dash.position.set(x, 0.1, z);
      scene.add(dash);
    }
  }

  // Buildings: one to four per block, coloured, with lit windows and a roof lip.
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 1 });
  const blocks = [];
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      blocks.push({
        x0: STREETS[si] + 9,
        x1: STREETS[si + 1] - 9,
        z0: AVENUES[ai] + 9,
        z1: AVENUES[ai + 1] - 9,
      });
    }
  }
  for (const block of blocks) {
    if (block.z1 < SAND_LINE + 4) continue; // the beach stays open
    const count = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < count; i += 1) {
      const w = 12 + rng() * 16;
      const d = 10 + rng() * 12;
      const h = 7 + rng() * rng() * 38;
      const x = block.x0 + w / 2 + rng() * Math.max(1, block.x1 - block.x0 - w);
      const z = block.z0 + d / 2 + rng() * Math.max(1, block.z1 - block.z0 - d);
      // Plaza Coral stays open: no building may cover the fountain square.
      if (Math.hypot(x - 22, z - 52) < 18) continue;
      const color = pick(rng, PALETTE.building);
      const mat = new THREE.MeshStandardMaterial({ color, map: windowTex, roughness: 0.85 });
      const b = new THREE.Mesh(buildingGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(x, h / 2, z);
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.7, d + 1), roofMat);
      roof.position.set(x, h + 0.3, z);
      roof.castShadow = true;
      scene.add(roof);
      // A rooftop water tank or antenna on the tall ones.
      if (h > 24) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 8), new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 1 }));
        tank.position.set(x + w / 4, h + 1.8, z);
        tank.castShadow = true;
        scene.add(tank);
      }
      colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    }
  }

  // Palms along Ocean Drive and the promenade.
  for (let x = -WORLD_HALF + 6; x <= WORLD_HALF - 6; x += 13) {
    if (rng() < 0.85) {
      const palm = makePalm(rng);
      palm.position.set(x + (rng() - 0.5) * 3, 0, -152 + (rng() - 0.5) * 4);
      scene.add(palm);
    }
    if (rng() < 0.5) {
      const palm = makePalm(rng);
      palm.position.set(x, 0, -128 + (rng() - 0.5) * 3);
      scene.add(palm);
    }
  }
  for (let i = 0; i < 26; i += 1) {
    const palm = makePalm(rng);
    palm.position.set(-WORLD_HALF + 10 + rng() * (WORLD_HALF * 2 - 20), 0, -30 + rng() * 220);
    if (Math.abs(palm.position.x % 55) < 9) continue;
    scene.add(palm);
  }

  // Street lights along every avenue, both sides.
  for (const z of AVENUES) {
    for (let x = -WORLD_HALF + 15; x < WORLD_HALF; x += 55) {
      const light = makeStreetLight();
      light.position.set(x, 0, z - 7.5);
      scene.add(light);
      const light2 = makeStreetLight();
      light2.position.set(x + 27, 0, z + 7.5);
      light2.rotation.y = Math.PI;
      scene.add(light2);
    }
  }

  // The pier: wooden planks out over the sea, with lamps and a bait shack.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 });
  for (let z = SEA_LINE + 4; z > -215; z -= 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 3.6), pierMat);
    plank.position.set(0, 0.6, z);
    plank.castShadow = true;
    scene.add(plank);
  }
  for (let z = -176; z > -212; z -= 18) {
    const lamp = makeStreetLight();
    lamp.position.set(4.4, 0.6, z);
    scene.add(lamp);
  }
  const shack = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 6), new THREE.MeshStandardMaterial({ color: 0x5a8a9a, roughness: 1 }));
  shack.position.set(0, 2.6, -206);
  shack.castShadow = true;
  scene.add(shack);
  colliders.push({ x0: -3.5, x1: 3.5, z0: -209, z1: -203 });

  // Landmark props: a coral-coloured fountain in the plaza, benches, hydrants.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 1.2, 12), new THREE.MeshStandardMaterial({ color: 0x7fd4c1, roughness: 0.4 }));
  fountain.position.set(22, 0.6, 52);
  fountain.castShadow = true;
  scene.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.4, 12), new THREE.MeshStandardMaterial({ color: 0x2fa8b8, roughness: 0.2 }));
  water.position.set(22, 1.2, 52);
  scene.add(water);

  return {
    colliders,
    seaTexture: seaTex,
    sunDisc,
    places: {
      garage: { x: -88, z: -58, label: "Marisol's Garage" },
      pier: { x: 0, z: -196, label: 'Coral Pier' },
      hotel: { x: 128, z: -58, label: 'Hotel Miramar' },
      beachBar: { x: -140, z: -152, label: 'The Salty Palm Bar' },
      bank: { x: -32, z: 52, label: 'Coral Bay Bank' },
      safehouse: { x: 78, z: 108, label: 'Safehouse' },
      harbor: { x: 188, z: -108, label: 'Coral Harbor' },
      mansion: { x: -192, z: 208, label: 'Vega Mansion' },
      marina: { x: 150, z: -152, label: 'Marina' },
      plaza: { x: 22, z: 52, label: 'Plaza Coral' },
    },
  };
}

/** Is a point clear of every building box, with `margin` to spare? */
export function isClearSpot(colliders, x, z, margin) {
  for (const c of colliders) {
    if (x > c.x0 - margin && x < c.x1 + margin && z > c.z0 - margin && z < c.z1 + margin) return false;
  }
  return true;
}

/**
 * The nearest clear spot to (x, z): the point itself when it is clear,
 * otherwise the first clear ring around it, so spawns, parked cars and
 * mission markers never sit inside a building.
 */
export function findClearSpot(colliders, x, z, margin = 2) {
  if (isClearSpot(colliders, x, z, margin)) return { x, z };
  for (let r = 4; r <= 44; r += 4) {
    for (let a = 0; a < 8; a += 1) {
      const ang = (a / 8) * Math.PI * 2;
      const nx = x + Math.cos(ang) * r;
      const nz = z + Math.sin(ang) * r;
      if (isClearSpot(colliders, nx, nz, margin)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

/** Push a circle (player or car) out of every building box it overlaps. */
export function resolveCollisions(pos, radius, colliders) {
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * radius;
      pos.z = cz + (dz / d) * radius;
      continue;
    }
    // Deep inside the box: push out through the nearest face instead of
    // teleporting, so a fast car never jumps to the far side of a building.
    const toLeft = pos.x - c.x0 + radius;
    const toRight = c.x1 - pos.x + radius;
    const toTop = pos.z - c.z0 + radius;
    const toBottom = c.z1 - pos.z + radius;
    const min = Math.min(toLeft, toRight, toTop, toBottom);
    if (min === toLeft) pos.x = c.x0 - radius;
    else if (min === toRight) pos.x = c.x1 + radius;
    else if (min === toTop) pos.z = c.z0 - radius;
    else pos.z = c.z1 + radius;
  }
  pos.x = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, pos.x));
  pos.z = Math.max(-WORLD_HALF, Math.min(WORLD_HALF, pos.z));
}
