// Camera rig: three-quarter view that rises with the tower using frame-rate
// independent damping, zooms out to show the whole tower on game over, and
// refits when the aspect ratio changes.

import { MathUtils } from 'three';
import { CAMERA, RULES } from './config.js';

const RAD = Math.PI / 180;
const TAN_HALF_FOV = Math.tan((CAMERA.fov * RAD) / 2);
const DRIFT_LAMBDA = 2;

/**
 * @param {{ camera: object, reducedMotion: () => boolean }} options a three.js PerspectiveCamera
 * @returns {{ resize: Function, update: Function, snap: Function, focus: () => number }}
 */
export function createCameraRig({ camera, reducedMotion }) {
  let aspect = camera.aspect;
  let focusX = 0;
  let focusY = 0;
  let focusZ = 0;
  let distance = 20;
  let drift = 0;

  const fitDistance = (halfHeight) => Math.max(
    halfHeight / TAN_HALF_FOV,
    CAMERA.fitHalfWidth / (TAN_HALF_FOV * aspect),
  );

  function targets({ mode, floors, top }) {
    const topY = (floors + 1) * RULES.slabHeight;
    if (mode === 'overview') {
      const shown = Math.min(topY, CAMERA.overviewMaxHeight);
      const halfHeight = Math.max(CAMERA.fitHalfHeight, shown / 2 + CAMERA.overviewPad);
      const dist = fitDistance(halfHeight);
      return { x: 0, y: topY - shown / 2 - CAMERA.overviewShift * dist * TAN_HALF_FOV, z: 0, distance: dist };
    }
    const dist = fitDistance(CAMERA.fitHalfHeight);
    return {
      x: top.x * 0.5,
      y: topY + CAMERA.focusFraction * dist * TAN_HALF_FOV,
      z: top.z * 0.5,
      distance: dist,
    };
  }

  function place(time) {
    const azimuth = CAMERA.azimuthDeg * RAD + (reducedMotion() ? 0 : Math.sin(time * CAMERA.driftSpeed) * CAMERA.driftDeg * RAD * drift);
    const elevation = CAMERA.elevationDeg * RAD;
    camera.position.set(
      focusX + distance * Math.cos(elevation) * Math.sin(azimuth),
      focusY + distance * Math.sin(elevation),
      focusZ + distance * Math.cos(elevation) * Math.cos(azimuth),
    );
    camera.lookAt(focusX, focusY, focusZ);
  }

  /**
   * @param {{ dt: number, time: number, mode: 'follow'|'overview', idle: boolean, floors: number, top: object }} frame
   * `top` is the tower top slab `{x, z}`; `idle` enables the breathing drift.
   */
  function update({ dt, time, mode, idle, floors, top }) {
    const goal = targets({ mode, floors, top });
    focusX = MathUtils.damp(focusX, goal.x, CAMERA.followLambda, dt);
    focusY = MathUtils.damp(focusY, goal.y, CAMERA.followLambda, dt);
    focusZ = MathUtils.damp(focusZ, goal.z, CAMERA.followLambda, dt);
    distance = MathUtils.damp(distance, goal.distance, CAMERA.zoomLambda, dt);
    drift = MathUtils.damp(drift, idle ? 1 : 0, DRIFT_LAMBDA, dt);
    place(time);
  }

  /** Jump straight to the goal for the given frame (first frame, round restart). */
  function snap(frame) {
    const goal = targets(frame);
    focusX = goal.x;
    focusY = goal.y;
    focusZ = goal.z;
    distance = goal.distance;
    drift = 0;
    place(frame.time);
  }

  /** @param {number} nextAspect width over height */
  function resize(nextAspect) {
    aspect = nextAspect;
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
  }

  return { resize, update, snap, focus: () => focusY };
}
