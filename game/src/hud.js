// The HUD: the DOM bar (health, money, wanted stars, ammo, speed,
// objective, toasts) and the minimap canvas (roads, sea, the player, the
// police, the mission marker). DOM text is only rewritten when it changes,
// so a frame allocates nothing.

import { WORLD, PALETTE } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    money: el('money'),
    stars: el('stars'),
    ammo: el('ammo'),
    speed: el('speed'),
    objective: el('objective-text'),
    toast: el('toast'),
    dialogue: el('dialogue'),
    minimap: el('minimap'),
    toastTimer: 0,
    dialogueTimer: 0,
    last: {},
  };
  hud.mapCtx = hud.minimap.getContext('2d');
  return hud;
}

function setText(node, key, value, cache) {
  if (cache[key] !== value) {
    cache[key] = value;
    node.textContent = value;
  }
}

export function showToast(hud, message, seconds) {
  hud.toast.textContent = message;
  hud.toast.classList.add('show');
  hud.toastTimer = seconds || 3;
}

export function showDialogue(hud, line, seconds) {
  hud.dialogue.textContent = line;
  hud.dialogue.classList.add('show');
  hud.dialogueTimer = seconds || 4.5;
}

export function updateHud(hud, dt, game) {
  if (hud.toastTimer > 0) {
    hud.toastTimer -= dt;
    if (hud.toastTimer <= 0) hud.toast.classList.remove('show');
  }
  if (hud.dialogueTimer > 0) {
    hud.dialogueTimer -= dt;
    if (hud.dialogueTimer <= 0) hud.dialogue.classList.remove('show');
  }
  const health = Math.max(0, Math.round(game.player.health));
  hud.healthFill.style.width = `${health}%`;
  hud.healthFill.style.background = health > 50 ? '#7ee081' : health > 25 ? '#ffb340' : '#ff5a4e';
  setText(hud.healthText, 'health', String(health), hud.last);
  setText(hud.money, 'money', `$${game.player.money}`, hud.last);
  const stars = '★'.repeat(game.police.stars) + '☆'.repeat(5 - game.police.stars);
  setText(hud.stars, 'stars', stars, hud.last);
  hud.stars.classList.toggle('hot', game.police.stars > 0);
  const ammo = game.player.hasPistol ? `Ammo ${game.player.ammo}` : 'No gun — Fists';
  setText(hud.ammo, 'ammo', ammo, hud.last);
  // Speed as a big number with a small km/h, instead of one flat string.
  const speedNum = game.playerCar ? String(Math.round(Math.abs(game.playerCar.speed) * 0.36)) : '';
  if (hud.last.speed !== speedNum) {
    hud.last.speed = speedNum;
    hud.speed.innerHTML = speedNum ? `${speedNum} <small>km/h</small>` : '';
    hud.speed.style.display = speedNum ? '' : 'none';
  }
  setText(hud.objective, 'objective', game.objectiveText, hud.last);
}

export function drawMinimap(hud, game) {
  const ctx = hud.mapCtx;
  const w = hud.minimap.width;
  const h = hud.minimap.height;
  const scale = w / WORLD.size;
  ctx.clearRect(0, 0, w, h);
  // Sea and sand: bright cyan water so it never reads as land.
  ctx.fillStyle = PALETTE.seaBright;
  ctx.fillRect(0, WORLD.seaTop * scale, w, h - WORLD.seaTop * scale);
  ctx.fillStyle = '#eed9a0';
  ctx.fillRect(0, WORLD.beachTop * scale, w, (WORLD.seaTop - WORLD.beachTop) * scale);
  // Harbor basin.
  ctx.fillStyle = PALETTE.seaBright;
  ctx.fillRect(WORLD.harborX * scale, WORLD.harborTop * scale, w - WORLD.harborX * scale, (WORLD.harborBottom - WORLD.harborTop) * scale);
  // Land.
  ctx.fillStyle = '#8a7a5d';
  ctx.fillRect(0, 0, w, WORLD.beachTop * scale);
  // Roads.
  ctx.strokeStyle = '#3b4048';
  ctx.lineWidth = 3;
  for (const c of game.city.centers) {
    ctx.beginPath(); ctx.moveTo(c * scale, 0); ctx.lineTo(c * scale, WORLD.beachTop * scale); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, c * scale); ctx.lineTo(w, c * scale); ctx.stroke();
  }
  // Downtown blocks.
  ctx.fillStyle = '#5d6b7d';
  ctx.fillRect(1780 * scale, 1780 * scale, 1240 * scale, 1240 * scale);
  // Mission marker: a pulsing yellow diamond.
  const marker = game.marker;
  if (marker) {
    const pulse = 5 + Math.sin(game.time * 5) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(marker.x * scale, marker.y * scale - pulse - 4);
    ctx.lineTo(marker.x * scale + pulse + 4, marker.y * scale);
    ctx.lineTo(marker.x * scale, marker.y * scale + pulse + 4);
    ctx.lineTo(marker.x * scale - pulse - 4, marker.y * scale);
    ctx.closePath();
    ctx.fill();
  }
  // Traffic as grey dots, police as red dots.
  ctx.fillStyle = '#c9c9c9';
  for (const car of game.traffic.cars) {
    ctx.fillRect(car.x * scale - 1, car.y * scale - 1, 2, 2);
  }
  ctx.fillStyle = '#ff3b30';
  for (const car of game.police.cars) {
    ctx.beginPath(); ctx.arc(car.x * scale, car.y * scale, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const cop of game.police.cops) {
    ctx.fillRect(cop.x * scale - 1, cop.y * scale - 1, 2, 2);
  }
  // The player: a larger white arrow with an outline, so it never
  // gets lost among the traffic dots.
  const px = (game.playerCar ? game.playerCar.x : game.player.x) * scale;
  const py = (game.playerCar ? game.playerCar.y : game.player.y) * scale;
  const angle = game.playerCar ? game.playerCar.angle : game.player.angle;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#14181f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  // Viewport frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
