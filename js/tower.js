// Tower rendering: the placed slabs, the slab in motion, falling offcuts, the plinth.
// Slabs are instances of one unit box, so the whole tower is two draw calls and
// there is no per-slab geometry or material to dispose.

import {
  BoxGeometry, CylinderGeometry, Color, Euler, Group, InstancedMesh, Matrix4, Mesh,
  MeshLambertMaterial, Quaternion, Vector3,
} from 'three';
import { RULES, SCENE, DEBRIS, SLAB_GLOW, DEBRIS_TINT } from './config.js';

// Placed slabs wrap around a ring buffer: floors this far below are never in view.
const TOWER_CAPACITY = 2048;
const MOVING_SLOT = 0;

function createSlabMaterial() {
  const material = new MeshLambertMaterial();
  // Instance colour also drives a soft emissive term, so slabs glow against dusk.
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = { value: SLAB_GLOW };
    shader.fragmentShader = shader.fragmentShader
      .replace('uniform float opacity;', 'uniform float opacity;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uGlow;');
  };
  material.customProgramCacheKey = () => 'dusk-slab-glow';
  return material;
}

function createInstances({ geometry, material, capacity }) {
  const mesh = new InstancedMesh(geometry, material, capacity);
  const white = new Color(1, 1, 1);
  // The colour attribute must exist before the first render so the shader variant is stable.
  for (let i = 0; i < capacity; i += 1) mesh.setColorAt(i, white);
  mesh.instanceColor.needsUpdate = true;
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

/**
 * @returns {{ group: Group, reset: Function, addSlab: Function, setMoving: Function,
 *   hideMoving: Function, spawnOffcut: Function, update: Function, dispose: Function }}
 */
export function createTower() {
  const geometry = new BoxGeometry(1, 1, 1);
  const material = createSlabMaterial();
  const placed = createInstances({ geometry, material, capacity: TOWER_CAPACITY });
  const live = createInstances({ geometry, material, capacity: 1 + DEBRIS.max });

  const plinthGeometry = new CylinderGeometry(
    SCENE.plinthRadius, SCENE.plinthRadius * 1.08, SCENE.plinthHeight, SCENE.plinthSegments,
  );
  const plinthMaterial = new MeshLambertMaterial({ color: SCENE.plinthColor });
  plinthMaterial.flatShading = true;
  const plinth = new Mesh(plinthGeometry, plinthMaterial);
  plinth.position.y = -SCENE.plinthHeight / 2;

  const group = new Group();
  group.add(plinth, placed, live);

  const matrix = new Matrix4();
  const position = new Vector3();
  const scale = new Vector3();
  const rotation = new Quaternion();
  const euler = new Euler();
  const color = new Color();
  const noRotation = new Quaternion();

  let debris = [];
  let movingColor = null;
  let placedCount = 0;

  const levelY = (index) => (index + 0.5) * RULES.slabHeight;

  function writeLive(slot, { x, y, z, w, d, quaternion }) {
    position.set(x, y, z);
    scale.set(w, RULES.slabHeight, d);
    matrix.compose(position, quaternion ?? noRotation, scale);
    live.setMatrixAt(slot, matrix);
  }

  function flushLive() {
    live.count = 1 + debris.length;
    live.instanceMatrix.needsUpdate = true;
  }

  function hideMoving() {
    movingColor = null;
    matrix.makeScale(0, 0, 0);
    live.setMatrixAt(MOVING_SLOT, matrix);
    flushLive();
  }

  function reset() {
    placed.count = 0;
    placedCount = 0;
    debris = [];
    hideMoving();
  }

  /**
   * @param {{ index: number, rect: object, color: string }} slab floor index (0 = base), `{x,z,w,d}`, `#rrggbb`
   */
  function addSlab({ index, rect, color: hex }) {
    const slot = index % TOWER_CAPACITY;
    position.set(rect.x, levelY(index), rect.z);
    scale.set(rect.w, RULES.slabHeight, rect.d);
    matrix.compose(position, noRotation, scale);
    placed.setMatrixAt(slot, matrix);
    placed.setColorAt(slot, color.set(hex));
    placed.instanceMatrix.needsUpdate = true;
    placed.instanceColor.needsUpdate = true;
    placedCount = Math.max(placedCount, index + 1);
    placed.count = Math.min(placedCount, TOWER_CAPACITY);
  }

  /**
   * @param {{ index: number, rect: object, color: string, lift: number }} slab `lift` raises it above its level (spawn animation)
   */
  function setMoving({ index, rect, color: hex, lift }) {
    writeLive(MOVING_SLOT, { x: rect.x, y: levelY(index) + lift, z: rect.z, w: rect.w, d: rect.d });
    if (hex !== movingColor) {
      live.setColorAt(MOVING_SLOT, color.set(hex));
      live.instanceColor.needsUpdate = true;
      movingColor = hex;
    }
    flushLive();
  }

  /**
   * @param {{ index: number, rect: object, color: string, push: number, axis: 'x'|'z' }} cut
   * `push` is the sideways speed sign along `axis`.
   */
  function spawnOffcut({ index, rect, color: hex, push, axis }) {
    if (debris.length >= DEBRIS.max) debris.shift();
    debris.push({
      rect,
      y: levelY(index),
      vx: axis === 'x' ? push * DEBRIS.push : 0,
      vz: axis === 'z' ? push * DEBRIS.push : 0,
      vy: 0,
      tiltX: 0,
      tiltZ: 0,
      spinX: axis === 'z' ? push * DEBRIS.spin : 0,
      spinZ: axis === 'x' ? -push * DEBRIS.spin : 0,
      age: 0,
      color: new Color(hex).multiplyScalar(DEBRIS_TINT),
    });
    syncDebrisColors();
  }

  function syncDebrisColors() {
    debris.forEach((piece, i) => live.setColorAt(1 + i, piece.color));
    live.instanceColor.needsUpdate = true;
  }

  /**
   * @param {number} dt seconds, already clamped
   * @param {number} killY world height below which debris is removed
   */
  function update(dt, killY) {
    const before = debris.length;
    debris = debris.filter((piece) => piece.y > killY && piece.age < DEBRIS.maxAge);
    if (debris.length !== before) syncDebrisColors();
    debris.forEach((piece, i) => {
      piece.age += dt;
      piece.vy -= DEBRIS.gravity * dt;
      piece.y += piece.vy * dt;
      piece.rect = { ...piece.rect, x: piece.rect.x + piece.vx * dt, z: piece.rect.z + piece.vz * dt };
      piece.tiltX += piece.spinX * dt;
      piece.tiltZ += piece.spinZ * dt;
      rotation.setFromEuler(euler.set(piece.tiltX, 0, piece.tiltZ));
      writeLive(1 + i, { x: piece.rect.x, y: piece.y, z: piece.rect.z, w: piece.rect.w, d: piece.rect.d, quaternion: rotation });
    });
    flushLive();
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    plinthGeometry.dispose();
    plinthMaterial.dispose();
    placed.dispose();
    live.dispose();
  }

  hideMoving();

  return { group, reset, addSlab, setMoving, hideMoving, spawnOffcut, update, dispose };
}
