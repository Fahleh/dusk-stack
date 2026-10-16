// DOM layer: HUD, profile chip, title and game-over screens, leaderboard.
// Anything that came from start.ng is written with textContent or validated first.

import { GAME_NAME } from './config.js';
import { litPips } from './logic.js';

const byId = (id) => document.getElementById(id);

/**
 * @param {{ onMuteToggle: () => void, onSignIn: () => void, onPlayAgain: () => void, guestMode: boolean }} options
 * `guestMode` is true when the URL has `?guest`: no sign-in invitations are shown.
 * @returns {object} UI controller
 */
export function createUi({ onMuteToggle, onSignIn, onPlayAgain, guestMode }) {
  const el = {
    score: byId('score'),
    pips: byId('pips'),
    mute: byId('mute'),
    profile: byId('profile'),
    face: byId('profile-face'),
    name: byId('profile-name'),
    account: byId('profile-account'),
    signIn: byId('sign-in'),
    titleBest: byId('title-best'),
    overFloors: byId('over-floors'),
    overPerfects: byId('over-perfects'),
    overBest: byId('over-best'),
    status: byId('over-status'),
    board: byId('board'),
    boardNote: byId('board-note'),
    again: byId('again'),
    fallback: byId('fallback'),
  };

  byId('game-name').textContent = GAME_NAME;
  document.title = GAME_NAME;

  el.mute.addEventListener('click', (event) => {
    onMuteToggle();
    // Pointer clicks drop focus so Space keeps dropping slabs; keyboard users keep theirs.
    if (event.detail > 0) el.mute.blur();
  });
  el.signIn.addEventListener('click', onSignIn);
  el.again.addEventListener('click', onPlayAgain);

  const bestText = (best) => (best > 0 ? `Best on this device: ${best}` : '');

  return {
    setState(state) {
      document.body.dataset.state = state;
    },

    showFallback() {
      el.fallback.hidden = false;
    },

    setFloors(floors) {
      el.score.textContent = String(floors);
    },

    setStreak(streak) {
      el.pips.dataset.streak = String(streak);
      el.pips.dataset.lit = String(litPips(streak));
      el.pips.setAttribute('aria-label', `Perfect streak ${streak}`);
    },

    setMuted(muted) {
      el.mute.setAttribute('aria-pressed', String(muted));
      el.mute.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    },

    setBest(best) {
      el.titleBest.textContent = bestText(best);
    },

    /** @param {{ name: string, account: string|null, face: string|null, signedIn: boolean }} player already validated */
    setProfile(player) {
      el.name.textContent = player.name;
      el.account.textContent = player.signedIn && player.account ? `@${player.account}` : 'Not signed in';
      if (player.face) {
        el.face.src = player.face;
        el.face.hidden = false;
      } else {
        el.face.removeAttribute('src');
        el.face.hidden = true;
      }
      el.signIn.hidden = player.signedIn;
      el.profile.hidden = false;
    },

    /** @param {{ floors: number, perfects: number, best: number, signedIn: boolean }} round */
    showSummary({ floors, perfects, best, signedIn }) {
      el.overFloors.textContent = String(floors);
      el.overPerfects.textContent = String(perfects);
      el.overBest.textContent = String(best);
      el.board.replaceChildren();
      el.boardNote.textContent = 'Loading the leaderboard...';
      if (signedIn) el.status.textContent = 'Saving your score...';
      else el.status.textContent = guestMode ? '' : 'Sign in to save your score to the leaderboard.';
    },

    /** @param {{ ok: boolean, improved?: boolean, rank?: number|null }} result from normalizeScoreReply */
    setScoreResult(result) {
      if (!result.ok) {
        el.status.textContent = "Couldn't save your score this time.";
        return;
      }
      const rank = result.rank ? ` You are #${result.rank}.` : '';
      el.status.textContent = result.improved ? `New best!${rank}` : `Saved.${rank}`;
    },

    /** @param {{ ok: boolean, entries?: object[] }} board from normalizeLeaderboard @param {number|null} playerId */
    setLeaderboard(board, playerId) {
      if (!board.ok || board.entries.length === 0) {
        el.board.replaceChildren();
        el.boardNote.textContent = board.ok ? 'No scores yet. Be the first.' : 'Leaderboard unavailable.';
        return;
      }
      el.boardNote.textContent = '';
      const head = document.createElement('li');
      head.className = 'head';
      head.append(...['#', 'Player', 'Floors', 'Perfect'].map((label, i) => {
        const cell = document.createElement('span');
        cell.textContent = label;
        if (i > 1) cell.className = 'num';
        if (i === 0) cell.className = 'rank';
        return cell;
      }));
      const rows = board.entries.map((entry) => {
        const row = document.createElement('li');
        if (playerId !== null && entry.playerId === playerId) row.className = 'me';
        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = String(entry.rank);
        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = entry.name;
        const floors = document.createElement('span');
        floors.className = 'num';
        floors.textContent = String(entry.floors);
        const perfects = document.createElement('span');
        perfects.className = 'num';
        perfects.textContent = String(entry.perfects);
        row.append(rank, name, floors, perfects);
        return row;
      });
      el.board.replaceChildren(head, ...rows);
    },
  };
}
