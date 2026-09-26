// The only file that talks to Firebase. It uses the compat SDK loaded by the <script> tags in
// chess.html (global `firebase`) and adapts the Realtime Database to the small backend interface
// online.js uses, so the room logic can also run against a stand-in in tests:
//   { playerId, get(path), transaction(path, update), subscribe(path, onValue, onError) -> unsubscribe }

const PLAYER_ID_KEY = 'chess-player-id';

// No sign-in: each browser gets a random player id, remembered in localStorage so a reload keeps
// its seat. If storage is unavailable (private mode, blocked site data) the id lasts only for
// this page, so a reload can't rejoin — the game itself still works.
function getPlayerId() {
  try {
    let id = localStorage.getItem(PLAYER_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function connectFirebase(config) {
  const { firebase } = window;
  if (!firebase || !firebase.database) {
    throw new Error('Could not load Firebase. Check your connection and reload the page.');
  }
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);
  const db = app.database();

  return {
    playerId: getPlayerId(),
    async get(path) {
      return (await db.ref(path).once('value')).val();
    },
    // `update` gets the current value (possibly null before the first server read — returning a
    // value then makes the SDK retry with the real data) and returns the new value, or undefined
    // to abort. applyLocally = false: listeners only ever see server-confirmed data.
    async transaction(path, update) {
      const result = await db.ref(path).transaction(update, undefined, false);
      return { committed: result.committed, value: result.snapshot.val() };
    },
    subscribe(path, onValue, onError) {
      const ref = db.ref(path);
      const listener = ref.on('value', (snap) => onValue(snap.val()), onError);
      return () => ref.off('value', listener);
    },
  };
}
