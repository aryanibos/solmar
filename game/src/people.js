// Pedestrians: the people of Solmar. They stroll the sidewalks between
// random waypoints, chat in place for a while, and run when a gun goes off
// or a car comes at them. A pedestrian is a small circle with a heading;
// nothing here draws them, that is render's job.

import { clamp, dist } from './random.js';

const SHIRTS = ['#e86a6a', '#4fa3a5', '#e8b64c', '#7a5fd0', '#e8e8e8', '#4fae62', '#d64545', '#3e7bd6', '#c96bb0', '#8a7a5d'];

export function makePedestrian(city, rng, x, y) {
  const spot = x === undefined ? city.randomSidewalkPoint() : { x, y };
  return {
    x: spot.x, y: spot.y,
    angle: rng.float(0, Math.PI * 2),
    speed: rng.float(28, 55),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(['#f2c89b', '#d9a06b', '#8a5a3b', '#f7d7b0']),
    state: 'walk',
    target: city.randomSidewalkPoint(),
    wait: 0,
    fleeX: 0, fleeY: 0,
    r: rng.float(8, 11),
  };
}

export function updatePedestrians(list, dt, city, danger) {
  for (const p of list) {
    const prevX = p.x;
    const prevY = p.y;
    // Danger nearby (a gunshot, a speeding car, a police chase): run away.
    if (danger) {
      const d = dist(p.x, p.y, danger.x, danger.y);
      if (d < danger.radius) {
        p.state = 'flee';
        const a = Math.atan2(p.y - danger.y, p.x - danger.x);
        p.fleeX = p.x + Math.cos(a) * 120;
        p.fleeY = p.y + Math.sin(a) * 120;
      }
    }
    if (p.state === 'flee') {
      const a = Math.atan2(p.fleeY - p.y, p.fleeX - p.x);
      p.angle = a;
      p.x += Math.cos(a) * 150 * dt;
      p.y += Math.sin(a) * 150 * dt;
      if (dist(p.x, p.y, p.fleeX, p.fleeY) < 24) {
        p.state = 'walk';
        p.target = city.randomSidewalkPoint();
      }
    } else if (p.state === 'idle') {
      p.wait -= dt;
      if (p.wait <= 0) {
        p.state = 'walk';
        p.target = city.randomSidewalkPoint();
      }
    } else {
      const a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * dt;
      p.y += Math.sin(a) * p.speed * dt;
      if (dist(p.x, p.y, p.target.x, p.target.y) < 18) {
        if (Math.random() < 0.3) { p.state = 'idle'; p.wait = 2 + Math.random() * 4; }
        else p.target = city.randomSidewalkPoint();
      }
    }
    p.x = clamp(p.x, 40, 4760);
    p.y = clamp(p.y, 40, 4140);
    city.collideCircle(p);
    // Nobody strolls into the sea or the harbor basin.
    if (city.isInWater(p.x, p.y)) { p.x = prevX; p.y = prevY; }
  }
}

export function drawPedestrian(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, p.r + 1, p.r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body (shoulders) and head, sized to this pedestrian.
  ctx.fillStyle = p.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 0, p.r, p.r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.arc(p.r * 0.33, 0, p.r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
