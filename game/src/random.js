// Seeded random numbers for Solmar. One seed builds one city, so the same
// seed always deals the same streets, buildings and traffic. The generator
// is a small xorshift-style hash: cheap, deterministic, and good enough for
// a game that only needs shuffled-looking variety, not cryptography.

export function makeRandom(seed) {
  let a = (seed >>> 0) || 1;
  let b = (a ^ 0x9e3779b9) >>> 0;
  let c = (b ^ 0x85ebca6b) >>> 0;
  let d = (c ^ 0xc2b2ae35) >>> 0;
  function next() {
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const u = (t + d) | 0;
    c = (c + u) | 0;
    return ((u >>> 0) % 100000) / 100000;
  }
  return {
    next,
    float(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(min + next() * (max - min + 1)); },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    sign() { return next() < 0.5 ? -1 : 1; },
  };
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
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

export function dist2d(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
