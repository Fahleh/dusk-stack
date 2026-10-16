# Engineering Brief (AGENTS.md)

This file defines the rules and working process for Claude Code in this repository. Read it fully before writing code. The project is **Dusk Stack**, a small 3D tower-stacking browser game built for start.ng as an HNG task: stable, polished and artful, not production grade. The game name lives in one constant (`GAME_NAME` in `js/config.js`); the start.ng address name is `dusk-stack`.

Feature scope and acceptance criteria are in `spec.md`. Treat anything not in it as out of scope and ask.

## Project Docs

Only these documents live in the repo:

- `AGENTS.md`: this file. Read-only for Claude Code.
- `startNG-DOCS.md`: a copy of https://start.ng/docs.md. It is the source of truth for the platform. Read-only. At the start of each pass, fetch the live page and tell the engineer if it differs from the copy.
- `spec.md`: the feature spec.
- `README.md`: how to run, test and publish, and known limits. Keep it short and accurate. Update it in the same session as the change it describes.

Do not create other docs. Decisions that deviate from `spec.md` go in the report, not in a new file.

---

## Project Context

### Stack

- Plain JavaScript ES modules, HTML and CSS. No framework, no bundler, no build step, no TypeScript.
- three.js, **vendored** into `vendor/` as readable (non-minified) module files. Never loaded from a CDN.
- WebAudio for sound. No audio files.
- start.ng provides players, character, leaderboard and hosting (see `startNG-DOCS.md`).
- Node is dev tooling only: `node --test` for pure-logic tests. The repo has no runtime dependencies and no `node_modules`.

The published game must run from static files exactly as committed. start.ng never builds anything.

Exact three.js version and file list come from the vendored package. Never assume them.

---

## Mode of Operation

### This task is pre-approved

Unlike a normal task, do not stop for a proposal. The scope in `spec.md` is approved. Instead:

1. Read this file, `spec.md` and `startNG-DOCS.md`.
2. Send a short **Findings** note: the three.js version and files you will vendor, whether `dusk-stack` is free (`GET https://api.start.ng/games`), any doc drift, and anything in the spec you think is wrong.
3. Continue without waiting, unless the problem would change the scope. Then stop and ask.

### Raise disagreements

When the spec or a doc conflicts with a better approach: do not silently follow it, do not silently replace it. State the conflict and tradeoffs in the report. If it blocks the work, stop and ask.

### Verify third-party behavior

Before using three.js, WebAudio, `postMessage` or any start.ng behavior:

1. Read the vendored three.js source or its installed type definitions for the exact API you call.
2. Read `startNG-DOCS.md` for start.ng. If real behavior differs from the doc, say so. Do not work around it.
3. Use community sources only as supporting material.

Never write an API name, option or message type from memory. Separate confirmed behavior from inference.

### Verify claims before stating them

Do not claim a file's contents, a command's result, a passing check or an observed browser behavior unless you observed it in this session. An empty or failed fetch is a failed fetch; say so. If you could not run or view something (sign-in, real scores, the live leaderboard, mobile Safari), say exactly that.

### Actions that always require the engineer's approval

Stop and ask before any of the following, every time:

- Adding any dependency to the repo, runtime or dev, or any external script, font, image or CDN. (Tooling installed outside the repo for testing, such as Playwright, is allowed and is never committed.)
- Any network call other than `start.ng`, `api.start.ng`, and fetching docs or packages while setting up.
- Deleting files, or any destructive shell command.
- Pushing, opening a PR, or any history rewrite.
- Calling `POST https://api.start.ng/games/publish`. (`POST /games/check` is allowed once a repo URL exists.)
- Changing `startng.json` stat keys after the first publish: this changes the leaderboard columns.
- Editing `AGENTS.md` or `startNG-DOCS.md`.

### Pre-approved by this brief

- Creating and using the local branch `feat/dusk-stack`.
- Local commits, one per stage, as long as the stage checks pass. Stage exact paths, never `git add -A` or `git add .` blindly. Conventional Commits, imperative summary of at most 72 characters. No co-author or AI-attribution trailers.

Commit and push remain separate. Push is never pre-approved.

### Fix root causes

Address the underlying cause, not the symptom. Do not add a guard to hide a bug you have not understood.

---

## Development Workflow

### Setup

Serve the repo root over HTTP (`python3 -m http.server 8080`). ES modules and the importmap do not work from `file://`. The README documents this.

### The task loop

1. Read the docs. Send Findings.
2. Build in stages (the spec lists them). At each stage end, run the logic tests and load the game in a browser harness (see Testing). Fix before moving on. Commit the stage.
3. Run the full test and browser pass at the end.
4. Update `README.md`.
5. Report. Stop. The engineer asks for the next pass.

### Definition of done

- Behavior matches `spec.md` and its acceptance criteria.
- `node --test` passes. State the exact commands run and their outcome.
- Browser checks ran at one desktop and one mobile size, with screenshots you actually looked at. If you could not run them, say so.
- Zero console errors and warnings on load and across a full round.
- No dead code, debug logging, stray TODOs, mock code or unrelated changes in the diff.

### Reporting

When a pass ends, report:

- What changed, by stage, in a few sentences.
- Verification: commands run, results, and anything not verified.
- A manual checklist for what you cannot exercise (live sign-in, real score saving, the live leaderboard, real phones).
- Deviations from the spec, and open questions.
- Proposed edits to this file, written out in full for the engineer. Never apply them.

Do not recap every step.

---

## Global Code Standards

### JavaScript

ES modules only. Named exports only; no default exports, no `export *` barrels. `const` by default. Immutable updates for state objects. No globals on `window`. No `eval`, `new Function`, or string-built code. JSDoc on exported functions with parameter and return types. Input object for 3 or more arguments.

### Structure

Small files with one job. Pure logic (slicing math, perfect detection, speed curve, palette, style normalization, score payload) lives in `js/logic.js` with no three.js or DOM imports, so it can be tested in Node. Rendering code never decides game rules.

### Comments and constants

Comments explain non-obvious **why**, one or two lines. No magic numbers or strings: tunable values live in `js/config.js`, named and grouped.

### Rendering and lifecycle

- Frame-rate independent: use delta time, clamped (for example at 50 ms) so a tab switch cannot teleport slabs.
- Cap `devicePixelRatio` at 2. Handle resize and orientation change.
- Pause the loop and suspend audio when the tab is hidden; resume cleanly.
- Dispose geometries, materials and textures you create when removing objects. Cap live debris. Remove event listeners you add.
- Respect `prefers-reduced-motion` (less camera movement, no shake, fewer particles).

### start.ng integration

- Use the `askStartNg` helper from `startNG-DOCS.md`, keeping the `e.origin` and `e.source` checks exactly.
- Never block gameplay on start.ng. The game starts immediately with the guest look and swaps in the real character when the reply arrives.
- Treat every reply as untrusted. Validate shape and types before use.
- Never call start.ng with anything but whole numbers for scores, within 0 to 1,000,000,000.

### Storage

`localStorage` is allowed for exactly two things: the mute setting and the personal best (floors). Wrap every read and write in try/catch. Parse defensively. Anything other players should see goes to start.ng.

---

## Input Validation

Treat all external data as untrusted: `postMessage` replies, leaderboard entries, player names, `style` values, face images, `localStorage` values, query parameters.

- Character `style`: accept only the documented values (see the style table in `startNG-DOCS.md`). Colors must match `#rrggbb`. Anything missing or unknown falls back to the guest default for that field.
- `face` is used as an image source only if it starts with `data:image/png;base64,`.
- Names and accounts are rendered with `textContent`. Never `innerHTML` with external data.
- Prefer structured `{ ok, reason }` results over parsing error text.

---

## UX Baseline

Mobile-first and touch-friendly. Keyboard: Space or Enter drops a slab. Light accessibility baseline as normal practice: labelled buttons, visible focus, readable contrast, `aria-live` for the score, reduced-motion support. Safe-area insets respected on phones. No page scrolling or pull-to-refresh interference during play (`touch-action` and `overscroll-behavior` set properly).

A state attribute `data-state` on `<body>` (`loading`, `ready`, `playing`, `gameover`) is part of the design: it drives styling and lets browser tests read the game state.

---

## Testing

Proportionate. Aim at behavior that could break a round or break start.ng integration.

**Node (`node --test`, in `tests/`)**: pure logic only.

- Slicing: overlap, overhang and offcut size, on both axes, including exact edges and no overlap.
- Perfect detection at and either side of the tolerance, streak counting, regrow after 3 perfects, regrow cap.
- Speed curve: starts at base, rises with floors, never exceeds the cap.
- Style normalization: valid input, missing fields, unknown values, bad colors.
- Score payload: whole numbers, range, correct keys (`floors`, `perfects`).

**Browser (Playwright, installed outside the repo, not committed)**: reported, not committed.

- Load, zero console errors and warnings.
- Drop slabs with real Space presses; confirm the HUD score increments; confirm game over; confirm restart.
- No-player path: with the connect frame unreachable, the game still plays.
- Fake player path: intercept `https://start.ng/connect` in the test harness only, and answer `startng:whoami`, `startng:score` and `startng:leaderboard` with canned replies shaped like the docs. Confirm the character and profile chip render, the score message is sent with whole numbers, and the leaderboard highlights the player's row. **Mock code never ships in the repo.**
- Screenshots at desktop and mobile sizes. Look at them.
- Rapid taps, resize mid-round, and hidden-tab pause.

No `.only` or `.skip` left in tests. Never weaken an assertion. A failing test is a finding: reproduce it, find the cause, fix it.

---

## Documentation Standards

`README.md` stays short: what it is, how to run, how to test, how it is published (name, repo, `startng.json`), and known limits (sign-in and scores only work when live at `dusk-stack.start.ng`).

---

## High-Signal Forbidden Patterns

Never introduce these:

```js
import * as THREE from "https://cdn.jsdelivr.net/..."; // vendored only
```

```js
el.innerHTML = player.name; // external data is textContent only
```

```js
console.log("debug", state); // no debug logging in committed code
```

```js
const speed = 4.2 * floors * 0.05; // magic numbers belong in config.js
```

```js
img.src = reply.user.face; // validate the data:image/png prefix first
```

```js
window.game = game; // no globals; no test hooks that ship
```

Also never: a password field, a redirect on load, obfuscated or `eval`-style code, a secret of any kind, absolute asset paths (`/js/main.js`), `localStorage` for anything but mute and personal best, or mock start.ng code in the repo.

---

## Final Reminder

NEVER push, publish or edit protected files without explicit approval. Local commits per stage are pre-approved by this brief.

When in doubt, ask. Never claim something works unless you ran it.