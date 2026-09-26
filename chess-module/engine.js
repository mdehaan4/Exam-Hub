// Chess rules engine. Pure functions over a plain-object state — no DOM, no classes — so the
// state can be JSON.stringify'd as-is (for saving, or sending over the network later) and the
// same rules can run on a server to validate moves.
//
// State shape:
//   board:     8x8 array, board[row][col]; row 0 is rank 8 (Black's back rank), col 0 is file a.
//              Each square is null or a piece string: colour + type, e.g. 'wK', 'bP', 'wN'.
//   turn:      'w' | 'b' — side to move.
//   castling:  { wK, wQ, bK, bQ } booleans — rights not yet lost (the squares/check conditions
//              are checked separately at move-generation time).
//   enPassant: [row, col] of the square a pawn can capture onto en passant, or null.
//   halfmoveClock:  plies since the last capture or pawn move (fifty-move rule).
//   fullmoveNumber: starts at 1, incremented after Black moves.
//
// Moves are plain objects too:
//   { from: [r, c], to: [r, c], piece, captured?, promotion?, castle?: 'K' | 'Q', enPassant? }

export const FILES = 'abcdefgh';
const PROMOTION_TYPES = ['Q', 'R', 'B', 'N'];
const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

export const colorOf = (piece) => piece && piece[0];
export const typeOf = (piece) => piece && piece[1];
export const opponent = (color) => (color === 'w' ? 'b' : 'w');
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const homeRow = (color) => (color === 'w' ? 7 : 0);
const pawnDir = (color) => (color === 'w' ? -1 : 1);

export function squareName([r, c]) {
  return FILES[c] + (8 - r);
}

export function createInitialState() {
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    board[0][c] = 'b' + back[c];
    board[1][c] = 'bP';
    board[6][c] = 'wP';
    board[7][c] = 'w' + back[c];
  }
  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
  };
}

export function cloneState(state) {
  return {
    ...state,
    board: state.board.map(row => row.slice()),
    castling: { ...state.castling },
    enPassant: state.enPassant && [...state.enPassant],
  };
}

// Is (r, c) attacked by any piece of `byColor`? Works backwards from the target square, so it
// doesn't depend on whose turn it is and ignores pins (a pinned piece still gives check).
export function isSquareAttacked(board, r, c, byColor) {
  // Pawns: a byColor pawn attacks diagonally forward, so look one row "behind" the target.
  const pr = r - pawnDir(byColor);
  for (const dc of [-1, 1]) {
    if (onBoard(pr, c + dc) && board[pr][c + dc] === byColor + 'P') return true;
  }
  for (const [dr, dc] of KNIGHT_STEPS) {
    if (onBoard(r + dr, c + dc) && board[r + dr][c + dc] === byColor + 'N') return true;
  }
  for (const [dr, dc] of KING_STEPS) {
    if (onBoard(r + dr, c + dc) && board[r + dr][c + dc] === byColor + 'K') return true;
  }
  const slides = [[ROOK_DIRS, 'R'], [BISHOP_DIRS, 'B']];
  for (const [dirs, slider] of slides) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (colorOf(p) === byColor && (typeOf(p) === slider || typeOf(p) === 'Q')) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }
  }
  return false;
}

export function findKing(board, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === color + 'K') return [r, c];
    }
  }
  return null;
}

export function isInCheck(state, color = state.turn) {
  const king = findKing(state.board, color);
  return !!king && isSquareAttacked(state.board, king[0], king[1], opponent(color));
}

// Moves that follow each piece's movement rules but may leave the mover's own king in check.
// Castling is the exception: its "not in / through / into check" conditions are checked here,
// because they're about squares other than the king's final one.
function pseudoLegalMoves(state, r, c) {
  const { board } = state;
  const piece = board[r][c];
  if (!piece) return [];
  const color = colorOf(piece);
  const moves = [];
  const add = (tr, tc, extra = {}) => {
    const captured = board[tr][tc];
    const move = { from: [r, c], to: [tr, tc], piece };
    if (captured) move.captured = captured;
    Object.assign(move, extra);
    moves.push(move);
  };

  switch (typeOf(piece)) {
    case 'P': {
      const dir = pawnDir(color);
      const startRow = color === 'w' ? 6 : 1;
      const lastRow = color === 'w' ? 0 : 7;
      const addPawn = (tr, tc, extra) => {
        if (tr === lastRow) PROMOTION_TYPES.forEach(t => add(tr, tc, { ...extra, promotion: t }));
        else add(tr, tc, extra);
      };
      if (onBoard(r + dir, c) && !board[r + dir][c]) {
        addPawn(r + dir, c);
        if (r === startRow && !board[r + 2 * dir][c]) add(r + 2 * dir, c);
      }
      for (const dc of [-1, 1]) {
        const tr = r + dir, tc = c + dc;
        if (!onBoard(tr, tc)) continue;
        const target = board[tr][tc];
        if (target && colorOf(target) !== color) addPawn(tr, tc);
        else if (state.enPassant && state.enPassant[0] === tr && state.enPassant[1] === tc) {
          add(tr, tc, { enPassant: true, captured: opponent(color) + 'P' });
        }
      }
      break;
    }
    case 'N':
    case 'K': {
      const steps = typeOf(piece) === 'N' ? KNIGHT_STEPS : KING_STEPS;
      for (const [dr, dc] of steps) {
        const tr = r + dr, tc = c + dc;
        if (onBoard(tr, tc) && colorOf(board[tr][tc]) !== color) add(tr, tc);
      }
      if (typeOf(piece) === 'K') addCastlingMoves(state, color, r, c, add);
      break;
    }
    default: {
      const t = typeOf(piece);
      const dirs = t === 'R' ? ROOK_DIRS : t === 'B' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
      for (const [dr, dc] of dirs) {
        let tr = r + dr, tc = c + dc;
        while (onBoard(tr, tc)) {
          const target = board[tr][tc];
          if (target) {
            if (colorOf(target) !== color) add(tr, tc);
            break;
          }
          add(tr, tc);
          tr += dr; tc += dc;
        }
      }
    }
  }
  return moves;
}

// Castling requires: the right is still held (king and that rook never moved, rook not captured),
// every square between king and rook is empty, the king is not currently in check, and the king
// does not pass through or land on an attacked square. The rook's own path may be attacked.
function addCastlingMoves(state, color, r, c, add) {
  const { board, castling } = state;
  const row = homeRow(color);
  if (r !== row || c !== 4) return;
  const enemy = opponent(color);
  if (isSquareAttacked(board, row, 4, enemy)) return;

  if (castling[color + 'K'] && board[row][7] === color + 'R' &&
      !board[row][5] && !board[row][6] &&
      !isSquareAttacked(board, row, 5, enemy) && !isSquareAttacked(board, row, 6, enemy)) {
    add(row, 6, { castle: 'K' });
  }
  if (castling[color + 'Q'] && board[row][0] === color + 'R' &&
      !board[row][1] && !board[row][2] && !board[row][3] &&
      !isSquareAttacked(board, row, 3, enemy) && !isSquareAttacked(board, row, 2, enemy)) {
    add(row, 2, { castle: 'Q' });
  }
}

// Applies a move and returns the new state. Does not check legality — pass it a move from
// getLegalMoves() (or getLegalMoves() itself uses it to test for self-check).
export function applyMove(state, move) {
  const next = cloneState(state);
  const { board } = next;
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const color = colorOf(move.piece);

  board[fr][fc] = null;
  board[tr][tc] = move.promotion ? color + move.promotion : move.piece;

  if (move.enPassant) board[fr][tc] = null; // the captured pawn sits beside the mover, not on `to`
  if (move.castle === 'K') { board[tr][5] = board[tr][7]; board[tr][7] = null; }
  if (move.castle === 'Q') { board[tr][3] = board[tr][0]; board[tr][0] = null; }

  // Castling rights: lost for good when the king moves, or when a rook leaves — or is captured
  // on — its original corner.
  if (typeOf(move.piece) === 'K') {
    next.castling[color + 'K'] = false;
    next.castling[color + 'Q'] = false;
  }
  const corners = { 'w7,7': 'wK', 'w7,0': 'wQ', 'b0,7': 'bK', 'b0,0': 'bQ' };
  for (const [sq, side] of [[move.from, color], [move.to, opponent(color)]]) {
    const right = corners[side + sq.join(',')];
    if (right) next.castling[right] = false;
  }

  next.enPassant = typeOf(move.piece) === 'P' && Math.abs(tr - fr) === 2 ? [(fr + tr) / 2, fc] : null;
  next.halfmoveClock = typeOf(move.piece) === 'P' || move.captured ? 0 : state.halfmoveClock + 1;
  if (color === 'b') next.fullmoveNumber += 1;
  next.turn = opponent(color);
  return next;
}

// All legal moves for the side to move, or only those from one square if `from` is given.
export function getLegalMoves(state, from = null) {
  const squares = [];
  if (from) squares.push(from);
  else {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) squares.push([r, c]);
  }
  const legal = [];
  for (const [r, c] of squares) {
    if (colorOf(state.board[r][c]) !== state.turn) continue;
    for (const move of pseudoLegalMoves(state, r, c)) {
      // Make the move and see if our own king is attacked. This one test covers pins, moving into
      // check, failing to answer check, and the en passant case where removing both pawns from a
      // rank exposes the king to a rook.
      if (!isInCheck(applyMove(state, move), state.turn)) legal.push(move);
    }
  }
  return legal;
}

// Neither side can possibly mate: K v K, K+minor v K, or K+B v K+B with same-coloured bishops.
function isInsufficientMaterial(board) {
  const others = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && typeOf(p) !== 'K') others.push({ p, shade: (r + c) % 2 });
    }
  }
  if (others.length === 0) return true;
  if (others.length === 1) return ['B', 'N'].includes(typeOf(others[0].p));
  if (others.every(o => typeOf(o.p) === 'B')) return others.every(o => o.shade === others[0].shade);
  return false;
}

// { status: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw', winner?, reason? }
export function getGameStatus(state) {
  const inCheck = isInCheck(state);
  if (getLegalMoves(state).length === 0) {
    return inCheck
      ? { status: 'checkmate', winner: opponent(state.turn) }
      : { status: 'stalemate' };
  }
  if (state.halfmoveClock >= 100) return { status: 'draw', reason: 'fifty-move rule' };
  if (isInsufficientMaterial(state.board)) return { status: 'draw', reason: 'insufficient material' };
  return { status: inCheck ? 'check' : 'playing' };
}

// Standard algebraic notation for a legal move in `state` (the position before the move).
export function toSAN(state, move) {
  if (move.castle) return withCheckSuffix(state, move, move.castle === 'K' ? 'O-O' : 'O-O-O');
  const type = typeOf(move.piece);
  const dest = squareName(move.to);
  let san;
  if (type === 'P') {
    san = move.captured ? FILES[move.from[1]] + 'x' + dest : dest;
    if (move.promotion) san += '=' + move.promotion;
  } else {
    // Disambiguate when another piece of the same type could also reach the destination.
    const rivals = getLegalMoves(state).filter(m =>
      m.piece === move.piece && m.to[0] === move.to[0] && m.to[1] === move.to[1] &&
      (m.from[0] !== move.from[0] || m.from[1] !== move.from[1]));
    let disambig = '';
    if (rivals.length) {
      const sameFile = rivals.some(m => m.from[1] === move.from[1]);
      const sameRank = rivals.some(m => m.from[0] === move.from[0]);
      if (!sameFile) disambig = FILES[move.from[1]];
      else if (!sameRank) disambig = String(8 - move.from[0]);
      else disambig = squareName(move.from);
    }
    san = type + disambig + (move.captured ? 'x' : '') + dest;
  }
  return withCheckSuffix(state, move, san);
}

function withCheckSuffix(state, move, san) {
  const after = applyMove(state, move);
  if (!isInCheck(after)) return san;
  return san + (getLegalMoves(after).length === 0 ? '#' : '+');
}

// Counts leaf positions to a given depth — the standard way to verify a move generator against
// published numbers (see chess-module tests / chessprogramming.org "Perft Results").
export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = getLegalMoves(state);
  if (depth === 1) return moves.length;
  let total = 0;
  for (const m of moves) total += perft(applyMove(state, m), depth - 1);
  return total;
}

// FEN parsing, mainly so tests can set up specific positions.
export function fromFEN(fen) {
  const [placement, turn, castling, ep, half = '0', full = '1'] = fen.trim().split(/\s+/);
  const board = placement.split('/').map(rank => {
    const row = [];
    for (const ch of rank) {
      if (/\d/.test(ch)) row.push(...Array(Number(ch)).fill(null));
      else row.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
    }
    return row;
  });
  return {
    board,
    turn,
    castling: { wK: castling.includes('K'), wQ: castling.includes('Q'), bK: castling.includes('k'), bQ: castling.includes('q') },
    enPassant: ep === '-' ? null : [8 - Number(ep[1]), FILES.indexOf(ep[0])],
    halfmoveClock: Number(half),
    fullmoveNumber: Number(full),
  };
}
