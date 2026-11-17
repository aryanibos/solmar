// Seeded randomness and small math helpers for Solmar.
// Every system that needs determinism (city layout, screenshot staging)
// takes its randomness from here, so a seed always rebuilds the same city.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRandom(seed) {
  const next = mulberry32(seed);
  return {
    next,
    float(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = clamp(cx, rx, rx + rw);
  const ny = clamp(cy, ry, ry + rh);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function pushCircleOutOfRect(circle, rx, ry, rw, rh) {
  const nx = clamp(circle.x, rx, rx + rw);
  const ny = clamp(circle.y, ry, ry + rh);
  let dx = circle.x - nx;
  let dy = circle.y - ny;
  const d = Math.hypot(dx, dy);
  if (d === 0) {
    const left = circle.x - rx;
    const right = rx + rw - circle.x;
    const top = circle.y - ry;
    const bottom = ry + rh - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) { circle.x = rx - circle.r; }
    else if (m === right) { circle.x = rx + rw + circle.r; }
    else if (m === top) { circle.y = ry - circle.r; }
    else { circle.y = ry + rh + circle.r; }
    return true;
  }
  if (d < circle.r) {
    circle.x = nx + (dx / d) * circle.r;
    circle.y = ny + (dy / d) * circle.r;
    return true;
  }
  return false;
}
