// The HUD: DOM panels for health, money, wanted stars, ammo and speed, an
// objective line, toast and dialogue banners, and a 2D canvas minimap drawn
// top-down from the same city data the 3D world uses.

import { WORLD } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthText = el('health-text');
  const healthFill = el('health-fill');
  const moneyEl = el('money');
  const starsEl = el('stars');
  const ammoEl = el('ammo');
  const speedEl = el('speed');
  const objectiveEl = el('objective-text');
  const toastEl = el('toast');
  const dialogueEl = el('dialogue');
  const statusEl = el('status');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  let toastTimer = 0;
  let dialogueTimer = 0;

  function showToast(text, seconds = 4) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    toastTimer = seconds;
  }

  function showDialogue(text) {
    dialogueEl.textContent = text;
    dialogueEl.classList.add('show');
    dialogueTimer = 4.5;
  }

  function update(dt, game) {
    const p = game.sim.player;
    healthText.textContent = Math.ceil(p.health);
    healthFill.style.width = `${Math.max(0, p.health)}%`;
    healthFill.style.background = p.health > 50 ? '#7ee081' : p.health > 25 ? '#ffb340' : '#ff5a4e';
    moneyEl.textContent = `$${p.money}`;
    const stars = game.sim.police.stars;
    starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
    starsEl.classList.toggle('hot', stars >= 3);
    ammoEl.textContent = p.hasPistol ? `Pistol — ${p.ammo} ammo` : 'No gun — Fists';
    if (game.sim.playerCar) {
      const kmh = Math.round(Math.abs(game.sim.playerCar.speed) * 0.36);
      speedEl.style.display = 'block';
      speedEl.innerHTML = `${kmh} <small>km/h · ${game.sim.playerCar.def.name}</small>`;
    } else {
      speedEl.style.display = 'none';
      speedEl.innerHTML = '';
    }
    objectiveEl.textContent = game.objectiveText;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.remove('show');
    }
    if (dialogueTimer > 0) {
      dialogueTimer -= dt;
      if (dialogueTimer <= 0) dialogueEl.classList.remove('show');
    }
    drawMinimap(game);
  }

  function drawMinimap(game) {
    const w = minimap.width;
    const h = minimap.height;
    const s = w / WORLD.size;
    const city = game.city;
    mapCtx.fillStyle = '#8a7a5d';
    mapCtx.fillRect(0, 0, w, h);
    mapCtx.fillStyle = '#2b93bd';
    mapCtx.fillRect(0, WORLD.seaTop * s, w, h - WORLD.seaTop * s);
    mapCtx.fillRect(WORLD.harborX * s, WORLD.harborTop * s, w - WORLD.harborX * s, (WORLD.harborBottom - WORLD.harborTop) * s);
    mapCtx.fillStyle = '#eed9a0';
    mapCtx.fillRect(0, WORLD.beachTop * s, w, (WORLD.seaTop - WORLD.beachTop) * s);
    mapCtx.fillStyle = '#3b4048';
    for (const c of city.centers) {
      mapCtx.fillRect(0, (c - WORLD.roadWidth / 2) * s, w, WORLD.roadWidth * s);
      mapCtx.fillRect((c - WORLD.roadWidth / 2) * s, 0, WORLD.roadWidth * s, h);
    }
    mapCtx.fillStyle = '#5d6b7d';
    for (const b of city.buildings) {
      mapCtx.fillRect(b.x * s, b.y * s, Math.max(1.5, b.w * s), Math.max(1.5, b.h * s));
    }
    const sim = game.sim;
    const marker = game.marker;
    if (marker) {
      mapCtx.fillStyle = '#ffc93e';
      mapCtx.beginPath();
      mapCtx.arc(marker.x * s, marker.y * s, 5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffc93e';
      mapCtx.beginPath();
      mapCtx.arc(marker.x * s, marker.y * s, 8 + Math.sin(game.time * 4) * 2, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    mapCtx.fillStyle = '#2f6fd6';
    for (const c of sim.police.cars) {
      mapCtx.fillRect(c.x * s - 2, c.y * s - 2, 4, 4);
    }
    mapCtx.fillStyle = '#ffffff';
    const px = sim.playerCar ? sim.playerCar.x : sim.player.x;
    const py = sim.playerCar ? sim.playerCar.y : sim.player.y;
    mapCtx.beginPath();
    mapCtx.arc(px * s, py * s, 4, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.strokeStyle = '#14202e';
    mapCtx.stroke();
  }

  return {
    update,
    showToast,
    showDialogue,
    setStatus(text) { statusEl.textContent = text; },
  };
}
