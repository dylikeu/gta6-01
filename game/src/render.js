// render.js — the camera and the renderer: a WebGL renderer with soft
// shadows and warm tone mapping, and the third-person chase camera that
// swings behind Dante whether he is on foot or behind the wheel.
import * as THREE from 'three';
import { clamp } from './config.js';

/** Create the renderer, the scene and the chase camera. */
export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 6, -14);
  return { renderer, scene, camera };
}

/** Keep the renderer and camera matched to the window. */
export function resizeRenderer(render, width, height) {
  render.renderer.setSize(width, height);
  render.camera.aspect = width / height;
  render.camera.updateProjectionMatrix();
}

/**
 * The chase camera: ease toward the target point behind Dante, always look
 * a little ahead of him, and never let a building sit between lens and hero.
 */
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 6, -14);
    this.look = new THREE.Vector3(0, 1.5, 0);
    this.heading = Math.PI;
    this.snap = true;
  }

  /** Follow a target {x, z, y, lookX, lookZ, lookY} with smoothing. */
  follow(target, dt, instant = false) {
    const k = instant || this.snap ? 1 : 1 - Math.pow(0.0001, dt);
    this.pos.x += (target.x - this.pos.x) * k;
    this.pos.y += (target.y - this.pos.y) * k;
    this.pos.z += (target.z - this.pos.z) * k;
    this.look.x += (target.lookX - this.look.x) * k;
    this.look.y += (target.lookY - this.look.y) * k;
    this.look.z += (target.lookZ - this.look.z) * k;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.snap = false;
  }

  /** A fixed cinematic shot: place the camera exactly, no smoothing. */
  place(x, y, z, lookX, lookY, lookZ) {
    this.pos.set(x, y, z);
    this.look.set(lookX, lookY, lookZ);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.snap = true;
  }

  /** Nudge the camera height with the mouse wheel (zoom). */
  zoom(factor) {
    this.pos.y = clamp(this.pos.y * factor, 2.5, 12);
  }
}
