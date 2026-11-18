// Solmar in 3D: wiring, screens, the third-person camera and the game loop.
// Screens: title, play, paused, busted, wasted. In shot mode (?shot=...) the
// game stages a scene, plays it forward, paints it twice and sets
// window.__shotReady for a screenshot.

import * as THREE from 'three';
import { WORLD, STEP, PALETTE, PRICES, PLAYER } from './config.js';
import { makeRandom, clamp, angleLerp, dist2d } from './random.js';
import { createCity } from './city.js';
import { createSim } from './sim.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_MUTE } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createMissions, startMission, updateMissions, missionMarker, missionObjective, startSideJob, registerKill } from './missions.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { buildCity, buildPersonMesh, HALF } from './meshes.js';

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 1);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 40, 320);

const hemi = new THREE.HemisphereLight(0xffd9b0, 0x5a4a6a, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0015;
scene.add(sun);
scene.add(sun.target);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 4000);

const rng = makeRandom(seed);
const city = createCity(seed);
const water = buildCity(scene, city);
const audio = createAudio();
const sim = createSim(scene, city, rng, audio);
const input = createInput(canvas);
const hud = createHud();
const missions = createMissions(city);

const game = {
  sim,
  city,
  rng,
  missions,
  meshes: { buildPersonMesh },
  scene,
  screen: 'title',
  time: 0,
  objectiveText: 'Welcome to Solmar.',
  marker: null,
  missionsDone: 0,
  pendingMission: 0,
  camYaw: 0,
  cameraSnap: false,
  shotMode: Boolean(shotName),
  taxiPed: null,
  sideJobTimer: 25,
};

function focus3(x, y, h = 0) {
  return new THREE.Vector3((x - HALF) * 0.1, h * 0.1, (y - HALF) * 0.1);
}

function updateCamera(dt) {
  const f = sim.focus();
  if (game.screen === 'title') {
    const t = game.time * 0.08;
    camera.position.set(Math.cos(t) * 60, 25, Math.sin(t) * 60);
    camera.lookAt(focus3(2400, 2400, 40));
    return;
  }
  const targetYaw = f.angle;
  if (game.cameraSnap) {
    game.camYaw = targetYaw;
    game.cameraSnap = false;
  } else {
    const rate = f.inCar ? 3.2 : (f.speed > 0.1 ? 2.2 : 0.6);
    game.camYaw = angleLerp(game.camYaw, targetYaw, 1 - Math.exp(-dt * rate));
  }
  const dist = f.inCar ? 16 : 9;
  const height = f.inCar ? 8.5 : 5;
  const fx = Math.cos(game.camYaw);
  const fy = Math.sin(game.camYaw);
  const px = f.x - fx * dist * 10;
  const py = f.y - fy * dist * 10;
  camera.position.set((px - HALF) * 0.1, height, (py - HALF) * 0.1);
  camera.lookAt(focus3(f.x + fx * 30, f.y + fy * 30, 10));
  // The sun and its shadow box follow the player.
  const c3 = focus3(f.x, f.y, 0);
  sun.position.set(c3.x - 14, 19, c3.z - 11);
  sun.target.position.copy(c3);
  water.sea.position.y = 0.35 + Math.sin(game.time * 0.5) * 0.06;
  water.harborWater.position.y = 0.35 + Math.sin(game.time * 0.5 + 1) * 0.06;
}

function aimPoint() {
  const rect = canvas.getBoundingClientRect();
  const nx = (input.mouse.x / rect.width) * 2 - 1;
  const ny = -(input.mouse.y / rect.height) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
  const o = ray.ray.origin;
  const d = ray.ray.direction;
  if (Math.abs(d.y) < 0.0001) return null;
  const t = -o.y / d.y;
  if (t < 0) return null;
  const px = o.x + d.x * t;
  const pz = o.z + d.z * t;
  return { x: px + HALF, y: pz + HALF };
}

function nearestPlace(maxDist) {
  const p = sim.player;
  let best = null;
  let bestD = maxDist;
  for (const [key, place] of Object.entries(city.places)) {
    const d = dist2d(p.x, p.y, place.x, place.y);
    if (d < bestD) {
      best = { key, ...place };
      bestD = d;
    }
  }
  return best;
}

function handleEnter() {
  const p = sim.player;
  // Shops and mission starts happen on foot, near a named place.
  if (!sim.playerCar) {
    const place = nearestPlace(130);
    if (place) {
      if (place.key === 'garage' && !missions.active && game.missionsDone < 6) {
        const def = startMission(missions, game.missionsDone);
        hud.showToast(`Mission: ${def.title}`);
        audio.mission();
        return;
      }
      if (place.key === 'arms') {
        if (p.money >= PRICES.ammoBox) {
          p.money -= PRICES.ammoBox;
          p.ammo += 24;
          p.hasPistol = true;
          hud.showToast('Bought 24 pistol rounds — $60');
          audio.cash();
        } else {
          hud.showToast('Not enough cash for ammo.');
        }
        return;
      }
      if (place.key === 'harbor' && !missions.active && !missions.sideJob) {
        startSideJob(missions, 'courier', rng);
        hud.showToast('Courier run: collect the parcel at the harbor');
        return;
      }
    }
    if (game.taxiPed && dist2d(p.x, p.y, game.taxiPed.x, game.taxiPed.y) < 60) {
      startSideJob(missions, 'taxi', rng);
      missions.sideJob.x = game.taxiPed.x;
      missions.sideJob.y = game.taxiPed.y;
      scene.remove(game.taxiPed.mesh);
      game.taxiPed = null;
      hud.showToast('Taxi fare: pick up the passenger');
      return;
    }
  } else {
    // In a car at the garage: a fresh paint job clears the heat.
    const place = nearestPlace(140);
    if (place && place.key === 'garage') {
      if (sim.police.stars > 0 && p.money >= PRICES.clearWanted) {
        p.money -= PRICES.clearWanted;
        sim.police.stars = 0;
        sim.police.cars = [];
        hud.showToast('New paint job — the heat is off. $200');
        audio.cash();
      } else if (sim.police.stars > 0) {
        hud.showToast('A paint job costs $200 — not enough cash.');
      } else {
        hud.showToast('Garage: the car is already clean.');
      }
      return;
    }
  }
  const res = sim.tryEnterCar();
  if (res && res.entered) {
    audio.click();
    if (res.entered.isMissionCar) hud.showToast('Sunset GT — now lose the heat!');
    else if (res.entered.isTraffic) hud.showToast('Stole a car — the SPPD noticed!');
  }
}

function endRun(kind) {
  const p = sim.player;
  const fine = kind === 'busted' ? PRICES.bustedFine : PRICES.wastedFine;
  p.money = Math.max(0, p.money - fine);
  if (sim.playerCar) {
    scene.remove(sim.playerCar.mesh);
    sim.playerCar = null;
  }
  sim.police.stars = 0;
  for (const c of sim.police.cars) scene.remove(c.mesh);
  sim.police.cars = [];
  const spot = kind === 'busted' ? city.places.policeStation : city.places.hospital;
  p.x = spot.x;
  p.y = spot.y;
  p.health = kind === 'busted' ? 60 : PLAYER.maxHealth;
  game.camYaw = 0;
  game.cameraSnap = true;
  game.screen = kind;
  const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
  const line = kind === 'busted'
    ? `The SPPD caught you and fined you $${fine}. Mara is not impressed.`
    : `The medics patched you up and charged $${fine}. The city is still yours.`;
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = line;
  document.getElementById('end-screen').classList.add('show');
  hud.setStatus(`${title}. ${line}`);
  audio.busted();
  audio.engine(0);
}

function offerTaxi(dt) {
  if (missions.active || missions.sideJob || game.taxiPed) return;
  game.sideJobTimer -= dt;
  if (game.sideJobTimer > 0) return;
  game.sideJobTimer = 45;
  const spot = city.randomSidewalkPoint();
  if (dist2d(spot.x, spot.y, sim.player.x, sim.player.y) > 260) return;
  const mesh = buildPersonMesh(0xf2c230);
  scene.add(mesh);
  mesh.position.copy(focus3(spot.x, spot.y, 0));
  game.taxiPed = { x: spot.x, y: spot.y, mesh };
  hud.showToast('A passenger is waving for a cab nearby');
}

game.step = function (dt, rawInput) {
  game.time += dt;
  const actions = input.takeActions();
  const clicks = input.takeClicks();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.muted);
    document.getElementById('btn-mute').textContent = `Sound: ${audio.muted ? 'Off' : 'On'}`;
  }
  if (game.screen !== 'play') return;
  if (actions & ACTION_PAUSE) {
    game.screen = 'paused';
    document.getElementById('pause-screen').classList.add('show');
    return;
  }
  if (actions & ACTION_ENTER) handleEnter();
  const aim = aimPoint();
  const events = sim.step(dt, rawInput, game.camYaw, aim, clicks);
  if (sim.killsThisStep > 0) {
    for (let i = 0; i < sim.killsThisStep; i += 1) registerKill(missions);
  }
  const missionEvents = updateMissions(missions, dt, sim);
  if (missionEvents.say) hud.showDialogue(missionEvents.say);
  if (missionEvents.completed) {
    game.missionsDone += 1;
    game.pendingMission = game.missionsDone;
    hud.showToast(`Mission complete: ${missionEvents.completed.title} — earned $${missionEvents.completed.reward}`, 5);
    hud.setStatus(`Mission complete: ${missionEvents.completed.title}`);
    audio.mission();
    saveGame(game);
  }
  if (missionEvents.failed) {
    hud.showToast(missionEvents.failed, 5);
    audio.fail();
  }
  if (missionEvents.earned) audio.cash();
  game.marker = missionMarker(missions);
  if (game.taxiPed && !missions.sideJob) {
    game.marker = { x: game.taxiPed.x, y: game.taxiPed.y, label: 'Passenger' };
  }
  if (game.marker) sim.setMarker(game.marker.x, game.marker.y);
  else sim.clearMarker();
  // In shot mode a staged scene keeps its own objective line unless a
  // mission is actually running (its timer is live and worth showing).
  if (!game.shotMode || missions.active || missions.sideJob || missionEvents.completed) {
    // A just-completed mission reads its fresh objective; otherwise the
    // event's live objective (timer, kill count, escape hint) is the one.
    game.objectiveText = missionEvents.completed
      ? missionObjective(missions)
      : (missionEvents.objective || missionObjective(missions));
    if (!missions.active && !missions.sideJob && game.missionsDone < 6) {
      const near = nearestPlace(140);
      if (near && near.key === 'garage') game.objectiveText = 'Press E at the Sunset Garage to start the next job.';
    }
  }
  offerTaxi(dt);
  if (events.busted) endRun('busted');
  else if (events.wasted) endRun('wasted');
  hud.update(dt, game);
  const vignette = document.getElementById('vignette');
  vignette.style.opacity = sim.police.stars >= 3 ? String(0.25 + 0.15 * Math.sin(game.time * 5)) : '0';
};

function render() {
  updateCamera(0.016);
  renderer.render(scene, camera);
}

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.screen === 'play') {
    acc += dt;
    while (acc >= STEP) {
      game.step(STEP, input);
      acc -= STEP;
    }
  } else {
    game.time += dt;
    input.takeActions();
    input.takeClicks();
  }
  render();
}

function startGame(fresh) {
  audio.unlock();
  document.getElementById('title-screen').classList.remove('show');
  document.getElementById('pause-screen').classList.remove('show');
  document.getElementById('end-screen').classList.remove('show');
  if (fresh) {
    clearSave();
    sim.player.money = 50;
    sim.player.health = PLAYER.maxHealth;
    sim.player.ammo = PLAYER.pistolAmmoStart;
    sim.player.hasPistol = false;
    sim.player.x = 1200;
    sim.player.y = 3000;
    game.missionsDone = 0;
    missions.current = -1;
    missions.active = false;
    missions.finished = false;
    missions.sideJob = null;
  } else {
    const d = loadGame();
    if (d) {
      sim.player.money = d.money;
      game.missionsDone = d.missionsDone;
      sim.player.health = d.health;
      sim.player.ammo = d.ammo;
      sim.player.hasPistol = d.hasPistol;
      sim.player.x = d.x;
      sim.player.y = d.y;
      game.pendingMission = d.missionsDone < 6 ? d.missionsDone : -1;
    }
  }
  game.camYaw = 0;
  game.cameraSnap = true;
  game.screen = 'play';
  game.objectiveText = game.missionsDone > 0
    ? 'Visit Mara at the Sunset Garage to start the next job.'
    : 'Visit Mara at the Sunset Garage to start the first job.';
  hud.setStatus('Solmar: drive, steal cars, run from the police and finish Mara’s jobs.');
}

document.getElementById('btn-start').addEventListener('click', () => startGame(true));
document.getElementById('btn-continue').addEventListener('click', () => startGame(false));
document.getElementById('btn-resume').addEventListener('click', () => {
  document.getElementById('pause-screen').classList.remove('show');
  game.screen = 'play';
});
document.getElementById('btn-save').addEventListener('click', () => {
  if (saveGame(game)) hud.showToast('Game saved.');
  else hud.showToast('Save failed — storage is off.');
});
document.getElementById('btn-mute').addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  document.getElementById('btn-mute').textContent = `Sound: ${audio.muted ? 'Off' : 'On'}`;
});
document.getElementById('btn-restart').addEventListener('click', () => {
  clearSave();
  window.location.reload();
});
document.getElementById('btn-title').addEventListener('click', () => {
  document.getElementById('pause-screen').classList.remove('show');
  document.getElementById('title-screen').classList.add('show');
  game.screen = 'title';
});
document.getElementById('btn-end-continue').addEventListener('click', () => {
  document.getElementById('end-screen').classList.remove('show');
  game.screen = 'play';
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

if (loadGame()) document.getElementById('btn-continue').style.display = 'block';

if (game.shotMode) {
  stageShot(shotName, game);
  game.screen = 'play';
  render();
  render();
  window.__shotReady = true;
} else {
  document.getElementById('title-screen').classList.add('show');
  requestAnimationFrame(loop);
}

// Debug handle for automated checks (position, speed, counts).
window.__solmar = game;
