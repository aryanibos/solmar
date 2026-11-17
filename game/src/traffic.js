// Traffic: the cars that fill Solmar's roads. Each one picks a road, drives
// along its lane, and at every intersection either carries on or turns.
// They slow for the car ahead and respawn near the camera when they drift
// too far away, so the streets always feel alive without ever running dry.

import { CAR_DEFS, PALETTE } from './config.js';
import { makeCar, updateCar, drawCar } from './cars.js';
import { clamp } from './random.js';

const LANE = 20;

export function createTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) cars.push(spawnTrafficCar(city, rng));
  return { cars, respawnTimer: 0 };
}

function spawnTrafficCar(city, rng, near) {
  const defKey = rng.pick(['sedan', 'sedan', 'coupe', 'van', 'taxi', 'truck']);
  const def = CAR_DEFS[defKey];
  const color = defKey === 'taxi' ? PALETTE.taxi : rng.pick(PALETTE.carColors);
  let x; let y; let angle;
  if (near) {
    const p = city.randomRoadPoint();
    x = near.x + (p.x - 2400) * 0.4;
    y = near.y + (p.y - 2400) * 0.4;
    x = clamp(x, 120, 4680);
    y = clamp(y, 120, 4100);
    angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  } else {
    const p = city.randomRoadPoint();
    x = p.x; y = p.y;
    angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }
  // Snap onto a lane: shift off the road centre so cars drive on the right.
  const onVertical = Math.abs(Math.sin(angle)) > 0.5;
  if (onVertical) x += Math.cos(angle) * 0 + LANE * (angle > 0 ? 1 : -1) * 0 + (angle === Math.PI / 2 ? LANE : -LANE);
  else y += angle === 0 ? LANE : -LANE;
  const car = makeCar(def, color, x, y, angle);
  car.speed = rng.float(90, 170);
  car.isTraffic = true;
  car.turnAt = 0;
  return car;
}

export function updateTraffic(traffic, dt, city, rng, camera) {
  const cars = traffic.cars;
  for (const car of cars) {
    // Find the car ahead on the same road and slow down for it.
    let ahead = null;
    let aheadDist = 90;
    for (const other of cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < aheadDist && side < 26) { ahead = other; aheadDist = along; }
    }
    const drive = { throttle: ahead ? 0 : 1, steer: 0, handbrake: false };
    // At an intersection (near a road centre on the cross axis), sometimes turn.
    const nearX = Math.abs(car.x - city.centers.reduce((a, c) => Math.abs(car.x - c) < Math.abs(car.x - a) ? c : a, city.centers[0])) < 30;
    const nearY = Math.abs(car.y - city.centers.reduce((a, c) => Math.abs(car.y - c) < Math.abs(car.y - a) ? c : a, city.centers[0])) < 30;
    const onVertical = Math.abs(Math.sin(car.angle)) > 0.5;
    if (((onVertical && nearY) || (!onVertical && nearX)) && car.turnAt <= 0) {
      car.turnAt = 1.2;
      if (rng.chance(0.45)) {
        const dir = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
        car.angle += dir;
        // Re-lane after the turn.
        if (Math.abs(Math.sin(car.angle)) > 0.5) car.x += car.angle === Math.PI / 2 ? LANE : -LANE;
        else car.y += car.angle === 0 ? LANE : -LANE;
      }
    }
    car.turnAt -= dt;
    updateCar(car, drive, dt, city);
    // Keep traffic on the roads: nudge a car that drifted off back to its lane.
    if (!city.buildingAt(car.x, car.y)) {
      const cx = city.centers.reduce((a, c) => Math.abs(car.x - c) < Math.abs(car.x - a) ? c : a, city.centers[0]);
      const cy = city.centers.reduce((a, c) => Math.abs(car.y - c) < Math.abs(car.y - a) ? c : a, city.centers[0]);
      if (onVertical) car.x += (cx + (car.angle === Math.PI / 2 ? LANE : -LANE) - car.x) * dt * 0.8;
      else car.y += (cy + (car.angle === 0 ? LANE : -LANE) - car.y) * dt * 0.8;
    }
  }
  // Respawn cars that wandered far from the camera, so traffic stays dense
  // where the player is and never bunches up at the map's edge.
  traffic.respawnTimer -= dt;
  if (traffic.respawnTimer <= 0) {
    traffic.respawnTimer = 2;
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      const d = Math.hypot(car.x - camera.x, car.y - camera.y);
      if (d > 1600) cars[i] = spawnTrafficCar(city, rng, camera);
    }
  }
}

export function drawTraffic(ctx, traffic) {
  for (const car of traffic.cars) drawCar(ctx, car, 0);
}
