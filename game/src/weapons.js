// weapons.js — Dante's pistol: the raycast shot, the muzzle flash and the
// tracer, the ammo and the reload, and the street robbery that pays in cash
// and costs in wanted stars.
import * as THREE from 'three';
import { clamp, dist2d } from './config.js';

export const PISTOL = { damage: 34, range: 60, magSize: 12, reloadSeconds: 1.6, fireDelay: 0.22 };

/** The pistol state: ammo in the mag, the reload timer, the shot cooldown. */
export function createPistol() {
  return { ammo: PISTOL.magSize, reloading: 0, cooldown: 0, shotsFired: 0 };
}

/**
 * Fire one shot from `origin` along `direction`. Raycasts against the
 * supplied targets (peds, police cars, gangsters, the helicopter) and calls
 * `onHit(target, point)` for the first thing the bullet reaches. Returns
 * the hit point, or null when the shot flies into the sunset.
 */
export function firePistol(scene, pistol, origin, direction, targets, onHit) {
  if (pistol.cooldown > 0 || pistol.reloading > 0 || pistol.ammo <= 0) return null;
  pistol.ammo -= 1;
  pistol.cooldown = PISTOL.fireDelay;
  pistol.shotsFired += 1;
  const ray = new THREE.Raycaster(origin, direction, 0.1, PISTOL.range);
  const meshes = [];
  for (const target of targets) {
    if (!target || target.alive === false) continue;
    const mesh = target.mesh || target;
    mesh.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });
  }
  const hits = ray.intersectObjects(meshes, false);
  if (hits.length > 0) {
    const hit = hits[0];
    let owner = null;
    for (const target of targets) {
      if (!target || target.alive === false) continue;
      const mesh = target.mesh || target;
      let found = false;
      mesh.traverse((child) => {
        if (child === hit.object) found = true;
      });
      if (found) owner = target;
    }
    if (owner && onHit) onHit(owner, hit.point);
    return { point: hit.point, hit: owner };
  }
  const end = origin.clone().addScaledVector(direction, PISTOL.range);
  return { point: end, hit: null };
}

/** Tick the pistol timers; auto-reload when the mag runs dry. */
export function updatePistol(pistol, dt, wantReload) {
  pistol.cooldown = Math.max(0, pistol.cooldown - dt);
  if (wantReload && pistol.ammo < PISTOL.magSize && pistol.reloading <= 0) {
    pistol.reloading = PISTOL.reloadSeconds;
  }
  if (pistol.reloading > 0) {
    pistol.reloading -= dt;
    if (pistol.reloading <= 0) {
      pistol.ammo = PISTOL.magSize;
      pistol.reloading = 0;
    }
  }
}

/**
 * Rob the nearest pedestrian: take their cash, scare them into a sprint,
 * and add a star if anyone is watching. Returns the cash taken, or 0.
 */
export function robPedestrian(peds, x, z, onRobbed) {
  let best = null;
  let bestD = 3.2;
  for (const ped of peds) {
    if (!ped.alive || ped.robbed) continue;
    const d = dist2d(ped.mesh.position.x, ped.mesh.position.z, x, z);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  if (!best) return 0;
  best.robbed = true;
  best.fleeing = 4;
  best.fleeX = x;
  best.fleeZ = z;
  const cash = best.cash;
  if (onRobbed) onRobbed(best, cash);
  return cash;
}

/** A short-lived tracer line from the muzzle to the hit point. */
export function makeTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  scene.add(line);
  return { line, life: 0.09 };
}

/** A muzzle flash: a small glowing sprite that lives a few frames. */
export function makeMuzzleFlash(scene, at, direction) {
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffdf7a, transparent: true, opacity: 1 }),
  );
  flash.position.copy(at).addScaledVector(direction, 0.7);
  scene.add(flash);
  return { flash, life: 0.06 };
}

/** Tick tracer lines and muzzle flashes until they fade out. */
export function updateShotFx(fxList, dt) {
  for (let i = fxList.length - 1; i >= 0; i -= 1) {
    const fx = fxList[i];
    fx.life -= dt;
    if (fx.line) fx.line.material.opacity = clamp(fx.life / 0.09, 0, 1);
    if (fx.flash) fx.flash.material.opacity = clamp(fx.life / 0.06, 0, 1);
    if (fx.life <= 0) {
      if (fx.line) fx.line.parent?.remove(fx.line);
      if (fx.flash) fx.flash.parent?.remove(fx.flash);
      fxList.splice(i, 1);
    }
  }
}
