// Missions and the story of Solmar.
// Dario Venn comes home to Solmar and works for Mara Solis, a fixer with a
// garage and a grudge against the Castellan crew. Six story missions carry
// the plot; taxi fares and courier runs pay the bills between them.
// A mission is data: steps with a kind, a target and a line of dialogue.

import { CAR_DEFS, PALETTE } from './config.js';
import { makeCar } from './cars.js';
import { spawnThug } from './combat.js';
import { dist } from './random.js';

export const STORY = {
  hero: 'Dario Venn',
  fixer: 'Mara Solis',
  crew: 'Castellan crew',
};

const MISSION_DEFS = [
  {
    id: 'welcome',
    title: 'Welcome Back',
    reward: 150,
    intro: [
      'Mara Solis: Dario! Back in Solmar at last.',
      'Mara Solis: My sedan is parked on the corner. Bring it to the Sunset Garage.',
    ],
    steps: [
      { kind: 'drive', place: 'garage', text: 'Drive the sedan to the Sunset Garage' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    reward: 300,
    intro: [
      'Mara Solis: A Sunset GT is sitting at the Costa Marina. It belongs to a Castellan.',
      'Mara Solis: Take it. Lose the heat, then bring it to the safehouse.',
    ],
    steps: [
      { kind: 'steal', place: 'marina', text: 'Steal the Sunset GT at the Costa Marina' },
      { kind: 'drive', place: 'safehouse', text: 'Lose the cops and reach the safehouse' },
    ],
  },
  {
    id: 'harborrun',
    title: 'Harbor Run',
    reward: 400,
    intro: [
      'Mara Solis: A package is waiting at the Harbor Docks. The Palma Beach Bar wants it fast.',
      'Mara Solis: Ninety seconds, Dario. Do not stop for anyone.',
    ],
    steps: [
      { kind: 'drive', place: 'harbor', text: 'Pick up the package at the Harbor Docks' },
      { kind: 'timed', place: 'beachBar', time: 90, text: 'Deliver to the Palma Beach Bar — 90 seconds!' },
    ],
  },
  {
    id: 'dockside',
    title: 'Dockside Trouble',
    reward: 500,
    intro: [
      'Mara Solis: The Castellans are leaning on my dock workers.',
      'Mara Solis: Go to the harbor and remind them who runs Solmar. Take the pistol.',
    ],
    steps: [
      { kind: 'drive', place: 'harbor', text: 'Get to the Harbor Docks' },
      { kind: 'combat', place: 'harbor', count: 5, text: 'Clear out the Castellan thugs (0/5)' },
    ],
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    reward: 600,
    intro: [
      'Mara Solis: The vault job went loud. Every SPPD unit in Solmar is coming.',
      'Mara Solis: Four stars, Dario. Get to the safehouse and do not get caught.',
    ],
    steps: [
      { kind: 'escape', place: 'safehouse', text: 'Escape the police — reach the safehouse' },
    ],
  },
  {
    id: 'king',
    title: 'King of Solmar',
    reward: 1000,
    intro: [
      'Mara Solis: This is it. The Castellan Compound. End this tonight.',
      'Mara Solis: Take the compound, then meet me at the Solmar Tower.',
    ],
    steps: [
      { kind: 'drive', place: 'compound', text: 'Reach the Castellan Compound' },
      { kind: 'combat', place: 'compound', count: 8, text: 'Take the compound (0/8)' },
      { kind: 'drive', place: 'tower', text: 'Meet Mara at the Solmar Tower' },
    ],
  },
];

export function createMissions(city) {
  return {
    city,
    defs: MISSION_DEFS,
    current: -1,
    stepIndex: 0,
    timer: 0,
    kills: 0,
    killsNeeded: 0,
    dialogue: [],
    dialogueTimer: 0,
    active: false,
    finished: false,
    sideJob: null,
    sideTimer: 0,
    markerCar: null,
    escapeSet: false,
  };
}

export function startMission(missions, index) {
  const def = missions.defs[index];
  missions.current = index;
  missions.stepIndex = 0;
  missions.active = true;
  missions.kills = 0;
  missions.killsNeeded = 0;
  missions.timer = 0;
  missions.dialogue = def.intro.slice();
  missions.dialogueTimer = 0;
  missions.markerCar = null;
  missions.escapeSet = false;
  return def;
}

export function currentStep(missions) {
  if (!missions.active || missions.current < 0) return null;
  return missions.defs[missions.current].steps[missions.stepIndex];
}

export function missionMarker(missions) {
  const step = currentStep(missions);
  if (!step) {
    if (missions.sideJob) return { x: missions.sideJob.tx, y: missions.sideJob.ty, label: missions.sideJob.label };
    return null;
  }
  if (step.kind === 'steal' && missions.markerCar) {
    return { x: missions.markerCar.x, y: missions.markerCar.y, label: 'Sunset GT' };
  }
  const place = missions.city.places[step.place];
  return place ? { x: place.x, y: place.y, label: place.label } : null;
}

export function missionObjective(missions) {
  const step = currentStep(missions);
  if (step) {
    if (step.kind === 'combat') return step.text.replace(/\(\d+\/\d+\)/, `(${missions.kills}/${missions.killsNeeded})`);
    if (step.kind === 'timed') return `${step.text} — ${Math.ceil(missions.timer)}s left`;
    return step.text;
  }
  if (missions.sideJob) return missions.sideJob.label;
  if (missions.finished) return 'Story complete — free roam. Earn cash with taxi fares and courier runs.';
  return 'Visit Mara at the Sunset Garage to start the next job.';
}

export function startSideJob(missions, kind, rng) {
  const city = missions.city;
  const from = kind === 'taxi' ? city.randomSidewalkPoint() : city.places.harbor;
  const to = city.randomRoadPoint();
  missions.sideJob = {
    kind,
    x: from.x, y: from.y,
    tx: to.x, ty: to.y,
    label: kind === 'taxi' ? 'Taxi fare: pick up the passenger' : 'Courier: collect the parcel at the harbor',
    pickedUp: false,
    pay: kind === 'taxi' ? rng.int(40, 80) : rng.int(60, 110),
  };
  return missions.sideJob;
}

function ensureStepSetup(missions, world) {
  const step = currentStep(missions);
  if (!step) return;
  if (step.kind === 'steal' && !missions.markerCar) {
    const place = missions.city.places.marina;
    const car = makeCar(CAR_DEFS.sport, '#e87e2e', place.x + 60, place.y + 40, Math.PI / 2);
    car.isMissionCar = true;
    world.parked.push(car);
    missions.markerCar = car;
  }
  if (step.kind === 'combat' && missions.killsNeeded === 0) {
    missions.killsNeeded = step.count;
    missions.kills = 0;
    const place = missions.city.places[step.place];
    for (let i = 0; i < step.count + 1; i += 1) {
      spawnThug(world.combat, place.x + (Math.random() - 0.5) * 320, place.y + (Math.random() - 0.5) * 320, world.rng, true);
    }
  }
  if (step.kind === 'timed' && missions.timer <= 0 && missions.stepIndex > 0) {
    missions.timer = step.time;
  }
  if (step.kind === 'escape' && !missions.escapeSet) {
    missions.escapeSet = true;
    world.police.stars = 4;
  }
}

export function updateMissions(missions, dt, world) {
  const events = { completed: null, failed: null, objective: missionObjective(missions) };
  if (missions.dialogue.length > 0) {
    missions.dialogueTimer -= dt;
    if (missions.dialogueTimer <= 0) {
      missions.dialogueTimer = 4.5;
      events.say = missions.dialogue.shift();
    }
  }
  if (!missions.active) {
    updateSideJob(missions, dt, world, events);
    return events;
  }
  ensureStepSetup(missions, world);
  const step = currentStep(missions);
  if (!step) return events;
  const player = world.player;
  const px = world.playerCar ? world.playerCar.x : player.x;
  const py = world.playerCar ? world.playerCar.y : player.y;

  if (step.kind === 'timed') {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      events.failed = 'Too slow — the delivery went cold. Try the job again.';
      missions.active = false;
      missions.current = -1;
      return events;
    }
  }
  if (step.kind === 'combat') {
    if (missions.kills >= missions.killsNeeded && missions.killsNeeded > 0) {
      advanceStep(missions, world, events);
    }
    return events;
  }
  if (step.kind === 'steal') {
    if (missions.markerCar && world.playerCar === missions.markerCar) {
      world.police.stars = Math.max(world.police.stars, 2);
      events.say = 'Mara Solis: Nice. Now lose them and get to the safehouse.';
      advanceStep(missions, world, events);
    }
    return events;
  }
  if (step.kind === 'escape') {
    const nearPolice = world.police.cars.some((c) => dist(px, py, c.x, c.y) < 420);
    const place = missions.city.places[step.place];
    const arrived = place && dist(px, py, place.x, place.y) < 110;
    if (arrived && !nearPolice) {
      advanceStep(missions, world, events);
    } else if (arrived && nearPolice) {
      events.objective = 'Shake the police cars first — get some distance, then reach the safehouse.';
    }
    return events;
  }
  const place = missions.city.places[step.place];
  if (place && dist(px, py, place.x, place.y) < 110) {
    advanceStep(missions, world, events);
  }
  return events;
}

function advanceStep(missions, world, events) {
  missions.stepIndex += 1;
  missions.killsNeeded = 0;
  missions.kills = 0;
  const def = missions.defs[missions.current];
  if (missions.stepIndex >= def.steps.length) {
    missions.active = false;
    world.player.money += def.reward;
    events.completed = { title: def.title, reward: def.reward };
    if (missions.current === missions.defs.length - 1) {
      missions.finished = true;
    }
    missions.current = -1;
  }
}

function updateSideJob(missions, dt, world, events) {
  const job = missions.sideJob;
  if (!job) return;
  const player = world.player;
  const px = world.playerCar ? world.playerCar.x : player.x;
  const py = world.playerCar ? world.playerCar.y : player.y;
  const targetX = job.pickedUp ? job.tx : job.x;
  const targetY = job.pickedUp ? job.ty : job.y;
  if (dist(px, py, targetX, targetY) < 90) {
    if (!job.pickedUp) {
      job.pickedUp = true;
      job.label = job.kind === 'taxi' ? 'Taxi fare: drive the passenger to the marker' : 'Courier: deliver the parcel to the marker';
      events.say = job.kind === 'taxi' ? 'Passenger: Take me to the marker, quick!' : 'Parcel collected. Deliver it to the marker.';
    } else {
      world.player.money += job.pay;
      events.say = `Job done — earned $${job.pay}.`;
      events.earned = job.pay;
      missions.sideJob = null;
    }
  }
}

export function registerKill(missions) {
  if (missions.active) {
    const step = currentStep(missions);
    if (step && step.kind === 'combat') missions.kills += 1;
  }
}
