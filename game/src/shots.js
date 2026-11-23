// shots.js — the four screenshot scenes behind ?shot=cover|street|mission|
// combat. Each one stages the real game from a fresh world with a fixed
// seed, steps the simulation a fixed number of frames, and parks the camera
// on a cinematic angle, so the same URL always renders the same frame.
import * as THREE from 'three';
import { createCarMesh } from './vehicles.js';
import { makeDrivable } from './drive.js';
import { enterCar } from './player.js';
import { spawnPoliceCar } from './police.js';
import { makeMuzzleFlash } from './weapons.js';
import { showDialogue } from './hud.js';

const STEP = 1 / 30;

/** Put the player in a car at (x, z), facing `heading`, ready to drive. */
function putPlayerInCar(game, x, z, heading, color = 0xe63b2e, kind = 3) {
  const mesh = createCarMesh(color, kind);
  game.scene.add(mesh);
  const car = { mesh, color, name: 'Coral Coupe', parked: false, stolen: true };
  makeDrivable(car, x, z, heading);
  enterCar(game.player, car);
  game.player.x = x;
  game.player.z = z;
  return car;
}

/** A police cruiser parked in formation behind the player, lights flashing. */
function placePolice(game, x, z, heading) {
  const car = spawnPoliceCar(game.scene, x, z);
  car.heading = heading;
  car.speed = 12;
  car.mesh.rotation.y = heading - Math.PI / 2;
  car.sirenPhase = 0.6;
  game.policeCars.push(car);
  return car;
}

/** Step the live simulation with the given keys held, for shot motion. */
function stepGame(game, seconds, keys) {
  game.input.keys = new Set(keys);
  const frames = Math.round(seconds / STEP);
  for (let i = 0; i < frames; i += 1) {
    if (game.mode !== 'play') break;
    // updateGame is imported lazily to avoid a circular import.
    game.__step(STEP);
  }
  game.input.keys = new Set();
}

/**
 * Stage the named scene on the fresh game and park the camera. The caller
 * freezes the loop afterwards, so the frame is exactly this one.
 */
export function stageShot(name, game) {
  const hud = game.hud;
  if (name === 'street') return stageStreet(game, hud);
  if (name === 'mission') return stageMission(game, hud);
  if (name === 'combat') return stageCombat(game, hud);
  return stageCover(game, hud);
}

/** Cover: a sunset chase up a street toward the sea — wanted, police, helicopter. */
function stageCover(game, hud) {
  game.money = 8450;
  game.wanted.setLevel(3);
  game.player.health = 86;
  game.player.armor = 40;
  putPlayerInCar(game, 50, -95, Math.PI, 0xe63b2e, 3);
  // Traffic ahead on the same street, plus a car crossing on Ocean Drive.
  game.trafficCars[0].alongAvenue = false;
  game.trafficCars[0].line = 50;
  game.trafficCars[0].pos = -125;
  game.trafficCars[0].dir = -1;
  game.trafficCars[1].alongAvenue = false;
  game.trafficCars[1].line = 50;
  game.trafficCars[1].pos = -145;
  game.trafficCars[1].dir = -1;
  game.trafficCars[2].alongAvenue = true;
  game.trafficCars[2].line = -140;
  game.trafficCars[2].pos = -25;
  game.trafficCars[2].dir = 1;
  // Mission 1 is live: steal a car, drive to the garage.
  game.missionRunner.startMission(0);
  game.missionRunner.phase = 'active';
  game.missionRunner.beginObjective();
  game.missionRunner.markerPos = { x: game.missionRunner.mission.objective.to.x, z: game.missionRunner.mission.objective.to.z };
  showDialogue(game.hud, null);
  stepGame(game, 0.6, ['KeyW']);
  // Police placed after the drive, in formation behind the player.
  placePolice(game, 46, -92, Math.PI);
  placePolice(game, 55, -97, Math.PI);
  game.heli.mesh.visible = true;
  game.heli.active = true;
  // Parked lower and a little closer than the first staging so the whole
  // helicopter (rotor included) sits inside the frame, beam still on Dante.
  game.heli.mesh.position.set(30, 34, -158);
  game.heli.mesh.rotation.y = Math.atan2(50 - 30, -104 - -158);
  // Chase camera: on the street behind the player, the sun ahead over the sea.
  // Look target raised so the heli clears the top edge.
  game.chaseCam.place(50, 7, -82, 48, 4.5, -118);
  game.time = 12;
}

/** Street: Dante on foot on the promenade, palms, peds and traffic. */
function stageStreet(game, hud) {
  game.money = 1250;
  game.wanted.setLevel(0);
  // Dante stands 4 units east of his old spot: the streetlight pole at
  // (-105, -147.5) used to hide half of him from the camera. The two walkers
  // nearest him are re-spaced so nobody crowds him either.
  game.player.x = -100;
  game.player.z = -148;
  game.player.heading = Math.PI;
  game.player.mesh.position.set(-100, 0, -148);
  game.player.mesh.rotation.y = Math.PI;
  // Walkers on the Ocean Drive sidewalk, set through their walker state so
  // the simulation keeps them there instead of teleporting them away.
  // East of Dante, clear of his line: from the new camera angle the
  // promenade west of him falls out of frame.
  const pedSpots = [
    { pos: -94, lane: -6.8, dir: 1 },
    { pos: -90, lane: -6.8, dir: -1 },
    { pos: -86, lane: -6.8, dir: 1 },
    { pos: -82, lane: -6.8, dir: -1 },
    { pos: -78, lane: -6.8, dir: 1 },
  ];
  for (let i = 0; i < 5; i += 1) {
    const ped = game.peds[i];
    ped.alongAvenue = true;
    ped.line = -140;
    ped.lane = pedSpots[i].lane;
    ped.pos = pedSpots[i].pos;
    ped.dir = pedSpots[i].dir;
  }
  // Traffic kept far from the camera so no car fills the lens.
  game.trafficCars[0].alongAvenue = true;
  game.trafficCars[0].line = -140;
  game.trafficCars[0].pos = 60;
  game.trafficCars[0].dir = 1;
  game.trafficCars[1].alongAvenue = true;
  game.trafficCars[1].line = -140;
  game.trafficCars[1].pos = -185;
  game.trafficCars[1].dir = -1;
  stepGame(game, 0.5, []);
  // Low, south-west of Dante, looking north-east past him: the sun (which
  // sits ~8 deg east of north) lands upper-centre-left instead of clipped
  // at the edge, the palm at (-94, -152) clears Dante by ~12 deg, the pole
  // sits well left of him, and the frame bottom starts past the road.
  game.chaseCam.place(-105, 2.4, -137, -100, 4.3, -149);
  game.time = 8;
}

/** Mission: The Pickup — Rico waits at the Salty Palm, dialogue open. */
function stageMission(game, hud) {
  game.money = 2900;
  game.wanted.setLevel(1);
  putPlayerInCar(game, -108, -140, -Math.PI / 2, 0x2ec4b6, 1);
  game.missionRunner.startMission(2);
  // The briefing is on screen: Rico's line, portrait and all.
  game.missionRunner.dialogueIndex = 0;
  showDialogue(game.hud, game.missionRunner.dialogue[0], game.missionRunner.mission);
  game.missionRunner.setMarker(game.missionRunner.mission.objective.pickup.x, game.missionRunner.mission.objective.pickup.z);
  stepGame(game, 0.7, ['KeyW']);
  // From the road itself, so no building roof leans into the frame.
  game.chaseCam.place(-96, 5, -138, -130, 2, -150);
  game.time = 10;
}

/** Combat: a shootout at the Marina — pistol out, Sharks down, cash up. */
function stageCombat(game, hud) {
  game.money = 12450;
  game.wanted.setLevel(2);
  game.player.health = 78;
  game.player.armor = 40;
  game.player.x = 142;
  game.player.z = -146;
  game.player.heading = Math.PI * 0.92;
  game.player.mesh.position.set(142, 0, -146);
  game.player.mesh.rotation.y = Math.PI * 0.92;
  game.pistol.ammo = 9;
  game.missionRunner.startMission(3);
  game.missionRunner.phase = 'active';
  game.missionRunner.beginObjective();
  showDialogue(game.hud, null);
  // One Shark already down, two still standing by the boats.
  const gangsters = game.missionRunner.gangsters;
  if (gangsters[0]) {
    gangsters[0].alive = false;
    gangsters[0].health = 0;
    gangsters[0].mesh.rotation.x = -Math.PI / 2;
    gangsters[0].mesh.position.y = 0.25;
    game.missionRunner.killsLeft = 2;
  }
  // The two Sharks still standing flank the beacon instead of hiding in it.
  if (gangsters[1]) gangsters[1].mesh.position.set(143, 0, -158);
  if (gangsters[2]) gangsters[2].mesh.position.set(157, 0, -146);
  const cash = game.effects.cashPickup(140, -150, 250);
  game.cashPickups.push(cash);
  stepGame(game, 0.8, []);
  // A frozen tracer beam and muzzle flash sell the gunfight mid-shot.
  const from = new THREE.Vector3(game.player.x, 1.55, game.player.z);
  const to = gangsters[1] ? new THREE.Vector3(gangsters[1].mesh.position.x, 1.3, gangsters[1].mesh.position.z) : new THREE.Vector3(152, 1.3, -154);
  const dir = to.clone().sub(from).normalize();
  const beamLen = from.distanceTo(to);
  const beam = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.09, beamLen),
    new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }),
  );
  beam.position.copy(from).add(to).multiplyScalar(0.5);
  beam.lookAt(to);
  game.scene.add(beam);
  const flash = makeMuzzleFlash(game.scene, from, dir);
  flash.flash.scale.setScalar(2.5);
  game.shotFx.push(flash);
  game.chaseCam.place(130, 3, -138, 150, 1.5, -152);
  game.time = 14;
}
