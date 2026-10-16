// Every tunable lives here. Grouped by who reads it.

export const GAME_NAME = 'Dusk Stack';

export const STORAGE_KEYS = Object.freeze({
  muted: 'dusk-stack:muted',
  best: 'dusk-stack:best',
});

// ---------------------------------------------------------------- rules
export const RULES = Object.freeze({
  baseSize: 4.0,
  slabHeight: 0.5,
  perfectTolerance: 0.12,
  // Float guard so a computed offset of "0.12" still counts as perfect.
  epsilon: 1e-9,
  minOverlap: 1e-6,
  regrowAfter: 3,
  regrowStep: 0.25,
  speedBase: 3.2,
  speedPerFloor: 0.06,
  speedCap: 9.0,
  range: 5.5,
});

export const STAT_KEYS = Object.freeze({ floors: 'floors', perfects: 'perfects' });
export const SCORE_LIMITS = Object.freeze({ min: 0, max: 1_000_000_000 });

// ---------------------------------------------------------------- timing
export const TIMING = Object.freeze({
  maxDelta: 0.05,
  dropLockMs: 120,
  restartDelayMs: 700,
  spawnDrop: 1.4,
  spawnSeconds: 0.18,
  hopSeconds: 0.26,
  hopHeight: 0.45,
  gameOverSeconds: 0.9,
  pipsFull: 3,
});

// ---------------------------------------------------------------- physics
export const DEBRIS = Object.freeze({
  max: 24,
  gravity: 22,
  spin: 1.6,
  push: 1.2,
  killBelow: 18,
  maxAge: 4,
});

// ---------------------------------------------------------------- camera
export const CAMERA = Object.freeze({
  fov: 35,
  near: 0.5,
  far: 900,
  azimuthDeg: 45,
  elevationDeg: 27,
  fitHalfWidth: 6.6,
  fitHalfHeight: 7.2,
  focusFraction: 0.2,
  followLambda: 3.4,
  zoomLambda: 2.2,
  overviewPad: 3,
  overviewMaxHeight: 30,
  // Fraction of the half view height the tower is lifted on game over, clear of the summary card.
  overviewShift: 0.42,
  driftDeg: 3.5,
  driftSpeed: 0.35,
});

// ---------------------------------------------------------------- slabs
// Warm to cool, closed loop so the cycle has no seam.
export const SLAB_PALETTE = Object.freeze([
  '#ff6b57', '#ff8f45', '#ffb84a', '#f4d35e', '#a6d96a',
  '#4fd1a5', '#38bcd8', '#4b8df0', '#7b6af0', '#b863d6',
]);
export const SLAB_STEP = 0.45; // palette stops advanced per floor
export const SLAB_GLOW = 0.32; // emissive share of the slab colour
export const BASE_COLOR = '#3a3157';
export const DEBRIS_TINT = 0.8;

// ---------------------------------------------------------------- sky
export const SKY = Object.freeze({
  floorsToNight: 60,
  radius: 450,
  starScale: 70,
  starDensity: 0.965,
  // Gradient is drawn in screen space so the horizon band stays visible
  // whatever the camera pitch.
  horizonAt: 0.5,
  zenithAt: 1.15,
  // Each stage: colours as sRGB hex, `at` is the 0..1 position in the climb.
  stages: Object.freeze([
    { at: 0.0, horizon: '#ff9a4a', mid: '#df4f86', zenith: '#5b3a8c', stars: 0.0, sun: 1.0,
      dir: '#ffd0a0', hemiSky: '#ffb08a', hemiGround: '#4a2f66', fog: '#ff9a4a' },
    { at: 0.33, horizon: '#e0587a', mid: '#7a3f9c', zenith: '#2d2a6e', stars: 0.25, sun: 0.4,
      dir: '#ffb9b0', hemiSky: '#c98ab0', hemiGround: '#2b2457', fog: '#e0587a' },
    { at: 0.66, horizon: '#6a3f9a', mid: '#2e2a72', zenith: '#12163f', stars: 0.75, sun: 0.0,
      dir: '#a9b8ff', hemiSky: '#7a82d0', hemiGround: '#1b1b45', fog: '#6a3f9a' },
    { at: 1.0, horizon: '#2a2a62', mid: '#10143a', zenith: '#03040c', stars: 1.0, sun: 0.0,
      dir: '#8fa6ff', hemiSky: '#5a66b8', hemiGround: '#10122e', fog: '#2a2a62' },
  ]),
});

export const LIGHTS = Object.freeze({
  dirIntensity: 2.4,
  dirPosition: Object.freeze([-6, 12, 5]),
  hemiIntensity: 1.5,
});

export const FOG = Object.freeze({ near: 30, far: 120 });

// ---------------------------------------------------------------- scene
export const SCENE = Object.freeze({
  plinthRadius: 3.3,
  plinthHeight: 1.6,
  plinthColor: '#271d3f',
  plinthSegments: 10,
  groundRadius: 34,
  groundSegments: 64,
  groundDeep: '#150f2e',
  groundGlow: '#ff9a4a',
  rippleScale: 0.9,
  rippleSpeed: 0.6,
  ringSegments: 48,
  ringFlashSeconds: 0.55,
  ringPool: 4,
});

export const SKYLINE = Object.freeze({
  count: 30,
  innerRadius: 22,
  outerRadius: 40,
  minWidth: 2,
  maxWidth: 4.6,
  minHeight: 3,
  maxHeight: 12,
  // No buildings between the camera and the tower: they would fill the foreground.
  gapCenterDeg: 45,
  gapDeg: 150,
  parallax: 0.7,
  color: '#0b0818',
  windowColor: '#ffc87a',
  windowsPerBuilding: 9,
  windowSize: 0.32,
  windowLitChance: 0.55,
  seed: 20260,
});

export const PARTICLES = Object.freeze({
  max: 160,
  sparkCount: 26,
  dustCount: 10,
  reducedFactor: 0.35,
  sparkLife: 0.7,
  dustLife: 0.9,
  sparkSpeed: 3.6,
  dustSpeed: 1.4,
  gravity: 4,
  sparkSize: 0.3,
  dustSize: 0.42,
  sparkColor: '#ffe6a8',
  dustColor: '#a8a0c8',
});

// ---------------------------------------------------------------- audio
export const AUDIO = Object.freeze({
  // C major pentatonic, two octaves (C4 D4 E4 G4 A4 C5 D5 E5 G5 A5).
  scale: Object.freeze([261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0]),
  master: 0.5,
  noteSeconds: 0.5,
  noteGain: 0.32,
  thudHz: 120,
  thudEndHz: 48,
  thudSeconds: 0.22,
  thudGain: 0.5,
  overFrom: 392.0,
  overTo: 261.63,
  overGap: 0.22,
});

// ---------------------------------------------------------------- start.ng
export const START_NG = Object.freeze({
  origin: 'https://start.ng',
  whoamiTimeoutMs: 5000,
  scoreTimeoutMs: 8000,
  leaderboardTimeoutMs: 5000,
  // The helper's own timer starts only once the frame has loaded; this covers a frame that never does.
  frameGraceMs: 1000,
  leaderboardLimit: 10,
  facePrefix: 'data:image/png;base64,',
  nameMaxLength: 40,
  guestQuery: 'guest',
  sessionHashKey: 'startng_session',
});

// ---------------------------------------------------------------- character
export const STYLE_OPTIONS = Object.freeze({
  body: Object.freeze(['female', 'male']),
  hair: Object.freeze(['short', 'afro', 'braids', 'bun', 'ponytail', 'dreads', 'bald']),
  hat: Object.freeze(['none', 'cap', 'beanie', 'tophat', 'crown']),
  accessory: Object.freeze(['none', 'glasses', 'earrings', 'beard', 'scarf', 'backpack']),
});

// start.ng's own guest look is only known at runtime; this is the local stand-in.
export const GUEST_STYLE = Object.freeze({
  body: 'male',
  primaryColor: '#6c7a89',
  secondaryColor: '#3b4252',
  skinColor: '#c68642',
  hairColor: '#2b211c',
  hair: 'short',
  hat: 'none',
  accessory: 'none',
});

export const CHARACTER = Object.freeze({
  hopSpin: 0.9,
  idleBob: 0.025,
  idleSpeed: 2.2,
  cheerSeconds: 0.7,
  tumbleSpeed: 5,
  tumbleLift: 3.2,
  tumbleGravity: 14,
  tumbleKillBelow: 24,
  facingYaw: Math.PI / 4,
  gold: '#f4c542',
  shoe: '#241d33',
  eye: '#1d1626',
  eyeWhite: '#f6f1ea',
  hatDark: '#1c1626',
  legHeight: 0.36,
  legWidth: 0.12,
  legGap: 0.02,
  torsoHeight: 0.34,
  torsoDepth: 0.2,
  torsoWidthMale: 0.38,
  torsoWidthFemale: 0.3,
  armWidth: 0.085,
  sleeveLength: 0.15,
  forearmLength: 0.16,
  skirtHeight: 0.2,
  skirtTop: 0.15,
  skirtBottom: 0.23,
  headRadius: 0.165,
  neckGap: 0.01,
  segments: 8,
});
