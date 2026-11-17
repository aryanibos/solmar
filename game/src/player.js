// The player on foot: Dario Venn. Walks and sprints, aims with the mouse,
// punches or shoots, and climbs in and out of cars. Health, money and ammo
// live here; the wanted level lives with the police.

import { PLAYER, WORLD } from './config.js';
import { clamp, dist } from './random.js';

export function createPlayer(city, rng) {
  const spot = city.places.safehouse;
  return {
    x: spot.x + 80, y: spot.y + 60,
    angle: 0,
    aimAngle: 0,
    health: PLAYER.maxHealth,
    money: 50,
    ammo: PLAYER.pistolAmmoStart,
    hasPistol: false,
    speed: 0,
    r: PLAYER.radius,
    punchTimer: 0,
    shootCooldown: 0,
    invulnerable: 0,
    walkBob: 0,
  };
}

export function updatePlayerOnFoot(player, input, dt, city) {
  const prevX = player.x;
  const prevY = player.y;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const target = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  player.speed = len > 0 ? target : 0;
  player.x += mx * player.speed * dt;
  player.y += my * player.speed * dt;
  if (len > 0) {
    player.angle = Math.atan2(my, mx);
    player.walkBob += dt * 10;
  }
  city.collideCircle(player);
  player.x = clamp(player.x, 30, 4770);
  // The sand is walkable, the water is not: stop at the shoreline.
  player.y = clamp(player.y, 30, WORLD.seaTop - 20);
  if (city.isInWater(player.x, player.y)) { player.x = prevX; player.y = prevY; }
  player.aimAngle = input.aimAngle;
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
}

export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = dist(player.x, player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

export function exitCarSpot(player, car, city) {
  // Step out on the side away from the road centre, so the player does not
  // land inside a building or another car.
  const side = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  for (const sign of [1, -1]) {
    const x = car.x + side * 30 * sign;
    const y = car.y + sideY * 30 * sign;
    if (!city.buildingAt(x, y)) {
      player.x = x;
      player.y = y;
      return true;
    }
  }
  player.x = car.x;
  player.y = car.y - 30;
  return true;
}

export function drawPlayer(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = Math.sin(player.walkBob) * 1.5;
  ctx.rotate(player.angle);
  // Legs (two small feet that swing while walking).
  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(-4, -7 + bob, 7, 4);
  ctx.fillRect(-4, 3 - bob, 7, 4);
  // Body: teal jacket, the colour Mara's crew wears.
  ctx.fillStyle = '#2e7d6b';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#d9a06b';
  ctx.beginPath();
  ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  // Hair.
  ctx.fillStyle = '#1d1d22';
  ctx.beginPath();
  ctx.arc(2, 0, 5.5, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  // Pistol in hand when armed.
  if (player.hasPistol) {
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 11, 4);
  }
  // Punch swing.
  if (player.punchTimer > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(12, 0, 8, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.restore();
}
