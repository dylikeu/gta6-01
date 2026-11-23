// effects.js — the juice: dust kicked up behind the wheels, sparks off a
// wall, smoke and fire from a wreck, and the floating cash that marks a
// payday. Small pooled meshes, no textures, nothing to load.
import * as THREE from 'three';

/** One particle: a fading, rising, shrinking little mesh. */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.pool = [];
    this.geo = new THREE.SphereGeometry(0.22, 6, 5);
  }

  spawn(x, y, z, color, count, speed, life, size = 1, up = 1) {
    for (let i = 0; i < count; i += 1) {
      let mesh = this.pool.pop();
      if (!mesh) {
        mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
        mesh.castShadow = false;
      }
      mesh.material.color.setHex(color);
      mesh.material.opacity = 0.85;
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + Math.random() * 0.3, z + (Math.random() - 0.5) * 0.6);
      mesh.scale.setScalar(size * (0.7 + Math.random() * 0.6));
      mesh.visible = true;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * speed,
        vy: Math.random() * speed * up,
        vz: (Math.random() - 0.5) * speed,
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        grow: 1 + Math.random() * 2,
      });
    }
  }

  dust(x, z, amount) {
    if (amount <= 0.05) return;
    this.spawn(x, 0.3, z, 0xd8c49a, Math.ceil(amount * 3), 2.2, 0.9, 1.4, 0.6);
  }

  sparks(x, y, z) {
    this.spawn(x, y, z, 0xffc46b, 10, 7, 0.5, 0.5, 1.2);
    this.spawn(x, y, z, 0xffffff, 4, 9, 0.3, 0.35, 1.2);
  }

  smoke(x, y, z) {
    this.spawn(x, y, z, 0x3a3a3a, 6, 1.4, 1.8, 2.2, 1.6);
  }

  explosion(x, y, z) {
    this.spawn(x, y, z, 0xff7a3d, 22, 10, 0.8, 1.8, 1.4);
    this.spawn(x, y, z, 0x2a2a2a, 12, 4, 1.6, 2.6, 1.8);
  }

  /** A floating cash pickup: a spinning green bill that bobs in the air. */
  cashPickup(x, z, amount) {
    const group = new THREE.Group();
    const bill = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.06, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x2fae5f, emissive: 0x1d7a3d, emissiveIntensity: 0.7 }),
    );
    group.add(bill);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9, 0.05, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0x7dff9e, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    group.position.set(x, 1.4, z);
    this.scene.add(group);
    return { group, amount, spin: 0, taken: false };
  }

  update(dt, time) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.scene.remove(p.mesh);
        this.pool.push(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= dt * 0.4;
      const t = p.life / p.maxLife;
      p.mesh.material.opacity = 0.85 * t;
      p.mesh.scale.multiplyScalar(1 + p.grow * dt);
    }
  }
}

/** Spin and bob the cash pickups; collect the ones Dante touches. */
export function updateCashPickups(pickups, scene, playerX, playerZ, onCollect) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    if (pickup.taken) continue;
    pickup.spin += 0.06;
    pickup.group.rotation.y = pickup.spin;
    pickup.group.position.y = 1.4 + Math.sin(pickup.spin * 0.7) * 0.25;
    const dx = pickup.group.position.x - playerX;
    const dz = pickup.group.position.z - playerZ;
    if (dx * dx + dz * dz < 4.5) {
      pickup.taken = true;
      scene.remove(pickup.group);
      pickups.splice(i, 1);
      if (onCollect) onCollect(pickup.amount);
    }
  }
}
