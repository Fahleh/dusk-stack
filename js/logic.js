// Pure rules. No three.js, no DOM: everything here runs under `node --test`.

import {
  RULES, SLAB_PALETTE, SLAB_STEP, SKY, STYLE_OPTIONS, GUEST_STYLE, START_NG,
  SCORE_LIMITS, STAT_KEYS, TIMING,
} from './config.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const AXES = Object.freeze({
  x: Object.freeze({ pos: 'x', size: 'w' }),
  z: Object.freeze({ pos: 'z', size: 'd' }),
});

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Small seeded generator (mulberry32) so the skyline looks the same every visit.
 * @param {number} seed
 * @returns {() => number} function returning numbers in [0, 1)
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------ colours

/**
 * @param {string} hex `#rrggbb`
 * @returns {[number, number, number]} sRGB channels in 0..1
 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * @param {[number, number, number]} rgb sRGB channels in 0..1
 * @returns {string} `#rrggbb`
 */
export function rgbToHex(rgb) {
  const part = (c) => Math.round(clamp(c, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${part(rgb[0])}${part(rgb[1])}${part(rgb[2])}`;
}

const lerpRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Slab colour for a floor: a smooth walk around the closed palette loop.
 * @param {number} index floor index (0 is the base slab)
 * @returns {string} `#rrggbb`
 */
export function paletteColor(index) {
  const count = SLAB_PALETTE.length;
  const pos = (Math.max(0, index) * SLAB_STEP) % count;
  const from = Math.floor(pos);
  const mix = pos - from;
  const a = hexToRgb(SLAB_PALETTE[from]);
  const b = hexToRgb(SLAB_PALETTE[(from + 1) % count]);
  return rgbToHex(lerpRgb(a, b, mix));
}

// ------------------------------------------------------------ sky

/**
 * Sky, fog and light colours for a tower height. Colours are sRGB 0..1.
 * @param {number} floors floors placed so far
 * @returns {{ t: number, horizon: number[], mid: number[], zenith: number[], fog: number[],
 *   dir: number[], hemiSky: number[], hemiGround: number[], stars: number, sun: number }}
 */
export function skyState(floors) {
  const t = clamp(floors / SKY.floorsToNight, 0, 1);
  const stages = SKY.stages;
  let i = 0;
  while (i < stages.length - 2 && t > stages[i + 1].at) i += 1;
  const a = stages[i];
  const b = stages[i + 1];
  const mix = clamp((t - a.at) / (b.at - a.at), 0, 1);
  const color = (key) => lerpRgb(hexToRgb(a[key]), hexToRgb(b[key]), mix);
  return {
    t,
    horizon: color('horizon'),
    mid: color('mid'),
    zenith: color('zenith'),
    fog: color('fog'),
    dir: color('dir'),
    hemiSky: color('hemiSky'),
    hemiGround: color('hemiGround'),
    stars: lerp(a.stars, b.stars, mix),
    sun: lerp(a.sun, b.sun, mix),
  };
}

// ------------------------------------------------------------ slicing

/**
 * Slab speed in units per second for a given number of placed floors.
 * @param {number} floors floors placed so far
 * @returns {number}
 */
export function slabSpeed(floors) {
  return Math.min(RULES.speedCap, RULES.speedBase + RULES.speedPerFloor * Math.max(0, floors));
}

/**
 * Cut a dropped slab against the tower top. Slabs are `{ x, z, w, d }`: centre
 * on the ground plane plus width (x) and depth (z). The moving slab always
 * spawns at the top slab's size and lined up on the axis it does not move on,
 * so only the moving axis can overhang.
 *
 * @param {{ top: object, moving: object, axis: 'x'|'z', streak: number }} input
 * @returns {{ hit: boolean, perfect: boolean, grew: boolean, delta: number, streak: number,
 *   placed: object|null, offcut: object|null }}
 */
export function sliceSlab({ top, moving, axis, streak }) {
  const { pos, size } = AXES[axis];
  const delta = moving[pos] - top[pos];
  const low = Math.max(top[pos] - top[size] / 2, moving[pos] - moving[size] / 2);
  const high = Math.min(top[pos] + top[size] / 2, moving[pos] + moving[size] / 2);
  const overlap = high - low;

  if (overlap <= RULES.minOverlap) {
    return { hit: false, perfect: false, grew: false, delta, streak: 0, placed: null, offcut: { ...moving } };
  }

  if (Math.abs(delta) <= RULES.perfectTolerance + RULES.epsilon) {
    const grew = streak >= RULES.regrowAfter;
    const grow = (value) => (grew ? Math.min(RULES.baseSize, value + RULES.regrowStep) : value);
    const placed = { x: top.x, z: top.z, w: grow(moving.w), d: grow(moving.d) };
    return { hit: true, perfect: true, grew, delta, streak: streak + 1, placed, offcut: null };
  }

  const placed = { ...moving, [pos]: (low + high) / 2, [size]: overlap };
  const cutSize = moving[size] - overlap;
  const edge = delta > 0 ? high + cutSize / 2 : low - cutSize / 2;
  const offcut = { ...moving, [pos]: edge, [size]: cutSize };
  return { hit: true, perfect: false, grew: false, delta, streak: 0, placed, offcut };
}

/**
 * Where the next slab starts: on the far side of the axis, alternating sides.
 * @param {{ top: object, axis: 'x'|'z', floors: number }} input
 * @returns {{ slab: object, dir: 1|-1 }} slab at its spawn point and its travel direction
 */
export function spawnSlab({ top, axis, floors }) {
  const { pos } = AXES[axis];
  const dir = Math.floor(floors / 2) % 2 === 0 ? 1 : -1;
  const slab = { x: top.x, z: top.z, w: top.w, d: top.d };
  slab[pos] = top[pos] - dir * RULES.range;
  return { slab, dir };
}

/**
 * Advance a slab along its axis at constant speed, bouncing at the range ends.
 * @param {{ slab: object, axis: 'x'|'z', dir: 1|-1, center: number, speed: number, dt: number }} input
 * `center` is the tower top's centre on this axis.
 * @returns {{ slab: object, dir: 1|-1 }}
 */
export function advanceSlab({ slab, axis, dir, center, speed, dt }) {
  const { pos } = AXES[axis];
  let offset = slab[pos] - center + dir * speed * dt;
  let next = dir;
  // A single reflection is enough: dt is clamped, so one step never spans the range twice.
  if (offset > RULES.range) {
    offset = 2 * RULES.range - offset;
    next = -1;
  } else if (offset < -RULES.range) {
    offset = -2 * RULES.range - offset;
    next = 1;
  }
  return { slab: { ...slab, [pos]: center + offset }, dir: next };
}

/**
 * @param {'x'|'z'} axis
 * @returns {'x'|'z'} the other axis
 */
export function otherAxis(axis) {
  return axis === 'x' ? 'z' : 'x';
}

/**
 * Number of lit streak pips (0..pipsFull).
 * @param {number} streak consecutive perfects
 * @returns {number}
 */
export function litPips(streak) {
  return clamp(streak, 0, TIMING.pipsFull);
}

// ------------------------------------------------------------ style

/**
 * Always returns a complete, valid style: anything missing or unknown falls
 * back to the guest default for that field.
 * @param {unknown} input a `style` object from start.ng (untrusted)
 * @returns {Record<string, string>}
 */
export function normalizeStyle(input) {
  const source = isObject(input) ? input : {};
  const pick = (key) => (STYLE_OPTIONS[key].includes(source[key]) ? source[key] : GUEST_STYLE[key]);
  const color = (key) => (typeof source[key] === 'string' && HEX_COLOR.test(source[key]) ? source[key].toLowerCase() : GUEST_STYLE[key]);
  return {
    body: pick('body'),
    primaryColor: color('primaryColor'),
    secondaryColor: color('secondaryColor'),
    skinColor: color('skinColor'),
    hairColor: color('hairColor'),
    hair: pick('hair'),
    hat: pick('hat'),
    accessory: pick('accessory'),
  };
}

/**
 * @param {unknown} face value of `face` from start.ng (untrusted)
 * @returns {string|null} the data URL if it is a PNG data URL, otherwise null
 */
export function sanitizeFace(face) {
  return typeof face === 'string' && face.startsWith(START_NG.facePrefix) ? face : null;
}

/**
 * Printable, trimmed, length-capped text, or `fallback`.
 * @param {unknown} value
 * @param {string|null} fallback
 * @returns {string|null}
 */
export function cleanText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  // Control and format characters (zero-width, bidi marks) only make names hard to read.
  const text = value.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, START_NG.nameMaxLength) : fallback;
}

const isId = (value) => Number.isSafeInteger(value) && value > 0;

/**
 * Turn a `startng:user` reply into the player the game shows.
 * @param {unknown} reply untrusted reply from the connect page
 * @returns {{ id: number|null, name: string, account: string|null, style: Record<string, string>,
 *   face: string|null, signedIn: boolean }|null} null when the reply has neither user nor guest
 */
export function normalizePlayer(reply) {
  if (!isObject(reply)) return null;
  const user = isObject(reply.user) && isId(reply.user.id) ? reply.user : null;
  const guest = isObject(reply.guest) ? reply.guest : null;
  const source = user ?? guest;
  if (!source) return null;
  return {
    id: user ? user.id : null,
    name: cleanText(source.name, user ? 'Player' : 'Guest'),
    account: user ? cleanText(user.account, null) : null,
    style: normalizeStyle(source.style),
    face: sanitizeFace(source.face),
    signedIn: user !== null,
  };
}

/**
 * Stable key for "did the player change?", so the character is only rebuilt when needed.
 * @param {object|null} player result of `normalizePlayer`
 * @returns {string}
 */
export function playerKey(player) {
  return player ? JSON.stringify([player.id, player.name, player.account, player.style, player.face]) : '';
}

// ------------------------------------------------------------ score and board

const isWhole = (value) => Number.isInteger(value) && value >= SCORE_LIMITS.min && value <= SCORE_LIMITS.max;

/**
 * Build the `startng:score` stats. Only whole numbers in range are allowed.
 * @param {{ floors: number, perfects: number }} round
 * @returns {{ ok: true, stats: { floors: number, perfects: number } } | { ok: false, reason: string }}
 */
export function buildScorePayload({ floors, perfects }) {
  if (!isWhole(floors)) return { ok: false, reason: 'invalid_floors' };
  if (!isWhole(perfects)) return { ok: false, reason: 'invalid_perfects' };
  return { ok: true, stats: { [STAT_KEYS.floors]: floors, [STAT_KEYS.perfects]: perfects } };
}

/**
 * A round that never placed a floor is not worth a leaderboard row.
 * @param {{ signedIn: boolean, floors: number }} round
 * @returns {boolean}
 */
export function shouldSaveScore({ signedIn, floors }) {
  return signedIn && floors > 0;
}

/**
 * @param {unknown} reply untrusted `startng:scoreSaved` reply (null if none came)
 * @returns {{ ok: true, improved: boolean, rank: number|null } | { ok: false, reason: string }}
 */
export function normalizeScoreReply(reply) {
  if (!isObject(reply)) return { ok: false, reason: 'no_reply' };
  if (reply.ok !== true) return { ok: false, reason: 'rejected' };
  const result = isObject(reply.result) ? reply.result : {};
  return {
    ok: true,
    improved: result.improved === true,
    rank: isId(result.rank) ? result.rank : null,
  };
}

/**
 * @param {unknown} reply untrusted `startng:leaderboardData` reply (null if none came)
 * @returns {{ ok: true, entries: Array<{ rank: number, playerId: number|null, name: string,
 *   floors: number, perfects: number }> } | { ok: false, reason: string }}
 */
export function normalizeLeaderboard(reply) {
  if (!isObject(reply) || reply.ok !== true || !Array.isArray(reply.entries)) {
    return { ok: false, reason: 'no_reply' };
  }
  const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  const entries = reply.entries
    .filter((entry) => isObject(entry) && isId(entry.rank))
    .slice(0, START_NG.leaderboardLimit)
    .map((entry) => {
      const stats = isObject(entry.stats) ? entry.stats : {};
      return {
        rank: entry.rank,
        playerId: isId(entry.player_id) ? entry.player_id : null,
        name: cleanText(entry.name, 'Player'),
        floors: count(stats[STAT_KEYS.floors]),
        perfects: count(stats[STAT_KEYS.perfects]),
      };
    });
  return { ok: true, entries };
}

// ------------------------------------------------------------ storage values

/**
 * @param {unknown} raw string read from localStorage
 * @returns {number} best floors, 0 when absent or damaged
 */
export function parseBest(raw) {
  const value = typeof raw === 'string' && /^\d{1,9}$/.test(raw) ? Number(raw) : 0;
  return isWhole(value) ? value : 0;
}

/**
 * @param {unknown} raw string read from localStorage
 * @returns {boolean} true only for the exact stored "1"
 */
export function parseMuted(raw) {
  return raw === '1';
}
