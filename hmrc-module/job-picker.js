// The fairground stalls' interaction: a "Press ENTER to interact" hint while the player is at a
// stall (three-game.js reports when that changes), and a "What is your job?" popup offering every
// game as a tile. Choosing one goes to that game; Escape, the close button or clicking outside the
// panel closes it and hands movement back.
//
// The games come from game-list.js — the same list and tiles as the hub — so new games appear here
// automatically. HMRC Mode itself is left out, since the player is already in it.

import { GAMES, gameUrl, createGameTile } from '../game-list.js?v=2';
import { saveHmrcReturn } from '../player-session.js?v=1';

export function createJobPicker({ subject, onOpenChange = () => {} }) {
  const hint = document.createElement('button');
  hint.type = 'button';
  hint.className = 'interact-hint';
  hint.hidden = true;
  hint.innerHTML = 'Press <kbd>ENTER</kbd> to interact';

  const overlay = document.createElement('div');
  overlay.className = 'job-picker';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="job-picker-panel" role="dialog" aria-modal="true" aria-labelledby="jobPickerTitle">
      <button type="button" class="job-picker-close" aria-label="Close">✕</button>
      <h2 class="job-picker-title" id="jobPickerTitle">What is your job?</h2>
      <p class="job-picker-sub">Pick a game to play · <kbd>Esc</kbd> to close</p>
      <div class="job-picker-grid"></div>
    </div>`;
  const panel = overlay.querySelector('.job-picker-panel');
  const grid = overlay.querySelector('.job-picker-grid');
  const closeButton = overlay.querySelector('.job-picker-close');

  GAMES.filter((game) => game.id !== 'hmrc').forEach((game, i) => {
    const tile = createGameTile(game, i);
    tile.addEventListener('click', () => {
      // Remember the stall, so coming back to the fairground (e.g. the payslip's NEXT) puts the
      // player back beside it. Read by main.js.
      saveHmrcReturn({ stall: nearbyStall?.banner });
      window.location.href = gameUrl(game.id, subject);
    });
    grid.appendChild(tile);
  });

  document.body.append(hint, overlay);

  let nearbyStall = null;
  let isOpen = false;

  const renderHint = () => {
    hint.hidden = !nearbyStall || isOpen;
    if (nearbyStall) hint.setAttribute('aria-label', `Press Enter to interact with the ${nearbyStall.text} stall`);
  };

  const open = () => {
    if (isOpen || !nearbyStall) return;
    isOpen = true;
    overlay.hidden = false;
    onOpenChange(true);
    renderHint();
    // Focus after this keypress has finished, so the Enter that opened the popup can't also
    // activate the first tile.
    requestAnimationFrame(() => grid.querySelector('.game-card')?.focus());
  };

  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    overlay.hidden = true;
    onOpenChange(false);
    renderHint();
    document.activeElement?.blur();
  };

  // Tab stays within the popup while it's open.
  const trapFocus = (event) => {
    const focusable = [...panel.querySelectorAll('button')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  window.addEventListener('keydown', (event) => {
    if (isOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Tab') {
        trapFocus(event);
      }
      return;
    }
    const typing = event.target.closest && event.target.closest('input, textarea, select');
    if (event.key === 'Enter' && nearbyStall && !event.repeat && !typing) {
      event.preventDefault();
      open();
    }
  });

  hint.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });

  return {
    setNearbyStall(stall) {
      nearbyStall = stall;
      renderHint();
    },
    open,
    close,
    get isOpen() { return isOpen; },
  };
}
