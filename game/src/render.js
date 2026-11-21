// Renderer, sunset sky, sun, lights and fog — the look of Coral Bay at golden hour.
// Everything visual that is not a building, car or person lives here.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 520);
  return scene;
}

// A gradient sky dome with a low sun disc and a warm glow, drawn as shader + meshes.
export function createSky(scene) {
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      horizon: { value: new THREE.Color(PALETTE.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 mid; uniform vec3 horizon;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.75, h))
                            : mix(horizon, mid, smoothstep(-0.05, 0.25, h));
        // extra warmth hugging the horizon
        col += vec3(0.25, 0.08, 0.0) * pow(max(0.0, 1.0 - abs(h) * 4.0), 2.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Low sun disc over the ocean (west, -x) with a soft halo.
  const sunGroup = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 40),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  disc.position.set(-760, 62, 40);
  disc.lookAt(0, 62, 40);
  sunGroup.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(90, 40),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.28, fog: false }),
  );
  halo.position.set(-762, 62, 40);
  halo.lookAt(0, 62, 40);
  sunGroup.add(halo);
  scene.add(sunGroup);

  // A few flat dusk clouds, pink-lit from below.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xff9a8a, transparent: true, opacity: 0.32, fog: false });
  const cloudGeo = new THREE.SphereGeometry(1, 12, 8);
  const clouds = [
    [-300, 150, -260, 70, 10, 26], [180, 190, -320, 90, 12, 30], [-80, 170, 330, 80, 11, 28],
    [320, 140, 180, 60, 9, 22], [-420, 210, 120, 85, 12, 30], [60, 230, -180, 70, 10, 24],
  ];
  for (const [x, y, z, sx, sy, sz] of clouds) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(x, y, z);
    cloud.scale.set(sx, sy, sz);
    scene.add(cloud);
  }
  return sunGroup;
}

export function createLights(scene) {
  // Warm low sun from the west (over the ocean) — long shadows toward the city.
  const sun = new THREE.DirectionalLight(0xffb36b, 3.2);
  sun.position.set(-260, 110, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Purple dusk fill from above, warm bounce from the ground.
  const hemi = new THREE.HemisphereLight(0x8a5aa8, 0x54331f, 1.0);
  scene.add(hemi);
  const bounce = new THREE.DirectionalLight(0xff7e3d, 0.5);
  bounce.position.set(120, 40, -80);
  scene.add(bounce);
  return { sun, hemi, bounce };
}

// Sun-glitter strip on the water: a long additive plane under the sun's azimuth.
export function createSunGlitter(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,190,90,0)');
  grad.addColorStop(0.5, 'rgba(255,210,122,0.85)');
  grad.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false });
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(340, 26), mat);
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(-360, 0.35, 40);
  scene.add(strip);
  return strip;
}

export function resizeRenderer(renderer, camera) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
