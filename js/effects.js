// Transient effects: sparks and dust (one Points object, capped) and the soft
// ring that flashes on a perfect drop.

import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, Group, Mesh,
  MeshBasicMaterial, Points, RingGeometry, ShaderMaterial,
} from 'three';
import { PARTICLES, SCENE } from './config.js';

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -view.z;
  gl_Position = projectionMatrix * view;
}`;

const FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
}`;

const rand = (min, max) => min + (max - min) * Math.random();

/**
 * @param {{ reducedMotion: () => boolean }} options
 * @returns {{ group: Group, burst: Function, ring: Function, update: Function, setPixelScale: Function, dispose: Function }}
 */
export function createEffects({ reducedMotion }) {
  const max = PARTICLES.max;
  const positions = new Float32Array(max * 3);
  const colors = new Float32Array(max * 3);
  const sizes = new Float32Array(max);
  const alphas = new Float32Array(max);
  const velocity = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const lifeSpan = new Float32Array(max);
  const baseSize = new Float32Array(max);

  const geometry = new BufferGeometry();
  const attributes = {
    position: new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage),
    aColor: new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage),
    aSize: new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage),
    aAlpha: new BufferAttribute(alphas, 1).setUsage(DynamicDrawUsage),
  };
  Object.entries(attributes).forEach(([name, attribute]) => geometry.setAttribute(name, attribute));

  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
    uniforms: { uScale: { value: 1000 } },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;

  const ringGeometry = new RingGeometry(0.9, 1, SCENE.ringSegments);
  ringGeometry.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: SCENE.ringPool }, () => {
    const ringMaterial = new MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false,
    });
    const mesh = new Mesh(ringGeometry, ringMaterial);
    mesh.visible = false;
    return { mesh, age: SCENE.ringFlashSeconds, radius: 1 };
  });
  let nextRing = 0;

  const group = new Group();
  group.add(points, ...rings.map((r) => r.mesh));

  const tint = new Color();

  function spawn({ x, y, z, vx, vy, vz, seconds, size, color }) {
    let slot = life.findIndex((value) => value <= 0);
    if (slot === -1) slot = 0;
    positions.set([x, y, z], slot * 3);
    velocity.set([vx, vy, vz], slot * 3);
    colors.set([color.r, color.g, color.b], slot * 3);
    life[slot] = seconds;
    lifeSpan[slot] = seconds;
    baseSize[slot] = size;
  }

  /**
   * @param {{ kind: 'spark'|'dust', rect: object, y: number, color: string }} burst
   * `rect` is the slab `{x, z, w, d}`; particles start along its edge at height `y`.
   */
  function burst({ kind, rect, y, color }) {
    const spark = kind === 'spark';
    const factor = reducedMotion() ? PARTICLES.reducedFactor : 1;
    const count = Math.max(1, Math.round((spark ? PARTICLES.sparkCount : PARTICLES.dustCount) * factor));
    tint.set(spark ? PARTICLES.sparkColor : PARTICLES.dustColor);
    if (spark) tint.lerp(new Color(color), 0.35);
    for (let i = 0; i < count; i += 1) {
      const side = Math.floor(rand(0, 4));
      const along = rand(-0.5, 0.5);
      const edgeX = side < 2 ? along * rect.w : (side === 2 ? 0.5 : -0.5) * rect.w;
      const edgeZ = side < 2 ? (side === 0 ? 0.5 : -0.5) * rect.d : along * rect.d;
      const speed = spark ? PARTICLES.sparkSpeed : PARTICLES.dustSpeed;
      const outX = Math.sign(edgeX) * rand(0.2, 1) * speed;
      const outZ = Math.sign(edgeZ) * rand(0.2, 1) * speed;
      spawn({
        x: rect.x + edgeX, y, z: rect.z + edgeZ,
        vx: spark ? outX * 0.6 : outX, vy: spark ? rand(1.2, 3.2) : rand(0.1, 0.5), vz: spark ? outZ * 0.6 : outZ,
        seconds: (spark ? PARTICLES.sparkLife : PARTICLES.dustLife) * rand(0.7, 1),
        size: (spark ? PARTICLES.sparkSize : PARTICLES.dustSize) * rand(0.6, 1.2),
        color: tint,
      });
    }
  }

  /** @param {{ rect: object, y: number, color: string }} flash ring at a slab's top face */
  function ring({ rect, y, color }) {
    const entry = rings[nextRing];
    nextRing = (nextRing + 1) % rings.length;
    entry.age = 0;
    entry.radius = Math.max(rect.w, rect.d) * 0.75;
    entry.mesh.material.color.set(color).lerp(tint.set('#ffffff'), 0.4);
    entry.mesh.position.set(rect.x, y, rect.z);
    entry.mesh.visible = true;
  }

  /** @param {number} dt seconds, already clamped */
  function update(dt) {
    for (let i = 0; i < max; i += 1) {
      if (life[i] <= 0) {
        alphas[i] = 0;
        sizes[i] = 0;
        continue;
      }
      life[i] -= dt;
      const k = Math.max(0, life[i] / lifeSpan[i]);
      velocity[i * 3 + 1] -= PARTICLES.gravity * dt * 0.4;
      for (let axis = 0; axis < 3; axis += 1) positions[i * 3 + axis] += velocity[i * 3 + axis] * dt;
      alphas[i] = k;
      sizes[i] = baseSize[i] * (0.5 + 0.5 * k);
    }
    Object.values(attributes).forEach((attribute) => { attribute.needsUpdate = true; });

    rings.forEach((entry) => {
      if (!entry.mesh.visible) return;
      entry.age += dt;
      const k = entry.age / SCENE.ringFlashSeconds;
      if (k >= 1) {
        entry.mesh.visible = false;
        return;
      }
      entry.mesh.scale.setScalar(entry.radius * (1 + k * 0.7));
      entry.mesh.material.opacity = 0.75 * (1 - k) * (1 - k);
    });
  }

  /** @param {number} scale pixels per world unit at distance 1 (drawing buffer height over 2 tan(fov / 2)) */
  function setPixelScale(scale) {
    material.uniforms.uScale.value = scale;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    ringGeometry.dispose();
    rings.forEach((entry) => entry.mesh.material.dispose());
  }

  return { group, burst, ring, update, setPixelScale, dispose };
}
