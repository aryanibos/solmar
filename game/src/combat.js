// Combat: fists, pistols, armed thugs and pickups.
// Bullets fly straight until they hit a building, a person or a car.
// Thugs chase the player and shoot when they have a line on them.
// Pickups (health snacks and ammo boxes) sit on the street for the taking.

import { PLAYER } from './config.js';
import { dist, clamp } from './random.js';
import { spawnParticles } from './effects.js';

export function createCombat() {
  return { bullets: [], enemies: [], pickups: [] };
}

export function fireBullet(combat, x, y, angle, fromPlayer) {
  combat.bullets.push({
    x: x + Math.cos(angle) * 20,
    y: y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * 880,
    vy: Math.sin(angle) * 880,
    life: 0.6,
    fromPlayer,
    damage: fromPlayer ? PLAYER.pistolDamage : 12,
  });
}

export function spawnThug(combat, x, y, rng, armed) {
  const thug = {
    x, y, angle: rng.float(0, Math.PI * 2),
    health: 60, speed: 120, r: 12,
    armed: armed !== false,
    shootTimer: rng.float(0.6, 1.4),
    state: 'chase',
    shirt: rng.pick(['#3a3a3a', '#5a2a2a', '#2a3a5a']),
    skin: rng.pick(['#f2c89b', '#d9a06b', '#8a5a3b']),
  };
  combat.enemies.push(thug);
  return thug;
}

export function spawnPickup(combat, kind, x, y) {
  combat.pickups.push({ kind, x, y, bob: Math.random() * Math.PI * 2 });
}

export function meleeHit(x, y, angle, range, damage, targets) {
  let hits = 0;
  for (const t of targets) {
    const d = dist(x, y, t.x, t.y);
    if (d > range + (t.r || 12)) continue;
    const a = Math.atan2(t.y - y, t.x - x);
    let diff = a - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > 1.1) continue;
    t.health -= damage;
    hits += 1;
  }
  return hits;
}

export function updateCombat(combat, dt, city, player, fx, onPlayerHit, onKill) {
  const events = { playerHit: 0, kills: 0 };
  // Bullets.
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && city.buildingAt(b.x, b.y)) {
      spawnParticles(fx, b.x, b.y, '#ffd23e', 4, 120, 0.25, 3);
      dead = true;
    }
    if (!dead) {
      if (b.fromPlayer) {
        for (const e of combat.enemies) {
          if (e.health > 0 && dist(b.x, b.y, e.x, e.y) < e.r + 4) {
            e.health -= b.damage;
            spawnParticles(fx, b.x, b.y, '#ff5a4e', 6, 140, 0.3, 4);
            if (e.health <= 0) { events.kills += 1; onKill(e); }
            dead = true;
            break;
          }
        }
      } else if (player.health > 0 && dist(b.x, b.y, player.x, player.y) < PLAYER.radius + 4) {
        player.health -= b.damage;
        events.playerHit += 1;
        onPlayerHit(b.damage);
        spawnParticles(fx, b.x, b.y, '#ff5a4e', 6, 140, 0.3, 4);
        dead = true;
      }
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  // Enemies.
  for (let i = combat.enemies.length - 1; i >= 0; i -= 1) {
    const e = combat.enemies[i];
    if (e.health <= 0) {
      spawnParticles(fx, e.x, e.y, '#c9b694', 14, 160, 0.6, 5);
      if (Math.random() < 0.5) spawnPickup(combat, Math.random() < 0.5 ? 'ammo' : 'health', e.x, e.y);
      combat.enemies.splice(i, 1);
      continue;
    }
    const d = dist(e.x, e.y, player.x, player.y);
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    e.angle = a;
    if (d > 240) {
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
      city.collideCircle(e);
    } else if (e.armed) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 1.1 + Math.random() * 0.7;
        fireBullet(combat, e.x, e.y, a + (Math.random() - 0.5) * 0.16, false);
      }
    } else if (d < 30) {
      player.health -= 8 * dt * 2;
      events.playerHit += 1;
    }
  }
  // Pickups.
  for (let i = combat.pickups.length - 1; i >= 0; i -= 1) {
    const p = combat.pickups[i];
    p.bob += dt * 3;
    if (dist(p.x, p.y, player.x, player.y) < 26) {
      if (p.kind === 'health') player.health = Math.min(PLAYER.maxHealth, player.health + 30);
      else player.ammo += 24;
      combat.pickups.splice(i, 1);
    }
  }
  return events;
}

export function drawCombat(ctx, combat, time) {
  for (const p of combat.pickups) {
    const bob = Math.sin(p.bob) * 2;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 8, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    if (p.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else {
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = '#3a3a3a';
      ctx.fillRect(-6, -3, 3, 6);
      ctx.fillRect(0, -3, 3, 6);
      ctx.fillRect(6, -3, 3, 6);
    }
    ctx.restore();
  }
  for (const e of combat.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(3, 0, 5, 0, Math.PI * 2); ctx.fill();
    if (e.armed) {
      ctx.fillStyle = '#222';
      ctx.fillRect(8, -2, 12, 4);
    }
    ctx.restore();
    // Health bar over a hurt thug.
    if (e.health < 60) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 14, e.y - 22, 28, 4);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(e.x - 14, e.y - 22, 28 * clamp(e.health / 60, 0, 1), 4);
    }
  }
  ctx.fillStyle = '#ffe9a8';
  for (const b of combat.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
