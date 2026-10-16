// The player's start.ng character, built from three.js primitives and drawn from a
// normalized style. Facing +z in its own space; the root is turned toward the camera.

import {
  BoxGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh,
  MeshLambertMaterial, SphereGeometry, TorusGeometry,
} from 'three';
import { CHARACTER as C } from './config.js';

// Model dimensions (not gameplay tunables). Heights are measured from the feet.
const SHAPE = Object.freeze({
  hairCap: 1.12,
  hairCapReach: Math.PI * 0.55,
  afroRadius: 0.24,
  afroLift: 0.11,
  afroBack: 0.075,
  afroUnderHat: 0.85,
  strandRadius: 0.016,
  braidLength: 0.27,
  braidCount: 6,
  braidArc: 1.3,
  dreadLength: 0.34,
  dreadCount: 10,
  dreadArc: 1.75,
  dreadRadius: 0.021,
  bunRadius: 0.08,
  ponytailRadius: 0.035,
  ponytailLength: 0.2,
  ponytailTilt: -0.6,
  eyeRadius: 0.027,
  pupilRadius: 0.015,
  pupilForward: 0.018,
  eyeSpread: 0.058,
  eyeForward: 0.15,
  hatLiftAfroSmall: 0.09,
  hatLiftAfroTall: 0.14,
  domeScale: 1.12,
  beanieScale: 1.18,
  beanieReach: Math.PI * 0.6,
  brimRadius: 0.17,
  brimThickness: 0.014,
  brimForward: 0.05,
  pomRadius: 0.04,
  topHatHeight: 0.26,
  topHatRadius: 0.145,
  topHatBrim: 0.25,
  crownRadius: 0.165,
  crownHeight: 0.1,
  crownPoints: 5,
  crownPointRadius: 0.03,
  crownPointHeight: 0.1,
  glassesRadius: 0.045,
  glassesTube: 0.008,
  glassesSpread: 0.06,
  earringRadius: 0.02,
  beardScale: 0.78,
  scarfRadius: 0.1,
  scarfTube: 0.035,
  packWidth: 0.26,
  packHeight: 0.3,
  packDepth: 0.1,
  neckRadius: 0.05,
  squash: 0.18,
  squashSeconds: 0.18,
  cheerArm: 2.5,
  cheerHop: 0.12,
  tumbleSpinX: 6,
  tumbleSpinZ: 4,
});

const COVERED_BY_HAT = new Set(['cap', 'beanie']);

function createBuilder() {
  const geometries = [];
  const materials = new Map();
  const material = (hex, doubleSided = false) => {
    const key = `${hex}${doubleSided}`;
    if (!materials.has(key)) {
      const m = new MeshLambertMaterial(doubleSided ? { color: hex, side: DoubleSide } : { color: hex });
      m.flatShading = true;
      materials.set(key, m);
    }
    return materials.get(key);
  };
  const mesh = (geometry, hex, { doubleSided = false, x = 0, y = 0, z = 0 } = {}) => {
    geometries.push(geometry);
    const m = new Mesh(geometry, material(hex, doubleSided));
    m.position.set(x, y, z);
    return m;
  };
  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
  };
  return { mesh, dispose };
}

function buildFigure(style, { mesh }) {
  const figure = new Group();
  const female = style.body === 'female';
  const torsoWidth = female ? C.torsoWidthFemale : C.torsoWidthMale;
  const torsoY = C.legHeight + C.torsoHeight / 2;
  const neckY = C.legHeight + C.torsoHeight;
  const headY = neckY + C.neckGap + C.headRadius;
  const R = C.headRadius;
  const seg = C.segments;

  // Legs and shoes
  const legX = (C.legWidth + C.legGap) / 2;
  if (female) {
    const legHeight = C.legHeight - 0.04;
    for (const side of [-1, 1]) {
      figure.add(mesh(new BoxGeometry(C.legWidth * 0.75, legHeight, C.legWidth * 0.75), style.skinColor, { x: side * legX, y: legHeight / 2 }));
    }
    figure.add(mesh(new CylinderGeometry(C.skirtTop, C.skirtBottom, C.skirtHeight, seg), style.secondaryColor, { y: C.legHeight + 0.02 }));
  } else {
    for (const side of [-1, 1]) {
      figure.add(mesh(new BoxGeometry(C.legWidth, C.legHeight, C.legWidth), style.secondaryColor, { x: side * legX, y: C.legHeight / 2 }));
    }
  }
  for (const side of [-1, 1]) {
    figure.add(mesh(new BoxGeometry(C.legWidth, 0.05, C.legWidth * 1.4), C.shoe, { x: side * legX, y: 0.025, z: 0.03 }));
  }

  // Torso, neck, arms
  figure.add(mesh(new BoxGeometry(torsoWidth, C.torsoHeight, C.torsoDepth), style.primaryColor, { y: torsoY }));
  figure.add(mesh(new CylinderGeometry(SHAPE.neckRadius, SHAPE.neckRadius, 0.06, seg), style.skinColor, { y: neckY + 0.01 }));

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(side * (torsoWidth / 2 + C.armWidth / 2), neckY - 0.03, 0);
    pivot.rotation.z = side * 0.08;
    pivot.add(mesh(new BoxGeometry(C.armWidth + 0.012, C.sleeveLength, C.armWidth + 0.012), style.primaryColor, { y: -C.sleeveLength / 2 }));
    pivot.add(mesh(new BoxGeometry(C.armWidth, C.forearmLength, C.armWidth), style.skinColor, { y: -C.sleeveLength - C.forearmLength / 2 }));
    figure.add(pivot);
    arms.push({ pivot, side });
  }

  // Head and face
  figure.add(mesh(new SphereGeometry(R, 10, 8), style.skinColor, { y: headY }));
  for (const side of [-1, 1]) {
    // A light eye with a dark pupil stays visible on every skin colour.
    const eyeAt = { x: side * SHAPE.eyeSpread, y: headY + 0.01, z: SHAPE.eyeForward };
    figure.add(mesh(new SphereGeometry(SHAPE.eyeRadius, 6, 5), C.eyeWhite, eyeAt));
    figure.add(mesh(new SphereGeometry(SHAPE.pupilRadius, 6, 5), C.eye, { ...eyeAt, z: eyeAt.z + SHAPE.pupilForward }));
  }

  // Hair
  const hatCovers = COVERED_BY_HAT.has(style.hat);
  const hairCap = () => {
    const cap = mesh(new SphereGeometry(R * SHAPE.hairCap, 10, 8, 0, Math.PI * 2, 0, SHAPE.hairCapReach), style.hairColor, { y: headY + 0.01, z: -0.012 });
    cap.rotation.x = -0.25;
    return cap;
  };
  const strands = ({ count, arc, length, radius, drop }) => {
    for (let i = 0; i < count; i += 1) {
      const angle = count === 1 ? 0 : -arc + (2 * arc * i) / (count - 1);
      const strand = mesh(
        new CylinderGeometry(radius, radius, length, 5), style.hairColor,
        { x: Math.sin(angle) * R * 0.95, y: headY - drop - length / 2 + 0.1, z: -Math.cos(angle) * R * 0.95 },
      );
      figure.add(strand);
    }
  };

  let hatLift = 0;
  switch (style.hair) {
    case 'short':
      if (!hatCovers) figure.add(hairCap());
      break;
    case 'afro': {
      const scale = hatCovers ? SHAPE.afroUnderHat : 1;
      const afro = mesh(new SphereGeometry(SHAPE.afroRadius, 10, 8), style.hairColor, { y: headY + SHAPE.afroLift, z: -SHAPE.afroBack });
      afro.scale.setScalar(scale);
      figure.add(afro);
      hatLift = hatCovers ? SHAPE.hatLiftAfroSmall : SHAPE.hatLiftAfroTall;
      break;
    }
    case 'braids':
      if (!hatCovers) figure.add(hairCap());
      strands({ count: SHAPE.braidCount, arc: SHAPE.braidArc, length: SHAPE.braidLength, radius: SHAPE.strandRadius, drop: 0.08 });
      break;
    case 'bun':
      if (!hatCovers) {
        figure.add(hairCap());
        figure.add(mesh(new SphereGeometry(SHAPE.bunRadius, 8, 6), style.hairColor, { y: headY + R * 1.1 + 0.04, z: -0.03 }));
      }
      break;
    case 'ponytail': {
      if (!hatCovers) figure.add(hairCap());
      const tail = mesh(new CapsuleGeometry(SHAPE.ponytailRadius, SHAPE.ponytailLength, 3, 6), style.hairColor, { y: headY - 0.02, z: -R - 0.05 });
      tail.rotation.x = SHAPE.ponytailTilt;
      figure.add(tail);
      break;
    }
    case 'dreads':
      if (!hatCovers) figure.add(hairCap());
      strands({ count: SHAPE.dreadCount, arc: SHAPE.dreadArc, length: SHAPE.dreadLength, radius: SHAPE.dreadRadius, drop: 0.05 });
      break;
    default:
      break; // bald
  }

  // Hat
  const hatY = headY + hatLift;
  switch (style.hat) {
    case 'cap': {
      figure.add(mesh(new SphereGeometry(R * SHAPE.domeScale, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), style.primaryColor, { y: hatY + 0.02 }));
      figure.add(mesh(
        new CylinderGeometry(SHAPE.brimRadius, SHAPE.brimRadius, SHAPE.brimThickness, 10, 1, false, -Math.PI / 2, Math.PI),
        style.primaryColor, { y: hatY + 0.075, z: SHAPE.brimForward },
      ));
      break;
    }
    case 'beanie': {
      figure.add(mesh(new SphereGeometry(R * SHAPE.beanieScale, 10, 8, 0, Math.PI * 2, 0, SHAPE.beanieReach), style.primaryColor, { y: hatY + 0.015 }));
      figure.add(mesh(new SphereGeometry(SHAPE.pomRadius, 8, 6), style.secondaryColor, { y: hatY + R * SHAPE.beanieScale + 0.01 }));
      break;
    }
    case 'tophat': {
      const brimY = hatY + R * 0.88;
      figure.add(mesh(new CylinderGeometry(SHAPE.topHatBrim, SHAPE.topHatBrim, 0.025, 12), C.hatDark, { y: brimY }));
      figure.add(mesh(new CylinderGeometry(SHAPE.topHatRadius, SHAPE.topHatRadius + 0.01, SHAPE.topHatHeight, 10), C.hatDark, { y: brimY + SHAPE.topHatHeight / 2 }));
      figure.add(mesh(new CylinderGeometry(SHAPE.topHatRadius + 0.012, SHAPE.topHatRadius + 0.016, 0.045, 10), style.primaryColor, { y: brimY + 0.04 }));
      break;
    }
    case 'crown': {
      const baseY = hatY + R * 0.85 + SHAPE.crownHeight / 2;
      figure.add(mesh(new CylinderGeometry(SHAPE.crownRadius, SHAPE.crownRadius + 0.01, SHAPE.crownHeight, 10, 1, true), C.gold, { y: baseY, doubleSided: true }));
      for (let i = 0; i < SHAPE.crownPoints; i += 1) {
        const angle = (i / SHAPE.crownPoints) * Math.PI * 2;
        figure.add(mesh(
          new ConeGeometry(SHAPE.crownPointRadius, SHAPE.crownPointHeight, 4), C.gold,
          { x: Math.sin(angle) * SHAPE.crownRadius, y: baseY + SHAPE.crownHeight / 2 + SHAPE.crownPointHeight / 2 - 0.01, z: Math.cos(angle) * SHAPE.crownRadius },
        ));
      }
      break;
    }
    default:
      break;
  }

  // Accessory
  switch (style.accessory) {
    case 'glasses':
      for (const side of [-1, 1]) {
        figure.add(mesh(new TorusGeometry(SHAPE.glassesRadius, SHAPE.glassesTube, 6, 12), C.hatDark, { x: side * SHAPE.glassesSpread, y: headY + 0.01, z: R - 0.005 }));
      }
      figure.add(mesh(new BoxGeometry(SHAPE.glassesSpread, SHAPE.glassesTube, SHAPE.glassesTube), C.hatDark, { y: headY + 0.02, z: R }));
      break;
    case 'earrings':
      for (const side of [-1, 1]) {
        figure.add(mesh(new SphereGeometry(SHAPE.earringRadius, 6, 5), C.gold, { x: side * (R + 0.005), y: headY - 0.03 }));
      }
      break;
    case 'beard': {
      const beard = mesh(new SphereGeometry(R * SHAPE.beardScale, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), style.hairColor, { y: headY - 0.05, z: 0.05 });
      beard.scale.set(1.05, 1.15, 1);
      figure.add(beard);
      break;
    }
    case 'scarf': {
      const ring = mesh(new TorusGeometry(SHAPE.scarfRadius, SHAPE.scarfTube, 6, 10), style.secondaryColor, { y: neckY });
      ring.rotation.x = Math.PI / 2;
      figure.add(ring);
      figure.add(mesh(new BoxGeometry(0.06, 0.16, 0.03), style.secondaryColor, { x: 0.06, y: neckY - 0.09, z: SHAPE.scarfRadius + 0.02 }));
      break;
    }
    case 'backpack':
      figure.add(mesh(new BoxGeometry(SHAPE.packWidth, SHAPE.packHeight, SHAPE.packDepth), style.secondaryColor, { y: torsoY + 0.01, z: -(C.torsoDepth / 2 + SHAPE.packDepth / 2) }));
      break;
    default:
      break;
  }

  return { figure, arms };
}

/**
 * @returns {{ group: Group, setStyle: Function, place: Function, land: Function, cheer: Function,
 *   tumble: Function, reset: Function, update: Function, dispose: Function }}
 */
export function createCharacter() {
  const group = new Group();
  const root = new Group();
  group.add(root);

  let built = null;
  let arms = [];
  let bobTime = 0;
  let squashLeft = 0;
  let cheerLeft = 0;
  let fall = null;

  const faceCamera = () => {
    root.rotation.set(0, C.facingYaw, 0);
    root.scale.setScalar(1);
    root.position.set(0, 0, 0);
  };
  faceCamera();

  /** @param {Record<string, string>} style normalized style */
  function setStyle(style) {
    if (built) {
      root.remove(built.figure);
      built.builder.dispose();
    }
    const builder = createBuilder();
    const { figure, arms: rig } = buildFigure(style, builder);
    root.add(figure);
    built = { figure, builder };
    arms = rig;
  }

  /** Put the character on a slab top at world position (x, y, z). */
  function place(x, y, z) {
    if (!fall) group.position.set(x, y, z);
  }

  function land() {
    squashLeft = SHAPE.squashSeconds;
  }

  function cheer() {
    cheerLeft = C.cheerSeconds;
  }

  /** @param {{ vx: number, vz: number }} push sideways speed as it slides off */
  function tumble({ vx, vz }) {
    fall = { vx: vx * C.tumbleSpeed * 0.25, vy: C.tumbleLift, vz: vz * C.tumbleSpeed * 0.25 };
  }

  function reset() {
    fall = null;
    group.visible = true;
    squashLeft = 0;
    cheerLeft = 0;
    faceCamera();
    arms.forEach(({ pivot, side }) => pivot.rotation.set(0, 0, side * 0.08));
  }

  /** @param {number} dt seconds, already clamped */
  function update(dt) {
    if (fall) {
      fall.vy -= C.tumbleGravity * dt;
      group.position.x += fall.vx * dt;
      group.position.y += fall.vy * dt;
      group.position.z += fall.vz * dt;
      root.rotation.x += SHAPE.tumbleSpinX * dt;
      root.rotation.z += SHAPE.tumbleSpinZ * dt;
      group.visible = group.position.y > -C.tumbleKillBelow;
      return;
    }
    bobTime += dt;
    const bob = Math.sin(bobTime * C.idleSpeed) * C.idleBob;

    squashLeft = Math.max(0, squashLeft - dt);
    const squash = squashLeft / SHAPE.squashSeconds;
    root.scale.set(1 + SHAPE.squash * 0.5 * squash, 1 - SHAPE.squash * squash, 1 + SHAPE.squash * 0.5 * squash);

    cheerLeft = Math.max(0, cheerLeft - dt);
    const k = cheerLeft / C.cheerSeconds;
    const lift = Math.sin((1 - k) * Math.PI);
    root.position.y = bob + (cheerLeft > 0 ? lift * SHAPE.cheerHop : 0);
    root.rotation.y = C.facingYaw + (cheerLeft > 0 ? Math.sin((1 - k) * Math.PI * 2) * C.hopSpin * 0.5 : 0);
    arms.forEach(({ pivot, side }) => {
      pivot.rotation.z = side * (0.08 + (cheerLeft > 0 ? lift * SHAPE.cheerArm : 0));
    });
  }

  function dispose() {
    if (built) built.builder.dispose();
    built = null;
  }

  return { group, setStyle, place, land, cheer, tumble, reset, update, dispose };
}
