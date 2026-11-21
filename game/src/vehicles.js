// Every vehicle mesh: player cars, traffic cars, police cruisers and the police
// helicopter. All low-poly boxes, cylinders and emissive lights — no loaded assets.
import * as THREE from 'three';
import { mulberry32, pick, range } from './random.js';

export const CAR_COLORS = [0xe63946, 0xf4d35e, 0x2a9d8f, 0x4361ee, 0xff8c42, 0x9b5de5, 0x06d6a0, 0xef476f, 0x118ab2, 0xf8f9fa, 0x212529, 0xadb5bd];
export const SPORTS_COLORS = [0xff2e63, 0xffd60a, 0x00f5d4, 0xff6b35];

function box(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.35,
    metalness: opts.metalness ?? 0.55,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// A drivable car. kind: 'traffic' | 'player' | 'police' | 'sports'.
export function makeCar(color, kind = 'traffic') {
  const group = new THREE.Group();
  const isPolice = kind === 'police';
  const isSports = kind === 'sports';
  const bodyColor = isPolice ? 0xf8f9fa : color;
  const bodyLen = isSports ? 4.6 : 4.2;
  const bodyW = 1.9;

  const body = box(bodyW, 0.62, bodyLen, bodyColor);
  body.position.y = 0.55;
  group.add(body);

  const cabin = box(bodyW * 0.82, 0.55, bodyLen * 0.48, isPolice ? 0x212529 : 0x1b1e2e, { roughness: 0.15, metalness: 0.7 });
  cabin.position.set(0, 1.1, isSports ? -0.15 : -0.25);
  group.add(cabin);

  // Spoiler for sports cars, bumpers for everyone.
  if (isSports) {
    const spoiler = box(1.7, 0.08, 0.3, 0x111111, { roughness: 0.4, metalness: 0.6 });
    spoiler.position.set(0, 1.05, bodyLen / 2 - 0.15);
    group.add(spoiler);
    const strutL = box(0.08, 0.3, 0.08, 0x111111);
    strutL.position.set(-0.6, 0.9, bodyLen / 2 - 0.15);
    group.add(strutL);
    const strutR = strutL.clone();
    strutR.position.x = 0.6;
    group.add(strutR);
  }
  const bumperF = box(bodyW, 0.22, 0.25, 0x222222, { roughness: 0.6, metalness: 0.3 });
  bumperF.position.set(0, 0.4, bodyLen / 2);
  group.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -bodyLen / 2;
  group.add(bumperR);

  // Headlights (warm) and taillights (red).
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6c9, emissive: 0xffe9a8, emissiveIntensity: 2.4 });
  for (const s of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), headMat);
    head.position.set(s * 0.62, 0.62, bodyLen / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff2222, emissiveIntensity: 1.8 }),
    );
    tail.position.set(s * 0.62, 0.62, -bodyLen / 2 - 0.02);
    group.add(tail);
  }

  // Police livery: black doors band + flashing light bar.
  let lightBarL = null;
  let lightBarR = null;
  if (isPolice) {
    const band = box(bodyW + 0.02, 0.3, bodyLen * 0.55, 0x212529, { roughness: 0.5, metalness: 0.4 });
    band.position.set(0, 0.62, -0.1);
    group.add(band);
    lightBarL = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 }),
    );
    lightBarL.position.set(-0.3, 1.48, -0.25);
    group.add(lightBarL);
    lightBarR = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.16, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x0044ff, emissive: 0x0044ff, emissiveIntensity: 3 }),
    );
    lightBarR.position.set(0.3, 1.48, -0.25);
    group.add(lightBarR);
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.3, metalness: 0.8 });
  const wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(wx, 0.36, wz);
    group.add(hub);
    wheels.push(wheel);
  }

  return { group, wheels, lightBarL, lightBarR, kind, bodyLen };
}

// The police helicopter — deliberately BIG (about twice a car) with a bright
// searchlight cone, so the chase shot reads at contact-sheet size.
export function makeHelicopter() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b2a4a, roughness: 0.4, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 6.4), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 1.6, 2.0),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.8 }),
  );
  nose.position.set(0, -0.1, 3.6);
  group.add(nose);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 7.5), bodyMat);
  tail.position.set(0, 0.5, -6.2);
  tail.castShadow = true;
  group.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 1.6), bodyMat);
  fin.position.set(0, 1.4, -9.6);
  group.add(fin);
  // White POLICE stripe along the body.
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 0.7, 6.0),
    new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.5 }),
  );
  stripe.position.set(0, 0.1, 0);
  group.add(stripe);
  // Skids.
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 5.2),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6, metalness: 0.5 }));
    skid.position.set(s * 1.4, -1.5, 0.4);
    group.add(skid);
  }
  // Main rotor (spins) + tail rotor.
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.4 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(15, 0.12, 0.7), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  rotor.position.y = 1.6;
  group.add(rotor);
  const tailRotor = new THREE.Group();
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.3), bladeMat);
    blade.rotation.x = a;
    tailRotor.add(blade);
  }
  tailRotor.position.set(-0.6, 1.4, -9.6);
  group.add(tailRotor);

  // Searchlight: a real spotlight plus a visible bright cone so it reads in a still.
  const spot = new THREE.SpotLight(0xfff2c0, 9000, 160, 0.42, 0.45, 1.1);
  spot.position.set(0, -1.2, 1.5);
  group.add(spot);
  group.add(spot.target);
  spot.target.position.set(0, -60, 0);
  const coneGeo = new THREE.ConeGeometry(7.5, 42, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff6c9, transparent: true, opacity: 0.34, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  // Apex up at the helicopter, wide end down toward the street (ConeGeometry's
  // apex is at +y, so no rotation is needed).
  cone.position.set(0, -22, 1.5);
  group.add(cone);
  // Red beacon.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 }),
  );
  beacon.position.set(0, 1.5, -2);
  group.add(beacon);

  return { group, rotor, tailRotor, spot, cone, beacon };
}

// Spawn a parked or cruising traffic car at a road position.
export function spawnTrafficCar(scene, rng, x, z, heading) {
  const { group, wheels } = makeCar(pick(rng, CAR_COLORS), 'traffic');
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    mesh: group, wheels, kind: 'traffic',
    pos: group.position, heading, speed: range(rng, 6, 11),
    cruiseSpeed: range(rng, 7, 12), color: 0xffffff,
    route: null, routeIndex: 0, stopped: false, driver: null,
  };
}

// A rectangular loop route around one city block, for traffic to follow.
export function blockLoopRoute(cx, cz, half) {
  return [
    { x: cx - half, z: cz - half }, { x: cx + half, z: cz - half },
    { x: cx + half, z: cz + half }, { x: cx - half, z: cz + half },
  ];
}
