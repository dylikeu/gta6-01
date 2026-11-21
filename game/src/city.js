// Coral Bay itself: the road grid, beach and ocean, low-poly coloured buildings with
// lit windows, palms, street lamps and props. Builds once from the seeded rng.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { mulberry32, pick, range, rangeInt } from './random.js';

// One shared lit-window texture, tinted per building by its material colour.
export function makeWindowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  const rng = mulberry32(77);
  for (let y = 10; y < 246; y += 18) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng() < 0.45;
      ctx.fillStyle = lit ? (rng() < 0.7 ? '#ffd27a' : '#9fd8ff') : '#2c2f45';
      ctx.fillRect(x, y, 11, 13);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm(rng) {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmTrunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: PALETTE.palmLeaf, roughness: 0.9, side: THREE.DoubleSide });
  const height = range(rng, 6, 9);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, height, 7), trunkMat);
  trunk.position.y = height / 2;
  trunk.rotation.z = range(rng, -0.08, 0.08);
  trunk.castShadow = true;
  group.add(trunk);
  const fronds = 7;
  for (let i = 0; i < fronds; i += 1) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.4, 4), leafMat);
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.4;
    frond.position.set(Math.cos(a) * 1.3, height + 0.35, Math.sin(a) * 1.3);
    frond.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9);
    frond.scale.set(1, 1, 0.28);
    frond.castShadow = true;
    group.add(frond);
  }
  const nuts = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 1 }),
  );
  nuts.position.y = height + 0.1;
  group.add(nuts);
  return group;
}

function makeLamp() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2f3542, roughness: 0.6, metalness: 0.5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 6), poleMat);
  pole.position.y = 3.2;
  pole.castShadow = true;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), poleMat);
  arm.position.set(0.7, 6.3, 0);
  group.add(arm);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc46b, emissiveIntensity: 1.6 }),
  );
  bulb.position.set(1.4, 6.2, 0);
  group.add(bulb);
  // No real PointLight per lamp: 28 of them would drown a software renderer.
  // The emissive bulb reads as lit at dusk without the light cost.
  return group;
}

export function createCity(scene, state) {
  const rng = mulberry32(state.seed);
  const windowTex = makeWindowTexture();
  const { halfSize, block, road, beachX, waterX, oceanX } = CITY;

  // --- Ground: grass-green city base, sand strip, ocean plane.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(halfSize * 2 + 60, halfSize * 2 + 60),
    new THREE.MeshStandardMaterial({ color: 0x6f8f5a, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(40, halfSize * 2 + 120),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(beachX - 12, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const wetSand = new THREE.Mesh(
    new THREE.PlaneGeometry(10, halfSize * 2 + 120),
    new THREE.MeshStandardMaterial({ color: PALETTE.sandWet, roughness: 0.7 }),
  );
  wetSand.rotation.x = -Math.PI / 2;
  wetSand.position.set(waterX + 3, 0.03, 0);
  wetSand.receiveShadow = true;
  scene.add(wetSand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(oceanX * -1 + waterX, halfSize * 2 + 400),
    new THREE.MeshStandardMaterial({ color: PALETTE.ocean, roughness: 0.25, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set((oceanX + waterX) / 2, 0.0, 0);
  ocean.receiveShadow = true;
  scene.add(ocean);

  // --- Roads: asphalt strips on the grid lines, with dashed centre lines.
  const roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphalt, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: PALETTE.asphaltLine, roughness: 0.8 });
  const sideMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const roadLines = [];
  for (let c = -halfSize; c <= halfSize; c += block + road) {
    roadLines.push(c);
  }
  const span = halfSize * 2 + 24;
  for (const c of roadLines) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(span, road), roadMat);
      strip.rotation.x = -Math.PI / 2;
      strip.rotation.z = horizontal ? 0 : Math.PI / 2;
      strip.position.set(horizontal ? 0 : c, 0.06, horizontal ? c : 0);
      strip.receiveShadow = true;
      scene.add(strip);
      const sideA = new THREE.Mesh(new THREE.PlaneGeometry(span, 2.4), sideMat);
      sideA.rotation.x = -Math.PI / 2;
      sideA.rotation.z = horizontal ? 0 : Math.PI / 2;
      sideA.position.set(horizontal ? 0 : c + road / 2 + 1.2, 0.07, horizontal ? c + road / 2 + 1.2 : 0);
      sideA.receiveShadow = true;
      scene.add(sideA);
      const sideB = sideA.clone();
      if (horizontal) sideB.position.z = c - road / 2 - 1.2;
      else sideB.position.x = c - road / 2 - 1.2;
      scene.add(sideB);
      // Centre dashes.
      const dashCount = Math.floor(span / 8);
      for (let i = 0; i < dashCount; i += 1) {
        const d = -span / 2 + 4 + i * 8;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.rotation.z = horizontal ? 0 : Math.PI / 2;
        dash.position.set(horizontal ? d : c, 0.08, horizontal ? c : d);
        scene.add(dash);
      }
    }
  }

  // --- Buildings: one or two per block, pastel colours, lit windows, rooftop props.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3d3a4d, roughness: 1 });
  const acMat = new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 0.9 });
  const neonColors = [0xff2e63, 0x08d9d6, 0xf9ed69, 0xff8c42, 0x00f5d4];
  let buildingCount = 0;
  for (let bx = -halfSize + road; bx < halfSize - block; bx += block + road) {
    for (let bz = -halfSize + road; bz < halfSize - block; bz += block + road) {
      if (rng() < 0.12) continue; // empty lot / parking
      const w = range(rng, 14, 26);
      const d = range(rng, 14, 26);
      const h = range(rng, 9, 34) * (Math.abs(bx) < 60 && Math.abs(bz) < 60 ? 1.5 : 1);
      const cx = bx + block / 2 + range(rng, -3, 3);
      const cz = bz + block / 2 + range(rng, -3, 3);
      const color = pick(rng, PALETTE.building);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, map: windowTex });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(cx, h / 2, cz);
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
      roof.position.set(cx, h + 0.25, cz);
      scene.add(roof);
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 2.2), acMat);
      ac.position.set(cx + w / 4, h + 1, cz - d / 4);
      scene.add(ac);
      // Neon sign on some tall buildings — Coral Bay at dusk.
      if (h > 20 && rng() < 0.5) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 2.2, 6),
          new THREE.MeshStandardMaterial({ color: 0x111111, emissive: pick(rng, neonColors), emissiveIntensity: 2.2 }),
        );
        neon.position.set(cx + w / 2 + 0.2, h * 0.7, cz);
        scene.add(neon);
      }
      state.colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      buildingCount += 1;
    }
  }

  // --- Beachfront palms + lamps along the coast road, and lamps at intersections.
  for (let z = -halfSize; z <= halfSize; z += 18) {
    const palm = makePalm(rng);
    palm.position.set(beachX - 6 + range(rng, -2, 2), 0, z + range(rng, -3, 3));
    scene.add(palm);
    if (rng() < 0.5) {
      const palm2 = makePalm(rng);
      palm2.position.set(beachX + 22 + range(rng, -2, 2), 0, z + 8);
      scene.add(palm2);
    }
  }
  for (const c of roadLines) {
    for (const d of [-120, -40, 40, 120]) {
      const lamp = makeLamp();
      lamp.position.set(c + road / 2 + 1.6, 0, d);
      scene.add(lamp);
    }
  }

  // --- Props: beach umbrellas, crates near the docks, benches, a pier.
  const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xff5d8f, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i += 1) {
    const x = beachX - 8 - rng() * 14;
    const z = range(rng, -150, 150);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    pole.position.set(x, 1.2, z);
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 0.9, 8), umbrellaMat);
    top.position.set(x, 2.7, z);
    top.castShadow = true;
    scene.add(top);
  }
  // Pier jutting into the ocean (mission 1 meeting spot).
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x8a6d4b, roughness: 1 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 0.8, 8), pierMat);
  pier.position.set(waterX - 14, 0.6, 30);
  pier.castShadow = true;
  pier.receiveShadow = true;
  scene.add(pier);
  for (let i = 0; i < 6; i += 1) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), pierMat);
    post.position.set(waterX + 8 - i * 10, -0.4, 26);
    scene.add(post);
    const post2 = post.clone();
    post2.position.z = 34;
    scene.add(post2);
  }

  return { buildingCount, windowTex };
}

// Circle (x,z,r) vs building AABB push-out; returns corrected position.
export function collideCircle(state, x, z, r) {
  let px = x;
  let pz = z;
  for (const c of state.colliders) {
    const nx = Math.max(c.minX, Math.min(px, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pz, c.maxZ));
    const dx = px - nx;
    const dz = pz - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * r;
        pz = nz + (dz / d) * r;
      } else {
        // Inside the box: push out along the smallest penetration axis.
        const pushL = px - c.minX;
        const pushR = c.maxX - px;
        const pushT = pz - c.minZ;
        const pushB = c.maxZ - pz;
        const m = Math.min(pushL, pushR, pushT, pushB);
        if (m === pushL) px = c.minX - r;
        else if (m === pushR) px = c.maxX + r;
        else if (m === pushT) pz = c.minZ - r;
        else pz = c.maxZ + r;
      }
    }
  }
  return { x: px, z: pz };
}

export function clampToWorld(x, z) {
  const m = CITY.maxCoord;
  return {
    x: Math.max(CITY.wallX, Math.min(m, x)),
    z: Math.max(-m, Math.min(m, z)),
  };
}
