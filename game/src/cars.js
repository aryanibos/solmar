// Cars: arcade driving physics and top-down drawing.
// A car is a point with an angle and a speed; steering turns the angle in
// proportion to speed, the handbrake cuts grip so the tail slides, and
// buildings stop the car with a thud instead of letting it through.

import { clamp, angleLerp } from './random.js';

export function makeCar(def, color, x, y, angle) {
  return {
    def, color, x, y, angle,
    speed: 0,
    steer: 0,
    damage: 0,
    honk: 0,
    brakeLight: false,
    drift: 0,
    smokeTimer: 0,
    damageCooldown: 0,
    hitCooldown: 0,
  };
}

export function carPoints(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const half = car.def.length / 2;
  return {
    front: { x: car.x + c * half * 0.7, y: car.y + s * half * 0.7 },
    back: { x: car.x - c * half * 0.7, y: car.y - s * half * 0.7 },
    center: { x: car.x, y: car.y },
  };
}

export function updateCar(car, drive, dt, city) {
  const def = car.def;
  const throttle = drive.throttle; // -1 reverse/brake, 0 coast, 1 forward
  const steering = drive.steer;   // -1 left, 1 right
  const handbrake = drive.handbrake;

  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 8) car.speed -= def.accel * 1.6 * dt;
    else car.speed -= def.accel * 0.45 * dt;
  } else {
    car.speed -= car.speed * 0.55 * dt;
  }
  car.speed = clamp(car.speed, -def.topSpeed * 0.42, def.topSpeed);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const speedFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  const grip = handbrake ? 1.2 : def.grip;
  const targetAngle = car.angle + steering * speedFactor * grip * dt * (car.speed < 0 ? -1 : 1);
  car.angle = angleLerp(car.angle, targetAngle, 1);
  car.drift = handbrake && Math.abs(car.speed) > 120 ? 1 : Math.max(0, car.drift - dt * 3);
  if (car.damageCooldown > 0) car.damageCooldown -= dt;
  if (car.hitCooldown > 0) car.hitCooldown -= dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = { x: nx, y: ny, r: car.def.width / 2 + 2 };
  const hitWall = city.collideCircle(probe);
  car.x = probe.x;
  car.y = probe.y;
  if (hitWall) {
    if (Math.abs(car.speed) > 160 && car.damageCooldown <= 0) {
      car.damage += Math.abs(car.speed) * 0.02;
      car.damageCooldown = 0.6;
    }
    car.speed *= 0.45;
  }
  // The sea is not drivable: the south shore starts at y 4200, so stop
  // the car at the water's edge instead of sailing into the ocean.
  if (car.y > 4200) {
    car.y = 4200;
    car.speed *= 0.5;
  }
  car.brakeLight = throttle < 0 || handbrake;
  return hitWall;
}

export function collideCarPair(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = (a.def.length + b.def.length) / 2 - 8;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uy = dy / d;
  a.x -= ux * push; a.y -= uy * push;
  b.x += ux * push; b.y += uy * push;
  const exchange = (a.speed - b.speed) * 0.35;
  a.speed -= exchange;
  b.speed += exchange;
  // Damage only on a fresh impact, scaled by how hard the cars met:
  // a chase at matched speed should shove, not wreck.
  if (a.hitCooldown <= 0 && b.hitCooldown <= 0) {
    const impact = Math.abs(a.speed - b.speed);
    const dmg = Math.min(4, 1 + impact * 0.012);
    a.damage += dmg;
    b.damage += dmg;
    a.hitCooldown = 0.5;
    b.hitCooldown = 0.5;
  }
  return true;
}

export function drawCar(ctx, car, time) {
  const def = car.def;
  const halfL = def.length / 2;
  const halfW = def.width / 2;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Soft shadow under the body.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  roundRect(ctx, -halfL + 3, -halfW + 4, def.length, def.width, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -halfL, -halfW, def.length, def.width, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // The player's own car keeps a white outline so it never gets lost.
  if (car.isOwn) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    roundRect(ctx, -halfL, -halfW, def.length, def.width, 7);
    ctx.stroke();
  }
  // Roof: police get a white roof, everyone else a dark one. The
  // windshield is a wedge tapering toward the nose, not a flat bar.
  ctx.fillStyle = car.isPolice ? '#f2f2f2' : 'rgba(20, 28, 40, 0.85)';
  roundRect(ctx, -halfL * 0.28, -halfW * 0.72, halfL * 0.62, def.width * 1.44, 4);
  ctx.fill();
  // Police checker strip down each flank, so an SPPD car never reads
  // as ordinary traffic.
  if (car.isPolice) {
    for (let sx = -halfL + 8; sx < halfL - 8; sx += 8) {
      ctx.fillStyle = (Math.floor(sx / 8) % 2 === 0) ? '#14181f' : '#f2f2f2';
      ctx.fillRect(sx, halfW - 4, 8, 3);
      ctx.fillRect(sx, -halfW + 1, 8, 3);
    }
  }
  ctx.fillStyle = 'rgba(160, 210, 235, 0.75)';
  ctx.beginPath();
  ctx.moveTo(halfL * 0.42, -halfW * 0.66);
  ctx.lineTo(halfL * 0.42 - 9, -halfW * 0.38);
  ctx.lineTo(halfL * 0.42 - 9, halfW * 0.38);
  ctx.lineTo(halfL * 0.42, halfW * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-halfL * 0.52, -halfW * 0.66, 4, def.width * 1.32);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(halfL - 3, -halfW + 3, 3, 5);
  ctx.fillRect(halfL - 3, halfW - 8, 3, 5);
  // Brake lights.
  if (car.brakeLight) {
    ctx.fillStyle = '#ff2e2e';
    ctx.fillRect(-halfL, -halfW + 2, 3, 5);
    ctx.fillRect(-halfL, halfW - 7, 3, 5);
  }
  // Damage: smoke puffs are spawned by the caller from car.damage.
  if (car.damage > 55) {
    ctx.fillStyle = 'rgba(60, 60, 60, 0.5)';
    ctx.beginPath();
    ctx.arc(halfL * 0.4 + Math.sin(time * 9) * 2, -halfW * 0.4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
