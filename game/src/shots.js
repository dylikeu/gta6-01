// Deterministic screenshot scenes behind ?shot=chase|city|mission|combat. Each one
// sets up real game state (a mission, a wanted level, a chase), runs the real
// simulation forward a fixed number of 1/60 s steps with scripted inputs, then locks
// the camera and freezes the sim — so the same seed always gives the same frame.
import { setWanted, addMoney, healPlayer } from './state.js';
import { startMission } from './missions.js';
import { spawnEnemy } from './combat.js';

const STEP = 1 / 60;

function lockCamera(world, x, y, z, lookX, lookY, lookZ) {
  world.camera.position.set(x, y, z);
  world.camera.lookAt(lookX, lookY, lookZ);
  world.state.cameraLocked = true;
  world.state.frozen = true;
}

function behind(pos, heading, dist, height) {
  return {
    x: pos.x - Math.sin(heading) * dist,
    y: height,
    z: pos.z - Math.cos(heading) * dist,
  };
}

// 1 — Cover: a chase. Dante in a pink sports car up the beach road (northbound
// lane), 3 stars, a cruiser coming head-on in the opposite lane, one overtaking
// on his flank, the BIG helicopter ahead-left with its searchlight on, traffic
// rolling, sunset and ocean to the left.
function stageChase(world) {
  const { scene, state } = world;
  const car = world.givePlayerCar(scene, state, 0xff2e63, 'sports', -165, 96, Math.PI);
  world.enterCar(state, car);
  car.speed = 24;
  // Mission 5 (escape) is live, so the HUD shows a real objective. No dialog
  // here — Dante is driving, not talking.
  const mission = startMission(state, 4);
  mission.phase = 'active';
  mission.pickedUp = true;
  state.missions.dialog = null;
  state.missions.objectiveText = 'Lose the cops — stay out of sight!';
  // Traffic first: southbound cars in the opposite lane, one far ahead.
  world.spawnTrafficAt(scene, state, -171, 66, 0);
  world.spawnTrafficAt(scene, state, -171, 34, 0);
  world.spawnTrafficAt(scene, state, -165, 18, Math.PI);
  // Run the chase forward with no cops yet, so Dante builds real speed.
  world.runSteps(2.0, new Set(['KeyW']));
  const p = state.player.pos;
  // NOW bring the heat: 3 stars, cruisers placed exactly where they read well
  // (one head-on ahead, one on the flank, one trailing), heli ahead-left.
  setWanted(state, 3);
  world.spawnPoliceCarAt(scene, state, p.x - 7, p.z - 34, 0);
  world.spawnPoliceCarAt(scene, state, p.x - 3, p.z - 22, 0);
  world.spawnPoliceCarAt(scene, state, p.x + 2, p.z + 20, Math.PI);
  // One short step so light bars flash, wheels turn and the heli spawns.
  world.runSteps(0.15, new Set(['KeyW']));
  // Park the helicopter ahead-left of the player, searchlight locked on him.
  // Low enough (y=24) that the body itself reads in frame, not just its cone.
  const heli = state.police.heli;
  if (heli) {
    heli.pos.set(p.x - 14, 24, p.z - 30);
    heli.mesh.rotation.y = Math.atan2(p.x - heli.pos.x, p.z - heli.pos.z);
    heli.spot.target.position.set(p.x - heli.pos.x, -heli.pos.y, p.z - heli.pos.z);
  }
  // Camera close behind the car, looking slightly left down the beach road.
  const cam = behind(p, Math.PI, 9.5, 3.6);
  lockCamera(world, cam.x, cam.y, cam.z, p.x - 8, 3.0, p.z - 26);
}

// 2 — The city on foot: camera CLOSE behind Dante on the beach promenade at
// sunset, pedestrians strolling, traffic rolling past, palms and ocean ahead.
function stageCity(world) {
  const { scene, state } = world;
  const player = state.player;
  player.pos.x = -150;
  player.pos.z = 24;
  player.heading = -Math.PI / 2; // facing west, into the sunset over the ocean
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  // Pedestrians near Dante, fixed spots.
  world.spawnPedAt(scene, state, -146, 18, 0.6);
  world.spawnPedAt(scene, state, -154, 30, -0.4);
  world.spawnPedAt(scene, state, -148, 12, 1.2);
  world.spawnPedAt(scene, state, -152, 40, 2.4);
  // Traffic on the beach road (kept clear of Dante so he stays the subject).
  world.spawnTrafficAt(scene, state, -156, -6, 0);
  world.spawnTrafficAt(scene, state, -150, 62, Math.PI);
  addMoney(state, 350);
  world.runSteps(2.0, new Set());
  const p = state.player.pos;
  const cam = behind(p, player.heading, 4.4, 2.3);
  lockCamera(world, cam.x, cam.y, cam.z, p.x - 10, 1.4, p.z);
}

// 3 — A mission in progress: the briefing dialog is open (Rico, portrait and all),
// the yellow objective beacon burns over the Marina Hotel, Dante on foot below.
function stageMission(world) {
  const { scene, state } = world;
  const mission = startMission(state, 1); // Sunset Courier, spot (102, -84)
  mission.phase = 'active'; // dialog stays open, but the beacon must already burn
  const player = state.player;
  // Dante walks the hotel road north toward the beacon — open road, no building
  // between him and the objective, so the beam reads in frame.
  player.pos.x = 102;
  player.pos.z = -58;
  player.heading = Math.PI;
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  world.spawnTrafficAt(scene, state, 99, -72, Math.PI);
  world.spawnTrafficAt(scene, state, 105, -96, 0);
  world.spawnPedAt(scene, state, 95, -64, 2.0);
  world.spawnPedAt(scene, state, 109, -70, -1.0);
  addMoney(state, 200);
  world.runSteps(0.8, new Set());
  const p = state.player.pos;
  // Closer camera: Dante big in the foreground, the beacon over the hotel behind.
  const cam = behind(p, player.heading, 5.6, 2.7);
  lockCamera(world, cam.x, cam.y, cam.z, 102, 3.0, -84);
}

// 4 — Combat and progression: Dante firing his pistol at a harbor guard, one
// already down, a cruiser closing in, a stolen sports car beside him, the payout
// banner and a fat wallet on the HUD.
function stageCombat(world) {
  const { scene, state } = world;
  const mission = startMission(state, 3); // Debt Collector, spot (48, 48)
  mission.phase = 'active';
  mission.count = 1;
  state.missions.dialog = null; // no briefing box in the combat frame
  const player = state.player;
  player.pos.x = 38;
  player.pos.z = 40;
  player.heading = Math.atan2(48 - 38, 48 - 40);
  player.mesh.position.set(player.pos.x, 0, player.pos.z);
  player.mesh.rotation.y = player.heading;
  player.shooting = true;
  player.weapon = 'pistol';
  addMoney(state, 1700);
  setWanted(state, 2);
  // One guard down, two still standing ahead of Dante.
  const down = spawnEnemy(scene, state, 52, 52);
  down.alive = false;
  down.mesh.rotation.x = -Math.PI / 2;
  down.mesh.position.y = 0.3;
  spawnEnemy(scene, state, 56, 56);
  spawnEnemy(scene, state, 50, 60);
  // The stolen sports car on Dante's left, cruisers closing from both sides
  // (both placed by hand — wanted 2 needs exactly 2, so none spawn at random).
  world.givePlayerCar(scene, state, 0xffd60a, 'sports', 32, 48, player.heading + 0.4);
  world.spawnPoliceCarAt(scene, state, 62, 38, Math.atan2(38 - 62, 40 - 38));
  world.spawnPoliceCarAt(scene, state, 66, 62, Math.atan2(38 - 66, 40 - 62));
  state.missions.banner = {
    text: 'JOB DONE — Hot Wheels',
    sub: '+$500  •  3/8 jobs complete',
    until: state.time + 999,
  };
  world.runSteps(0.6, new Set());
  player.shooting = true; // keep the aim pose after the sim steps
  healPlayer(state, 100); // staging must not leave a random police hit on the HUD
  // Camera behind Dante's shoulder: him big at bottom-centre, guards ahead.
  const p = state.player.pos;
  const dirX = Math.sin(player.heading);
  const dirZ = Math.cos(player.heading);
  lockCamera(world, p.x - dirX * 6.5, 2.9, p.z - dirZ * 6.5, 54, 1.5, 56);
  // Set the aim pose directly: arms raised, pistol out (no more sim steps run
  // after this, so the pose would otherwise never be applied). Then fire one
  // shot so the tracer and muzzle flash freeze at full brightness in frame.
  player.parts.armR.rotation.x = -Math.PI / 2 + 0.2;
  player.parts.armL.rotation.x = -Math.PI / 2 + 0.2;
  player.gun.visible = true;
  world.shootOnce();
  setWanted(state, 2); // the shot raised the heat; put the HUD back to 2 stars
}

export function stageShot(name, world) {
  world.state.screen = 'play';
  world.state.freeRoam = true;
  world.state.shotMode = true; // hides the crosshair: staged frames need no aim dot
  if (name === 'city') stageCity(world);
  else if (name === 'mission') stageMission(world);
  else if (name === 'combat') stageCombat(world);
  else stageChase(world); // default + 'chase'
  // Marker follows the active mission's objective.
  world.syncMarker();
  world.state.promptText = '';
  return name;
}
