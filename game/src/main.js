// Boot and the one loop: Solmar. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, busted, wasted. ?shot=cover|drive|foot|
// mission (with &seed=N) stages that scene instead of running the loop,
// paints it twice and sets window.__shotReady for a screenshot.

import { STEP, WORLD, PALETTE, CAR_DEFS, PRICES, PLAYER } from './config.js';
import { makeRandom, clamp, dist } from './random.js';
import { createCity, nearestRoadCenter } from './city.js';
import { makeCar, updateCar, drawCar, collideCarPair } from './cars.js';
import { makePedestrian, updatePedestrians, drawPedestrian } from './people.js';
import { createTraffic, updateTraffic, drawTraffic } from './traffic.js';
import { createPolice, addHeat, clearWanted, updatePolice, drawPolice } from './police.js';
import { createCombat, fireBullet, updateCombat, drawCombat, spawnPickup, meleeHit } from './combat.js';
import { createMissions, startMission, updateMissions, missionMarker, missionObjective, startSideJob, registerKill } from './missions.js';
import { createAudio, ensureAudio, setEngine, setSiren, setMuted, playGunshot, playPunch, playPickup, playCrash, playJingle, playClick, playBusted, startMusic, stopMusic } from './audio.js';
import { createEffects, spawnParticles, spawnSmoke, spawnExplosion, addSkid, addText, updateEffects, drawSkids, drawParticles } from './effects.js';
import { createHud, updateHud, drawMinimap, showToast, showDialogue } from './hud.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_MUTE } from './input.js';
import { createPlayer, updatePlayerOnFoot, nearestCar, exitCarSpot, drawPlayer } from './player.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { createCamera, cameraView, drawWorld, drawMissionMarker, drawEdgeArrow } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAVE_HINT = 'Progress saved.';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function createGame(seedValue) {
  const rng = makeRandom(seedValue);
  const city = createCity(seedValue);
  const player = createPlayer(city, rng);
  const game = {
    seed: seedValue, rng, city, player,
    playerCar: null,
    parked: [],
    traffic: createTraffic(city, rng, 14),
    pedestrians: [],
    police: createPolice(),
    combat: createCombat(),
    missions: createMissions(city),
    fx: createEffects(),
    camera: createCamera(),
    audio: createAudio(),
    hud: null, input: null,
    screen: 'title',
    time: 0,
    objectiveText: '',
    marker: null,
    missionsDone: 0,
    pendingMission: -1,
    pendingTimer: 0,
    garageCooldown: 0,
    danger: null,
    shotMode: false,
    endKind: '',
    muted: false,
  };
  // Mara's sedan, the player's own car, parked on the road by the safehouse
  // (not inside the block, where the first drive would brush a building).
  const ownSpot = { x: 900, y: nearestRoadCenter(player.y) };
  const ownCar = makeCar(CAR_DEFS.sedan, '#2e7d6b', ownSpot.x, ownSpot.y, 0);
  ownCar.isOwn = true;
  ownCar.isParked = true;
  game.parked.push(ownCar);
  // A cab at the garage for taxi fares.
  const cab = makeCar(CAR_DEFS.taxi, PALETTE.taxi, city.places.garage.x + 60, city.places.garage.y - 60, Math.PI / 2);
  cab.isTaxi = true;
  cab.isParked = true;
  game.parked.push(cab);
  // Parked cars scattered through the city, free for the taking.
  for (let i = 0; i < 10; i += 1) {
    const spot = city.randomParkedSpot();
    const defKey = rng.pick(['sedan', 'coupe', 'sedan', 'van', 'sport']);
    const car = makeCar(CAR_DEFS[defKey], rng.pick(PALETTE.carColors), spot.x, spot.y, spot.angle);
    car.isParked = true;
    game.parked.push(car);
  }
  for (let i = 0; i < 34; i += 1) game.pedestrians.push(makePedestrian(city, rng));
  spawnPickup(game.combat, 'ammo', city.places.arms.x + 40, city.places.arms.y + 30);
  spawnPickup(game.combat, 'health', city.places.hospital.x - 60, city.places.hospital.y + 40);
  spawnPickup(game.combat, 'ammo', city.places.beachBar.x - 80, city.places.beachBar.y - 20);
  game.camera.x = player.x;
  game.camera.y = player.y;
  game.step = (dt, input) => stepGame(game, dt, input);
  return game;
}

function allCars(game) {
  const list = game.parked.slice();
  if (game.playerCar) list.push(game.playerCar);
  return list;
}

function stepGame(game, dt, input) {
  game.time += dt;
  const player = game.player;
  const city = game.city;

  // Aim: the mouse in world space, or the direction of travel on foot.
  if (input.mouseWorld) {
    player.aimAngle = Math.atan2(input.mouseWorld.y - player.y, input.mouseWorld.x - player.x);
  } else if (player.speed > 10) {
    player.aimAngle = player.angle;
  }

  if (game.playerCar) {
    const car = game.playerCar;
    const drive = {
      throttle: (input.up ? 1 : 0) - (input.down ? 1 : 0),
      steer: (input.right ? 1 : 0) - (input.left ? 1 : 0),
      handbrake: !!input.handbrake,
    };
    const hitWall = updateCar(car, drive, dt, city);
    if (hitWall && Math.abs(car.speed) > 200) {
      playCrash(game.audio);
      spawnParticles(game.fx, car.x, car.y, '#c9c9c9', 10, 160, 0.4, 5);
    }
    if (car.drift > 0.5) addSkid(game.fx, car.x, car.y, car.angle, 26);
    // Collide with traffic and parked cars.
    for (const other of game.traffic.cars) {
      if (collideCarPair(car, other)) {
        playCrash(game.audio);
        spawnParticles(game.fx, (car.x + other.x) / 2, (car.y + other.y) / 2, '#ffd23e', 6, 120, 0.3, 4);
      }
    }
    for (const other of game.parked) {
      if (collideCarPair(car, other)) playCrash(game.audio);
    }
    // Smoke when badly damaged; a wrecked car explodes and throws the player out.
    if (car.damage > 55) {
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.12;
        spawnSmoke(game.fx, car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14);
      }
    }
    if (car.damage >= 100) {
      spawnExplosion(game.fx, car.x, car.y);
      playCrash(game.audio);
      addText(game.fx, car.x, car.y - 30, 'WRECKED!', '#ff5a4e');
      exitCarSpot(player, car, city);
      player.health -= 15;
      game.playerCar = null;
    }
    setEngine(game.audio, Math.abs(car.speed) / car.def.topSpeed, true);
    game.camera.x += (car.x - game.camera.x) * Math.min(1, dt * 4);
    game.camera.y += (car.y - game.camera.y) * Math.min(1, dt * 4);
  } else {
    updatePlayerOnFoot(player, input, dt, city);
    // Shooting and punching with the mouse.
    if (input.mouseDown) {
      if (player.hasPistol && player.ammo > 0 && player.shootCooldown <= 0) {
        player.shootCooldown = 0.28;
        player.ammo -= 1;
        fireBullet(game.combat, player.x, player.y, player.aimAngle, true);
        playGunshot(game.audio);
        game.danger = { x: player.x, y: player.y, radius: 500 };
        spawnParticles(game.fx, player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, '#ffe9a8', 3, 120, 0.12, 3);
      } else if (!player.hasPistol && player.punchTimer <= 0) {
        player.punchTimer = 0.35;
        playPunch(game.audio);
        const hits = meleeHit(player.x, player.y, player.aimAngle, 34, PLAYER.punchDamage, game.combat.enemies);
        if (hits > 0) spawnParticles(game.fx, player.x + Math.cos(player.aimAngle) * 26, player.y + Math.sin(player.aimAngle) * 26, '#ffffff', 5, 140, 0.25, 4);
      }
    }
    setEngine(game.audio, 0, false);
    game.camera.x += (player.x - game.camera.x) * Math.min(1, dt * 5);
    game.camera.y += (player.y - game.camera.y) * Math.min(1, dt * 5);
  }

  // A fast car through a crowd sends pedestrians running.
  if (game.playerCar && Math.abs(game.playerCar.speed) > 180) {
    game.danger = { x: game.playerCar.x, y: game.playerCar.y, radius: 220 };
  }
  updateTraffic(game.traffic, dt, city, game.rng, game.camera);
  updatePedestrians(game.pedestrians, dt, city, game.danger);
  game.danger = null;

  // Traffic cars can clip the player on foot.
  if (!game.playerCar && player.invulnerable <= 0) {
    for (const car of game.traffic.cars) {
      if (Math.abs(car.speed) > 70 && dist(car.x, car.y, player.x, player.y) < 28) {
        player.health -= 12;
        player.invulnerable = 1;
        player.x += (player.x - car.x) * 0.4;
        player.y += (player.y - car.y) * 0.4;
        spawnParticles(game.fx, player.x, player.y, '#ff5a4e', 8, 160, 0.4, 5);
      }
    }
  }

  const policeEvents = updatePolice(game.police, dt, { city, rng: game.rng, player, playerCar: game.playerCar, fx: game.fx });
  if (policeEvents.rammed) playCrash(game.audio);
  setSiren(game.audio, game.police.stars > 0, game.time);

  const combatEvents = updateCombat(game.combat, dt, city, player, game.fx,
    () => { /* player hit: health already applied */ },
    (enemy) => { registerKill(game.missions); player.money += 20; addText(game.fx, enemy.x, enemy.y - 20, '+$20', '#7ee081'); });

  const missionEvents = updateMissions(game.missions, dt, game);
  if (missionEvents.say) showDialogue(game.hud, missionEvents.say, 4.5);
  if (missionEvents.completed) {
    game.missionsDone += 1;
    playJingle(game.audio);
    showToast(game.hud, `Mission complete: ${missionEvents.completed.title} — earned $${missionEvents.completed.reward}`, 4);
    addText(game.fx, player.x, player.y - 40, `+$${missionEvents.completed.reward}`, '#7ee081');
    saveGame(game);
    if (game.missionsDone < 6) {
      game.pendingMission = game.missionsDone;
      game.pendingTimer = 4;
    }
  }
  if (missionEvents.failed) {
    showToast(game.hud, missionEvents.failed, 4);
    game.pendingMission = game.missionsDone;
    game.pendingTimer = 5;
  }
  if (game.pendingMission >= 0) {
    game.pendingTimer -= dt;
    if (game.pendingTimer <= 0) {
      startMission(game.missions, game.pendingMission);
      game.pendingMission = -1;
    }
  }

  // The garage repairs and clears heat when the car sits still beside it.
  game.garageCooldown -= dt;
  const garage = city.places.garage;
  if (game.playerCar && game.garageCooldown <= 0 && dist(game.playerCar.x, game.playerCar.y, garage.x, garage.y) < 140 && Math.abs(game.playerCar.speed) < 12) {
    if (game.playerCar.damage > 10 && player.money >= PRICES.repair) {
      player.money -= PRICES.repair;
      game.playerCar.damage = 0;
      showToast(game.hud, `Sunset Garage: repaired for $${PRICES.repair}.`, 3);
      game.garageCooldown = 4;
    } else if (game.police.stars > 0 && player.money >= PRICES.clearWanted) {
      player.money -= PRICES.clearWanted;
      clearWanted(game.police);
      showToast(game.hud, `Sunset Garage: new paint, heat gone — $${PRICES.clearWanted}.`, 3);
      game.garageCooldown = 4;
    }
  }

  // A courier parcel waits at the harbor when nothing else is running.
  if (!game.missions.active && !game.missions.sideJob && game.missionsDone > 0) {
    const harbor = city.places.harbor;
    if (!game.playerCar && dist(player.x, player.y, harbor.x, harbor.y) < 100) {
      startSideJob(game.missions, 'courier', game.rng);
      showToast(game.hud, 'Courier run started — deliver the parcel to the marker.', 3);
    }
  }

  updateEffects(game.fx, dt);
  game.marker = missionMarker(game.missions);
  if (!game.shotMode) game.objectiveText = missionEvents.objective || missionObjective(game.missions);
  if (game.hud) {
    updateHud(game.hud, dt, game);
    drawMinimap(game.hud, game);
  }

  if (policeEvents.busted) {
    endRun(game, 'busted');
  } else if (player.health <= 0) {
    endRun(game, 'wasted');
  }
}

function endRun(game, kind) {
  game.endKind = kind;
  game.screen = kind;
  playBusted(game.audio);
  const fine = kind === 'busted' ? PRICES.bustedFine : PRICES.wastedFine;
  game.player.money = Math.max(0, game.player.money - fine);
  clearWanted(game.police);
  game.playerCar = null;
  const spot = kind === 'busted' ? game.city.places.policeStation : game.city.places.hospital;
  game.player.x = spot.x + 60;
  game.player.y = spot.y + 60;
  game.player.health = kind === 'busted' ? 60 : PLAYER.maxHealth;
  game.player.ammo = Math.max(0, game.player.ammo - 12);
  game.camera.x = game.player.x;
  game.camera.y = game.player.y;
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  const line = kind === 'busted'
    ? `The SPPD caught up with you. Fine $${fine} — the heat is off.`
    : `You did not make it. The medics patched you up. Fine $${fine}.`;
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = line;
  document.getElementById('end-screen').classList.add('show');
  statusEl.textContent = `${title}. ${line}`;
}

function resize() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
}

function draw(game) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const zoom = 1;
  const view = cameraView(game.camera, canvas.width, canvas.height);
  ctx.setTransform(zoom, 0, 0, zoom, canvas.width / 2 - game.camera.x * zoom, canvas.height / 2 - game.camera.y * zoom);
  drawWorld(ctx, game.city, game.camera, view);
  drawSkids(ctx, game.fx);
  for (const car of game.parked) drawCar(ctx, car, game.time);
  drawTraffic(ctx, game.traffic);
  drawPolice(ctx, game.police, game.time);
  drawMissionMarker(ctx, game.marker, game.time, view);
  if (game.playerCar) drawCar(ctx, game.playerCar, game.time);
  else drawPlayer(ctx, game.player, game.time);
  for (const p of game.pedestrians) drawPedestrian(ctx, p);
  drawCombat(ctx, game.combat, game.time);
  drawParticles(ctx, game.fx);
  drawEdgeArrow(ctx, game.marker, view, canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Heat vignette: at three stars or more the screen edges pulse red,
  // so a chase feels dangerous before a single word is read. Drawn as
  // nested flat bands (not a smooth gradient) so the screenshot PNG
  // stays small.
  if (game.screen === 'play' && game.police.stars >= 3) {
    const pulse = 0.10 + 0.06 * Math.sin(game.time * Math.PI * 2);
    const bands = 6;
    const bandW = 46;
    for (let i = 0; i < bands; i += 1) {
      const inset = i * bandW;
      const a = pulse * (i + 1) / bands;
      ctx.fillStyle = `rgba(255, 30, 20, ${a})`;
      ctx.fillRect(inset, inset, canvas.width - inset * 2, bandW);
      ctx.fillRect(inset, canvas.height - inset - bandW, canvas.width - inset * 2, bandW);
      ctx.fillRect(inset, inset + bandW, bandW, canvas.height - inset * 2 - bandW * 2);
      ctx.fillRect(canvas.width - inset - bandW, inset + bandW, bandW, canvas.height - inset * 2 - bandW * 2);
    }
  }
}

function liveInput(game) {
  const input = game.input;
  const mouseWorld = {
    x: game.camera.x + (input.mouse.x - canvas.width / 2),
    y: game.camera.y + (input.mouse.y - canvas.height / 2),
  };
  return {
    up: input.up, down: input.down, left: input.left, right: input.right,
    run: input.run, handbrake: input.handbrake, mouseDown: input.mouseDown,
    mouseWorld,
  };
}

function handleActions(game) {
  const actions = game.input.takeActions();
  const player = game.player;
  if (actions & ACTION_MUTE) {
    game.muted = !game.muted;
    setMuted(game.audio, game.muted);
    showToast(game.hud, game.muted ? 'Sound off.' : 'Sound on.', 1.5);
  }
  if (game.screen === 'title') {
    if (actions & ACTION_CONFIRM) startPlay(game, false);
    return;
  }
  if (game.screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) resumePlay(game);
    return;
  }
  if (game.screen === 'busted' || game.screen === 'wasted') {
    if (actions & ACTION_CONFIRM) continueAfterEnd(game);
    return;
  }
  if (game.screen !== 'play') return;
  if (actions & ACTION_PAUSE) {
    game.screen = 'paused';
    document.getElementById('pause-screen').classList.add('show');
    statusEl.textContent = 'Paused.';
    return;
  }
  if (actions & ACTION_ENTER) {
    if (game.playerCar) {
      const car = game.playerCar;
      exitCarSpot(player, car, game.city);
      car.isParked = true;
      game.parked.push(car);
      game.playerCar = null;
      playClick(game.audio);
      return;
    }
    // Enter the nearest car, or buy ammo at Solmar Arms.
    const car = nearestCar(player, allCars(game), 64);
    if (car) {
      if (car.isTraffic) {
        const index = game.traffic.cars.indexOf(car);
        if (index >= 0) game.traffic.cars.splice(index, 1);
        game.pedestrians.push(makePedestrian(game.city, game.rng, car.x + 30, car.y + 30));
      } else {
        const index = game.parked.indexOf(car);
        if (index >= 0) game.parked.splice(index, 1);
      }
      if (!car.isOwn && !car.isMissionCar) addHeat(game.police, 1);
      game.playerCar = car;
      car.isParked = false;
      playClick(game.audio);
      if (car.isTaxi && !game.missions.active && !game.missions.sideJob) {
        startSideJob(game.missions, 'taxi', game.rng);
        showToast(game.hud, 'Taxi fare started — pick up the passenger.', 3);
      }
      if (car.isMissionCar) showToast(game.hud, 'The Sunset GT is yours. Lose the heat.', 3);
      return;
    }
    const arms = game.city.places.arms;
    if (dist(player.x, player.y, arms.x, arms.y) < 120 && player.money >= PRICES.ammoBox) {
      player.money -= PRICES.ammoBox;
      player.ammo += 24;
      player.hasPistol = true;
      playPickup(game.audio);
      showToast(game.hud, `Solmar Arms: 24 rounds for $${PRICES.ammoBox}.`, 2.5);
    }
  }
}

function startPlay(game, fromSave) {
  document.getElementById('title-screen').classList.remove('show');
  ensureAudio(game.audio);
  startMusic(game.audio);
  game.screen = 'play';
  if (fromSave && game.saveData) {
    const d = game.saveData;
    game.player.money = d.money;
    game.missionsDone = d.missionsDone;
    game.player.health = d.health;
    game.player.ammo = d.ammo;
    game.player.hasPistol = d.hasPistol;
    game.player.x = d.x;
    game.player.y = d.y;
    game.camera.x = d.x;
    game.camera.y = d.y;
    game.pendingMission = d.missionsDone < 6 ? d.missionsDone : -1;
    game.pendingTimer = 1.5;
  } else {
    game.pendingMission = 0;
    game.pendingTimer = 1.5;
  }
  statusEl.textContent = 'Playing Solmar.';
}

function resumePlay(game) {
  document.getElementById('pause-screen').classList.remove('show');
  game.screen = 'play';
  statusEl.textContent = 'Playing.';
}

function continueAfterEnd(game) {
  document.getElementById('end-screen').classList.remove('show');
  game.screen = 'play';
  statusEl.textContent = 'Playing.';
}

function attractStep(game, dt) {
  game.time += dt;
  updateTraffic(game.traffic, dt, game.city, game.rng, game.camera);
  updatePedestrians(game.pedestrians, dt, game.city, null);
  updateEffects(game.fx, dt);
  // Slow drift over downtown while the title shows.
  game.camera.x = 2400 + Math.sin(game.time * 0.05) * 500;
  game.camera.y = 2400 + Math.cos(game.time * 0.04) * 400;
}

function runGame() {
  const game = createGame(seed);
  game.input = createInput(canvas);
  game.hud = createHud();
  game.saveData = loadGame();
  resize();
  window.addEventListener('resize', resize);

  // Title screen wiring.
  const titleScreen = document.getElementById('title-screen');
  const continueBtn = document.getElementById('btn-continue');
  if (game.saveData) {
    continueBtn.style.display = '';
    continueBtn.textContent = `Continue — $${game.saveData.money}, ${game.saveData.missionsDone} missions done`;
  }
  document.getElementById('btn-start').addEventListener('click', () => startPlay(game, false));
  continueBtn.addEventListener('click', () => startPlay(game, true));
  document.getElementById('btn-resume').addEventListener('click', () => resumePlay(game));
  document.getElementById('btn-save').addEventListener('click', () => {
    if (saveGame(game)) showToast(game.hud, SAVE_HINT, 2);
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    clearSave();
    window.location.reload();
  });
  document.getElementById('btn-mute').addEventListener('click', () => {
    game.muted = !game.muted;
    setMuted(game.audio, game.muted);
    document.getElementById('btn-mute').textContent = game.muted ? 'Sound: Off' : 'Sound: On';
  });
  document.getElementById('btn-title').addEventListener('click', () => {
    document.getElementById('pause-screen').classList.remove('show');
    titleScreen.classList.add('show');
    game.screen = 'title';
  });
  document.getElementById('btn-end-continue').addEventListener('click', () => continueAfterEnd(game));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') {
      game.screen = 'paused';
      document.getElementById('pause-screen').classList.add('show');
    }
  });
  canvas.addEventListener('pointerdown', () => ensureAudio(game.audio));

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(game);
    if (game.screen === 'title') {
      while (accumulator >= STEP) {
        attractStep(game, STEP);
        accumulator -= STEP;
      }
    } else if (game.screen === 'play') {
      while (accumulator >= STEP) {
        stepGame(game, STEP, liveInput(game));
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    draw(game);
  }
  titleScreen.classList.add('show');
  statusEl.textContent = 'Solmar. Press Enter or click Start to play.';
  requestAnimationFrame(frame);
}

function runShot(name) {
  const game = createGame(seed);
  game.shotMode = true;
  game.input = createInput(canvas);
  game.hud = createHud();
  resize();
  stageShot(name, game);
  updateHud(game.hud, 0, game);
  drawMinimap(game.hud, game);
  let painted = 0;
  function paint() {
    draw(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shotName) runShot(shotName);
else runGame();
