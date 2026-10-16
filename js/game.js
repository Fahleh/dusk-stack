// Round flow: ready -> playing -> gameover. All rules come from logic.js; this file
// turns them into calls on the views (tower, character, effects, audio) and events
// for the UI and start.ng layers.

import { RULES, TIMING, BASE_COLOR } from './config.js';
import {
  sliceSlab, spawnSlab, advanceSlab, slabSpeed, otherAxis, paletteColor,
} from './logic.js';

const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => t * t * (3 - 2 * t);

const baseSlab = () => ({ x: 0, z: 0, w: RULES.baseSize, d: RULES.baseSize });
const topFaceY = (index) => (index + 1) * RULES.slabHeight;

/**
 * @param {{ view: { tower: object, character: object, effects: object, audio: object },
 *   events: { onPhase: Function, onScore: Function, onGameOver: Function, beforeRound: Function } }} options
 * @returns {{ update: Function, action: Function, playAgain: Function, snapshot: Function }}
 */
export function createGame({ view, events }) {
  const { tower, character, effects, audio } = view;
  let clock = 0;
  let state = null;

  const freshState = (phase) => ({
    phase,
    floors: 0,
    perfects: 0,
    streak: 0,
    top: baseSlab(),
    axis: 'x',
    dir: 1,
    moving: null,
    spawnAge: 0,
    lockUntil: 0,
    overAt: 0,
    hop: null,
  });

  const riderTarget = (slab, lift) => ({
    x: slab.x,
    y: topFaceY(state.floors + 1) + lift,
    z: slab.z,
  });

  function spawn({ hopFrom }) {
    const { slab, dir } = spawnSlab({ top: state.top, axis: state.axis, floors: state.floors });
    state = {
      ...state,
      moving: slab,
      dir,
      spawnAge: 0,
      lockUntil: clock + TIMING.dropLockMs / 1000,
      hop: hopFrom ? { from: hopFrom, age: 0 } : null,
    };
  }

  function begin({ phase, hopFrom }) {
    tower.reset();
    tower.addSlab({ index: 0, rect: baseSlab(), color: BASE_COLOR });
    character.reset();
    state = freshState(phase);
    spawn({ hopFrom });
    if (!hopFrom) {
      const at = riderTarget(state.moving, TIMING.spawnDrop);
      character.place(at.x, at.y, at.z);
    }
    events.onPhase(phase);
    events.onScore({ floors: 0, streak: 0 });
  }

  function place(result) {
    const index = state.floors + 1;
    const color = paletteColor(index);
    tower.addSlab({ index, rect: result.placed, color });
    if (result.offcut) {
      tower.spawnOffcut({ index, rect: result.offcut, color, push: Math.sign(result.delta), axis: state.axis });
    }
    const floors = state.floors + 1;
    const perfects = state.perfects + (result.perfect ? 1 : 0);
    const y = topFaceY(index);
    if (result.perfect) {
      audio.playPerfect(result.streak);
      effects.burst({ kind: 'spark', rect: result.placed, y, color });
      effects.ring({ rect: result.placed, y, color });
      character.cheer();
    } else {
      audio.playDrop();
      effects.burst({ kind: 'dust', rect: result.placed, y, color });
    }
    character.land();
    state = {
      ...state,
      floors,
      perfects,
      streak: result.streak,
      top: result.placed,
      axis: otherAxis(state.axis),
    };
    events.onScore({ floors, streak: result.streak });
    spawn({ hopFrom: character.group.position.clone() });
  }

  function gameOver() {
    const index = state.floors + 1;
    tower.spawnOffcut({ index, rect: state.moving, color: paletteColor(index), push: state.dir, axis: state.axis });
    tower.hideMoving();
    character.tumble({
      vx: state.axis === 'x' ? state.dir : 0,
      vz: state.axis === 'z' ? state.dir : 0,
    });
    audio.playGameOver();
    state = { ...state, phase: 'gameover', moving: null, hop: null, overAt: clock, streak: 0 };
    events.onPhase('gameover');
    events.onScore({ floors: state.floors, streak: 0 });
    events.onGameOver({ floors: state.floors, perfects: state.perfects });
  }

  function drop() {
    if (state.phase !== 'playing' || !state.moving || clock < state.lockUntil) return;
    const result = sliceSlab({ top: state.top, moving: state.moving, axis: state.axis, streak: state.streak });
    if (result.hit) place(result);
    else gameOver();
  }

  function start() {
    events.beforeRound();
    begin({ phase: 'playing', hopFrom: character.group.position.clone() });
  }

  function playAgain() {
    if (state.phase !== 'gameover') return;
    events.beforeRound();
    begin({ phase: 'playing', hopFrom: null });
  }

  /** @param {'pointer'|'key'} source what triggered the action */
  function action(source) {
    if (state.phase === 'ready') start();
    else if (state.phase === 'playing') drop();
    // After a game over only the button, or Space/Enter after a short pause, restart:
    // a frantic last tap must not skip the summary.
    else if (source === 'key' && clock - state.overAt >= TIMING.restartDelayMs / 1000) playAgain();
  }

  /**
   * @param {{ dt: number, killY: number }} frame `dt` seconds (clamped), `killY` height below which debris is dropped
   */
  function update({ dt, killY }) {
    clock += dt;
    tower.update(dt, killY);

    if (state.moving) {
      const speed = slabSpeed(state.phase === 'playing' ? state.floors : 0);
      const moved = advanceSlab({
        slab: state.moving, axis: state.axis, dir: state.dir, center: state.top[state.axis], speed, dt,
      });
      const spawnAge = state.spawnAge + dt;
      const lift = TIMING.spawnDrop * (1 - easeOutCubic(Math.min(1, spawnAge / TIMING.spawnSeconds))) ** 2;
      state = { ...state, moving: moved.slab, dir: moved.dir, spawnAge };
      tower.setMoving({ index: state.floors + 1, rect: state.moving, color: paletteColor(state.floors + 1), lift });

      const target = riderTarget(state.moving, lift);
      if (state.hop) {
        const age = state.hop.age + dt;
        const k = Math.min(1, age / TIMING.hopSeconds);
        const eased = easeInOut(k);
        const { from } = state.hop;
        character.place(
          from.x + (target.x - from.x) * eased,
          from.y + (target.y - from.y) * eased + Math.sin(k * Math.PI) * TIMING.hopHeight,
          from.z + (target.z - from.z) * eased,
        );
        state = { ...state, hop: k >= 1 ? null : { from, age } };
      } else {
        character.place(target.x, target.y, target.z);
      }
    }
    character.update(dt);
  }

  /** @returns {{ phase: string, floors: number, perfects: number, streak: number, top: object }} */
  function snapshot() {
    return { phase: state.phase, floors: state.floors, perfects: state.perfects, streak: state.streak, top: state.top };
  }

  begin({ phase: 'ready', hopFrom: null });

  return { update, action, playAgain, snapshot };
}
