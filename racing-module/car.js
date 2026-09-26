import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Local car space: +Z is forward, +Y up, origin on the centerline at the wheel-contact level
// (the Car group itself sits 0.22 above the road). All shapes below are side profiles drawn in
// (z, y) and extruded across the car's width.

const WHEEL_RADIUS = 0.45;
const WHEEL_Y = 0.42;
const AXLE_Z = 1.6; // front axle at +AXLE_Z, rear at -AXLE_Z
const WHEEL_X = 1.15;
const WELL_RADIUS = 0.6; // arch cut into the body's lower edge; minus the 0.06 bevel it clears the tire by ~0.09
const SILL_Y = 0.32; // bottom edge of the body between the arches
const BODY_WIDTH = 2.24; // before bevel; the bevel adds 0.08 per side
const BODY_BEVEL = { bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 24 };

// Cabin ("greenhouse") outline, rear to front along the belt line.
const CABIN = {
  rearBase: [-1.5, 1.05],
  rearTop: [-1.1, 1.72],
  frontTop: [0.25, 1.72],
  frontBase: [0.95, 1.07],
  halfWidth: 0.92,
};

// Extrudes a (z, y) side profile across the width, centered on x = 0, keeping +Z forward.
function extrudeProfile(shape, width, options) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, ...options });
  geometry.translate(0, 0, -width / 2);
  geometry.rotateY(-Math.PI / 2); // shape-x (car z) stays +Z; extrusion axis becomes the car's x
  return geometry;
}

function bodyGeometry() {
  const s = new THREE.Shape();
  const a = Math.asin((WHEEL_Y - SILL_Y) / WELL_RADIUS); // where the arch meets the sill line
  const archHalf = Math.sqrt(WELL_RADIUS ** 2 - (WHEEL_Y - SILL_Y) ** 2);
  s.moveTo(-2.4, SILL_Y);
  // underside, rear to front, with an arch over each axle
  s.lineTo(-AXLE_Z - archHalf, SILL_Y);
  s.absarc(-AXLE_Z, WHEEL_Y, WELL_RADIUS, Math.PI + a, -a, true);
  s.lineTo(AXLE_Z - archHalf, SILL_Y);
  s.absarc(AXLE_Z, WHEEL_Y, WELL_RADIUS, Math.PI + a, -a, true);
  s.lineTo(2.35, SILL_Y);
  // nose, then hood back to the cowl
  s.lineTo(2.5, 0.5);
  s.lineTo(2.52, 0.78);
  s.lineTo(2.35, 0.92);
  s.lineTo(1.05, 1.06);
  // belt line under the cabin, then the trunk deck and tail
  s.lineTo(-1.55, 1.08);
  s.lineTo(-2.3, 1.02);
  s.lineTo(-2.48, 0.85);
  s.lineTo(-2.45, 0.5);
  s.lineTo(-2.4, SILL_Y);
  return extrudeProfile(s, BODY_WIDTH, BODY_BEVEL);
}

function cabinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(...CABIN.rearBase);
  s.lineTo(...CABIN.rearTop);
  s.lineTo(...CABIN.frontTop);
  s.lineTo(...CABIN.frontBase);
  s.lineTo(...CABIN.rearBase);
  return extrudeProfile(s, CABIN.halfWidth * 2, { bevelEnabled: false });
}

// A flat panel lying on the cabin face between two (z, y) points, nudged outward so it sits
// just proud of the face.
function slopedPanel(from, to, width, material) {
  const dz = to[0] - from[0], dy = to[1] - from[1];
  const length = Math.hypot(dz, dy);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
  const phi = Math.atan2(dz, dy);
  mesh.rotation.x = phi;
  let nz = Math.cos(phi), ny = -Math.sin(phi);
  const midZ = (from[0] + to[0]) / 2, midY = (from[1] + to[1]) / 2;
  const cabinCenterZ = -0.35, cabinCenterY = 1.35;
  if (nz * (midZ - cabinCenterZ) + ny * (midY - cabinCenterY) < 0) { nz = -nz; ny = -ny; }
  mesh.position.set(0, midY + ny * 0.012, midZ + nz * 0.012);
  return mesh;
}

// Thin painted strip along a cabin edge (A/C pillars), at the given x.
function pillar(from, to, x, material) {
  const dz = to[0] - from[0], dy = to[1] - from[1];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, Math.hypot(dz, dy)), material);
  mesh.rotation.x = -Math.atan2(dy, dz);
  mesh.position.set(x, (from[1] + to[1]) / 2, (from[0] + to[0]) / 2);
  mesh.castShadow = true;
  return mesh;
}

// ---- wheel parts, all built with the axle along X and the outer face toward +X ----
const TIRE_WIDTH = 0.42;
const RIM_RADIUS = 0.29;

// Rounded tire cross-section spun around the axle.
function tireGeometry() {
  const w = TIRE_WIDTH / 2;
  const profile = [
    [RIM_RADIUS, -w + 0.02], [0.39, -w], [0.435, -w + 0.035], [WHEEL_RADIUS - 0.02, -w + 0.08],
    [WHEEL_RADIUS - 0.02, w - 0.08], [0.435, w - 0.035], [0.39, w], [RIM_RADIUS, w - 0.02],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(profile, 36).rotateZ(Math.PI / 2);
}

// Raised tread blocks around the circumference, merged into one mesh.
function treadGeometry() {
  const blocks = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const block = new THREE.BoxGeometry(TIRE_WIDTH - 0.14, 0.035, 0.07);
    block.translate(0, WHEEL_RADIUS - 0.005, 0);
    block.rotateX(angle);
    blocks.push(block);
  }
  return mergeGeometries(blocks);
}

// Rim: an open barrel, a lip ring at the outer face, five spokes and a center cap.
function rimGeometries() {
  const barrel = new THREE.CylinderGeometry(RIM_RADIUS, RIM_RADIUS, TIRE_WIDTH - 0.06, 28, 1, true).rotateZ(Math.PI / 2);
  const lip = new THREE.TorusGeometry(RIM_RADIUS - 0.01, 0.025, 8, 28).rotateY(Math.PI / 2).translate(0.17, 0, 0);
  const spokes = [];
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.BoxGeometry(0.05, RIM_RADIUS - 0.06, 0.07);
    spoke.translate(0.15, (RIM_RADIUS - 0.06) / 2 + 0.05, 0);
    spoke.rotateX((i / 5) * Math.PI * 2);
    spokes.push(spoke);
  }
  const face = mergeGeometries([lip, ...spokes]);
  const hub = new THREE.CylinderGeometry(0.075, 0.09, 0.08, 16).rotateZ(Math.PI / 2).translate(0.16, 0, 0);
  const innerDisc = new THREE.CircleGeometry(RIM_RADIUS - 0.005, 28).rotateY(Math.PI / 2).translate(0.02, 0, 0);
  return { barrel, face, hub, innerDisc };
}

function sideWindowGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-1.35, 1.12);
  s.lineTo(-1.03, 1.64);
  s.lineTo(0.2, 1.64);
  s.lineTo(0.8, 1.12);
  s.lineTo(-1.35, 1.12);
  const geometry = new THREE.ShapeGeometry(s);
  geometry.rotateY(-Math.PI / 2);
  return geometry;
}

// Built once and shared by every car; only the paint differs per car.
const shared = {
  body: bodyGeometry(),
  cabin: cabinGeometry(),
  sideWindow: sideWindowGeometry(),
  wellLiner: new THREE.CylinderGeometry(WELL_RADIUS - 0.07, WELL_RADIUS - 0.07, BODY_WIDTH + 0.1, 20, 1, true, 0, Math.PI)
    .rotateZ(Math.PI / 2),
  tire: tireGeometry(),
  tread: treadGeometry(),
  rim: rimGeometries(),
  headlight: new RoundedBoxGeometry(0.5, 0.16, 0.1, 2, 0.04),
  taillight: new RoundedBoxGeometry(0.55, 0.14, 0.08, 2, 0.035),
  grille: new RoundedBoxGeometry(0.95, 0.16, 0.06, 2, 0.03),
  roof: new RoundedBoxGeometry(CABIN.halfWidth * 2 + 0.06, 0.07, 1.42, 2, 0.03),
  spoiler: new RoundedBoxGeometry(2.0, 0.05, 0.28, 2, 0.02),
  bPillar: new THREE.BoxGeometry(0.03, 0.56, 0.1),
};

// Every car material is Lambert (diffuse only): no reflections and no specular highlights, so
// nothing on the car can catch the sun or scene.environment and glare. Shading comes purely from
// the scene's lights.
const materials = {
  // Slightly transparent tinted glass.
  glass: new THREE.MeshLambertMaterial({
    color: 0x1b2836,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  interior: new THREE.MeshLambertMaterial({ color: 0x0d1014 }),
  wellLiner: new THREE.MeshLambertMaterial({ color: 0x08090b, side: THREE.DoubleSide }),
  trim: new THREE.MeshLambertMaterial({ color: 0x15171a }),
  headlight: new THREE.MeshLambertMaterial({ color: 0xf4f7ff, emissive: 0xfff4d6, emissiveIntensity: 1.3 }),
  taillight: new THREE.MeshLambertMaterial({ color: 0x5a0508, emissive: 0xff1f24, emissiveIntensity: 1.1 }),
  tire: new THREE.MeshLambertMaterial({ color: 0x1a1a1c }),
  tread: new THREE.MeshLambertMaterial({ color: 0x0c0c0d }),
  // The one metallic, reflective part of the car. Rims face sideways, so unlike the roof/trunk
  // they can't mirror the overhead light into the chase camera; the reflection is kept modest.
  rim: new THREE.MeshStandardMaterial({ color: 0xc4cad1, metalness: 0.85, roughness: 0.35, envMapIntensity: 0.6, side: THREE.DoubleSide }),
  hub: new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 0.9, roughness: 0.3, envMapIntensity: 0.6 }),
  rimInner: new THREE.MeshLambertMaterial({ color: 0x1c1f23 }),
};

function mesh(geometry, material, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export class Car extends THREE.Group {
  constructor({ paintColor = 0xc0282c } = {}) {
    super();

    // The scene's direct lights alone leave matte paint very dark, so a low emissive in the
    // paint's own color lifts it evenly (a flat lift, not a reflection or highlight).
    const paint = new THREE.MeshLambertMaterial({ color: paintColor, emissive: paintColor, emissiveIntensity: 0.3 });
    this.paintMaterial = paint;

    this.add(mesh(shared.body, paint, { receive: true }));
    this.add(mesh(shared.cabin, materials.interior));

    const roof = mesh(shared.roof, paint);
    roof.position.set(0, CABIN.rearTop[1] + 0.03, (CABIN.rearTop[0] + CABIN.frontTop[0]) / 2);
    this.add(roof);

    // Glass: windshield, rear window, and a side window each side, all separate meshes.
    this.add(slopedPanel(CABIN.frontBase, CABIN.frontTop, CABIN.halfWidth * 2 - 0.14, materials.glass));
    this.add(slopedPanel(CABIN.rearBase, CABIN.rearTop, CABIN.halfWidth * 2 - 0.14, materials.glass));
    [-1, 1].forEach(side => {
      const sideWindow = new THREE.Mesh(shared.sideWindow, materials.glass);
      sideWindow.position.x = side * (CABIN.halfWidth + 0.012);
      this.add(sideWindow);

      const x = side * (CABIN.halfWidth - 0.02);
      this.add(pillar(CABIN.frontBase, CABIN.frontTop, x, paint)); // A-pillar
      this.add(pillar(CABIN.rearBase, CABIN.rearTop, x, paint)); // C-pillar
      const bPillar = mesh(shared.bPillar, paint);
      bPillar.position.set(side * (CABIN.halfWidth + 0.02), 1.38, -0.42);
      this.add(bPillar);
    });

    const spoiler = mesh(shared.spoiler, paint);
    spoiler.position.set(0, 1.1, -2.2);
    this.add(spoiler);

    const grille = mesh(shared.grille, materials.trim, { cast: false });
    grille.position.set(0, 0.6, 2.6);
    this.add(grille);

    [-1, 1].forEach(side => {
      const headlight = mesh(shared.headlight, materials.headlight, { cast: false });
      headlight.position.set(side * 0.72, 0.72, 2.6);
      this.add(headlight);

      const taillight = mesh(shared.taillight, materials.taillight, { cast: false });
      taillight.position.set(side * 0.75, 0.86, -2.57);
      this.add(taillight);
    });

    // Dark liners fill each arch across the full width, so the wells read as recesses.
    [AXLE_Z, -AXLE_Z].forEach(z => {
      const liner = mesh(shared.wellLiner, materials.wellLiner, { cast: false });
      liner.position.set(0, WHEEL_Y, z);
      this.add(liner);
    });

    // Each wheel: a positioned group (mirrored on the left so the rim face points outward) holding
    // a spinner group that updateWheels() rotates about the axle.
    this.wheels = [];
    this.wheelSpinners = [];
    [[-WHEEL_X, AXLE_Z], [WHEEL_X, AXLE_Z], [-WHEEL_X, -AXLE_Z], [WHEEL_X, -AXLE_Z]].forEach(([x, z]) => {
      const wheel = new THREE.Group();
      wheel.position.set(x, WHEEL_Y, z);
      if (x < 0) wheel.scale.x = -1;
      const spinner = new THREE.Group();
      spinner.add(mesh(shared.tire, materials.tire, { receive: true }));
      spinner.add(mesh(shared.tread, materials.tread));
      spinner.add(mesh(shared.rim.barrel, materials.rim, { cast: false }));
      spinner.add(mesh(shared.rim.face, materials.rim));
      spinner.add(mesh(shared.rim.hub, materials.hub, { cast: false }));
      spinner.add(mesh(shared.rim.innerDisc, materials.rimInner, { cast: false }));
      wheel.add(spinner);
      this.add(wheel);
      this.wheels.push(wheel);
      this.wheelSpinners.push(spinner);
    });

    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.steer = 0;
    this.turnInput = 0;
    this.drift = 0;
    this.maxSpeed = 42;
    this.position.set(0, 0.22, 0);
  }

  // Rolls the wheels for a distance travelled along the car's own forward (+Z) direction;
  // negative distances roll them backward.
  updateWheels(forwardDistance) {
    const angle = forwardDistance / WHEEL_RADIUS;
    this.wheelSpinners.forEach(spinner => { spinner.rotation.x += angle; });
  }

  steer(amount) {
    this.turnInput = amount;
  }
}
