// The simulation: player on foot and in cars, traffic, pedestrians, police
// and thugs, all in flat (x, y) metres. The renderer only mirrors this
// state into 3D meshes. step() advances one fixed step and reports events
// (busted, wasted, kills) so main can react without the sim knowing about
// screens or sound.

import * as THREE from 'three';
import { WORLD, CAR_DEFS, PALETTE, PLAYER, WANTED, PRICES } from './config.js';
import { clamp, dist2d, angleLerp } from './random.js';
import { createCity, isOnRoad, nearestRoadCenter } from './city.js';
import { buildCarMesh, buildPersonMesh, buildBeacon, buildPickupMesh, animatePerson, to3, headingToRotation } from './meshes.js';
import { createEffects } from './effects.js';

function makeCarObject(def, color, x, y, angle, kind, scene) {
  const mesh = buildCarMesh(def, color, kind);
  scene.add(mesh);
  return { def, color, kind, x, y, angle, speed: 0, steer: 0, mesh, isTraffic: false, isPolice: false, isMissionCar: false, stunned: 0 };
}

export function createSim(scene, city, rng, audio) {
  const effects = createEffects(scene);
  const beacon = buildBeacon();
  beacon.visible = false;
  scene.add(beacon);

  const sim = {
    city,
    rng,
    audio,
    effects,
    player: {
      x: 1200, y: 3000, angle: 0, health: PLAYER.maxHealth, money: 50,
      ammo: PLAYER.pistolAmmoStart, hasPistol: false, moving: false,
      mesh: buildPersonMesh(0xd64545),
    },
    playerCar: null,
    parked: [],
    traffic: [],
    pedestrians: [],
    police: { stars: 0, cars: [], decayTimer: 0, quietTimer: 0 },
    thugs: [],
    pickups: [],
    camYaw: 0,
    killsThisStep: 0,
    time: 0,
  };
  scene.add(sim.player.mesh);

  // ---- spawning ----------------------------------------------------------
  sim.spawnCar = function (def, color, x, y, angle, kind = 'civil') {
    const car = makeCarObject(def, color, x, y, angle, kind, scene);
    return car;
  };

  sim.spawnThug = function (x, y, armed = true) {
    const mesh = buildPersonMesh(PALETTE.thug);
    scene.add(mesh);
    const thug = { x, y, angle: 0, hp: 60, mesh, shootTimer: rng.float(0.5, 1.5), speed: 20, armed };
    sim.thugs.push(thug);
    return thug;
  };

  sim.spawnPickup = function (kind, x, y) {
    const mesh = buildPickupMesh(kind);
    scene.add(mesh);
    const p = { kind, x, y, mesh, phase: Math.random() * 6 };
    sim.pickups.push(p);
    return p;
  };

  sim.setMarker = function (x, y) {
    beacon.visible = true;
    beacon.position.copy(to3(x, y, 0));
  };
  sim.clearMarker = function () { beacon.visible = false; };

  function scatterParked(count) {
    const defs = [CAR_DEFS.sedan, CAR_DEFS.coupe, CAR_DEFS.sedan, CAR_DEFS.van, CAR_DEFS.taxi];
    for (let i = 0; i < count; i += 1) {
      const spot = city.randomParkedSpot();
      const def = rng.pick(defs);
      const car = sim.spawnCar(def, rng.pick(PALETTE.carColors), spot.x, spot.y, spot.angle, def === CAR_DEFS.taxi ? 'taxi' : 'civil');
      sim.parked.push(car);
    }
  }

  function scatterTraffic(count) {
    const defs = [CAR_DEFS.sedan, CAR_DEFS.coupe, CAR_DEFS.van, CAR_DEFS.sedan, CAR_DEFS.taxi];
    for (let i = 0; i < count; i += 1) {
      const p = city.randomRoadPoint();
      const horizontal = Math.abs(p.y - nearestRoadCenter(p.y)) < 4;
      const def = rng.pick(defs);
      const car = sim.spawnCar(def, rng.pick(PALETTE.carColors), p.x, p.y, horizontal ? 0 : Math.PI / 2, def === CAR_DEFS.taxi ? 'taxi' : 'civil');
      car.isTraffic = true;
      car.speed = rng.float(27, 51);
      car.axis = horizontal ? 'x' : 'y';
      car.dir = rng.sign();
      car.lane = (WORLD.roadWidth / 4) * rng.sign();
      car.targetSpeed = car.speed;
      sim.traffic.push(car);
    }
  }

  function scatterPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const p = city.randomSidewalkPoint();
      const mesh = buildPersonMesh(rng.pick(PALETTE.pedShirts));
      scene.add(mesh);
      sim.pedestrians.push({
        x: p.x, y: p.y, angle: rng.float(0, Math.PI * 2), speed: rng.float(2.5, 4.5),
        tx: p.x, ty: p.y, state: 'walk', mesh, wait: 0,
      });
    }
  }

  scatterParked(16);
  scatterTraffic(14);
  scatterPeds(22);
  sim.spawnPickup('health', city.places.hospital.x + 30, city.places.hospital.y);
  sim.spawnPickup('ammo', city.places.arms.x - 30, city.places.arms.y);
  sim.spawnPickup('health', city.places.beachBar.x, city.places.beachBar.y - 20);

  // ---- driving ------------------------------------------------------------
  function driveCar(car, dt, throttle, steerInput, handbrake) {
    const def = car.def;
    if (throttle > 0) car.speed += def.accel * throttle * dt;
    else if (throttle < 0) car.speed += def.accel * 0.7 * throttle * dt;
    if (car.speed > def.topSpeed) car.speed = def.topSpeed;
    if (car.speed < -def.topSpeed * 0.45) car.speed = -def.topSpeed * 0.45;
    const drag = handbrake ? 2.2 : 0.35;
    if (throttle === 0) car.speed -= car.speed * drag * dt;
    if (handbrake) car.speed -= car.speed * 1.4 * dt;
    const grip = handbrake ? 2.6 : 1;
    const turnRate = (2.1 / (1 + Math.abs(car.speed) * 0.012)) * grip;
    const speedFactor = clamp(Math.abs(car.speed) / 9, 0, 1);
    car.angle += steerInput * turnRate * speedFactor * dt * Math.sign(car.speed || 1);
    car.steer = steerInput;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const oldX = car.x;
    const oldY = car.y;
    car.x = clamp(nx, 20, WORLD.size - 20);
    car.y = clamp(ny, 20, WORLD.size - 20);
    if (city.isInWater(car.x, car.y)) {
      car.x = oldX;
      car.y = oldY;
      car.speed *= 0.3;
    }
    const probe = { x: car.x, y: car.y, r: car.def.length * 4.2 };
    if (city.collideCircle(probe)) {
      const fast = Math.abs(car.speed) > 14;
      car.x = probe.x;
      car.y = probe.y;
      car.speed *= 0.45;
      if (fast && car === sim.playerCar) {
        audio.crash();
        const p3 = to3(car.x, car.y, 1);
        effects.burst(p3.x, p3.y, p3.z, 0xffc93e, 8, 5, 0.5);
      }
    }
  }

  function syncCarMesh(car) {
    car.mesh.position.copy(to3(car.x, car.y, 0));
    car.mesh.rotation.y = headingToRotation(car.angle);
    const spin = (car.speed * 0.016) / 0.42;
    for (const w of car.mesh.userData.wheels) w.rotation.z -= spin;
  }

  function collideCars(a, b) {
    const r = (a.def.length + b.def.length) / 2 * 5.5;
    const d = dist2d(a.x, a.y, b.x, b.y);
    if (d >= r || d < 0.01) return;
    const push = (r - d) / 2;
    const nx = (a.x - b.x) / d;
    const ny = (a.y - b.y) / d;
    a.x += nx * push;
    a.y += ny * push;
    b.x -= nx * push;
    b.y -= ny * push;
    // A bump costs speed in proportion to the impact, and only while the
    // cars are closing: slow grinding past a head-on car no longer drains
    // all momentum, so the player can push through instead of stalling.
    const nx2 = (a.x - b.x) / d;
    const ny2 = (a.y - b.y) / d;
    const closing = (Math.cos(a.angle) * a.speed - Math.cos(b.angle) * b.speed) * nx2 +
      (Math.sin(a.angle) * a.speed - Math.sin(b.angle) * b.speed) * ny2;
    if (closing < 0) {
      const factor = clamp(-closing / 60, 0.1, 1);
      a.speed *= 1 - 0.12 * factor;
      b.speed *= 1 - 0.12 * factor;
    }
  }

  // ---- one fixed step -----------------------------------------------------
  sim.step = function (dt, input, camYaw, aim, clicks) {
    sim.time += dt;
    sim.killsThisStep = 0;
    const events = { busted: false, wasted: false };
    const p = sim.player;

    // Player movement or driving.
    if (sim.playerCar) {
      const car = sim.playerCar;
      const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
      const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
      driveCar(car, dt, throttle, steer, input.handbrake);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      if (Math.abs(car.speed) > 4) {
        const p3 = to3(car.x - Math.cos(car.angle) * car.def.length * 5, car.y - Math.sin(car.angle) * car.def.length * 5, 0.4);
        if (Math.random() < 0.12) effects.puff(p3.x, p3.y, p3.z);
      }
      if (input.handbrake && Math.abs(car.speed) > 10 && Math.random() < 0.5) {
        const p3 = to3(car.x, car.y, 0.3);
        effects.puff(p3.x, p3.y, p3.z, 0x6a6a6a);
      }
    } else {
      const fx = Math.cos(camYaw);
      const fy = Math.sin(camYaw);
      const rx = -Math.sin(camYaw);
      const ry = Math.cos(camYaw);
      let mx = fx * ((input.up ? 1 : 0) - (input.down ? 1 : 0)) + rx * ((input.right ? 1 : 0) - (input.left ? 1 : 0));
      let my = fy * ((input.up ? 1 : 0) - (input.down ? 1 : 0)) + ry * ((input.right ? 1 : 0) - (input.left ? 1 : 0));
      const len = Math.hypot(mx, my);
      p.moving = len > 0.01;
      if (p.moving) {
        mx /= len;
        my /= len;
        const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
        const nx = p.x + mx * speed * dt;
        const ny = p.y + my * speed * dt;
        const probe = { x: nx, y: ny, r: PLAYER.radius * 10 };
        if (!city.isInWater(nx, ny)) {
          p.x = nx;
          p.y = ny;
          if (city.collideCircle(probe)) {
            p.x = probe.x;
            p.y = probe.y;
          }
          p.angle = Math.atan2(my, mx);
        }
        p.x = clamp(p.x, 20, WORLD.size - 20);
        p.y = clamp(p.y, 20, WORLD.size - 20);
      }
      // Face the aim point while shooting.
      if (aim && (clicks > 0 || input.mouseDown)) {
        p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
      }
    }

    // Combat: clicks fire the pistol or throw a punch.
    if (clicks > 0 && !sim.playerCar) {
      if (p.hasPistol && p.ammo > 0) {
        p.ammo -= 1;
        audio.shoot();
        const gx = p.x + Math.cos(p.angle) * 1.2;
        const gy = p.y + Math.sin(p.angle) * 1.2;
        const g3 = to3(gx, gy, 1.4);
        effects.burst(g3.x, g3.y, g3.z, 0xffd23e, 6, 4, 0.25);
        let best = null;
        let bestD = PLAYER.pistolRange * 10;
        for (const t of sim.thugs) {
          const d = dist2d(p.x, p.y, t.x, t.y);
          if (d > PLAYER.pistolRange * 10) continue;
          const a = Math.atan2(t.y - p.y, t.x - p.x);
          let diff = Math.abs(a - p.angle) % (Math.PI * 2);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 0.4 && d < bestD) {
            best = t;
            bestD = d;
          }
        }
        if (best) {
          best.hp -= PLAYER.pistolDamage;
          const b3 = to3(best.x, best.y, 1.4);
          effects.burst(b3.x, b3.y, b3.z, 0xd21f1f, 8, 5, 0.5);
          audio.hit();
          if (best.hp <= 0) killThug(best);
        }
        if (sim.police.cars.some((c) => dist2d(p.x, p.y, c.x, c.y) < 100)) {
          sim.police.stars = Math.max(sim.police.stars, 1);
        }
      } else if (!p.hasPistol) {
        audio.punch();
        for (const t of [...sim.thugs]) {
          if (dist2d(p.x, p.y, t.x, t.y) < 32) {
            t.hp -= PLAYER.punchDamage;
            if (t.hp <= 0) killThug(t);
          }
        }
      }
    }

    function killThug(t) {
      const idx = sim.thugs.indexOf(t);
      if (idx === -1) return;
      sim.thugs.splice(idx, 1);
      scene.remove(t.mesh);
      const b3 = to3(t.x, t.y, 1);
      effects.burst(b3.x, b3.y, b3.z, 0xd21f1f, 14, 6, 0.8);
      sim.killsThisStep += 1;
    }

    // Traffic: follow road lanes, turn at intersections sometimes.
    for (const car of sim.traffic) {
      if (car.stunned > 0) {
        car.stunned -= dt;
        car.speed = 0;
        continue;
      }
      // Yield to the player: a traffic car facing the player's car stops
      // instead of grinding nose-to-nose forever on a narrow road.
      if (sim.playerCar) {
        const dx = sim.playerCar.x - car.x;
        const dy = sim.playerCar.y - car.y;
        const d = Math.hypot(dx, dy);
        const heading = Math.cos(car.angle) * dx + Math.sin(car.angle) * dy;
        if (d < 70 && heading > 0) {
          car.speed = 0;
          continue;
        }
      }
      car.speed += (car.targetSpeed - car.speed) * dt;
      const ahead = car.axis === 'x' ? car.x + car.dir * car.speed * dt : car.y + car.dir * car.speed * dt;
      const onCenter = car.axis === 'x' ? car.y : car.x;
      const nearCrossing = Math.abs(onCenter - nearestRoadCenter(onCenter)) < 6 ||
        Math.abs(ahead - nearestRoadCenter(ahead)) < car.speed * dt + 4;
      if (nearCrossing && rng.chance(0.02)) {
        car.axis = car.axis === 'x' ? 'y' : 'x';
        car.dir = rng.sign();
        car.lane = (WORLD.roadWidth / 4) * rng.sign();
      }
      if (car.axis === 'x') {
        car.x += car.dir * car.speed * dt;
        car.y = nearestRoadCenter(car.y) + car.lane;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        if (car.x < 100) { car.x = 100; car.dir = 1; }
        if (car.x > WORLD.size - 100) { car.x = WORLD.size - 100; car.dir = -1; }
      } else {
        car.y += car.dir * car.speed * dt;
        car.x = nearestRoadCenter(car.x) + car.lane;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (car.y < 100) { car.y = 100; car.dir = 1; }
        if (car.y > WORLD.size - 100) { car.y = WORLD.size - 100; car.dir = -1; }
      }
    }

    // Pedestrians: stroll the sidewalks, flee from gunfire and fast cars.
    for (let i = sim.pedestrians.length - 1; i >= 0; i -= 1) {
      const ped = sim.pedestrians[i];
      if (ped.wait > 0) {
        ped.wait -= dt;
        animatePerson(ped.mesh, false, dt);
        continue;
      }
      const d = dist2d(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 4) {
        const np = city.randomSidewalkPoint();
        ped.tx = np.x;
        ped.ty = np.y;
        ped.wait = rng.float(0, 2);
        continue;
      }
      const sp = ped.state === 'flee' ? ped.speed * 2.2 : ped.speed;
      const mx = (ped.tx - ped.x) / d;
      const my = (ped.ty - ped.y) / d;
      ped.x += mx * sp * dt;
      ped.y += my * sp * dt;
      ped.angle = Math.atan2(my, mx);
      const probe = { x: ped.x, y: ped.y, r: 10 };
      city.collideCircle(probe);
      ped.x = probe.x;
      ped.y = probe.y;
      animatePerson(ped.mesh, true, dt);
      // Run over by a fast car: the SPPD notices.
      if (sim.playerCar && Math.abs(sim.playerCar.speed) > 6 && dist2d(ped.x, ped.y, sim.playerCar.x, sim.playerCar.y) < 10) {
        scene.remove(ped.mesh);
        sim.pedestrians.splice(i, 1);
        sim.police.stars = Math.max(sim.police.stars, 1);
        const p3 = to3(ped.x, ped.y, 1);
        effects.burst(p3.x, p3.y, p3.z, 0xd21f1f, 10, 5, 0.7);
        setTimeout(() => {
          const np = city.randomSidewalkPoint();
          const mesh = buildPersonMesh(rng.pick(PALETTE.pedShirts));
          scene.add(mesh);
          sim.pedestrians.push({ x: np.x, y: np.y, angle: 0, speed: rng.float(2.5, 4.5), tx: np.x, ty: np.y, state: 'walk', mesh, wait: 0 });
        }, 8000);
      }
    }

    // Police: keep the right number of cars, chase the player, bust on foot.
    const want = WANTED.copsPerStar[sim.police.stars] || 0;
    while (sim.police.cars.length < want) {
      const p0 = city.randomRoadPoint();
      if (dist2d(p0.x, p0.y, p.x, p.y) < 60) continue;
      const car = sim.spawnCar(CAR_DEFS.police, PALETTE.policeCar, p0.x, p0.y, 0, 'police');
      car.isPolice = true;
      car.speed = 60;
      car.slot = (sim.police.cars.length % 3 - 1) * 25;
      sim.police.cars.push(car);
    }
    while (sim.police.cars.length > want) {
      const car = sim.police.cars.pop();
      scene.remove(car.mesh);
    }
    let nearestCop = Infinity;
    for (const car of sim.police.cars) {
      const d = dist2d(car.x, car.y, p.x, p.y);
      nearestCop = Math.min(nearestCop, d);
      // Chase the player, but stay on the roads: a cop that cut a corner
      // through a block steers back to the nearest road centre first.
      // Each car aims at its own lateral slot beside the player, so the
      // whole unit flanks instead of piling onto one spot.
      let tx = p.x;
      let ty = p.y;
      if (!isOnRoad(car.x, car.y)) {
        const dx = nearestRoadCenter(car.x) - car.x;
        const dy = nearestRoadCenter(car.y) - car.y;
        if (Math.abs(dx) < Math.abs(dy)) { tx = car.x + dx; ty = car.y; }
        else { tx = car.x; ty = car.y + dy; }
      } else {
        const slot = car.slot || 0;
        tx = p.x - Math.sin(p.angle) * slot;
        ty = p.y + Math.cos(p.angle) * slot;
      }
      const targetAngle = Math.atan2(ty - car.y, tx - car.x);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.6, -1, 1);
      const throttle = d > 60 ? 1 : d > 20 ? 0.5 : 0.25;
      if (car.scripted) driveCar(car, dt, 1, 0, false);
      else driveCar(car, dt, throttle, steer, false);
      if (!sim.playerCar && d < 10 && Math.abs(car.speed) < 8) {
        events.busted = true;
      }
      if (sim.playerCar && d < 14) {
        car.speed *= 0.98;
        sim.playerCar.speed *= 0.995;
      }
    }
    audio.siren(sim.police.cars.length > 0);
    if (sim.police.stars > 0) {
      if (nearestCop > 60) sim.police.quietTimer += dt;
      else sim.police.quietTimer = 0;
      if (sim.police.quietTimer > WANTED.decayDelay) {
        sim.police.decayTimer += dt;
        if (sim.police.decayTimer >= WANTED.decayStep) {
          sim.police.decayTimer = 0;
          sim.police.stars = Math.max(0, sim.police.stars - 1);
        }
      }
    }

    // Thugs: close in and shoot when the player is on foot.
    for (const t of [...sim.thugs]) {
      const d = dist2d(t.x, t.y, p.x, p.y);
      if (d > 30 && d < 300) {
        const mx = (p.x - t.x) / d;
        const my = (p.y - t.y) / d;
        t.x += mx * t.speed * dt;
        t.y += my * t.speed * dt;
        t.angle = Math.atan2(my, mx);
        const probe = { x: t.x, y: t.y, r: 10 };
        city.collideCircle(probe);
        t.x = probe.x;
        t.y = probe.y;
        animatePerson(t.mesh, true, dt);
      } else {
        animatePerson(t.mesh, false, dt);
      }
      t.shootTimer -= dt;
      if (t.shootTimer <= 0 && d < 260 && !sim.playerCar) {
        t.shootTimer = rng.float(0.9, 1.6);
        p.health -= rng.float(5, 10);
        audio.shoot();
        const t3 = to3(t.x, t.y, 1.4);
        effects.burst(t3.x, t3.y, t3.z, 0xffd23e, 5, 4, 0.25);
        if (p.health <= 0) {
          p.health = 0;
          events.wasted = true;
        }
      }
    }

    // Pickups: bob, spin, collect on foot.
    for (let i = sim.pickups.length - 1; i >= 0; i -= 1) {
      const pk = sim.pickups[i];
      pk.phase += dt * 2;
      pk.mesh.position.y = 1.2 + Math.sin(pk.phase) * 0.25;
      pk.mesh.rotation.y += dt * 1.5;
      pk.mesh.position.x = (pk.x - 2400) * 0.1;
      pk.mesh.position.z = (pk.y - 2400) * 0.1;
      if (!sim.playerCar && dist2d(p.x, p.y, pk.x, pk.y) < 26) {
        if (pk.kind === 'health') p.health = Math.min(PLAYER.maxHealth, p.health + 40);
        else p.ammo += 24;
        audio.pickup();
        scene.remove(pk.mesh);
        sim.pickups.splice(i, 1);
      }
    }

    // Car-to-car bumps.
    const allCars = [...sim.parked, ...sim.traffic, ...sim.police.cars];
    if (sim.playerCar) allCars.push(sim.playerCar);
    for (let i = 0; i < allCars.length; i += 1) {
      for (let j = i + 1; j < allCars.length; j += 1) {
        collideCars(allCars[i], allCars[j]);
      }
    }
    for (const car of sim.traffic) {
      if (sim.playerCar && dist2d(car.x, car.y, sim.playerCar.x, sim.playerCar.y) < 50) car.stunned = 1.5;
    }

    // Sync every mesh to the sim.
    for (const car of allCars) syncCarMesh(car);
    if (sim.playerCar) {
      sim.player.mesh.visible = false;
    } else {
      sim.player.mesh.visible = true;
      sim.player.mesh.position.copy(to3(p.x, p.y, 0));
      sim.player.mesh.rotation.y = headingToRotation(p.angle);
      animatePerson(sim.player.mesh, p.moving, dt);
    }
    for (const ped of sim.pedestrians) {
      ped.mesh.position.copy(to3(ped.x, ped.y, 0));
      ped.mesh.rotation.y = headingToRotation(ped.angle);
    }
    for (const t of sim.thugs) {
      t.mesh.position.copy(to3(t.x, t.y, 0));
      t.mesh.rotation.y = headingToRotation(t.angle);
    }
    if (beacon.visible) {
      beacon.userData.gem.rotation.y += dt * 2;
      beacon.userData.gem.position.y = 9 + Math.sin(sim.time * 2) * 0.8;
    }
    effects.update(dt);
    audio.engine(sim.playerCar ? Math.abs(sim.playerCar.speed) / sim.playerCar.def.topSpeed : 0);
    return events;
  };

  sim.focus = function () {
    if (sim.playerCar) {
      return { x: sim.playerCar.x, y: sim.playerCar.y, angle: sim.playerCar.angle, speed: Math.abs(sim.playerCar.speed), inCar: true };
    }
    return { x: sim.player.x, y: sim.player.y, angle: sim.player.angle, speed: sim.player.moving ? 1 : 0, inCar: false };
  };

  // Enter or steal the nearest car, or step out of the one being driven.
  sim.tryEnterCar = function () {
    if (sim.playerCar) {
      const car = sim.playerCar;
      sim.playerCar = null;
      car.speed = 0;
      const side = 26;
      sim.player.x = car.x + Math.cos(car.angle + Math.PI / 2) * side;
      sim.player.y = car.y + Math.sin(car.angle + Math.PI / 2) * side;
      if (city.buildingAt(sim.player.x, sim.player.y) || city.isInWater(sim.player.x, sim.player.y)) {
        sim.player.x = car.x - Math.cos(car.angle + Math.PI / 2) * side;
        sim.player.y = car.y - Math.sin(car.angle + Math.PI / 2) * side;
      }
      sim.parked.push(car);
      return { exited: true };
    }
    let best = null;
    let bestD = 50;
    for (const car of [...sim.parked, ...sim.traffic]) {
      const d = dist2d(sim.player.x, sim.player.y, car.x, car.y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    if (!best) return null;
    if (best.isTraffic) {
      sim.traffic = sim.traffic.filter((c) => c !== best);
      sim.police.stars = Math.max(sim.police.stars, 1);
    } else {
      sim.parked = sim.parked.filter((c) => c !== best);
    }
    if (best.isMissionCar) {
      // The mission step notices the car itself; no extra heat here.
    }
    best.isTraffic = false;
    sim.playerCar = best;
    sim.player.x = best.x;
    sim.player.y = best.y;
    return { entered: best };
  };

  return sim;
}
