// A dark, water-like disc under the tower. No real reflection: a radial gradient
// that picks up the horizon colour, the glow of the top slab, and slow ripples.

import { CircleGeometry, Mesh, ShaderMaterial, Vector3 } from 'three';
import { SCENE } from './config.js';
import { hexToRgb } from './logic.js';

const VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uTime;
uniform float uRadius;
uniform float uRippleScale;
uniform float uRippleSpeed;
varying vec3 vWorld;

void main() {
  float dist = length(vWorld.xz);
  float far = smoothstep(6.0, uRadius, dist);
  vec3 col = mix(uDeep, uHorizon, far * 0.75);
  col += uGlow * exp(-dist * 0.2) * 0.5;
  float wave = sin(dist * uRippleScale - uTime * uRippleSpeed) * 0.5 + 0.5;
  float line = smoothstep(0.8, 1.0, wave) * (1.0 - smoothstep(0.0, uRadius * 0.7, dist));
  col += (uHorizon * 0.5 + uGlow * 0.5) * line * 0.1;
  float alpha = 1.0 - smoothstep(uRadius * 0.35, uRadius, dist);
  gl_FragColor = vec4(col, alpha);
}`;

/**
 * @returns {{ mesh: Mesh, update: Function, dispose: Function }}
 */
export function createGround() {
  const geometry = new CircleGeometry(SCENE.groundRadius, SCENE.groundSegments);
  geometry.rotateX(-Math.PI / 2);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: {
      uDeep: { value: new Vector3(...hexToRgb(SCENE.groundDeep)) },
      uHorizon: { value: new Vector3() },
      uGlow: { value: new Vector3(...hexToRgb(SCENE.groundGlow)) },
      uTime: { value: 0 },
      uRadius: { value: SCENE.groundRadius },
      uRippleScale: { value: SCENE.rippleScale },
      uRippleSpeed: { value: SCENE.rippleSpeed },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.y = -SCENE.plinthHeight;
  mesh.renderOrder = -5;

  /**
   * @param {{ horizon: number[], glow: number[], time: number }} frame sRGB 0..1 colours
   */
  function update({ horizon, glow, time }) {
    material.uniforms.uHorizon.value.set(...horizon);
    material.uniforms.uGlow.value.set(...glow);
    material.uniforms.uTime.value = time;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, update, dispose };
}
