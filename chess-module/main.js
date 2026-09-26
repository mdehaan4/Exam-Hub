import { findKing, colorOf, typeOf, squareName } from './engine.js?v=1';
import { createGame, legalMoves, playMove, undoMove, isGameOver } from './game.js?v=3';
import { createRoom, joinRoom, submitMove, watchRoom, normalizeRoomCode } from './online.js?v=4';
import { firebaseConfig } from './firebase-config.js?v=2';

// U+FE0E asks for the text (not emoji) form, so pawns don't render as a coloured emoji on iOS.
const GLYPHS = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const glyph = (type) => GLYPHS[type] + '︎';
const PIECE_NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const COLOR_NAMES = { w: 'White', b: 'Black' };
const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };

const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const movesEl = document.getElementById('moves');
const undoBtn = document.getElementById('undo');
const promotionEl = document.getElementById('promotion');
const promotionChoicesEl = document.getElementById('promotion-choices');
const capturedEls = { w: document.getElementById('captured-w'), b: document.getElementById('captured-b') };
const newGameBtn = document.getElementById('new-game');
const onlineLobbyEl = document.getElementById('online-lobby');
const onlineRoomEl = document.getElementById('online-room');
const onlineCreateBtn = document.getElementById('online-create');
const onlineJoinForm = document.getElementById('online-join-form');
const onlineCodeInput = document.getElementById('online-code');
const roomCodeEl = document.getElementById('room-code');
const roomInfoEl = document.getElementById('room-info');
const roomCopyBtn = document.getElementById('room-copy');
const inviteEl = document.getElementById('invite');
const roomLinkInput = document.getElementById('room-link');
const onlineMessageEl = document.getElementById('online-message');

// The whole game (position, move list, status) as one plain-data object — see game.js.
// Everything else here is view state that isn't part of the game.
let game;
let selected = null;       // [r, c] of the selected piece
let selectedMoves = [];    // legal moves from `selected`
let flipped = false;       // true = Black at the bottom
let pendingPromotion = null;
// Pointer press on one of the mover's pieces. It becomes a drag once the pointer travels past
// DRAG_THRESHOLD; if it never does, the press was a click.
let drag = null;           // { from, startX, startY, size, wasSelected, active, ghost }
const DRAG_THRESHOLD = 5;  // px
// null for a local game; while in an online room:
//   { code, color: my side, players: { w, b? } player ids, sending: a move is being saved,
//     serverGame: last game received from the room }
let online = null;
let connecting = false;    // creating/joining a room

function newGame() {
  game = createGame();
  clearSelection();
  hidePromotion();
  render();
}

const sameSquare = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

function clearSelection() {
  selected = null;
  selectedMoves = [];
}

function select(square) {
  selected = square;
  selectedMoves = legalMoves(game, square);
}

// Plays the selected piece to (r, c) if that's legal; returns whether it did.
function tryMoveTo(r, c) {
  const candidates = selectedMoves.filter(m => sameSquare(m.to, [r, c]));
  if (!candidates.length) return false;
  if (candidates.length > 1) showPromotion(candidates); // one move per promotion piece
  else commitMove(candidates[0]);
  return true;
}

// Whether this screen may move right now. Locally both players share it; online only the player
// whose turn it is, once an opponent has joined and no move of ours is still being saved.
function canMove() {
  if (isGameOver(game)) return false;
  if (!online) return true;
  return !!online.players.b && game.turn === online.color && !online.sending;
}

const isOwnPiece = (r, c) => canMove() && colorOf(game.board[r][c]) === game.turn;

// Keyboard activation (Enter/Space on a focused square). Mouse and touch go through the pointer
// handlers below, which do the same thing plus dragging.
function onSquareActivate(r, c) {
  if (pendingPromotion || !canMove()) return;
  if (selected && tryMoveTo(r, c)) return;
  if (isOwnPiece(r, c) && !sameSquare(selected, [r, c])) select([r, c]);
  else clearSelection();
  render();
}

function squareFromEl(el) {
  const sq = el && el.closest('.square');
  return sq && boardEl.contains(sq) ? [Number(sq.dataset.r), Number(sq.dataset.c)] : null;
}

function onPointerDown(e) {
  if (e.button !== 0 || pendingPromotion || !canMove()) return;
  const square = squareFromEl(e.target);
  if (!square) return;
  const [r, c] = square;
  if (selected && tryMoveTo(r, c)) return; // click-to-move onto a highlighted square
  if (!isOwnPiece(r, c)) {
    clearSelection();
    render();
    return;
  }
  e.preventDefault();
  // Capture on the board (not the square): render() replaces the square elements mid-drag.
  boardEl.setPointerCapture(e.pointerId);
  drag = {
    from: square,
    startX: e.clientX,
    startY: e.clientY,
    size: e.target.closest('.square').getBoundingClientRect().width,
    wasSelected: sameSquare(selected, square),
    active: false,
    ghost: null,
  };
  select(square);
  render();
}

function onPointerMove(e) {
  if (!drag) return;
  if (!drag.active) {
    if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
    drag.active = true;
    const piece = game.board[drag.from[0]][drag.from[1]];
    drag.ghost = document.createElement('span');
    drag.ghost.className = `piece ${colorOf(piece)} ghost`;
    drag.ghost.textContent = glyph(typeOf(piece));
    drag.ghost.style.fontSize = `${drag.size * 0.82}px`;
    document.body.append(drag.ghost);
    document.body.classList.add('dragging');
    render(); // dims the piece left behind on its origin square
  }
  drag.ghost.style.left = `${e.clientX}px`;
  drag.ghost.style.top = `${e.clientY}px`;

  const over = squareFromEl(document.elementFromPoint(e.clientX, e.clientY));
  const legal = over && selectedMoves.some(m => sameSquare(m.to, over));
  boardEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  if (legal) boardEl.querySelector(`[data-r="${over[0]}"][data-c="${over[1]}"]`).classList.add('drag-over');
}

function onPointerUp(e, cancelled = false) {
  if (!drag) return;
  const { active, ghost, wasSelected } = drag;
  drag = null;
  if (ghost) ghost.remove();
  document.body.classList.remove('dragging');
  if (active) {
    const over = !cancelled && squareFromEl(document.elementFromPoint(e.clientX, e.clientY));
    if (over && tryMoveTo(over[0], over[1])) return;
    render(); // dropped somewhere illegal: the piece snaps back and stays selected
  } else if (wasSelected) {
    clearSelection(); // a plain click on the already-selected piece deselects it
    render();
  }
}

function commitMove(move) {
  const input = { from: squareName(move.from), to: squareName(move.to) };
  if (move.promotion) input.promotion = move.promotion;
  if (online) {
    sendOnlineMove(input);
    return;
  }
  game = playMove(game, input);
  clearSelection();
  hidePromotion();
  render();
}

// ---- online play ------------------------------------------------------------------------------

let backendPromise = null;
function getBackend() {
  if (!backendPromise) {
    backendPromise = import('./firebase-backend.js?v=3').then(m => m.connectFirebase(firebaseConfig));
    backendPromise.catch(() => { backendPromise = null; }); // allow a retry after a failed connect
  }
  return backendPromise;
}

function showOnlineMessage(text, isError = false) {
  onlineMessageEl.textContent = text;
  onlineMessageEl.classList.toggle('error', isError);
}

function setRoomInUrl(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  history.replaceState(null, '', url);
}

const roomLink = (code) => `${location.origin}${location.pathname}?room=${code}`;

async function goOnline(action) {
  if (connecting) return;
  connecting = true;
  showOnlineMessage('Connecting…');
  render();
  try {
    const backend = await getBackend();
    enterRoom(backend, await action(backend));
    showOnlineMessage('');
  } catch (err) {
    showOnlineMessage(err.message || String(err), true);
  } finally {
    connecting = false;
    render();
  }
}

function enterRoom(backend, { code, color }) {
  leaveRoom({ keepMessage: true });
  online = { code, color, players: {}, sending: false, serverGame: null, unsubscribe: null };
  flipped = color === 'b';
  game = createGame();
  clearSelection();
  hidePromotion();
  setRoomInUrl(code);
  online.unsubscribe = watchRoom(backend, code, ({ game: serverGame, players }) => {
    if (!online || online.code !== code) return;
    const moved = serverGame.moves.length !== game.moves.length;
    online.players = players;
    online.serverGame = serverGame;
    game = serverGame;
    if (moved) {
      clearSelection();
      hidePromotion();
      if (drag) onPointerUp(new PointerEvent('pointercancel'), true);
    }
    render();
  }, (err) => {
    showOnlineMessage(err.message || String(err), true);
  });
}

function leaveRoom({ keepMessage = false } = {}) {
  if (!online) return;
  online.unsubscribe?.();
  online = null;
  flipped = false;
  setRoomInUrl(null);
  if (!keepMessage) showOnlineMessage('');
}

// The move is shown straight away, then saved in a transaction against the room's current state;
// the room listener then delivers the confirmed game. If saving fails, the board goes back to the
// last confirmed game.
async function sendOnlineMove(input) {
  const room = online;
  const before = game;
  game = playMove(game, input);
  room.sending = true;
  clearSelection();
  hidePromotion();
  render();
  try {
    await submitMove(await getBackend(), room.code, room.color, input);
  } catch (err) {
    if (online === room) {
      game = room.serverGame || before;
      showOnlineMessage(err.message || String(err), true);
    }
  } finally {
    room.sending = false;
    render();
  }
}

function undo() {
  if (!game.moves.length) return;
  game = undoMove(game);
  clearSelection();
  hidePromotion();
  render();
}

function showPromotion(candidates) {
  pendingPromotion = candidates;
  const color = colorOf(candidates[0].piece);
  promotionChoicesEl.replaceChildren(...candidates.map(move => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', PIECE_NAMES[move.promotion]);
    btn.innerHTML = `<span class="piece ${color}">${glyph(move.promotion)}</span>`;
    btn.addEventListener('click', () => commitMove(move));
    return btn;
  }));
  promotionEl.hidden = false;
  promotionChoicesEl.firstChild.focus();
}

function hidePromotion() {
  pendingPromotion = null;
  promotionEl.hidden = true;
}

function render() {
  renderBoard();
  renderStatus();
  renderMoves();
  renderCaptured();
  undoBtn.disabled = !!online || game.moves.length === 0;
  newGameBtn.disabled = !!online;
  renderOnline();
}

function renderOnline() {
  onlineLobbyEl.hidden = !!online;
  onlineRoomEl.hidden = !online;
  onlineCreateBtn.disabled = connecting || !firebaseConfig;
  for (const el of onlineJoinForm.elements) el.disabled = connecting || !firebaseConfig;
  if (!online) return;
  roomCodeEl.textContent = online.code;
  // The invite is only needed until someone takes the empty seat.
  inviteEl.hidden = !!online.players.b;
  roomLinkInput.value = roomLink(online.code);
  const opponent = online.players.b ? 'opponent connected' : 'waiting for an opponent to join';
  roomInfoEl.textContent = `You are ${COLOR_NAMES[online.color]} · ${opponent}`;
}

function renderBoard() {
  const status = game.status.state;
  const gameOver = isGameOver(game);
  const checkedKing = status === 'check' || status === 'checkmate' ? findKing(game.board, game.turn) : null;
  const lastMove = game.moves[game.moves.length - 1];
  const squares = [];

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const r = flipped ? 7 - i : i;
      const c = flipped ? 7 - j : j;
      const piece = game.board[r][c];
      const sq = document.createElement('button');
      sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.r = r;
      sq.dataset.c = c;
      if (piece && colorOf(piece) === game.turn && !gameOver && canMove()) sq.classList.add('movable');
      if (sameSquare(selected, [r, c])) sq.classList.add('selected');
      if (lastMove && [lastMove.from, lastMove.to].includes(squareName([r, c]))) sq.classList.add('last-move');
      if (sameSquare(checkedKing, [r, c])) sq.classList.add('in-check');
      const target = selectedMoves.find(m => sameSquare(m.to, [r, c]));
      if (target) {
        sq.classList.add('target');
        if (target.captured) sq.classList.add('capture');
      }
      sq.setAttribute('aria-label', squareName([r, c]) + (piece ? ` ${COLOR_NAMES[colorOf(piece)]} ${PIECE_NAMES[typeOf(piece)]}` : ''));
      if (piece) {
        const lifted = drag && drag.active && sameSquare(drag.from, [r, c]) ? ' lifted' : '';
        sq.innerHTML = `<span class="piece ${colorOf(piece)}${lifted}">${glyph(typeOf(piece))}</span>`;
      }
      if (j === 0) sq.insertAdjacentHTML('beforeend', `<span class="coord rank">${8 - r}</span>`);
      if (i === 7) sq.insertAdjacentHTML('beforeend', `<span class="coord file">${'abcdefgh'[c]}</span>`);
      squares.push(sq);
    }
  }
  boardEl.replaceChildren(...squares);
}

function renderStatus() {
  const result = game.status;
  const side = COLOR_NAMES[game.turn];
  const text = {
    playing: `${side} to move`,
    check: `${side} to move — check!`,
    checkmate: `Checkmate — ${COLOR_NAMES[result.winner]} wins`,
    stalemate: 'Stalemate — draw',
    draw: `Draw — ${result.reason}`,
  }[result.state];
  statusEl.textContent = online ? onlineStatusText(result, text) : text;
  statusEl.classList.toggle('ended', isGameOver(game));
}

function onlineStatusText(result, localText) {
  if (!online.players.b) return 'Waiting for an opponent to join…';
  if (result.state === 'checkmate') return result.winner === online.color ? 'Checkmate — you win!' : 'Checkmate — you lose';
  if (isGameOver(game)) return localText;
  if (online.sending) return 'Sending your move…';
  const check = result.state === 'check' ? ' — check!' : '';
  return (game.turn === online.color ? 'Your move' : "Opponent's move") + check;
}

function renderMoves() {
  const rows = [];
  for (let i = 0; i < game.moves.length; i += 2) {
    const li = document.createElement('li');
    const white = game.moves[i];
    const black = game.moves[i + 1];
    li.innerHTML = `<span class="num">${i / 2 + 1}.</span><span></span><span></span>`;
    li.children[1].textContent = white.san;
    if (black) li.children[2].textContent = black.san;
    rows.push(li);
  }
  movesEl.replaceChildren(...rows);
  const latest = movesEl.querySelectorAll('span:not(.num):not(:empty)');
  if (latest.length) latest[latest.length - 1].classList.add('latest');
  movesEl.scrollTop = movesEl.scrollHeight;
}

// Pieces each side has taken (drawn in the captured piece's own colour), plus the material lead.
function renderCaptured() {
  const taken = { w: [], b: [] }; // taken.w = pieces White has captured
  for (const move of game.moves) {
    if (move.captured) taken[colorOf(move.piece)].push(typeOf(move.captured));
    if (move.promotion) taken[colorOf(move.piece)].push(`-P+${move.promotion}`); // material only
  }
  const score = (list) => list.reduce((sum, t) => {
    if (t.startsWith('-P+')) return sum + PIECE_VALUES[t[3]] - PIECE_VALUES.P;
    return sum + PIECE_VALUES[t];
  }, 0);
  const diff = score(taken.w) - score(taken.b);
  const order = 'QRBNP';
  for (const color of ['w', 'b']) {
    const victimColor = color === 'w' ? 'b' : 'w';
    const pieces = taken[color].filter(t => !t.startsWith('-P+'))
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map(t => `<span class="piece ${victimColor}">${glyph(t)}</span>`).join('');
    const lead = color === 'w' ? diff : -diff;
    capturedEls[color].innerHTML = pieces + (lead > 0 ? `<span class="adv">+${lead}</span>` : '');
  }
}

newGameBtn.addEventListener('click', () => {
  if (game.moves.length && !isGameOver(game) && !confirm('Abandon this game and start a new one?')) return;
  newGame();
});
undoBtn.addEventListener('click', undo);
boardEl.addEventListener('pointerdown', onPointerDown);
boardEl.addEventListener('pointermove', onPointerMove);
boardEl.addEventListener('pointerup', (e) => onPointerUp(e));
boardEl.addEventListener('pointercancel', (e) => onPointerUp(e, true));
boardEl.addEventListener('click', (e) => {
  if (e.detail !== 0) return; // detail 0 = keyboard-triggered; pointer clicks are handled above
  const square = squareFromEl(e.target);
  if (square) onSquareActivate(square[0], square[1]);
});
document.getElementById('flip').addEventListener('click', () => { flipped = !flipped; render(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (pendingPromotion) { hidePromotion(); clearSelection(); render(); }
    else if (drag) onPointerUp(new PointerEvent('pointercancel'), true);
    else if (selected) { clearSelection(); render(); }
  }
});

onlineCreateBtn.addEventListener('click', () => {
  if (game.moves.length && !isGameOver(game) && !confirm('Abandon this game and start an online one?')) return;
  goOnline((backend) => createRoom(backend));
});
onlineJoinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const code = normalizeRoomCode(onlineCodeInput.value);
  if (!code) {
    showOnlineMessage('Room codes are 6 letters and numbers, e.g. K7PQ2M.', true);
    return;
  }
  if (game.moves.length && !isGameOver(game) && !confirm('Abandon this game and join an online one?')) return;
  goOnline((backend) => joinRoom(backend, code));
});
document.getElementById('room-leave').addEventListener('click', () => {
  if (!isGameOver(game) && online.players.b && !confirm('Leave this online game?')) return;
  leaveRoom();
  newGame();
});
roomCopyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomLink(online.code));
    roomCopyBtn.textContent = 'Copied!';
    setTimeout(() => { roomCopyBtn.textContent = 'Copy invite link'; }, 1500);
  } catch {
    // Clipboard access can be refused (permissions, non-HTTPS pages): select the link instead.
    roomLinkInput.focus();
    roomLinkInput.select();
    showOnlineMessage('Press Ctrl+C (⌘C on a Mac) to copy the selected link.');
  }
});
roomLinkInput.addEventListener('focus', () => roomLinkInput.select());

// Debug/inspection hook: JSON.stringify(window.__chess.game) is a complete save of the game.
window.__chess = { get game() { return game; }, get online() { return online; } };

newGame();
// An invite link (?room=CODE) fills in the code and joins that room; reloading rejoins it as the
// same player. The code stays in the box, so if joining fails it can be retried with one click.
const linkedParam = new URL(location.href).searchParams.get('room');
const linkedCode = normalizeRoomCode(linkedParam);
if (linkedParam) onlineCodeInput.value = linkedCode || linkedParam;
if (!firebaseConfig) {
  showOnlineMessage('Online play needs a Firebase project: add its config to chess-module/firebase-config.js.');
} else if (linkedCode) {
  goOnline((backend) => joinRoom(backend, linkedCode));
} else if (linkedParam) {
  showOnlineMessage(`"${linkedParam}" in this invite link isn't a valid room code.`, true);
}
