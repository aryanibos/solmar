// Procedural Solmar: roads on a grid, city blocks with low-poly buildings,
// parks, a beach and sea to the south, a harbor basin to the east, and a
// downtown core. Everything comes from one seed, so the city is identical
// every run. Buildings are solid boxes; roads, sidewalks and plazas are
// walkable and drivable. The renderer turns this data into meshes.

import { WORLD, PALETTE } from './config.js';
import { makeRandom, clamp } from './random.js';

export const DISTRICT_DOWNTOWN = 'downtown';
export const DISTRICT_HARBOR = 'harbor';
export const DISTRICT_BEACH = 'beach';
export const DISTRICT_HOMES = 'homes';
export const DISTRICT_WORKS = 'works';
export const DISTRICT_MID = 'midtown';

export function roadCenters() {
  const centers = [];
  const first = WORLD.roadPitch / 2;
  for (let i = 0; i < 10; i += 1) centers.push(first + i * WORLD.roadPitch);
  return centers;
}

export function isOnRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const c of roadCenters()) {
    if (Math.abs(x - c) < half || Math.abs(y - c) < half) return true;
  }
  return false;
}

export function nearestRoadCenter(v) {
  const centers = roadCenters();
  let best = centers[0];
  for (const c of centers) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}

export function districtAt(x, y) {
  if (y >= WORLD.beachTop) return DISTRICT_BEACH;
  if (x >= WORLD.harborX && y >= WORLD.harborTop && y <= WORLD.harborBottom) return DISTRICT_HARBOR;
  const dx = Math.abs(x - WORLD.size / 2);
  const dy = Math.abs(y - WORLD.size / 2);
  if (dx < 620 && dy < 620) return DISTRICT_DOWNTOWN;
  if (x < 1400 && y < 1400) return DISTRICT_HOMES;
  if (x > 3400 && y < 1400) return DISTRICT_WORKS;
  return DISTRICT_MID;
}

export function createCity(seed) {
  const rng = makeRandom(seed);
  const centers = roadCenters();
  const buildings = [];
  const trees = [];
  const parks = [];
  const piers = [];
  const lamps = [];
  const umbrellas = [];

  const blockMin = WORLD.roadWidth / 2 + WORLD.sidewalk + 14;
  const blockMax = WORLD.roadPitch - WORLD.roadWidth / 2 - WORLD.sidewalk - 14;

  for (let gx = 0; gx < 9; gx += 1) {
    for (let gy = 0; gy < 9; gy += 1) {
      const bx0 = centers[gx] + blockMin;
      const bx1 = centers[gx + 1] - blockMin;
      const by0 = centers[gy] + blockMin;
      const by1 = centers[gy + 1] - blockMin;
      const cx = (bx0 + bx1) / 2;
      const cy = (by0 + by1) / 2;
      const district = districtAt(cx, cy);
      if (district === DISTRICT_BEACH || district === DISTRICT_HARBOR) continue;
      if (district === DISTRICT_HOMES && rng.chance(0.28)) {
        parks.push({ x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0 });
        const count = rng.int(5, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: rng.float(bx0 + 20, bx1 - 20), y: rng.float(by0 + 20, by1 - 20), r: rng.float(9, 15) });
        }
        continue;
      }
      const lots = district === DISTRICT_DOWNTOWN ? 1 : rng.int(2, 4);
      const cols = lots === 1 ? 1 : 2;
      const rows = Math.ceil(lots / cols);
      const lotW = (bx1 - bx0) / cols;
      const lotH = (by1 - by0) / rows;
      for (let li = 0; li < lots; li += 1) {
        const col = li % cols;
        const row = Math.floor(li / cols);
        const lx = bx0 + col * lotW;
        const ly = by0 + row * lotH;
        const pad = district === DISTRICT_DOWNTOWN ? 8 : 16;
        const w = rng.float(lotW * 0.45, lotW - pad * 2);
        const h = rng.float(lotH * 0.45, lotH - pad * 2);
        const x = lx + (lotW - w) / 2 + rng.float(-6, 6);
        const y = ly + (lotH - h) / 2 + rng.float(-6, 6);
        let height;
        let roof;
        let wall;
        if (district === DISTRICT_DOWNTOWN) {
          height = rng.float(15, 45) * 10;
          roof = rng.pick(PALETTE.downtownRoof);
          wall = rng.pick(PALETTE.wallDowntown);
        } else if (district === DISTRICT_HOMES) {
          height = rng.float(4, 9) * 10;
          roof = rng.pick(PALETTE.houseRoof);
          wall = rng.pick(PALETTE.wall);
        } else if (district === DISTRICT_WORKS) {
          height = rng.float(6, 12) * 10;
          roof = rng.pick(PALETTE.warehouseRoof);
          wall = rng.pick(PALETTE.wall);
        } else {
          height = rng.float(8, 20) * 10;
          roof = rng.pick(PALETTE.roof);
          wall = rng.pick(PALETTE.wall);
        }
        buildings.push({ x, y, w, h, height, roof, wall, district, tall: district === DISTRICT_DOWNTOWN });
      }
      if (district !== DISTRICT_WORKS && rng.chance(0.5)) {
        trees.push({ x: bx0 + rng.float(10, 30), y: by0 + rng.float(10, 30), r: rng.float(9, 14) });
      }
    }
  }

  // Harbor piers jut into the basin, and the beach gets umbrellas.
  for (let i = 0; i < 3; i += 1) {
    piers.push({ x: WORLD.harborX - 40, y: 900 + i * 480, w: 120, h: 40 });
  }
  for (let i = 0; i < 14; i += 1) {
    umbrellas.push({
      x: rng.float(300, WORLD.size - 300),
      y: rng.float(WORLD.beachTop + 18, WORLD.seaTop - 26),
      color: rng.pick([0xe86a6a, 0xf2c94c, 0x4fa3a5, 0xc96bb0, 0xe87e2e]),
    });
  }
  // Lamp posts along every second road, on both sidewalks, clear of the
  // third-person camera's line of sight down the road centre. They stand
  // mid-block (v + 240), never at an intersection where the cross road
  // would put one right in the middle of the traffic.
  for (const c of centers) {
    for (let v = 240; v < WORLD.size; v += 480) {
      const mid = v + 240;
      if (mid > 4700) continue;
      lamps.push({ x: c + WORLD.roadWidth / 2 + 20, y: mid });
      lamps.push({ x: mid, y: c - WORLD.roadWidth / 2 - 20 });
    }
  }

  // Named places the missions and the HUD point at.
  const places = {
    garage: { x: 1200, y: 3120, label: 'Sunset Garage' },
    marina: { x: 4080, y: 1560, label: 'Costa Marina' },
    beachBar: { x: 2400, y: 4060, label: 'Palma Beach Bar' },
    harbor: { x: 4020, y: 1200, label: 'Harbor Docks' },
    safehouse: { x: 720, y: 720, label: 'Venn Safehouse' },
    arms: { x: 3120, y: 1680, label: 'Solmar Arms' },
    hospital: { x: 1680, y: 3600, label: 'Solmar General' },
    policeStation: { x: 3360, y: 3120, label: 'SPPD Central' },
    compound: { x: 3840, y: 3360, label: 'Castellan Compound' },
    tower: { x: 2400, y: 2400, label: 'Solmar Tower' },
  };

  function buildingAt(x, y) {
    for (const b of buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle out of any building it overlaps; returns true on a hit.
  function collideCircle(circle) {
    let hit = false;
    for (const b of buildings) {
      if (circle.x + circle.r > b.x && circle.x - circle.r < b.x + b.w &&
          circle.y + circle.r > b.y && circle.y - circle.r < b.y + b.h) {
        const pushLeft = (circle.x + circle.r) - b.x;
        const pushRight = (b.x + b.w) - (circle.x - circle.r);
        const pushUp = (circle.y + circle.r) - b.y;
        const pushDown = (b.y + b.h) - (circle.y - circle.r);
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) circle.x = b.x - circle.r;
        else if (m === pushRight) circle.x = b.x + b.w + circle.r;
        else if (m === pushUp) circle.y = b.y - circle.r;
        else circle.y = b.y + b.h + circle.r;
        hit = true;
      }
    }
    return hit;
  }

  function randomRoadPoint() {
    const horizontal = rng.chance(0.5);
    const c = rng.pick(centers);
    const along = rng.float(200, WORLD.size - 200);
    if (horizontal) return { x: along, y: c };
    return { x: c, y: along };
  }

  function randomSidewalkPoint() {
    const p = randomRoadPoint();
    const off = (WORLD.roadWidth / 2 + WORLD.sidewalk / 2) * rng.sign();
    if (rng.chance(0.5)) p.x = clamp(p.x + off, 60, WORLD.size - 60);
    else p.y = clamp(p.y + off, 60, WORLD.size - 60);
    return p;
  }

  function randomParkedSpot() {
    for (let tries = 0; tries < 24; tries += 1) {
      const p = randomRoadPoint();
      const along = rng.chance(0.5) ? 'x' : 'y';
      const lane = (WORLD.roadWidth / 2 - 14) * rng.sign();
      const x = along === 'x' ? p.x : p.x + lane;
      const y = along === 'x' ? p.y + lane : p.y;
      if (y >= WORLD.seaTop - 40 || x >= WORLD.harborX - 40) continue;
      if (!buildingAt(x, y)) return { x, y, angle: along === 'x' ? 0 : Math.PI / 2 };
    }
    return { x: 1200, y: 240, angle: 0 };
  }

  function isInWater(x, y) {
    if (y >= WORLD.seaTop) return true;
    return x >= WORLD.harborX && y >= WORLD.harborTop && y <= WORLD.harborBottom;
  }

  return {
    seed, buildings, trees, parks, piers, places, centers, lamps, umbrellas,
    buildingAt, collideCircle, randomRoadPoint, randomSidewalkPoint, randomParkedSpot, isInWater,
  };
}
