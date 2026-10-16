// Bootstrap and wiring: scene, loop, input, UI and start.ng.

import {
  WebGLRenderer, Scene, PerspectiveCamera, Fog, DirectionalLight, HemisphereLight,
  MathUtils, SRGBColorSpace,
} from 'three';
import {
  CAMERA, DEBRIS, FOG, LIGHTS, RULES, TIMING, GUEST_STYLE,
} from './config.js';
import {
  hexToRgb, normalizeStyle, paletteColor, playerKey, skyState,
} from './logic.js';
import { createTower } from './tower.js';
import { createCharacter } from './character.js';
import { createSky } from './sky.js';
import { createGround } from './ground.js';
import { createSkyline } from './skyline.js';
import { createEffects } from './effects.js';
import { createCameraRig } from './camera.js';
import { createAudio } from './audio.js';
import { createGame } from './game.js';
import { createUi } from './ui.js';
import { bindInput } from './input.js';
import { loadBest, loadMuted, saveBest, saveMuted } from './storage.js';
import {
  clearSessionFromAddress, fetchLeaderboard, isGuestMode, saveScore, signIn, whoami,
} from './startng.js';

const SKY_LAMBDA = 1.6;
const TAN_HALF_FOV = Math.tan((CAMERA.fov * Math.PI) / 360);

const canvas = document.getElementById('scene');
const lifetime = new AbortController();
const { signal } = lifetime;

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionQuery.matches;

let muted = loadMuted();
const audio = createAudio({ muted });

const guestPlayer = Object.freeze({
  id: null, name: 'Guest', account: null, style: normalizeStyle(GUEST_STYLE), face: null, signedIn: false,
});
let player = guestPlayer;
let pendingPlayer = null;
let round = 0;
let live = false;
let game = null;
let asking = false;

const ui = createUi({
  guestMode: isGuestMode(),
  onMuteToggle: () => {
    muted = !muted;
    audio.setMuted(muted);
    saveMuted(muted);
    ui.setMuted(muted);
  },
  onSignIn: signIn,
  onPlayAgain: () => {
    audio.unlock();
    game.playAgain();
  },
});
ui.setMuted(muted);
ui.setBest(loadBest());
ui.setProfile(player);
ui.setFloors(0);
ui.setStreak(0);
clearSessionFromAddress();

let renderer;
try {
  renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  ui.showFallback();
}

if (renderer) {
  canvas.addEventListener('webglcontextlost', (event) => event.preventDefault(), { signal });

  const scene = new Scene();
  const fog = new Fog('#000000', FOG.near, FOG.far);
  scene.fog = fog;
  const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  const rig = createCameraRig({ camera, reducedMotion });

  const sun = new DirectionalLight('#ffffff', LIGHTS.dirIntensity);
  sun.position.set(...LIGHTS.dirPosition);
  const hemi = new HemisphereLight('#ffffff', '#000000', LIGHTS.hemiIntensity);

  const sky = createSky();
  const ground = createGround();
  const skyline = createSkyline();
  const tower = createTower();
  const character = createCharacter();
  const effects = createEffects({ reducedMotion });
  character.setStyle(player.style);

  scene.add(sky.mesh, ground.mesh, skyline.group, tower.group, character.group, effects.group, sun, hemi);

  // ------------------------------------------------------------ start.ng
  function applyPlayer(next) {
    player = next;
    pendingPlayer = null;
    character.setStyle(next.style);
    ui.setProfile(next);
  }

  async function refreshPlayer() {
    // focus and visibilitychange often fire together: one question at a time.
    if (asking) return;
    asking = true;
    const next = await whoami();
    asking = false;
    // No answer is the normal local-file path: keep the guest look, never retry in a loop.
    if (!next || playerKey(next) === playerKey(player)) return;
    // A round in progress is never interrupted; the change lands at the next round.
    if (game.snapshot().phase === 'playing') pendingPlayer = next;
    else applyPlayer(next);
  }

  async function finishRound({ floors, perfects }) {
    const mine = (round += 1);
    const best = Math.max(loadBest(), floors);
    if (floors > loadBest()) saveBest(floors);
    ui.setBest(best);
    ui.showSummary({ floors, perfects, best, signedIn: player.signedIn });
    if (player.signedIn) {
      const saved = await saveScore({ floors, perfects });
      if (mine !== round) return;
      ui.setScoreResult(saved);
    }
    const board = await fetchLeaderboard();
    if (mine !== round) return;
    ui.setLeaderboard(board, player.id);
  }

  // ------------------------------------------------------------ game
  game = createGame({
    view: { tower, character, effects, audio },
    events: {
      onPhase: (phase) => {
        if (live) ui.setState(phase);
        if (phase === 'playing') round += 1;
      },
      onScore: ({ floors, streak }) => {
        ui.setFloors(floors);
        ui.setStreak(streak);
      },
      onGameOver: (result) => { finishRound(result); },
      beforeRound: () => {
        if (pendingPlayer) applyPlayer(pendingPlayer);
      },
    },
  });

  bindInput({ canvas, onAction: (source) => game.action(source), signal });
  // iOS only grants audio from a finished gesture, so unlock on pointerup and keydown.
  document.addEventListener('pointerup', () => audio.unlock(), { signal });
  document.addEventListener('keydown', () => audio.unlock(), { signal });

  // ------------------------------------------------------------ size
  const bufferSize = { width: 1, height: 1 };

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    rig.resize(width / height);
    bufferSize.width = renderer.domElement.width;
    bufferSize.height = renderer.domElement.height;
    sky.resize(bufferSize);
    effects.setPixelScale(bufferSize.height / (2 * TAN_HALF_FOV));
  }
  window.addEventListener('resize', resize, { signal });
  window.addEventListener('orientationchange', resize, { signal });
  window.visualViewport?.addEventListener('resize', resize, { signal });
  resize();

  // ------------------------------------------------------------ loop
  let skyFloors = 0;
  let time = 0;
  let last = 0;
  let frameId = 0;
  let running = false;

  const toSrgb = (color, rgb) => color.setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace);

  function applySky(state) {
    toSrgb(fog.color, state.fog);
    toSrgb(sun.color, state.dir);
    toSrgb(hemi.color, state.hemiSky);
    toSrgb(hemi.groundColor, state.hemiGround);
  }

  function step(dt) {
    time += dt;
    game.update({ dt, killY: rig.focus() - DEBRIS.killBelow });
    const snap = game.snapshot();

    skyFloors = MathUtils.damp(skyFloors, snap.floors, SKY_LAMBDA, dt);
    const state = skyState(skyFloors);
    sky.update({ state, time, cameraPosition: camera.position });
    ground.update({ horizon: state.horizon, glow: hexToRgb(paletteColor(snap.floors)), time });
    skyline.update(skyFloors * RULES.slabHeight);
    applySky(state);

    rig.update({
      dt,
      time,
      mode: snap.phase === 'gameover' ? 'overview' : 'follow',
      idle: snap.phase !== 'playing',
      floors: snap.floors,
      top: snap.top,
    });
    effects.update(dt);
    renderer.render(scene, camera);
  }

  function frame(now) {
    frameId = requestAnimationFrame(frame);
    // Clamped so a stalled frame can never teleport a slab.
    const dt = Math.min(Math.max((now - last) / 1000, 0), TIMING.maxDelta);
    last = now;
    step(dt);
  }

  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    frameId = requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    cancelAnimationFrame(frameId);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopLoop();
      audio.suspend();
    } else {
      startLoop();
      audio.resume();
      refreshPlayer();
    }
  }, { signal });
  window.addEventListener('focus', () => { refreshPlayer(); }, { signal });

  window.addEventListener('pagehide', () => {
    stopLoop();
    lifetime.abort();
    [tower, character, sky, ground, skyline, effects].forEach((part) => part.dispose());
    renderer.dispose();
  }, { signal });

  // First frame, then reveal the game.
  const first = game.snapshot();
  rig.snap({ mode: 'follow', floors: first.floors, top: first.top, time: 0 });
  step(0);
  live = true;
  ui.setState(first.phase);
  if (!document.hidden) startLoop();
  refreshPlayer();
}
