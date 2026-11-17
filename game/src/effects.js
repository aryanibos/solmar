// Effects: particles, skid marks, smoke, muzzle flashes, explosions and
// floating score text. Nothing here owns game rules; it only makes things
// that happened look like they happened.

import { clamp } from './random.js';

export function createEffects() {
  return {
    particles: [],
    skids: [],
    texts: [],
  };
}

export function spawnParticles(fx, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.7),
      maxLife: life,
      color,
      size: size * (0.6 + Math.random() * 0.8),
    });
  }
}

export function spawnSmoke(fx, x, y) {
  fx.particles.push({
    x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
    vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 14,
    life: 0.9, maxLife: 0.9, color: 'rgba(90,90,90,0.55)', size: 7 + Math.random() * 6,
  });
}

export function spawnExplosion(fx, x, y) {
  spawnParticles(fx, x, y, '#ff9a2e', 26, 260, 0.7, 7);
  spawnParticles(fx, x, y, '#ff5a2e', 18, 180, 0.9, 9);
  spawnParticles(fx, x, y, '#3a3a3a', 12, 60, 1.4, 10);
  spawnParticles(fx, x, y, '#ffe9a8', 10, 340, 0.35, 5);
}

export function addSkid(fx, x, y, angle, length) {
  fx.skids.push({ x, y, angle, length });
  if (fx.skids.length > 220) fx.skids.splice(0, fx.skids.length - 220);
}

export function addText(fx, x, y, text, color) {
  fx.texts.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
  if (fx.texts.length > 12) fx.texts.shift();
}

export function updateEffects(fx, dt) {
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= (1 - 2.2 * dt);
    p.vy *= (1 - 2.2 * dt);
    p.life -= dt;
    if (p.life <= 0) fx.particles.splice(i, 1);
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.y -= 34 * dt;
    t.life -= dt;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }
}

export function drawSkids(ctx, fx) {
  // Skid marks lie on the road under everything else.
  ctx.save();
  ctx.strokeStyle = 'rgba(20, 20, 24, 0.5)';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (const s of fx.skids) {
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * s.length / 2, s.y - Math.sin(s.angle) * s.length / 2);
    ctx.lineTo(s.x + Math.cos(s.angle) * s.length / 2, s.y + Math.sin(s.angle) * s.length / 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx, fx) {
  for (const p of fx.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui, sans-serif';
  for (const t of fx.texts) {
    ctx.globalAlpha = clamp(t.life, 0, 1);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

export function drawEffects(ctx, fx) {
  drawSkids(ctx, fx);
  drawParticles(ctx, fx);
}
