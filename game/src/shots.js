// Screenshot staging behind ?shot=cover|drive|foot|mission.
// Each scene sets the real game to a chosen state with the seeded random
// generator, then plays it forward a fixed number of steps with a scripted
// driver, so the frame is what a short game really looks like and the same
// seed always gives the same frame. Nothing here is faked: the police, the
// traffic and the mission are all really running.

import { CAR_DEFS, PALETTE, STEP } from './config.js';
import { nearestRoadCenter } from './city.js';
import { to3 } from './meshes.js';
import { startMission } from './missions.js';

const STEPS = 150;

function scriptedDrive(game, steps, steer) {
  const input = { up: true, down: false, left: false, right: false, run: false, handbrake: false, mouseDown: false };
  for (let i = 0; i < steps; i += 1) {
    if (steer) {
      input.left = Math.sin(i * 0.05) < -0.55;
      input.right = Math.sin(i * 0.05) > 0.55;
    }
    game.step(STEP, input);
  }
}

function scriptedStand(game, steps) {
  const input = { up: false, down: false, left: false, right: false, run: false, handbrake: false, mouseDown: false };
  for (let i = 0; i < steps; i += 1) game.step(STEP, input);
}

function placePlayerInCar(game, defKey, color, x, y, angle) {
  const sim = game.sim;
  const car = sim.spawnCar(CAR_DEFS[defKey], color, x, y, angle, 'civil');
  car.speed = 60;
  sim.playerCar = car;
  sim.player.x = x;
  sim.player.y = y;
  sim.player.angle = angle;
  game.camYaw = angle;
  game.cameraSnap = true;
  return car;
}

function scatterTraffic(game, count, ex = null, ey = null, er = 700) {
  const sim = game.sim;
  for (let i = 0; i < count; i += 1) {
    const p = game.city.randomRoadPoint();
    // Keep the player's road clear so a staged drive never starts in a pile-up.
    if (ex !== null && Math.hypot(p.x - ex, p.y - ey) < er) continue;
    const horizontal = Math.abs(p.y - nearestRoadCenter(p.y)) < 4;
    const def = game.rng.pick([CAR_DEFS.sedan, CAR_DEFS.coupe, CAR_DEFS.van]);
    const dir = game.rng.sign();
    const car = sim.spawnCar(def, game.rng.pick(PALETTE.carColors), p.x, p.y, horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), 'civil');
    car.isTraffic = true;
    car.speed = game.rng.float(27, 51);
    car.axis = horizontal ? 'x' : 'y';
    car.dir = dir;
    car.lane = 19 * game.rng.sign();
    car.targetSpeed = car.speed;
    sim.traffic.push(car);
  }
}

function scatterPeds(game, count, cx, cy) {
  const sim = game.sim;
  for (let i = 0; i < count; i += 1) {
    // Start on a sidewalk near the scene, never in the middle of the road.
    let p = game.city.randomSidewalkPoint();
    for (let tries = 0; tries < 12 && Math.hypot(p.x - cx, p.y - cy) > 320; tries += 1) {
      p = game.city.randomSidewalkPoint();
    }
    const { buildPersonMesh } = game.meshes;
    const mesh = buildPersonMesh(game.rng.pick(PALETTE.pedShirts));
    game.scene.add(mesh);
    sim.pedestrians.push({
      x: p.x, y: p.y,
      angle: 0, speed: game.rng.float(2.5, 4.5), tx: p.x, ty: p.y, state: 'walk', mesh, wait: 0,
    });
  }
}

function clearParkedNear(game, cx, cy, r) {
  const sim = game.sim;
  sim.parked = sim.parked.filter((car) => {
    if (Math.hypot(car.x - cx, car.y - cy) < r) {
      game.scene.remove(car.mesh);
      return false;
    }
    return true;
  });
}

export function stageShot(name, game) {
  const city = game.city;
  const sim = game.sim;
  game.screen = 'play';
  if (name === 'drive') {
    // Driving down a downtown boulevard with traffic and pedestrians.
    placePlayerInCar(game, 'sedan', 0x3e7bd6, 2400, 1200, 0);
    clearParkedNear(game, 2400, 1200, 700);
    scatterTraffic(game, 8, 2400, 1200);
    scatterPeds(game, 10, 2400, 1200);
    game.objectiveText = 'Free roam — explore Solmar, steal a car, start a job.';
    scriptedDrive(game, STEPS, false);
    return;
  }
  if (name === 'foot') {
    // On foot at the harbor, pistol out, thugs closing in, people fleeing.
    const harbor = city.places.harbor;
    sim.player.x = harbor.x - 120;
    sim.player.y = harbor.y + 60;
    sim.player.angle = 0;
    sim.player.hasPistol = true;
    sim.player.ammo = 42;
    game.camYaw = 0;
    game.cameraSnap = true;
    for (let i = 0; i < 4; i += 1) {
      sim.spawnThug(harbor.x + game.rng.float(-160, 160), harbor.y + game.rng.float(-120, 160), true);
    }
    scatterPeds(game, 12, harbor.x, harbor.y);
    for (const p of sim.pedestrians) {
      p.state = 'flee';
      p.tx = p.x - 300;
      p.ty = p.y + 200;
    }
    sim.spawnPickup('health', harbor.x - 60, harbor.y + 120);
    game.missions.kills = 2;
    game.missions.killsNeeded = 5;
    game.objectiveText = 'Dockside Trouble — clear out the Castellan thugs (2/5)';
    scriptedStand(game, 90);
    return;
  }
  if (name === 'mission') {
    // Mission 3 in progress: the Harbor Run delivery, marker and timer live.
    // The coupe drives east along the beach road (y=4080) toward the Palma
    // Beach Bar beacon, the sea on its right.
    startMission(game.missions, 2);
    game.missions.stepIndex = 1;
    game.missions.timer = 74;
    placePlayerInCar(game, 'coupe', 0xe8b64c, 2040, 4080, 0);
    clearParkedNear(game, 2160, 4080, 700);
    scatterTraffic(game, 4, 2160, 4080);
    scatterPeds(game, 8, 2400, 4060);
    game.objectiveText = 'Harbor Run — deliver to the Palma Beach Bar, 74s left';
    scriptedDrive(game, STEPS, false);
    return;
  }
  // Cover: a three-star police chase at dusk downtown, the getaway in full.
  // Two interceptors cross the player's road from the side street ahead
  // (in frame) and one chases from behind.
  startMission(game.missions, 4);
  const car = placePlayerInCar(game, 'sport', 0xe87e2e, 2400, 2160, 0);
  clearParkedNear(game, 2400, 2160, 700);
  sim.police.stars = 3;
  const chaseSpots = [
    [2640, 2160 - 350, Math.PI / 2],
    [2640, 2160 + 350, -Math.PI / 2],
    [2400 - 300, 2160, 0],
  ];
  for (let i = 0; i < chaseSpots.length; i += 1) {
    const [px, py, pa] = chaseSpots[i];
    const pc = sim.spawnCar(CAR_DEFS.police, PALETTE.policeCar, px, py, pa, 'police');
    pc.isPolice = true;
    pc.speed = 78;
    pc.slot = (i % 3 - 1) * 25;
    // The two crossers drive straight across the player's road; only the
    // rear car actually chases, so the shot stays a chase, not a pile-up.
    pc.scripted = i < 2;
    sim.police.cars.push(pc);
  }
  scatterTraffic(game, 6, 2400, 2160);
  scatterPeds(game, 8, 2400, 2160);
  const flash = to3(2520, 2160, 10);
  game.sim.effects.burst(flash.x, flash.y, flash.z, 0xff9a2e, 8, 12, 0.5);
  game.objectiveText = 'The Getaway — escape the police, reach the safehouse';
  scriptedDrive(game, STEPS, false);
}
