// Online rooms: create/join by code, submit moves, and follow the shared game. Talks to the
// database only through a backend object (firebase-backend.js in the app, a stand-in in tests).
//
// A room stores who is playing and an append-only log of moves — never a board, turn or status:
//   games/{CODE}: {
//     players:   { w: id, b?: id },              the creator plays White; the joiner takes Black
//     moves:     { 0: { from: 'e2', to: 'e4' },   even indexes are White's, odd are Black's
//                  1: { pass: true },              a turn lost to a wrong answer (question gate)
//                  ... promotion?: 'Q' | 'R' | 'B' | 'N' },
//     subject:   'gitlab',                         question-bank subject both players answer from
//     createdAt: ms timestamp,
//   }
// Every client rebuilds the game by replaying the log with the chess engine, so the position can't
// be written directly by anyone. database.rules.json makes the log append-only: a write can only
// add a new, well-formed move, and past moves can't be changed or deleted. (The rules language
// can't count children, so "no gaps in the numbering" is checked by the clients, below.)
//
// There is no sign-in: a player's id is a random id kept in their browser (see
// firebase-backend.js), used to hold a seat and to rejoin after a reload. Because the database
// can't verify who is writing, "only the player whose turn it is may move" is enforced by the
// clients, not the rules — someone with the room code could still append a move from the
// browser console. Chess legality is enforced by the replay: an illegal move in the log is
// rejected by every client (it shows as an error and the game can't continue).

import { replayMoves, playMove } from './game.js?v=4';

export const ROOMS_PATH = 'games';
// No 0/O or 1/I, so codes survive being read out loud or retyped.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const roomPath = (code) => `${ROOMS_PATH}/${code}`;

export function makeRoomCode(random = Math.random) {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_CHARS[Math.floor(random() * CODE_CHARS.length)];
  return code;
}

// Accepts user input like " abc 123 " and returns 'ABC123', or null if it can't be a room code.
export function normalizeRoomCode(input) {
  const code = String(input || '').toUpperCase().replace(/[\s-]/g, '');
  return new RegExp(`^[${CODE_CHARS}]{${CODE_LENGTH}}$`).test(code) ? code : null;
}

const moveRecord = ({ from, to, promotion, pass }) => {
  if (pass) return { pass: true };
  return promotion ? { from, to, promotion } : { from, to };
};

// The room's moves in order. The log may come back as an array, as an object keyed '0', '1', ...
// or be missing entirely (the Realtime Database drops empty lists). A log with a gap — an array
// hole, or keys that skip a number — was written outside the game, so it's rejected.
function moveLog(moves) {
  if (!moves) return [];
  const entries = Array.isArray(moves) ? moves.map((m, i) => [String(i), m]) : Object.entries(moves);
  entries.forEach(([key, move], i) => {
    if (key !== String(i) || !move) throw new Error(`move ${i + 1} is missing`);
  });
  return entries.map(([, move]) => moveRecord(move));
}

// Rebuilds the game from a room's move log. Throws if the log has a gap or an illegal move.
export function gameFromRoom(room) {
  return replayMoves(moveLog(room.moves));
}

export async function createRoom(backend, subject) {
  const room = { players: { w: backend.playerId }, subject, createdAt: Date.now() };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    // Only claim the code if nobody has it; a clash just tries another code.
    const { committed } = await backend.transaction(roomPath(code), (current) => (current === null ? room : undefined));
    if (committed) return { code, color: 'w' };
  }
  throw new Error('Could not create a room. Please try again.');
}

// Joins as Black, or rejoins as whichever side this browser already holds (e.g. after a reload).
export async function joinRoom(backend, code) {
  const room = await backend.get(roomPath(code));
  if (!room) throw new Error(`No game found with code ${code}.`);
  if (room.players.w === backend.playerId) return { code, color: 'w' };
  if (room.players.b === backend.playerId) return { code, color: 'b' };
  if (room.players.b) throw new Error('That game already has two players.');

  const { value } = await backend.transaction(`${roomPath(code)}/players/b`,
    (current) => (current === null ? backend.playerId : undefined));
  if (value !== backend.playerId) throw new Error('That game already has two players.');
  return { code, color: 'b' };
}

// Plays `input` ({ from, to, promotion? } or { pass: true }) as `color` by appending it to the
// room's move log.
// Checked against the room's current log first: throws if the opponent hasn't joined, it isn't
// this player's turn, the game is over, or the move is illegal. The write is a transaction that
// only fills the next index if it's still empty, so a move can't land on top of another one.
export async function submitMove(backend, code, color, input) {
  const room = await backend.get(roomPath(code));
  if (!room) throw new Error('This game no longer exists.');
  if (!room.players.b) throw new Error('Waiting for an opponent to join.');
  const game = gameFromRoom(room);
  if (game.turn !== color) throw new Error("It's not your turn.");
  playMove(game, input); // throws if illegal or the game is over

  const index = game.moves.length;
  const record = moveRecord(input);
  const { committed } = await backend.transaction(`${roomPath(code)}/moves/${index}`,
    (current) => (current === null ? record : undefined));
  if (!committed) throw new Error('The game changed before your move was saved. Please try again.');
}

// Calls onUpdate({ game, players, subject }) with the rebuilt game on every change to the room, and
// onError(error) if the room disappears or its log contains an illegal move. Returns an
// unsubscribe function.
export function watchRoom(backend, code, onUpdate, onError) {
  return backend.subscribe(roomPath(code), (room) => {
    if (!room) return onError(new Error('This game no longer exists.'));
    let game;
    try {
      game = gameFromRoom(room);
    } catch (err) {
      return onError(new Error(`This game contains an invalid move and can't continue (${err.message}).`));
    }
    onUpdate({ game, players: room.players || {}, subject: room.subject || null });
  }, onError);
}
