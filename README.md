# Dusk Stack

A calm 3D tower-stacking game for [start.ng](https://start.ng). Drop slabs, line them up, and climb from a Lagos sunset into the night. Your start.ng character rides the tower.

- Tap, click, or press Space or Enter to drop the sliding slab.
- Overhang is cut off. A near-perfect drop (within 0.12 units) snaps on, keeps its full size and plays a rising note. Three perfects in a row make the next perfect grow the slab back, up to its starting size.
- Miss completely and the tower falls. For signed-in players, floors and perfect drops go to the start.ng leaderboard. A round with no floor placed is not saved.

## Run

ES modules and the import map need HTTP, not `file://`:

```sh
python3 -m http.server 8080
```

Open http://localhost:8080. No build step and no `node_modules`: the game is plain static files, with three.js vendored in `vendor/`.

## Test

Logic tests (slicing, perfect detection, regrow, speed curve, style and reply validation, score payload) run in Node with no dependencies:

```sh
npm test
```

That runs `node --test`. Browser checks were run with Playwright installed outside this repo and are not committed.

## How it is published

- Name and address: `dusk-stack`, which plays at `dusk-stack.start.ng`.
- start.ng serves the repo root as is: `index.html`, `style.css`, `js/`, `vendor/`, `startng.json` and `cover.png`.
- `startng.json` defines the leaderboard columns `floors` and `perfects`, ranked by floors with ties broken by perfects. Changing these keys after the first publish changes the leaderboard columns.
- To check before publishing: `POST https://api.start.ng/games/check` with `{ "repo_url": "<your public repo>" }`.

## Layout

| Path | Job |
| --- | --- |
| `js/config.js` | Every tunable: rules, speed curve, palette, sky stages, camera, audio, character dimensions. The game name is `GAME_NAME` here. |
| `js/logic.js` | Pure rules and validation. No three.js or DOM, so it runs under `node --test`. |
| `js/game.js` | Round flow: ready, playing, game over. |
| `js/tower.js`, `js/character.js`, `js/effects.js` | Slabs and offcuts, the start.ng character, sparks and rings. |
| `js/sky.js`, `js/ground.js`, `js/skyline.js` | Gradient sky with stars, water disc, instanced skyline. |
| `js/camera.js`, `js/input.js`, `js/audio.js`, `js/storage.js` | Camera rig, input, WebAudio, mute and personal best. |
| `js/startng.js`, `js/ui.js`, `js/main.js` | start.ng messages, DOM, wiring and loop. |

## Known limits

- Sign-in, score saving and the live leaderboard only work when the game is live at `dusk-stack.start.ng`. Anywhere else there is no player: the game plays with the guest look and the leaderboard shows as unavailable.
- Personal best (floors) and the mute setting are kept in `localStorage` on the device only.
- Needs WebGL. Without it the page shows a short message instead of a blank screen.
