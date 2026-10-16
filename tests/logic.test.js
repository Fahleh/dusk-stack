import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RULES, GUEST_STYLE, SKY, STYLE_OPTIONS, START_NG, SLAB_PALETTE } from '../js/config.js';
import {
  sliceSlab, spawnSlab, advanceSlab, slabSpeed, otherAxis, litPips, paletteColor, skyState,
  hexToRgb, rgbToHex, createRandom, normalizeStyle, sanitizeFace, normalizePlayer, playerKey, cleanText,
  buildScorePayload, shouldSaveScore, normalizeScoreReply, normalizeLeaderboard, parseBest, parseMuted,
} from '../js/logic.js';

const top = { x: 0, z: 0, w: 4, d: 4 };
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} expected ${expected}, got ${actual}`);

// ---------------------------------------------------------------- slicing

test('slice on x: overhang to the right is cut and becomes the offcut', () => {
  const r = sliceSlab({ top, moving: { ...top, x: 1 }, axis: 'x', streak: 0 });
  assert.equal(r.hit, true);
  assert.equal(r.perfect, false);
  near(r.placed.w, 3);
  near(r.placed.x, 0.5);
  near(r.placed.d, 4);
  near(r.offcut.w, 1);
  near(r.offcut.x, 2.5);
  assert.equal(r.streak, 0);
});

test('slice on x: overhang to the left', () => {
  const r = sliceSlab({ top, moving: { ...top, x: -1.5 }, axis: 'x', streak: 2 });
  near(r.placed.w, 2.5);
  near(r.placed.x, -0.75);
  near(r.offcut.w, 1.5);
  near(r.offcut.x, -2.75);
  assert.equal(r.streak, 0);
});

test('slice on z uses depth and leaves width alone', () => {
  const r = sliceSlab({ top, moving: { ...top, z: 1.25 }, axis: 'z', streak: 0 });
  near(r.placed.d, 2.75);
  near(r.placed.z, 0.625);
  near(r.placed.w, 4);
  near(r.offcut.d, 1.25);
  near(r.offcut.z, 2.625);
  near(r.offcut.w, 4);
});

test('placed plus offcut always cover the moving slab exactly', () => {
  for (const axis of ['x', 'z']) {
    for (const offset of [-3.9, -2, -0.5, 0.5, 2, 3.9]) {
      const moving = { ...top, [axis]: offset };
      const r = sliceSlab({ top, moving, axis, streak: 0 });
      const size = axis === 'x' ? 'w' : 'd';
      near(r.placed[size] + r.offcut[size], 4, `axis ${axis} offset ${offset}`);
    }
  }
});

test('slice works on a smaller, shifted tower top', () => {
  const small = { x: 1, z: -0.5, w: 2.5, d: 1.5 };
  const r = sliceSlab({ top: small, moving: { ...small, z: 0.6 }, axis: 'z', streak: 0 });
  near(r.placed.d, 1.5 - 1.1);
  near(r.placed.z, small.z + 0.75 - (1.5 - 1.1) / 2);
  near(r.offcut.d, 1.1);
});

test('exact edge contact and larger gaps are a miss', () => {
  for (const axis of ['x', 'z']) {
    for (const offset of [4, -4, 4.5, -6]) {
      const r = sliceSlab({ top, moving: { ...top, [axis]: offset }, axis, streak: 2 });
      assert.equal(r.hit, false, `axis ${axis} offset ${offset}`);
      assert.equal(r.placed, null);
      assert.equal(r.streak, 0);
      assert.deepEqual(r.offcut, { ...top, [axis]: offset });
    }
  }
});

test('a sliver of overlap still counts as a hit', () => {
  const r = sliceSlab({ top, moving: { ...top, x: 3.9 }, axis: 'x', streak: 0 });
  assert.equal(r.hit, true);
  near(r.placed.w, 0.1);
});

// ---------------------------------------------------------------- perfect

test('perfect: at the tolerance edge, even with float noise', () => {
  const exact = sliceSlab({ top, moving: { ...top, x: RULES.perfectTolerance }, axis: 'x', streak: 0 });
  assert.equal(exact.perfect, true);
  const noisy = sliceSlab({ top: { ...top, x: 3 }, moving: { ...top, x: 3.12 }, axis: 'x', streak: 0 });
  assert.equal(noisy.perfect, true, 'computed 3.12 - 3 is slightly above 0.12');
});

test('perfect: just inside passes, just outside does not', () => {
  assert.equal(sliceSlab({ top, moving: { ...top, x: 0.119 }, axis: 'x', streak: 0 }).perfect, true);
  assert.equal(sliceSlab({ top, moving: { ...top, x: -0.119 }, axis: 'x', streak: 0 }).perfect, true);
  assert.equal(sliceSlab({ top, moving: { ...top, x: 0.121 }, axis: 'x', streak: 0 }).perfect, false);
  assert.equal(sliceSlab({ top, moving: { ...top, x: -0.121 }, axis: 'x', streak: 0 }).perfect, false);
});

test('perfect snaps onto the tower top and keeps the full size', () => {
  const r = sliceSlab({ top: { x: 1, z: 2, w: 3, d: 3 }, moving: { x: 1.1, z: 2, w: 3, d: 3 }, axis: 'x', streak: 0 });
  assert.deepEqual(r.placed, { x: 1, z: 2, w: 3, d: 3 });
  assert.equal(r.offcut, null);
});

test('perfect also works on z', () => {
  const r = sliceSlab({ top, moving: { ...top, z: -0.1 }, axis: 'z', streak: 0 });
  assert.equal(r.perfect, true);
  assert.deepEqual(r.placed, top);
});

test('streak counts perfects and a normal drop resets it', () => {
  let streak = 0;
  for (let i = 1; i <= 4; i += 1) {
    const r = sliceSlab({ top, moving: top, axis: 'x', streak });
    streak = r.streak;
    assert.equal(streak, i);
  }
  const miss = sliceSlab({ top, moving: { ...top, x: 1 }, axis: 'x', streak });
  assert.equal(miss.streak, 0);
});

test('regrow: the first three perfects do not grow, the fourth does', () => {
  const small = { x: 0, z: 0, w: 2, d: 2 };
  const grown = [0, 1, 2, 3].map((streak) => sliceSlab({ top: small, moving: small, axis: 'x', streak }));
  assert.deepEqual(grown.map((r) => r.grew), [false, false, false, true]);
  assert.deepEqual(grown.map((r) => r.placed.w), [2, 2, 2, 2.25]);
  assert.deepEqual(grown.map((r) => r.placed.d), [2, 2, 2, 2.25]);
});

test('regrow keeps growing on a longer streak but never past the base size', () => {
  let slab = { x: 0, z: 0, w: 3.6, d: 3.6 };
  for (let streak = 3; streak < 8; streak += 1) {
    const r = sliceSlab({ top: slab, moving: slab, axis: 'z', streak });
    slab = r.placed;
    assert.ok(slab.w <= RULES.baseSize && slab.d <= RULES.baseSize);
  }
  assert.equal(slab.w, RULES.baseSize);
  assert.equal(slab.d, RULES.baseSize);
});

test('regrow does not shrink a slab that is already at the base size', () => {
  const r = sliceSlab({ top, moving: top, axis: 'x', streak: 5 });
  assert.deepEqual(r.placed, top);
});

// ---------------------------------------------------------------- speed and motion

test('speed starts at base, rises with floors, never passes the cap', () => {
  assert.equal(slabSpeed(0), RULES.speedBase);
  near(slabSpeed(10), RULES.speedBase + 10 * RULES.speedPerFloor);
  let last = 0;
  for (let floors = 0; floors < 400; floors += 1) {
    const speed = slabSpeed(floors);
    assert.ok(speed >= last, 'never decreases');
    assert.ok(speed <= RULES.speedCap, 'never exceeds cap');
    last = speed;
  }
  assert.equal(slabSpeed(100000), RULES.speedCap);
  assert.equal(slabSpeed(-5), RULES.speedBase);
});

test('spawn: starts at the edge of the range and alternates sides', () => {
  const a = spawnSlab({ top, axis: 'x', floors: 0 });
  assert.equal(a.slab.x, -RULES.range);
  assert.equal(a.dir, 1);
  const b = spawnSlab({ top, axis: 'z', floors: 2 });
  assert.equal(b.slab.z, RULES.range);
  assert.equal(b.dir, -1);
  assert.equal(b.slab.x, 0);
  const shifted = spawnSlab({ top: { x: 1.5, z: 0, w: 3, d: 3 }, axis: 'x', floors: 0 });
  near(shifted.slab.x, 1.5 - RULES.range);
  assert.equal(shifted.slab.w, 3);
});

test('advance: moves at constant speed and bounces at both ends', () => {
  const start = { ...top, x: 0 };
  const moved = advanceSlab({ slab: start, axis: 'x', dir: 1, center: 0, speed: 3, dt: 0.5 });
  near(moved.slab.x, 1.5);
  assert.equal(moved.dir, 1);

  const hiEdge = advanceSlab({ slab: { ...top, x: 5.4 }, axis: 'x', dir: 1, center: 0, speed: 4, dt: 0.1 });
  near(hiEdge.slab.x, 5.5 - 0.3);
  assert.equal(hiEdge.dir, -1);

  const loEdge = advanceSlab({ slab: { ...top, z: -5.4 }, axis: 'z', dir: -1, center: 0, speed: 4, dt: 0.1 });
  near(loEdge.slab.z, -5.5 + 0.3);
  assert.equal(loEdge.dir, 1);
});

test('advance: range follows the tower centre and never leaves it', () => {
  let slab = { ...top, x: 2 - RULES.range };
  let dir = 1;
  for (let i = 0; i < 2000; i += 1) {
    ({ slab, dir } = advanceSlab({ slab, axis: 'x', dir, center: 2, speed: RULES.speedCap, dt: 0.05 }));
    assert.ok(slab.x >= 2 - RULES.range - 1e-9 && slab.x <= 2 + RULES.range + 1e-9);
  }
});

test('axes alternate and pips are capped', () => {
  assert.equal(otherAxis('x'), 'z');
  assert.equal(otherAxis('z'), 'x');
  assert.deepEqual([0, 1, 2, 3, 9].map(litPips), [0, 1, 2, 3, 3]);
});

// ---------------------------------------------------------------- look

test('palette: valid colours, cycles without a seam, starts on the first stop', () => {
  assert.equal(paletteColor(0), SLAB_PALETTE[0]);
  for (let i = 0; i < 100; i += 1) assert.match(paletteColor(i), /^#[0-9a-f]{6}$/);
  assert.equal(paletteColor(-4), SLAB_PALETTE[0]);
});

test('colour helpers round-trip', () => {
  assert.equal(rgbToHex(hexToRgb('#12ab9f')), '#12ab9f');
  assert.equal(rgbToHex([2, -1, 0.5]), '#ff0080');
});

test('sky: starts at the first stage, ends at the last, clamps beyond', () => {
  const first = skyState(0);
  assert.equal(first.t, 0);
  assert.equal(rgbToHex(first.horizon), SKY.stages[0].horizon);
  assert.equal(first.stars, 0);
  const last = skyState(SKY.floorsToNight);
  assert.equal(rgbToHex(last.zenith), SKY.stages.at(-1).zenith);
  assert.equal(last.stars, 1);
  const beyond = skyState(5000);
  assert.deepEqual(beyond.horizon, last.horizon);
  assert.equal(beyond.t, 1);
  const mid = skyState(SKY.floorsToNight * 0.5);
  assert.ok(mid.stars > 0 && mid.stars < 1);
  assert.deepEqual(skyState(-3).horizon, first.horizon);
});

test('random: seeded, repeatable and in range', () => {
  const a = createRandom(7);
  const b = createRandom(7);
  const first = Array.from({ length: 50 }, () => a());
  assert.deepEqual(first, Array.from({ length: 50 }, () => b()));
  assert.ok(first.every((v) => v >= 0 && v < 1));
  assert.notDeepEqual(first, Array.from({ length: 50 }, ((c) => () => c())(createRandom(8))));
});

// ---------------------------------------------------------------- style

test('style: valid input passes through', () => {
  const style = {
    body: 'female', primaryColor: '#A55EEA', secondaryColor: '#0c6e5a', skinColor: '#8d5524',
    hairColor: '#17120f', hair: 'braids', hat: 'crown', accessory: 'earrings',
  };
  assert.deepEqual(normalizeStyle(style), { ...style, primaryColor: '#a55eea' });
});

test('style: missing, null and non-object input give the guest default', () => {
  for (const input of [undefined, null, {}, 'x', 5, [], [1, 2]]) {
    assert.deepEqual(normalizeStyle(input), GUEST_STYLE);
  }
});

test('style: unknown values fall back per field, valid fields are kept', () => {
  const out = normalizeStyle({ body: 'robot', hair: 'mohawk', hat: 'tophat', accessory: 'monocle', primaryColor: '#123456' });
  assert.equal(out.body, GUEST_STYLE.body);
  assert.equal(out.hair, GUEST_STYLE.hair);
  assert.equal(out.accessory, GUEST_STYLE.accessory);
  assert.equal(out.hat, 'tophat');
  assert.equal(out.primaryColor, '#123456');
});

test('style: bad colours fall back', () => {
  const bad = ['#fff', '#12345', '#1234567', 'red', 'rgb(1,2,3)', '123456', '#gggggg', '', null, 12, {}];
  for (const value of bad) {
    const out = normalizeStyle({ primaryColor: value, secondaryColor: value, skinColor: value, hairColor: value });
    assert.equal(out.primaryColor, GUEST_STYLE.primaryColor, String(value));
    assert.equal(out.secondaryColor, GUEST_STYLE.secondaryColor);
    assert.equal(out.skinColor, GUEST_STYLE.skinColor);
    assert.equal(out.hairColor, GUEST_STYLE.hairColor);
  }
});

test('style: every documented option is accepted as is', () => {
  for (const [key, values] of Object.entries(STYLE_OPTIONS)) {
    for (const value of values) assert.equal(normalizeStyle({ [key]: value })[key], value);
  }
});

test('style: inherited keys are not options', () => {
  assert.equal(normalizeStyle({ hair: '__proto__', hat: 'constructor' }).hair, GUEST_STYLE.hair);
  assert.equal(normalizeStyle({ hat: 'toString' }).hat, GUEST_STYLE.hat);
});

// ---------------------------------------------------------------- player

const png = `${START_NG.facePrefix}iVBORw0KGgo=`;

test('face: only png data URLs pass', () => {
  assert.equal(sanitizeFace(png), png);
  for (const bad of ['https://evil.example/x.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', null, 5, undefined, {}]) {
    assert.equal(sanitizeFace(bad), null, String(bad));
  }
});

test('player: signed-in reply', () => {
  const player = normalizePlayer({
    type: 'startng:user',
    user: { id: 42, name: 'Runner Tee', account: 'Hamzat', style: { hair: 'afro' }, face: png },
    guest: { name: 'Guest', style: {}, face: png },
  });
  assert.equal(player.signedIn, true);
  assert.equal(player.id, 42);
  assert.equal(player.name, 'Runner Tee');
  assert.equal(player.account, 'Hamzat');
  assert.equal(player.style.hair, 'afro');
  assert.equal(player.face, png);
});

test('player: null user uses the guest', () => {
  const player = normalizePlayer({ user: null, guest: { name: 'Guest', style: { hat: 'cap' }, face: png } });
  assert.equal(player.signedIn, false);
  assert.equal(player.id, null);
  assert.equal(player.account, null);
  assert.equal(player.name, 'Guest');
  assert.equal(player.style.hat, 'cap');
});

test('player: junk replies give null or a safe guest', () => {
  for (const reply of [null, undefined, 'x', 5, [], {}, { user: null }, { user: 'me' }]) {
    assert.equal(normalizePlayer(reply), null, JSON.stringify(reply));
  }
  const badId = normalizePlayer({ user: { id: '42', name: 'X' }, guest: { name: 'Guest' } });
  assert.equal(badId.signedIn, false, 'a non-integer id is not trusted as a sign-in');
  for (const id of [0, -1, 1.5, NaN, Infinity]) {
    assert.equal(normalizePlayer({ user: { id, name: 'X' }, guest: { name: 'Guest' } }).signedIn, false);
  }
});

test('player: names are cleaned and capped, bad face is dropped', () => {
  const player = normalizePlayer({ user: { id: 1, name: `  A\u0000B​   ${'x'.repeat(100)}`, account: 5, face: 'http://x/y.png' } });
  assert.ok(player.name.startsWith('AB x'));
  assert.equal(player.name.length, START_NG.nameMaxLength);
  assert.equal(player.account, null);
  assert.equal(player.face, null);
  assert.equal(normalizePlayer({ user: { id: 1, name: '   ' } }).name, 'Player');
  assert.equal(cleanText('<b>hi</b>', null), '<b>hi</b>', 'markup stays text; the UI uses textContent');
});

test('playerKey changes when the look or identity changes', () => {
  const base = { user: { id: 1, name: 'A', style: { hair: 'afro' } } };
  const a = playerKey(normalizePlayer(base));
  assert.equal(a, playerKey(normalizePlayer(structuredClone(base))));
  assert.notEqual(a, playerKey(normalizePlayer({ user: { id: 1, name: 'A', style: { hair: 'bun' } } })));
  assert.equal(playerKey(null), '');
});

// ---------------------------------------------------------------- score payload

test('score payload: whole numbers with the right keys', () => {
  assert.deepEqual(buildScorePayload({ floors: 12, perfects: 3 }), { ok: true, stats: { floors: 12, perfects: 3 } });
  assert.deepEqual(Object.keys(buildScorePayload({ floors: 0, perfects: 0 }).stats), ['floors', 'perfects']);
  assert.equal(buildScorePayload({ floors: 1_000_000_000, perfects: 0 }).ok, true);
});

test('score payload: rejects fractions, range errors and non-numbers', () => {
  const bad = [1.5, -1, 1_000_000_001, NaN, Infinity, '7', null, undefined, {}];
  for (const value of bad) {
    assert.deepEqual(buildScorePayload({ floors: value, perfects: 1 }), { ok: false, reason: 'invalid_floors' }, String(value));
    assert.deepEqual(buildScorePayload({ floors: 1, perfects: value }), { ok: false, reason: 'invalid_perfects' }, String(value));
  }
});

test('score: only signed-in rounds with at least one floor are saved', () => {
  assert.equal(shouldSaveScore({ signedIn: true, floors: 1 }), true);
  assert.equal(shouldSaveScore({ signedIn: true, floors: 0 }), false);
  assert.equal(shouldSaveScore({ signedIn: false, floors: 12 }), false);
});

test('score reply: success, rejection and junk', () => {
  assert.deepEqual(normalizeScoreReply({ ok: true, result: { best: 5, improved: true, rank: 3 } }), { ok: true, improved: true, rank: 3 });
  assert.deepEqual(normalizeScoreReply({ ok: true, result: { improved: 'yes', rank: -2 } }), { ok: true, improved: false, rank: null });
  assert.deepEqual(normalizeScoreReply({ ok: true }), { ok: true, improved: false, rank: null });
  assert.equal(normalizeScoreReply({ ok: false, error: 'Sign in to save your score' }).ok, false);
  for (const junk of [null, undefined, 'x', 5, []]) assert.equal(normalizeScoreReply(junk).ok, false);
});

test('leaderboard: valid entries are shaped, junk entries dropped', () => {
  const reply = {
    ok: true,
    entries: [
      { rank: 1, player_id: 7, name: 'Trini', color: '#4b7bec', score: 8, stats: { floors: 8, perfects: 2 } },
      { rank: 'x', player_id: 8, name: 'Bad', stats: {} },
      null,
      'str',
      { rank: 2, player_id: 'nope', name: 5, stats: { floors: -4, perfects: 2.9 } },
      { rank: 3, name: 'NoStats' },
    ],
  };
  const out = normalizeLeaderboard(reply);
  assert.equal(out.ok, true);
  assert.deepEqual(out.entries, [
    { rank: 1, playerId: 7, name: 'Trini', floors: 8, perfects: 2 },
    { rank: 2, playerId: null, name: 'Player', floors: 0, perfects: 2 },
    { rank: 3, playerId: null, name: 'NoStats', floors: 0, perfects: 0 },
  ]);
});

test('leaderboard: failure shapes and the row cap', () => {
  for (const junk of [null, undefined, {}, { ok: false }, { ok: true }, { ok: true, entries: 'x' }]) {
    assert.equal(normalizeLeaderboard(junk).ok, false);
  }
  const many = Array.from({ length: 30 }, (_, i) => ({ rank: i + 1, player_id: i + 1, name: 'P', stats: {} }));
  assert.equal(normalizeLeaderboard({ ok: true, entries: many }).entries.length, START_NG.leaderboardLimit);
});

// ---------------------------------------------------------------- storage values

test('stored values parse defensively', () => {
  assert.equal(parseBest('12'), 12);
  for (const raw of [null, undefined, '', '-3', '1.5', 'abc', '1e3', '99999999999', '{"a":1}', 7]) {
    assert.equal(parseBest(raw), 0, String(raw));
  }
  assert.equal(parseMuted('1'), true);
  for (const raw of ['0', 'true', '', null, undefined, 1]) assert.equal(parseMuted(raw), false);
});
