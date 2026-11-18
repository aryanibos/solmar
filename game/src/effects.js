// Lightweight particle pool: one THREE.Points cloud, a few hundred slots,
// reused for exhaust puffs, muzzle sparks, impact bursts and pickup glints.
// Slots are plain objects; the GPU buffer is rewritten every frame. The
// points use a soft round sprite so exhaust reads as smoke, not confetti.

import * as THREE from 'three';

const MAX = 320;

function softDotTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export function createEffects(scene) {
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, map: softDotTexture() });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const slots = [];
  for (let i = 0; i < MAX; i += 1) {
    slots.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1 });
  }
  const tmpColor = new THREE.Color();

  function spawn(x, y, z, hex, count, speed, life, up = 0.5) {
    tmpColor.setHex(hex);
    let made = 0;
    for (const s of slots) {
      if (made >= count) break;
      if (s.alive) continue;
      made += 1;
      s.alive = true;
      s.x = x; s.y = y; s.z = z;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * speed;
      s.vx = Math.cos(a) * r;
      s.vz = Math.sin(a) * r;
      s.vy = Math.random() * speed * up;
      s.life = s.max = life * (0.6 + Math.random() * 0.7);
      s.r = tmpColor.r; s.g = tmpColor.g; s.b = tmpColor.b;
    }
  }

  return {
    burst(x, y, z, hex, count = 10, speed = 6, life = 0.6) { spawn(x, y, z, hex, count, speed, life, 0.9); },
    puff(x, y, z, hex = 0x9a8a72) { spawn(x, y, z, hex, 2, 1.2, 0.9, 0.4); },
    update(dt) {
      for (let i = 0; i < MAX; i += 1) {
        const s = slots[i];
        if (!s.alive) {
          positions[i * 3 + 1] = -100;
          continue;
        }
        s.life -= dt;
        if (s.life <= 0) {
          s.alive = false;
          positions[i * 3 + 1] = -100;
          continue;
        }
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.z += s.vz * dt;
        s.vy -= 4 * dt;
        if (s.y < 0.1) { s.y = 0.1; s.vy = 0; }
        const fade = s.life / s.max;
        positions[i * 3] = s.x;
        positions[i * 3 + 1] = s.y;
        positions[i * 3 + 2] = s.z;
        colors[i * 3] = s.r * fade;
        colors[i * 3 + 1] = s.g * fade;
        colors[i * 3 + 2] = s.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}
