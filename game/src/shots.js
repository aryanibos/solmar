// Screenshot staging behind ?shot=cover|drive|foot|mission.
// Each scene sets the real game to a chosen state with the seeded random
// generator, then plays it forward a fixed number of steps with a scripted
// driver, so the frame is what a short game really looks like and the same
// seed always gives the same frame. Nothing here is faked: the police,
// the traffic and the mission are all really running.

import { CAR_DEFS, PALETTE, PLAYER } from './config.js';
import { makeCar } from './cars.js';
import { makePedestrian } from './people.js';
import { spawnThug, spawnPickup } from './combat.js';
import { addHeat } from './police.js';
import { startMission } from './missions.js';
import { addSkid, spawnParticles } from './effects.js';
import { STEP } from './config.js';

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
  const car = makeCar(CAR_DEFS[defKey], color, x, y, angle);
  car.speed = 200;
  game.playerCar = car;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

function scatterTraffic(game, count, cx, cy) {
  for (let i = 0; i < count; i += 1) {
    const p = game.city.randomRoadPoint();
    const car = makeCar(game.rng.pick([CAR_DEFS.sedan, CAR_DEFS.coupe, CAR_DEFS.van]), game.rng.pick(PALETTE.carColors), p.x, p.y, game.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
    car.isTraffic = true;
    car.speed = game.rng.float(90, 170);
    game.traffic.cars.push(car);
  }
}

function scatterPeds(game, count, cx, cy) {
  for (let i = 0; i < count; i += 1) {
    game.pedestrians.push(makePedestrian(game.city, game.rng, cx + game.rng.float(-260, 260), cy + game.rng.float(-260, 260)));
  }
}

export function stageShot(name, game) {
  const city = game.city;
  game.screen = 'play';
  if (name === 'drive') {
    // Driving down a downtown boulevard with traffic and pedestrians.
    const car = placePlayerInCar(game, 'sedan', '#3e7bd6', 2400, 1200, 0);
    scatterTraffic(game, 8, 2400, 1200);
    scatterPeds(game, 10, 2400, 1200);
    game.objectiveText = 'Free roam — explore Solmar, steal a car, start a job.';
    scriptedDrive(game, STEPS, false);
    return;
  }
  if (name === 'foot') {
    // On foot at the harbor, pistol out, thugs closing in, people fleeing.
    const harbor = city.places.harbor;
    game.player.x = harbor.x - 120;
    game.player.y = harbor.y + 60;
    game.player.angle = 0;
    game.player.hasPistol = true;
    game.player.ammo = 42;
    game.camera.x = game.player.x;
    game.camera.y = game.player.y;
    for (let i = 0; i < 4; i += 1) {
      spawnThug(game.combat, harbor.x + game.rng.float(-160, 160), harbor.y + game.rng.float(-120, 160), game.rng, true);
    }
    scatterPeds(game, 12, harbor.x, harbor.y);
    for (const p of game.pedestrians) { p.state = 'flee'; p.fleeX = p.x - 300; p.fleeY = p.y + 200; }
    spawnPickup(game.combat, 'health', harbor.x - 60, harbor.y + 120);
    game.objectiveText = 'Dockside Trouble — clear out the Castellan thugs (2/5)';
    game.missions.kills = 2;
    game.missions.killsNeeded = 5;
    scriptedStand(game, 90);
    return;
  }
  if (name === 'mission') {
    // Mission 3 in progress: the Harbor Run delivery, marker and timer live.
    startMission(game.missions, 2);
    game.missions.stepIndex = 1;
    game.missions.timer = 74;
    const beach = city.places.beachBar;
    placePlayerInCar(game, 'coupe', '#e8b64c', 2400, 3600, Math.PI / 2);
    scatterTraffic(game, 4, 2400, 3600);
    scatterPeds(game, 8, 2400, 3600);
    game.objectiveText = 'Harbor Run — deliver to the Palma Beach Bar, 74s left';
    // The coupe reaches the beach bar, completes the delivery, then runs
    // on to the shore and stops at the water's edge (cars can't enter the sea).
    scriptedDrive(game, STEPS, false);
    return;
  }
  // Cover: a three-star police chase at dusk downtown, the getaway in full.
  startMission(game.missions, 4);
  const car = placePlayerInCar(game, 'sport', '#e87e2e', 2400, 2160, 0);
  addHeat(game.police, 3);
  for (let i = 0; i < 3; i += 1) {
    const pc = makeCar(CAR_DEFS.police, PALETTE.policeCar, 2400 - 260 - i * 90, 2160 + (i - 1) * 46, 0);
    pc.isPolice = true;
    pc.speed = 260;
    game.police.cars.push(pc);
  }
  scatterTraffic(game, 6, 2400, 2160);
  scatterPeds(game, 8, 2400, 2160);
  // Skid marks from the chase so far.
  for (let i = 0; i < 6; i += 1) {
    addSkid(game.fx, 2400 - 120 - i * 46, 2160 + (i % 2 ? 8 : -8), 0, 40);
  }
  spawnParticles(game.fx, 2520, 2160, '#ff9a2e', 8, 120, 0.5, 5);
  game.objectiveText = 'The Getaway — escape the police, reach the safehouse';
  scriptedDrive(game, STEPS, false);
}
