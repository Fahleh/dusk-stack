// localStorage holds exactly two things: the mute setting and the personal best.
// Every access is wrapped: private windows and blocked storage must not break play.

import { STORAGE_KEYS } from './config.js';
import { parseBest, parseMuted } from './logic.js';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the setting just does not persist.
  }
}

/** @returns {boolean} the saved mute setting */
export function loadMuted() {
  return parseMuted(read(STORAGE_KEYS.muted));
}

/** @param {boolean} muted */
export function saveMuted(muted) {
  write(STORAGE_KEYS.muted, muted ? '1' : '0');
}

/** @returns {number} best floors on this device */
export function loadBest() {
  return parseBest(read(STORAGE_KEYS.best));
}

/** @param {number} floors */
export function saveBest(floors) {
  write(STORAGE_KEYS.best, String(floors));
}
