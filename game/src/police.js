// The wanted system and the Solmar Police Department.
// Stars rise when the player commits crimes and fall when the player stays
// out of sight. Police cars chase and ram; foot cops chase and, if they
// hold the player on foot, arrest them. At four stars the SPPD sets
// roadblocks across the road ahead.

import { CAR_DEFS, PALETTE, WANTED } from './config.js';
import { makeCar, updateCar, drawCar, collideCarPair } from './cars.js';
import { clamp, dist, angleLerp } from './random.js';
import { spawnParticles } from './effects.js';

export function createPolice() {
  return {
    stars: 0,
    unseen: 0,
    spawnTimer: 0,
    cars: [],
    cops: [],
    roadblocks: [],
    roadblockTimer: 0,
  };
}

export function addHeat(police, stars) {
  police.stars = clamp(police.stars + stars, 0, WANTED.maxStars);
  police.unseen = 0;
}

export function clearWanted(police) {
  police.stars = 0;
  police.unseen = 0;
  police.cars.length = 0;
  police.cops.length = 0;
  police.roadblocks.length = 0;
}

function spawnPoliceCar(police, city, rng, near) {
  const spot = city.randomRoadPoint();
  const car = makeCar(CAR_DEFS.police, PALETTE.policeCar, spot.x, spot.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
  car.isPolice = true;
  car.speed = 200;
  police.cars.push(car);
  return car;
}

function spawnCop(police, city, rng, near) {
  const spot = city.randomSidewalkPoint();
  police.cops.push({
    x: spot.x, y: spot.y, angle: 0, speed: 195, r: 12,
    grab: 0, shirt: '#2f4a7a', skin: '#d9a06b',
  });
}

function spawnRoadblock(police, city, rng, player) {
  // Two parked police cars across the road the player is heading down.
  const ahead = { x: player.x + Math.cos(player.angle || 0) * 420, y: player.y + Math.sin(player.angle || 0) * 420 };
  const cx = city.centers.reduce((a, c) => Math.abs(ahead.x - c) < Math.abs(ahead.x - a) ? c : a, city.centers[0]);
  const cy = city.centers.reduce((a, c) => Math.abs(ahead.y - c) < Math.abs(ahead.y - a) ? c : a, city.centers[0]);
  const vertical = Math.abs(ahead.x - cx) < Math.abs(ahead.y - cy);
  for (let i = -1; i <= 1; i += 2) {
    const car = makeCar(CAR_DEFS.police, PALETTE.policeCar,
      vertical ? cx + i * 22 : cx, vertical ? cy : cy + i * 22,
      vertical ? Math.PI / 2 : 0);
    car.isPolice = true;
    car.isRoadblock = true;
    car.speed = 0;
    police.roadblocks.push(car);
  }
  police.roadblockTimer = 14;
}

export function updatePolice(police, dt, world) {
  const { city, rng, player, playerCar, fx } = world;
  const events = { busted: false, rammed: false };
  const px = playerCar ? playerCar.x : player.x;
  const py = playerCar ? playerCar.y : player.y;

  // Wanted decays only while no police unit can see the player.
  let seen = false;
  for (const car of police.cars) if (dist(car.x, car.y, px, py) < 520) seen = true;
  for (const cop of police.cops) if (dist(cop.x, cop.y, px, py) < 320) seen = true;
  if (police.stars > 0) {
    if (seen) police.unseen = 0;
    else {
      police.unseen += dt;
      if (police.unseen > WANTED.decayDelay) {
        police.unseen = 0;
        police.stars = Math.max(0, police.stars - 1);
      }
    }
  }

  // Keep the force at the strength the stars demand.
  const wantCars = police.stars > 0 ? WANTED.carsPerStar[police.stars] : 0;
  const wantCops = police.stars > 0 ? WANTED.copsPerStar[police.stars] : 0;
  police.spawnTimer -= dt;
  if (police.spawnTimer <= 0) {
    police.spawnTimer = 1.6;
    if (police.cars.length < wantCars) spawnPoliceCar(police, city, rng, { x: px, y: py });
    if (police.cops.length < wantCops) spawnCop(police, city, rng, { x: px, y: py });
  }
  if (police.stars >= 4) {
    police.roadblockTimer -= dt;
    if (police.roadblockTimer <= 0 && police.roadblocks.length < 4) spawnRoadblock(police, city, rng, { x: px, y: py, angle: playerCar ? playerCar.angle : player.angle });
  }

  // Police cars: steer at the player and ram.
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    const car = police.cars[i];
    const d = dist(car.x, car.y, px, py);
    if (d > 2200) { police.cars.splice(i, 1); continue; }
    const want = Math.atan2(py - car.y, px - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = clamp(diff * 1.6, -1, 1);
    updateCar(car, { throttle: 1, steer, handbrake: false }, dt, city);
    if (playerCar && collideCarPair(car, playerCar)) {
      events.rammed = true;
      spawnParticles(fx, (car.x + playerCar.x) / 2, (car.y + playerCar.y) / 2, '#ffd23e', 8, 140, 0.4, 4);
    }
  }

  // Roadblock cars sit still; the player can smash through them.
  for (let i = police.roadblocks.length - 1; i >= 0; i -= 1) {
    const car = police.roadblocks[i];
    if (playerCar && collideCarPair(car, playerCar)) {
      car.damage += 30;
      events.rammed = true;
    }
    if (car.damage > 90) {
      spawnParticles(fx, car.x, car.y, '#ff9a2e', 20, 220, 0.8, 7);
      police.roadblocks.splice(i, 1);
    }
  }

  // Foot cops: run the player down on foot; hold on to arrest.
  for (let i = police.cops.length - 1; i >= 0; i -= 1) {
    const cop = police.cops[i];
    const d = dist(cop.x, cop.y, player.x, player.y);
    if (d > 1400) { police.cops.splice(i, 1); continue; }
    if (!playerCar) {
      const a = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = a;
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      city.collideCircle(cop);
      if (d < 26) {
        cop.grab += dt;
        if (cop.grab > 1.2) events.busted = true;
      } else cop.grab = Math.max(0, cop.grab - dt * 2);
    } else {
      // On foot no longer: the cop gives up the chase on foot and jogs away.
      cop.x += Math.cos(cop.angle) * 60 * dt;
      cop.y += Math.sin(cop.angle) * 60 * dt;
    }
  }
  return events;
}

export function drawPolice(ctx, police, time) {
  for (const car of police.cars) {
    drawCar(ctx, car, time);
    drawLightBar(ctx, car, time);
  }
  for (const car of police.roadblocks) {
    drawCar(ctx, car, time);
    drawLightBar(ctx, car, time);
  }
  for (const cop of police.cops) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.rotate(cop.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1, 2, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2f4a7a';
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cop.skin;
    ctx.beginPath(); ctx.arc(3, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2f52';
    ctx.fillRect(-4, -6, 6, 12);
    ctx.restore();
  }
}

function drawLightBar(ctx, car, time) {
  const on = Math.floor(time * 6) % 2 === 0;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
  ctx.fillRect(-4, -8, 8, 7);
  ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
  ctx.fillRect(-4, 1, 8, 7);
  ctx.restore();
}
