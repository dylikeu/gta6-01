// People of Coral Bay: Dante Cruz (the player) and the pedestrians who fill the
// sidewalks. All low-poly box people with swinging limbs and varied outfits.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { pick, range } from './random.js';

const SHIRTS = [0xff6b6b, 0xf7b801, 0x4cc9f0, 0x80ed99, 0xc77dff, 0xffffff, 0xef8354, 0x90be6d];
const PANTS = [0x2b2d42, 0x3d405b, 0x5c677d, 0x6c584c, 0x212529];
const SKINS = [0xc68e5f, 0x8d5524, 0xffdbac, 0xf1c27d, 0xe0ac69];
const HAIRS = [0x1d1a16, 0x3b2f2f, 0x6c584c, 0x8a6d3b, 0xcccccc];

function limb(w, h, d, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  mesh.castShadow = true;
  return mesh;
}

// A humanoid figure. Returns { group, parts: { legL, legR, armL, armR, head, torso } }.
// The limbs pivot at the shoulder/hip so walk animation is one sin() each.
export function makePerson({ jacket, pants, skin, hair, scale = 1 } = {}) {
  const group = new THREE.Group();
  const parts = {};

  const legL = limb(0.22, 0.8, 0.24, pants);
  legL.geometry.translate(0, -0.4, 0);
  legL.position.set(-0.14, 0.82, 0);
  group.add(legL);
  const legR = limb(0.22, 0.8, 0.24, pants);
  legR.geometry.translate(0, -0.4, 0);
  legR.position.set(0.14, 0.82, 0);
  group.add(legR);

  const torso = limb(0.62, 0.72, 0.34, jacket);
  torso.position.y = 1.18;
  group.add(torso);

  const armL = limb(0.18, 0.68, 0.2, jacket);
  armL.geometry.translate(0, -0.34, 0);
  armL.position.set(-0.42, 1.5, 0);
  group.add(armL);
  const armR = limb(0.18, 0.68, 0.2, jacket);
  armR.geometry.translate(0, -0.34, 0);
  armR.position.set(0.42, 1.5, 0);
  group.add(armR);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.36, 0.32),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }),
  );
  head.position.y = 1.74;
  head.castShadow = true;
  group.add(head);
  const hairMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.16, 0.36),
    new THREE.MeshStandardMaterial({ color: hair, roughness: 1 }),
  );
  hairMesh.position.y = 1.94;
  group.add(hairMesh);

  // Shoes.
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  for (const s of [-1, 1]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.36), shoeMat);
    shoe.position.set(s * 0.14, 0.05, 0.05);
    group.add(shoe);
  }

  parts.legL = legL;
  parts.legR = legR;
  parts.armL = armL;
  parts.armR = armR;
  parts.head = head;
  parts.torso = torso;
  group.scale.setScalar(scale);
  return { group, parts };
}

// Dante Cruz: teal jacket, dark jeans, short dark hair, gold chain.
export function makeDante() {
  const person = makePerson({
    jacket: PALETTE.danteJacket, pants: PALETTE.dantePants,
    skin: PALETTE.danteSkin, hair: PALETTE.danteHair,
  });
  const chain = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.06, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xffd60a, metalness: 0.9, roughness: 0.25, emissive: 0x664400, emissiveIntensity: 0.4 }),
  );
  chain.position.set(0, 1.5, 0.19);
  person.group.add(chain);
  // Pistol in the right hand (visible when armed).
  const gun = new THREE.Group();
  const barrel = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 }),
  );
  gun.add(barrel);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.2, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.7 }),
  );
  grip.position.set(0, -0.1, -0.12);
  gun.add(grip);
  gun.position.set(0.42, 1.12, 0.15);
  gun.visible = false;
  person.group.add(gun);
  person.gun = gun;
  return person;
}

export function makePedestrian(rng) {
  const person = makePerson({
    jacket: pick(rng, SHIRTS), pants: pick(rng, PANTS),
    skin: pick(rng, SKINS), hair: pick(rng, HAIRS),
    scale: range(rng, 0.92, 1.06),
  });
  return person;
}

// Swing limbs for a walk cycle; phase advances with distance travelled.
export function animateWalk(parts, phase, amount) {
  const s = Math.sin(phase) * amount;
  parts.legL.rotation.x = s;
  parts.legR.rotation.x = -s;
  parts.armL.rotation.x = -s * 0.8;
  parts.armR.rotation.x = s * 0.8;
}

export function animateIdle(parts, time) {
  const breathe = Math.sin(time * 2) * 0.03;
  parts.armL.rotation.x = breathe;
  parts.armR.rotation.x = -breathe;
  parts.legL.rotation.x = 0;
  parts.legR.rotation.x = 0;
}
