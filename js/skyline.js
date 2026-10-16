// A ring of dark low-poly buildings with a few warm windows. Two instanced meshes,
// so the whole skyline is two draw calls. It follows the camera rise only partly,
// which reads as parallax.

import { BoxGeometry, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Quaternion, Vector3, Euler } from 'three';
import { SKYLINE, SCENE } from './config.js';
import { createRandom } from './logic.js';

// Columns reach far below the water so no gap shows as the group lifts.
const COLUMN_DEPTH = 90;
const DEG = Math.PI / 180;

/**
 * @returns {{ group: Group, update: Function, dispose: Function }}
 */
export function createSkyline() {
  const random = createRandom(SKYLINE.seed);
  const between = (min, max) => min + (max - min) * random();

  const geometry = new BoxGeometry(1, 1, 1);
  const wallMaterial = new MeshBasicMaterial({ color: SKYLINE.color });
  const windowMaterial = new MeshBasicMaterial({ color: 0xffffff });

  const walls = new InstancedMesh(geometry, wallMaterial, SKYLINE.count);
  const lit = [];
  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const euler = new Euler();
  const baseY = -SCENE.plinthHeight;

  for (let i = 0; i < SKYLINE.count; i += 1) {
    const gap = SKYLINE.gapDeg * DEG;
    const arc = Math.PI * 2 - gap;
    const angle = SKYLINE.gapCenterDeg * DEG + gap / 2 + (i / SKYLINE.count) * arc + between(-0.04, 0.04);
    const radius = between(SKYLINE.innerRadius, SKYLINE.outerRadius);
    const w = between(SKYLINE.minWidth, SKYLINE.maxWidth);
    const d = between(SKYLINE.minWidth, SKYLINE.maxWidth);
    const h = between(SKYLINE.minHeight, SKYLINE.maxHeight);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // Local +z faces the tower.
    rotation.setFromEuler(euler.set(0, -Math.PI / 2 - angle, 0));

    position.set(x, baseY + h / 2 - COLUMN_DEPTH / 2, z);
    scale.set(w, h + COLUMN_DEPTH, d);
    matrix.compose(position, rotation, scale);
    walls.setMatrixAt(i, matrix);

    for (let k = 0; k < SKYLINE.windowsPerBuilding; k += 1) {
      const fx = between(-0.5, 0.5);
      const fy = between(0.1, 0.95);
      const on = random() < SKYLINE.windowLitChance;
      if (!on) continue;
      const local = new Vector3(fx * (w - SKYLINE.windowSize * 2), fy * h - h / 2, d / 2 + 0.02);
      local.applyQuaternion(rotation);
      lit.push({
        x: x + local.x,
        y: baseY + h / 2 + local.y,
        z: z + local.z,
        rotation: rotation.clone(),
        shade: between(0.55, 1),
      });
    }
  }
  walls.frustumCulled = false;

  const windows = new InstancedMesh(geometry, windowMaterial, Math.max(1, lit.length));
  const warm = new Color(SKYLINE.windowColor);
  const tint = new Color();
  lit.forEach((win, i) => {
    position.set(win.x, win.y, win.z);
    scale.set(SKYLINE.windowSize, SKYLINE.windowSize * 1.3, 0.04);
    matrix.compose(position, win.rotation, scale);
    windows.setMatrixAt(i, matrix);
    windows.setColorAt(i, tint.copy(warm).multiplyScalar(win.shade));
  });
  windows.count = lit.length;
  windows.frustumCulled = false;

  const group = new Group();
  group.add(walls, windows);

  /** @param {number} lift how far the camera focus has risen since the start of the round */
  function update(lift) {
    group.position.y = lift * SKYLINE.parallax;
  }

  function dispose() {
    geometry.dispose();
    wallMaterial.dispose();
    windowMaterial.dispose();
    walls.dispose();
    windows.dispose();
  }

  return { group, update, dispose };
}
