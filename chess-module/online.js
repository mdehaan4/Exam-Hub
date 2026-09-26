// Online rooms: create/join by code, submit moves, and follow the shared game. Talks to the
// database only through a backend object (firebase-backend.js in the app, a stand-in in tests).
//
// A room stores who is playing and an append-only log of moves — never a board, turn or status:
//   games/{CODE}: {
//     players:   { w: uid, b?: uid },            the creator plays White; the joiner takes Black
//     moves:     { 0: { from: 'e2', to: 'e4' },   even indexes are White's, odd are Black's
//                  1: { from: 'e7', to: 'e5' },
//                  ... promotion?: 'Q' | 'R' | 'B' | 'N' },
//     createdAt: ms timestamp,
//   }
// Every client rebuilds the game by replaying the log with the chess engine, so the position can't
// be written directly by anyone. database.rules.json makes the log append-only: a write can only
// add the next index, only by the player that index belongs to, and only as a well-formed move.
// Rules can't check chess legality, so that part is the replay: an illegal move in the log is
// rejected by every client (it shows as an error and the game can't continue).

import { replayMoves, playMove } from './game.js?v=3';

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

const moveRecord = ({ from, to, promotion }) => (promotion ? { from, to, promotion } : { from, to });

// Rebuilds the game from a room's move log. Throws if any move in it is illegal. The log may come
// back as an array, as an object keyed '0', '1', ... or be missing entirely (the Realtime Database
// drops empty lists); integer-like keys enumerate in ascending order, so Object.values keeps order.
export function gameFromRoom(room) {
  return replayMoves(Object.values(room.moves || {}).map(moveRecord));
}

export async function createRoom(backend) {
  const room = { players: { w: backend.uid }, createdAt: Date.now() };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeRoomCode();
    // Only claim the code if nobody has it; a clash just tries another code.
    const { committed } = await backend.transaction(roomPath(code), (current) => (current === null ? room : undefined));
    if (committed) return { code, color: 'w' };
  }
  throw new Error('Could not create a room. Please try again.');
}

// Joins as Black, or rejoins as whichever side this uid already holds (e.g. after a reload).
export async function joinRoom(backend, code) {
  const room = await backend.get(roomPath(code));
  if (!room) throw new Error(`No game found with code ${code}.`);
  if (room.players.w === backend.uid) return { code, color: 'w' };
  if (room.players.b === backend.uid) return { code, color: 'b' };
  if (room.players.b) throw new Error('That game already has two players.');

  const { value } = await backend.transaction(`${roomPath(code)}/players/b`,
    (current) => (current === null ? backend.uid : undefined));
  if (value !== backend.uid) throw new Error('That game already has two players.');
  return { code, color: 'b' };
}

// Plays `input` ({ from, to, promotion? }) as `color` by appending it to the room's move log.
// Checked against the room's current log first: throws if the opponent hasn't joined, it isn't
// this player's turn, the game is over, or the move is illegal. Only this player can write the
// next index, so the log can't change underneath between the check and the write.
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

// Calls onUpdate({ game, players }) with the rebuilt game on every change to the room, and
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
    onUpdate({ game, players: room.players || {} });
  }, onError);
}
