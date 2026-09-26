// The game record: one flat, plain-data object holding everything about a game, plus the only
// functions that create or change it. Updates are immutable (each returns a new object), so a
// game can be JSON.stringify'd, diffed or sent over the network at any point.
//
//   {
//     version: 1,
//     board: 8x8 array of 'wP' | 'bK' | ... | null   (row 0 = rank 8, col 0 = file a)
//     turn: 'w' | 'b',
//     castling: { wK, wQ, bK, bQ },
//     enPassant: 'e3' | null,        // square a pawn may capture onto en passant
//     halfmoveClock: 0,              // fifty-move rule counter
//     fullmoveNumber: 1,
//     moves: [{ from: 'e2', to: 'e4', piece: 'wP', captured?: 'bN', promotion?: 'Q', san: 'e4' }],
//     status: { state: 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw',
//               winner?: 'w' | 'b', reason?: string },
//   }
//
// `moves` is the source of truth: replaying it from the start position reproduces everything
// else (that's how undo works, and how online rooms work — they store only the move list; see
// online.js). Optional keys are left out rather than set to undefined.

import {
  createInitialState, getLegalMoves, applyMove, getGameStatus, toSAN, squareName, FILES,
} from './engine.js?v=1';

export const GAME_VERSION = 1;

const parseSquare = (name) => [8 - Number(name[1]), FILES.indexOf(name[0])];

// The engine works with enPassant as [row, col]; the game record uses a square name, which keeps
// arrays out of it except the board itself.
function toEngineState(game) {
  return {
    board: game.board,
    turn: game.turn,
    castling: game.castling,
    enPassant: game.enPassant ? parseSquare(game.enPassant) : null,
    halfmoveClock: game.halfmoveClock,
    fullmoveNumber: game.fullmoveNumber,
  };
}

function fromEngineState(state, moves) {
  const result = getGameStatus(state);
  const status = { state: result.status };
  if (result.winner) status.winner = result.winner;
  if (result.reason) status.reason = result.reason;
  return {
    version: GAME_VERSION,
    board: state.board,
    turn: state.turn,
    castling: state.castling,
    enPassant: state.enPassant ? squareName(state.enPassant) : null,
    halfmoveClock: state.halfmoveClock,
    fullmoveNumber: state.fullmoveNumber,
    moves,
    status,
  };
}

export function createGame() {
  return fromEngineState(createInitialState(), []);
}

export function isGameOver(game) {
  return ['checkmate', 'stalemate', 'draw'].includes(game.status.state);
}

// Legal moves for the side to move (optionally only from one square, given as a name or [r, c]).
// Returned in the engine's move shape, for the UI to highlight targets.
export function legalMoves(game, from = null) {
  if (isGameOver(game)) return [];
  const square = typeof from === 'string' ? parseSquare(from) : from;
  return getLegalMoves(toEngineState(game), square);
}

// Plays a move given as { from: 'e2', to: 'e4', promotion?: 'Q' } — the shape a remote player
// would send. The move is checked against the legal-move list, so a record can never be put into
// an illegal position, however the input arrived. Throws on an illegal move.
export function playMove(game, input) {
  if (isGameOver(game)) throw new Error(`Game is over (${game.status.state})`);
  const state = toEngineState(game);
  const [fr, fc] = parseSquare(input.from);
  const [tr, tc] = parseSquare(input.to);
  const move = getLegalMoves(state, [fr, fc]).find(m =>
    m.to[0] === tr && m.to[1] === tc && (m.promotion || null) === (input.promotion || null));
  if (!move) throw new Error(`Illegal move: ${input.from}-${input.to}${input.promotion ? '=' + input.promotion : ''}`);

  const record = { from: input.from, to: input.to, piece: move.piece };
  if (move.captured) record.captured = move.captured;
  if (move.promotion) record.promotion = move.promotion;
  record.san = toSAN(state, move);
  return fromEngineState(applyMove(state, move), [...game.moves, record]);
}

// Rebuilds a game by replaying a move list from the start position. Also the way to verify a
// game received from elsewhere: it throws if any move is illegal.
export function replayMoves(moves) {
  return moves.reduce((game, m) => playMove(game, m), createGame());
}

export function undoMove(game) {
  return replayMoves(game.moves.slice(0, -1));
}
