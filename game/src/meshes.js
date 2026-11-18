// Three.js meshes for Solmar: the static city is merged into a handful of
// vertex-coloured geometries (one draw call per material group), while cars,
// people and markers stay as small groups so they can move. Simulation
// coordinates are flat (x, y) metres; the renderer maps them to
// (x - 2400, height, y - 2400) in 3D space.

import * as THREE from 'three';
import { WORLD, PALETTE } from './config.js';

export const HALF = WORLD.size / 2;

export function to3(x, y, h = 0) {
  // Simulation units are decimetres: one unit is 0.1 m, so the 4800-unit
  // city is 480 m across and a 4.6 m car fits its 7.6 m road.
  return new THREE.Vector3((x - HALF) * 0.1, h * 0.1, (y - HALF) * 0.1);
}

export function headingToRotation(angle) {
  return -angle;
}

// ---- merged geometry helper ---------------------------------------------

class Bucket {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.col = [];
    this.idx = [];
  }
  add(geom, color, matrix) {
    geom.applyMatrix4(matrix);
    const p = geom.attributes.position;
    const n = geom.attributes.normal;
    const c = new THREE.Color(color);
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i += 1) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      this.norm.push(n.getX(i), n.getY(i), n.getZ(i));
      this.col.push(c.r, c.g, c.b);
    }
    const index = geom.index;
    for (let i = 0; i < index.count; i += 1) this.idx.push(base + index.getX(i));
    geom.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

function box(bucket, color, cx, cy, cz, w, h, d, ry = 0) {
  const m = new THREE.Matrix4();
  m.makeRotationY(ry);
  m.setPosition(cx, cy, cz);
  bucket.add(new THREE.BoxGeometry(w, h, d), color, m);
}

function cyl(bucket, color, cx, cy, cz, rTop, rBottom, h, seg = 8) {
  const m = new THREE.Matrix4();
  m.setPosition(cx, cy, cz);
  bucket.add(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, m);
}

function cone(bucket, color, cx, cy, cz, r, h, seg = 8) {
  const m = new THREE.Matrix4();
  m.setPosition(cx, cy, cz);
  bucket.add(new THREE.ConeGeometry(r, h, seg), color, m);
}

function sphere(bucket, color, cx, cy, cz, r, wSeg = 8, hSeg = 6) {
  const m = new THREE.Matrix4();
  m.setPosition(cx, cy, cz);
  bucket.add(new THREE.SphereGeometry(r, wSeg, hSeg), color, m);
}

const stdMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.05 });

// ---- the static city -----------------------------------------------------

export function buildCity(scene, city) {
  const ground = new Bucket();
  const solid = new Bucket();
  const leaf = new Bucket();
  const trunk = new Bucket();

  // Base ground slab.
  box(ground, PALETTE.ground, 0, -0.4, 0, WORLD.size, 0.8, WORLD.size);
  // Beach sand strip and the sea floor beneath the water.
  box(ground, PALETTE.sand, 0, -0.2, (WORLD.beachTop + WORLD.size) / 2 - HALF, WORLD.size, 0.4, WORLD.size - WORLD.beachTop);
  box(ground, 0xc9a06a, 0, -0.6, (WORLD.seaTop + WORLD.size) / 2 - HALF, WORLD.size, 0.4, WORLD.size - WORLD.seaTop);

  // Sidewalk ribbons, then asphalt on top, then dashed centre lines.
  const halfRoad = WORLD.roadWidth / 2;
  for (const c of city.centers) {
    const z = c - HALF;
    const x = c - HALF;
    box(ground, PALETTE.sidewalk, 0, 0.02, z, WORLD.size, 0.12, WORLD.roadWidth + WORLD.sidewalk * 2);
    box(ground, PALETTE.sidewalk, x, 0.02, 0, WORLD.roadWidth + WORLD.sidewalk * 2, 0.12, WORLD.size);
    box(ground, PALETTE.asphalt, 0, 0.08, z, WORLD.size, 0.12, WORLD.roadWidth);
    box(ground, PALETTE.asphalt, x, 0.08, 0, WORLD.roadWidth, 0.12, WORLD.size);
    for (let v = 120; v < WORLD.size; v += 240) {
      box(ground, PALETTE.lane, v - HALF, 0.16, z, 26, 0.05, 3);
      box(ground, PALETTE.lane, x, 0.16, v - HALF, 3, 0.05, 26);
    }
  }
  // Harbor basin floor and wooden piers.
  box(ground, 0x8a6a4a, (WORLD.harborX + WORLD.size) / 2 - HALF, -0.5, (WORLD.harborTop + WORLD.harborBottom) / 2 - HALF,
    WORLD.size - WORLD.harborX, 0.4, WORLD.harborBottom - WORLD.harborTop);
  for (const pier of city.piers) {
    box(solid, 0x7a5a38, pier.x + pier.w / 2 - HALF, 7, pier.y + pier.h / 2 - HALF, pier.w, 14, pier.h);
  }
  // Parks are green slabs.
  for (const park of city.parks) {
    box(ground, PALETTE.grass, park.x + park.w / 2 - HALF, 0.06, park.y + park.h / 2 - HALF, park.w, 0.12, park.h);
  }

  // Buildings: wall box, darker base skirt, roof slab, rooftop box on tall ones.
  for (const b of city.buildings) {
    const cx = b.x + b.w / 2 - HALF;
    const cz = b.y + b.h / 2 - HALF;
    box(solid, b.wall, cx, b.height / 2, cz, b.w, b.height, b.h);
    box(solid, 0x000000, cx, 2.5, cz, b.w + 0.3, 5, b.h + 0.3);
    box(solid, b.roof, cx, b.height + 2, cz, b.w + 0.6, 4, b.h + 0.6);
    if (b.tall) box(solid, b.roof, cx, b.height + 5, cz, Math.min(b.w, b.h) * 0.4, 6, Math.min(b.w, b.h) * 0.4);
    // Lit window strips on the two long faces, one band per storey.
    const band = b.height > 400 ? 0x2a2f3a : 0x3a3f4a;
    const rows = Math.floor(b.height / 30);
    for (let r = 0; r < rows; r += 1) {
      const y = 15 + r * 30;
      box(solid, band, cx, y, cz - b.h / 2 - 0.15, b.w * 0.7, 6, 0.3);
      box(solid, band, cx, y, cz + b.h / 2 + 0.15, b.w * 0.7, 6, 0.3);
    }
  }

  // Trees: trunks and leafy cones. Lamps: poles with warm heads. Umbrellas on the beach.
  for (const t of city.trees) {
    const x = t.x - HALF;
    const z = t.y - HALF;
    cyl(trunk, PALETTE.trunk, x, 12, z, 2.5, 3.5, 24, 6);
    cone(leaf, t.r > 12 ? PALETTE.tree : PALETTE.treeDark, x, 28 + t.r, z, t.r * 1.8, 30 + t.r, 7);
    sphere(leaf, PALETTE.tree, x, 45 + t.r, z, t.r * 1.1, 7, 5);
  }
  for (const lamp of city.lamps) {
    const x = lamp.x - HALF;
    const z = lamp.y - HALF;
    cyl(trunk, 0x2b2f36, x, 25, z, 1.2, 1.6, 50, 6);
    sphere(leaf, 0xffe9a8, x, 51, z, 3.2, 6, 5);
  }
  for (const u of city.umbrellas) {
    const x = u.x - HALF;
    const z = u.y - HALF;
    cyl(trunk, 0x8a7a5d, x, 11, z, 0.8, 0.8, 22, 5);
    cone(leaf, u.color, x, 26, z, 24, 12, 8);
  }

  const groundMesh = new THREE.Mesh(ground.build(), stdMat);
  groundMesh.receiveShadow = true;
  groundMesh.scale.setScalar(0.1);
  scene.add(groundMesh);
  const solidMesh = new THREE.Mesh(solid.build(), stdMat);
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  solidMesh.scale.setScalar(0.1);
  scene.add(solidMesh);
  const leafMesh = new THREE.Mesh(leaf.build(), stdMat);
  leafMesh.castShadow = true;
  leafMesh.scale.setScalar(0.1);
  scene.add(leafMesh);
  const trunkMesh = new THREE.Mesh(trunk.build(), stdMat);
  trunkMesh.castShadow = true;
  trunkMesh.scale.setScalar(0.1);
  scene.add(trunkMesh);

  // Water: one sea plane and one harbor plane, gently bobbing in main.
  // These are built in metres directly, unlike the merged city geometry.
  const waterMat = new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.size * 0.1, 110), waterMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.35, 245);
  scene.add(sea);
  const harborWater = new THREE.Mesh(new THREE.PlaneGeometry((WORLD.size - WORLD.harborX) * 0.1, (WORLD.harborBottom - WORLD.harborTop) * 0.1), waterMat);
  harborWater.rotation.x = -Math.PI / 2;
  harborWater.position.set(((WORLD.harborX + WORLD.size) / 2 - HALF) * 0.1, 0.35, ((WORLD.harborTop + WORLD.harborBottom) / 2 - HALF) * 0.1);
  scene.add(harborWater);

  // Low sun disc on the horizon, due west, for the sunset vibe.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(18, 24),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }),
  );
  sun.position.set(-300, 26, 40);
  sun.lookAt(0, 12, 0);
  scene.add(sun);
  return { sea, harborWater };
}

// ---- cars ----------------------------------------------------------------

const matCache = new Map();
export function materialFor(color) {
  if (!matCache.has(color)) {
    matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.35 }));
  }
  return matCache.get(color);
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.15, metalness: 0.6 });
const tireMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.95 });
const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xd21f1f, emissive: 0x7a0d0d, emissiveIntensity: 0.5 });

export function buildCarMesh(def, color, kind = 'civil') {
  const g = new THREE.Group();
  const body = materialFor(color);
  const L = def.length;
  const W = def.width;
  const base = new THREE.Mesh(new THREE.BoxGeometry(L, 0.75, W), body);
  base.position.y = 0.62;
  base.castShadow = true;
  g.add(base);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.52, 0.62, W * 0.86), glassMat);
  cabin.position.set(-L * 0.05, 1.28, 0);
  cabin.castShadow = true;
  g.add(cabin);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(L * 0.18, 0.1, W * 0.9), body);
  hood.position.set(L * 0.38, 1.02, 0);
  g.add(hood);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelPos = [
    [L * 0.32, 0.42, W / 2 - 0.1], [L * 0.32, 0.42, -W / 2 + 0.1],
    [-L * 0.32, 0.42, W / 2 - 0.1], [-L * 0.32, 0.42, -W / 2 + 0.1],
  ];
  const wheels = [];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    w.position.set(x, y, z);
    g.add(w);
    wheels.push(w);
  }
  const hl = new THREE.BoxGeometry(0.12, 0.22, 0.5);
  for (const z of [W / 2 - 0.45, -W / 2 + 0.45]) {
    const h = new THREE.Mesh(hl, lightMat);
    h.position.set(L / 2 + 0.02, 0.72, z);
    g.add(h);
    const t = new THREE.Mesh(hl, tailMat);
    t.position.set(-L / 2 - 0.02, 0.72, z);
    g.add(t);
  }
  if (kind === 'police') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.18, W + 0.04), materialFor(0xf2f2f2));
    stripe.position.y = 0.85;
    g.add(stripe);
    const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0xd21f1f, emissive: 0xff2020, emissiveIntensity: 1.2 }));
    barR.position.set(-L * 0.05, 1.72, 0.45);
    g.add(barR);
    const barB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.5), new THREE.MeshStandardMaterial({ color: 0x2050ff, emissive: 0x2050ff, emissiveIntensity: 1.2 }));
    barB.position.set(-L * 0.05, 1.72, -0.45);
    g.add(barB);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.5), materialFor(0x1a1a1a));
    sign.position.set(-L * 0.05, 1.72, 0);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

// ---- people ---------------------------------------------------------------

const skinMat = new THREE.MeshStandardMaterial({ color: 0xc98e6a, roughness: 0.8 });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2b3442, roughness: 0.85 });

export function buildPersonMesh(shirtColor, skin = skinMat) {
  const g = new THREE.Group();
  const shirt = materialFor(shirtColor);
  const legGeo = new THREE.BoxGeometry(0.26, 0.72, 0.3);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(0, 0.36, 0.18);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0, 0.36, -0.18);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.72), shirt);
  torso.position.y = 1.12;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.24);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(0, 1.15, 0.5);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0, 1.15, -0.5);
  g.add(legL, legR, torso, head, armL, armR);
  g.userData = { legL, legR, armL, armR, torso, head, phase: Math.random() * 6 };
  return g;
}

export function animatePerson(mesh, moving, dt) {
  const u = mesh.userData;
  if (moving) u.phase += dt * 9;
  const swing = moving ? Math.sin(u.phase) * 0.55 : 0;
  u.legL.rotation.z = swing;
  u.legR.rotation.z = -swing;
  u.armL.rotation.z = -swing * 0.8;
  u.armR.rotation.z = swing * 0.8;
}

// ---- markers, beacons and pickups -----------------------------------------

export function buildBeacon(color = 0xffc93e) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.6, 30, 10, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 15;
  const gem = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  gem.position.y = 9;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.1, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  g.add(pillar, gem, ring);
  g.userData.gem = gem;
  return g;
}

export function buildPickupMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'health') {
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), materialFor(0xf2f2f2));
    const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), materialFor(0xd21f1f));
    const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), materialFor(0xd21f1f));
    crossA.position.x = 0.56;
    crossB.position.x = 0.56;
    g.add(boxM, crossA, crossB);
  } else {
    const boxM = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), materialFor(0x2b2f36));
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.9), materialFor(0xf2c230));
    top.position.y = 0.38;
    g.add(boxM, top);
  }
  g.position.y = 1.2;
  return g;
}
