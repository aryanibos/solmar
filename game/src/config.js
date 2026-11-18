// World constants, palette and vehicle definitions for Solmar in 3D.
// The simulation still thinks in flat (x, y) metres on a 4800 m square —
// the renderer just maps that to (x - 2400, height, y - 2400) in 3D space,
// so the city layout, places and mission distances match the 2D original.

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
  asphalt: 0x3b4048,
  asphaltDark: 0x33373f,
  lane: 0xf2d06b,
  sidewalk: 0xc9b694,
  ground: 0xa8906a,
  grass: 0x79b264,
  grassDark: 0x5f9a4e,
  sand: 0xeed9a0,
  sea: 0x2b93bd,
  seaDeep: 0x1d7ba3,
  sky: 0xffb36b,
  fog: 0xf2a56b,
  sun: 0xffd9a0,
  roof: [0xb25a44, 0xc98f3d, 0x4f7a7d, 0xa34a4a, 0x7d8a68, 0x8a6a72, 0x6a7a9a, 0xb09a72],
  downtownRoof: [0x5d6b7d, 0x7a6a8a, 0x4a6b7a, 0x8a7a5d],
  houseRoof: [0xc96f4a, 0xb0523c, 0xd99a4a, 0x7a8a5a],
  warehouseRoof: [0x8a8f96, 0x7d838a, 0x9a938a],
  wall: [0xcbb894, 0xbfae8e, 0xa8946f, 0xc4a882, 0xb59a78],
  wallDowntown: [0x9aa5b5, 0x8a97a8, 0xa8b0bd, 0x7d8898],
  tree: 0x4e8f3e,
  treeDark: 0x3c7a30,
  trunk: 0x6b4a2f,
  carColors: [0xd64545, 0x3e7bd6, 0xe8b64c, 0x4fae62, 0xe8e8e8, 0x2b2f36, 0xc96bb0, 0xe87e2e, 0x7a5fd0, 0x3ec6c6],
  policeCar: 0x2f6fd6,
  taxi: 0xf2c230,
  thug: 0x5a2e2e,
  pedShirts: [0xd64545, 0x3e7bd6, 0xe8b64c, 0x4fae62, 0xe8e8e8, 0xc96bb0, 0x7a5fd0, 0x3ec6c6, 0xf2f2f2],
};

export const CAR_DEFS = {
  sedan: { length: 4.6, width: 2.2, accel: 63, topSpeed: 99, grip: 3.4, name: 'Solmar Sedan' },
  coupe: { length: 4.4, width: 2.1, accel: 78, topSpeed: 117, grip: 3.1, name: 'Costa Coupe' },
  sport: { length: 4.6, width: 2.2, accel: 96, topSpeed: 138, grip: 3.6, name: 'Sunset GT' },
  taxi: { length: 4.6, width: 2.2, accel: 66, topSpeed: 102, grip: 3.4, name: 'Solmar Cab' },
  van: { length: 5.4, width: 2.4, accel: 51, topSpeed: 84, grip: 3.0, name: 'Harbor Van' },
  truck: { length: 6.2, width: 2.6, accel: 45, topSpeed: 78, grip: 2.8, name: 'Dock Truck' },
  police: { length: 4.7, width: 2.2, accel: 90, topSpeed: 126, grip: 3.8, name: 'SPPD Interceptor' },
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
  walkSpeed: 16.5,
  runSpeed: 40,
  radius: 1.3,
  maxHealth: 100,
  punchDamage: 12,
  pistolDamage: 34,
  pistolRange: 42,
  pistolAmmoStart: 24,
};

export const WANTED = {
  decayDelay: 9,
  decayStep: 4,
  maxStars: 5,
  copsPerStar: [0, 1, 2, 3, 4, 6],
};
