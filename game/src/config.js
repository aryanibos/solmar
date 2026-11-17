// World constants, palette and vehicle definitions for Solmar.
// Nothing here is read from the network; every colour and number is local.

// The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate.
export const STEP = 1 / 60;

export const WORLD = {
  size: 4800,
  roadPitch: 480,
  roadWidth: 76,
  sidewalk: 18,
  seaTop: 4300,
  beachTop: 4160,
  harborX: 4280,
  harborTop: 720,
  harborBottom: 2080,
};

export const PALETTE = {
  asphalt: '#3b4048',
  asphaltDark: '#33373f',
  lane: '#f2d06b',
  sidewalk: '#c9b694',
  curb: '#a8946f',
  ground: '#b8a67e',
  grass: '#79b264',
  grassDark: '#5f9a4e',
  sand: '#eed9a0',
  sea: '#2b93bd',
  seaDeep: '#1d7ba3',
  buildingRoof: ['#b25a44', '#c98f3d', '#4f7a7d', '#a34a4a', '#7d8a68', '#8a6a72', '#6a7a9a', '#b09a72'],
  downtownRoof: ['#5d6b7d', '#7a6a8a', '#4a6b7a', '#8a7a5d'],
  houseRoof: ['#c96f4a', '#b0523c', '#d99a4a', '#7a8a5a'],
  warehouseRoof: ['#8a8f96', '#7d838a', '#9a938a'],
  seaBright: '#00bfff',
  tree: '#4e8f3e',
  treeDark: '#3c7a30',
  carColors: ['#d64545', '#3e7bd6', '#e8b64c', '#4fae62', '#e8e8e8', '#2b2f36', '#c96bb0', '#e87e2e', '#7a5fd0', '#3ec6c6'],
  policeCar: '#2f6fd6',
  taxi: '#f2c230',
  uiPanel: 'rgba(12, 20, 36, 0.82)',
  uiAccent: '#ffb340',
  uiText: '#f5efe0',
  uiDanger: '#ff5a4e',
  uiGood: '#7ee081',
};

export const CAR_DEFS = {
  sedan: { length: 46, width: 22, accel: 210, topSpeed: 330, grip: 3.4, name: 'Solmar Sedan' },
  coupe: { length: 44, width: 21, accel: 260, topSpeed: 390, grip: 3.1, name: 'Costa Coupe' },
  sport: { length: 46, width: 22, accel: 320, topSpeed: 460, grip: 3.6, name: 'Sunset GT' },
  taxi: { length: 46, width: 22, accel: 220, topSpeed: 340, grip: 3.4, name: 'Solmar Cab' },
  van: { length: 54, width: 24, accel: 170, topSpeed: 280, grip: 3.0, name: 'Harbor Van' },
  truck: { length: 62, width: 26, accel: 150, topSpeed: 260, grip: 2.8, name: 'Dock Truck' },
  police: { length: 47, width: 22, accel: 300, topSpeed: 420, grip: 3.8, name: 'SPPD Interceptor' },
};

export const PRICES = {
  repair: 120,
  clearWanted: 200,
  ammoBox: 60,
  healthSnack: 25,
  bustedFine: 150,
  wastedFine: 150,
};

export const PLAYER = {
  walkSpeed: 165,
  runSpeed: 265,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 420,
  pistolAmmoStart: 24,
};

export const WANTED = {
  decayDelay: 9,
  decayStep: 4,
  maxStars: 5,
  carsPerStar: [0, 1, 2, 3, 4, 5],
  copsPerStar: [0, 1, 2, 3, 4, 6],
};
