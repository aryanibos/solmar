// Drawing the city itself: ground, sea and sand, roads with lane dashes,
// parks and trees, harbor piers, and buildings with sun shadows and
// windows. Everything outside the camera's view is skipped, so a frame
// only paints what the player can see.

import { WORLD, PALETTE } from './config.js';

export function createCamera() {
  return { x: 2400, y: 2400, zoom: 1 };
}

export function cameraView(camera, width, height) {
  const w = width / camera.zoom;
  const h = height / camera.zoom;
  return { x: camera.x - w / 2, y: camera.y - h / 2, w, h };
}

export function drawWorld(ctx, city, camera, view) {
  const { x: vx, y: vy, w: vw, h: vh } = view;
  // Land base.
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(vx, vy, vw, vh);
  // District ground tints: the works yards read darker, the homes
  // blocks read greener, so the city is not one flat tan.
  ctx.fillStyle = 'rgba(90, 70, 40, 0.14)';
  ctx.fillRect(Math.max(vx, 3400), Math.max(vy, 0), Math.min(vx + vw, WORLD.size) - Math.max(vx, 3400), Math.max(0, Math.min(vy + vh, 1400) - Math.max(vy, 0)));
  ctx.fillStyle = 'rgba(90, 120, 60, 0.10)';
  ctx.fillRect(Math.max(vx, 0), Math.max(vy, 0), Math.min(vx + vw, 1400) - Math.max(vx, 0), Math.max(0, Math.min(vy + vh, 1400) - Math.max(vy, 0)));
  // Sea and beach to the south.
  ctx.fillStyle = PALETTE.seaDeep;
  ctx.fillRect(Math.max(vx, 0), Math.max(vy, WORLD.seaTop), Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), Math.max(0, vy + vh - WORLD.seaTop));
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(Math.max(vx, 0), Math.max(vy, WORLD.beachTop), Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), Math.max(0, Math.min(vy + vh, WORLD.seaTop) - Math.max(vy, WORLD.beachTop)));
  // Sea waves: a few light strokes along the shore.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const wy = WORLD.seaTop + 12 + i * 26;
    if (wy < vy || wy > vy + vh) continue;
    ctx.beginPath();
    for (let wx = Math.max(vx, 0); wx < Math.min(vx + vw, WORLD.size); wx += 60) {
      const wave = Math.sin(wx * 0.01 + i * 2) * 4;
      if (wx === Math.max(vx, 0)) ctx.moveTo(wx, wy + wave);
      else ctx.lineTo(wx, wy + wave);
    }
    ctx.stroke();
  }
  // Harbor basin to the east.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(Math.max(vx, WORLD.harborX), Math.max(vy, WORLD.harborTop), Math.min(vx + vw, WORLD.size) - Math.max(vx, WORLD.harborX), Math.max(0, Math.min(vy + vh, WORLD.harborBottom) - Math.max(vy, WORLD.harborTop)));

  // Parks.
  for (const park of city.parks) {
    if (park.x > vx + vw || park.x + park.w < vx || park.y > vy + vh || park.y + park.h < vy) continue;
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Roads: asphalt bands, then lane dashes, then sidewalks at the edges.
  for (const c of city.centers) {
    if (c + WORLD.roadWidth / 2 > vx && c - WORLD.roadWidth / 2 < vx + vw) {
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(c - WORLD.roadWidth / 2, Math.max(vy, 0), WORLD.roadWidth, Math.min(vy + vh, WORLD.beachTop) - Math.max(vy, 0));
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(c - WORLD.roadWidth / 2 - WORLD.sidewalk, Math.max(vy, 0), WORLD.sidewalk, Math.min(vy + vh, WORLD.beachTop) - Math.max(vy, 0));
      ctx.fillRect(c + WORLD.roadWidth / 2, Math.max(vy, 0), WORLD.sidewalk, Math.min(vy + vh, WORLD.beachTop) - Math.max(vy, 0));
    }
    if (c + WORLD.roadWidth / 2 > vy && c - WORLD.roadWidth / 2 < vy + vh) {
      ctx.fillStyle = PALETTE.asphalt;
      ctx.fillRect(Math.max(vx, 0), c - WORLD.roadWidth / 2, Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), WORLD.roadWidth);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(Math.max(vx, 0), c - WORLD.roadWidth / 2 - WORLD.sidewalk, Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), WORLD.sidewalk);
      ctx.fillRect(Math.max(vx, 0), c + WORLD.roadWidth / 2, Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), WORLD.sidewalk);
    }
  }
  // Lane dashes.
  ctx.fillStyle = PALETTE.lane;
  for (const c of city.centers) {
    for (let d = 0; d < WORLD.size; d += 64) {
      if (c > vx - 40 && c < vx + vw + 40 && d > vy - 40 && d < vy + vh + 40 && d < WORLD.beachTop) {
        ctx.fillRect(c - 2, d, 4, 30);
      }
      if (c > vy - 40 && c < vy + vh + 40 && d > vx - 40 && d < vx + vw + 40 && c < WORLD.beachTop) {
        ctx.fillRect(d, c - 2, 30, 4);
      }
    }
  }
  // Faint white edge lines where the sidewalk meets the road.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (const c of city.centers) {
    if (c + WORLD.roadWidth / 2 > vx && c - WORLD.roadWidth / 2 < vx + vw) {
      ctx.fillRect(c - WORLD.roadWidth / 2 - 1, Math.max(vy, 0), 2, Math.min(vy + vh, WORLD.beachTop) - Math.max(vy, 0));
      ctx.fillRect(c + WORLD.roadWidth / 2 - 1, Math.max(vy, 0), 2, Math.min(vy + vh, WORLD.beachTop) - Math.max(vy, 0));
    }
    if (c + WORLD.roadWidth / 2 > vy && c - WORLD.roadWidth / 2 < vy + vh) {
      ctx.fillRect(Math.max(vx, 0), c - WORLD.roadWidth / 2 - 1, Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), 2);
      ctx.fillRect(Math.max(vx, 0), c + WORLD.roadWidth / 2 - 1, Math.min(vx + vw, WORLD.size) - Math.max(vx, 0), 2);
    }
  }
  // Crosswalk zebra stripes on every approach to an intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const cx of city.centers) {
    for (const cy of city.centers) {
      if (cx < vx - 60 || cx > vx + vw + 60 || cy < vy - 60 || cy > vy + vh + 60 || cy >= WORLD.beachTop) continue;
      const half = WORLD.roadWidth / 2;
      for (let x = cx - half + 6; x < cx + half - 4; x += 13) {
        ctx.fillRect(x, cy - half - 16, 6, 12);
        ctx.fillRect(x, cy + half + 4, 6, 12);
      }
      for (let y = cy - half + 6; y < cy + half - 4; y += 13) {
        ctx.fillRect(cx - half - 16, y, 12, 6);
        ctx.fillRect(cx + half + 4, y, 12, 6);
      }
    }
  }
  // Piers and moored boats.
  for (const pier of city.piers) {
    if (pier.x > vx + vw || pier.x + pier.w < vx || pier.y > vy + vh || pier.y + pier.h < vy) continue;
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(pier.x + pier.w - 60, pier.y - 14, 44, 12);
    ctx.fillStyle = '#3e7bd6';
    ctx.fillRect(pier.x + pier.w - 52, pier.y - 10, 28, 5);
  }
  // Beach gear on the sand: umbrellas, towels, a lifeguard tower, boats.
  for (const bp of city.beachProps) {
    if (bp.x < vx - 30 || bp.x > vx + vw + 30 || bp.y < vy - 30 || bp.y > vy + vh + 30) continue;
    if (bp.kind === 'umbrella') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(bp.x + 3, bp.y + 4, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bp.color;
      ctx.beginPath(); ctx.arc(bp.x, bp.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f5efe0';
      ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(bp.x - 13, bp.y); ctx.arc(bp.x, bp.y, 13, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.lineTo(bp.x + 13, bp.y); ctx.arc(bp.x, bp.y, 13, 0, Math.PI * 0.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(bp.x - 1, bp.y, 2, 12);
    } else if (bp.kind === 'towel') {
      ctx.fillStyle = bp.color;
      ctx.fillRect(bp.x - 11, bp.y - 6, 22, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(bp.x - 11, bp.y - 2, 22, 3);
    } else if (bp.kind === 'tower') {
      ctx.fillStyle = '#8a6a4a';
      ctx.fillRect(bp.x - 2, bp.y, 3, 16);
      ctx.fillRect(bp.x + 8, bp.y, 3, 16);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(bp.x - 9, bp.y - 12, 28, 12);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(bp.x - 9, bp.y - 12, 28, 4);
    } else {
      ctx.fillStyle = '#7a5a3a';
      ctx.beginPath(); ctx.ellipse(bp.x, bp.y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = bp.color;
      ctx.beginPath(); ctx.ellipse(bp.x, bp.y - 2, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Buildings: sun shadow, roof, dark outline, facade pattern, awning.
  for (const b of city.buildings) {
    if (b.x > vx + vw || b.x + b.w < vx || b.y > vy + vh || b.y + b.h < vy) continue;
    const sh = b.height * 0.5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(b.x + sh * 0.6, b.y + sh * 0.8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Dark outline so roofs stop bleeding into the ground.
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // A shaded south and east edge, away from the sun.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    ctx.fillRect(b.x + b.w - 8, b.y, 8, b.h);
    // Facade: dotted windows, solid roof, or horizontal floor stripes.
    if (b.facade === 'stripes') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let wy = b.y + 14; wy < b.y + b.h - 8; wy += 20) {
        ctx.fillRect(b.x + 8, wy, b.w - 16, 6);
      }
    } else if (b.facade === 'dots') {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      const stepX = 26;
      const stepY = 24;
      for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += stepX) {
        for (let wy = b.y + 12; wy < b.y + b.h - 10; wy += stepY) {
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
    } else {
      // Solid roof: a doorway at the street edge instead of windows.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 7, b.y + b.h - 16, 14, 16);
    }
    // Shop awning along the ground floor, striped for a storefront read.
    if (b.awning) {
      ctx.fillStyle = '#b3563a';
      ctx.fillRect(b.x + 4, b.y + b.h - 14, b.w - 8, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let ax = b.x + 10; ax < b.x + b.w - 8; ax += 14) {
        ctx.fillRect(ax, b.y + b.h - 14, 5, 12);
      }
    }
    if (b.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }
  // Trees.
  for (const t of city.trees) {
    if (t.x < vx - 20 || t.x > vx + vw + 20 || t.y < vy - 20 || t.y > vy + vh + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Street props: lamps glow at intersections, bins and hydrants on the kerb.
  for (const prop of city.props) {
    if (prop.x < vx - 20 || prop.x > vx + vw + 20 || prop.y < vy - 20 || prop.y > vy + vh + 20) continue;
    if (prop.kind === 'lamp') {
      ctx.fillStyle = '#3a3f47';
      ctx.fillRect(prop.x - 1, prop.y - 16, 2, 16);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(prop.x, prop.y - 17, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,233,168,0.18)';
      ctx.beginPath(); ctx.arc(prop.x, prop.y - 17, 9, 0, Math.PI * 2); ctx.fill();
    } else if (prop.kind === 'bin') {
      ctx.fillStyle = '#4a4f57';
      ctx.fillRect(prop.x - 4, prop.y - 5, 8, 10);
      ctx.fillStyle = '#5d636d';
      ctx.fillRect(prop.x - 4, prop.y - 5, 8, 3);
    } else {
      ctx.fillStyle = '#c23b2e';
      ctx.fillRect(prop.x - 3, prop.y - 4, 6, 8);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(prop.x - 4, prop.y - 6, 8, 3);
    }
  }
}

export function drawMissionMarker(ctx, marker, time, view) {
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 5) * 0.12;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  ctx.scale(pulse, pulse);
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // A beam of light so the marker reads from far away.
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.sin(time * 5) * 0.05;
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(marker.x - 3, marker.y - 260, 6, 260);
  ctx.restore();
}

export function drawEdgeArrow(ctx, marker, view, width, height) {
  if (!marker) return;
  const { x: vx, y: vy, w: vw, h: vh } = view;
  if (marker.x > vx && marker.x < vx + vw && marker.y > vy && marker.y < vy + vh) return;
  const cx = vx + vw / 2;
  const cy = vy + vh / 2;
  const angle = Math.atan2(marker.y - cy, marker.x - cx);
  const ax = cx + Math.cos(angle) * (vw / 2 - 70);
  const ay = cy + Math.sin(angle) * (vh / 2 - 70);
  const distM = Math.round(Math.hypot(marker.x - cx, marker.y - cy));
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${distM}m`, ax, ay + 30);
}
