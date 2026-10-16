// WebAudio only, no files. The context is created on the first user gesture
// (browsers refuse to start audio before that) and suspended when the tab hides.

import { AUDIO } from './config.js';

const SILENT = 0.0001;

/**
 * @param {{ muted: boolean }} options initial mute state
 * @returns {{ unlock: Function, setMuted: Function, playDrop: Function, playPerfect: Function,
 *   playGameOver: Function, suspend: Function, resume: Function }}
 */
export function createAudio({ muted }) {
  let isMuted = muted;
  let context = null;
  let master = null;
  let failed = false;

  function ensure() {
    if (context || failed) return context;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) {
      failed = true;
      return null;
    }
    try {
      context = new Context();
      master = context.createGain();
      master.gain.value = isMuted ? 0 : AUDIO.master;
      master.connect(context.destination);
    } catch {
      failed = true;
      context = null;
    }
    return context;
  }

  function tone({ freq, endFreq = freq, delay = 0, seconds, gain, type = 'sine' }) {
    if (!context || isMuted || context.state !== 'running') return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + seconds);
    env.gain.setValueAtTime(SILENT, start);
    env.gain.linearRampToValueAtTime(gain, start + 0.012);
    env.gain.exponentialRampToValueAtTime(SILENT, start + seconds);
    osc.connect(env).connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  /** Call from a user gesture (pointerup, keydown). Safe to call repeatedly. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  /** @param {boolean} value */
  function setMuted(value) {
    isMuted = value;
    if (master) master.gain.setTargetAtTime(value ? 0 : AUDIO.master, context.currentTime, 0.02);
  }

  function playDrop() {
    tone({ freq: AUDIO.thudHz, endFreq: AUDIO.thudEndHz, seconds: AUDIO.thudSeconds, gain: AUDIO.thudGain });
  }

  /** @param {number} streak consecutive perfects including this one (1 = first) */
  function playPerfect(streak) {
    const step = Math.min(Math.max(streak, 1), AUDIO.scale.length) - 1;
    const freq = AUDIO.scale[step];
    tone({ freq, seconds: AUDIO.noteSeconds, gain: AUDIO.noteGain });
    tone({ freq: freq * 2, seconds: AUDIO.noteSeconds * 0.7, gain: AUDIO.noteGain * 0.35, type: 'triangle' });
  }

  function playGameOver() {
    tone({ freq: AUDIO.overFrom, seconds: AUDIO.noteSeconds, gain: AUDIO.noteGain, type: 'triangle' });
    tone({ freq: AUDIO.overTo, delay: AUDIO.overGap, seconds: AUDIO.noteSeconds * 1.6, gain: AUDIO.noteGain, type: 'triangle' });
  }

  function suspend() {
    if (context && context.state === 'running') context.suspend().catch(() => {});
  }

  function resume() {
    if (context && context.state === 'suspended') context.resume().catch(() => {});
  }

  return { unlock, setMuted, playDrop, playPerfect, playGameOver, suspend, resume };
}
