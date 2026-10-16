// Sky dome: a gradient drawn in screen space (so the horizon band stays visible at
// any camera pitch), a low sun, and a twinkling starfield that fades in with height.

import { Mesh, ShaderMaterial, SphereGeometry, BackSide, Vector2, Vector3 } from 'three';
import { SKY } from './config.js';

const VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAGMENT = /* glsl */ `
uniform vec3 uHorizon;
uniform vec3 uMid;
uniform vec3 uZenith;
uniform float uStars;
uniform float uSun;
uniform float uTime;
uniform float uHorizonAt;
uniform float uZenithAt;
uniform float uStarScale;
uniform float uStarDensity;
uniform vec2 uRes;
varying vec3 vDir;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float g = smoothstep(uHorizonAt, uZenithAt, uv.y);
  vec3 col = mix(mix(uHorizon, uMid, smoothstep(0.0, 0.55, g)), uZenith, smoothstep(0.45, 1.0, g));

  // Low sun, mostly hidden behind the skyline.
  vec2 sunPos = vec2(0.68, uHorizonAt + 0.05);
  float sd = length((uv - sunPos) * vec2(uRes.x / uRes.y, 1.0));
  col += vec3(1.0, 0.78, 0.5) * (exp(-sd * 5.0) * 0.5 + smoothstep(0.07, 0.055, sd) * 0.8) * uSun;

  if (uStars > 0.001) {
    vec3 p = vDir * uStarScale;
    vec3 cell = floor(p);
    float h = hash(cell);
    if (h > uStarDensity) {
      vec3 at = 0.25 + 0.5 * vec3(hash(cell + 1.0), hash(cell + 2.0), hash(cell + 3.0));
      float star = smoothstep(0.16, 0.0, length(fract(p) - at));
      float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + h * 4.0) + h * 40.0);
      float fade = smoothstep(uHorizonAt + 0.08, 0.7, uv.y);
      col += vec3(0.9, 0.93, 1.0) * star * twinkle * uStars * fade;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}`;

/**
 * @returns {{ mesh: Mesh, update: Function, resize: Function, dispose: Function }}
 */
export function createSky() {
  const geometry = new SphereGeometry(SKY.radius, 32, 16);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      uHorizon: { value: new Vector3() },
      uMid: { value: new Vector3() },
      uZenith: { value: new Vector3() },
      uStars: { value: 0 },
      uSun: { value: 1 },
      uTime: { value: 0 },
      uHorizonAt: { value: SKY.horizonAt },
      uZenithAt: { value: SKY.zenithAt },
      uStarScale: { value: SKY.starScale },
      uStarDensity: { value: SKY.starDensity },
      uRes: { value: new Vector2(1, 1) },
    },
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  /**
   * @param {{ state: object, time: number, cameraPosition: Vector3 }} frame `state` from `skyState`
   */
  function update({ state, time, cameraPosition }) {
    const u = material.uniforms;
    u.uHorizon.value.set(...state.horizon);
    u.uMid.value.set(...state.mid);
    u.uZenith.value.set(...state.zenith);
    u.uStars.value = state.stars;
    u.uSun.value = state.sun;
    u.uTime.value = time;
    mesh.position.copy(cameraPosition);
  }

  /** @param {{ width: number, height: number }} size drawing buffer size in pixels */
  function resize({ width, height }) {
    material.uniforms.uRes.value.set(width, height);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, update, resize, dispose };
}
