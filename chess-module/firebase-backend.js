// The only file that talks to Firebase. It uses the compat SDK loaded by the <script> tags in
// chess.html (global `firebase`) and adapts Realtime Database + Anonymous Auth to the small
// backend interface online.js uses, so the room logic can also run against a stand-in in tests:
//   { uid, get(path), transaction(path, update), subscribe(path, onValue, onError) -> unsubscribe }

export async function connectFirebase(config) {
  const { firebase } = window;
  if (!firebase || !firebase.database || !firebase.auth) {
    throw new Error('Could not load Firebase. Check your connection and reload the page.');
  }
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(config);

  // Anonymous sign-in gives each browser a stable uid (the SDK persists it, so a reload keeps the
  // same identity and rejoins its room). The security rules key "whose turn is it" off this uid.
  let user;
  try {
    ({ user } = await app.auth().signInAnonymously());
  } catch (err) {
    if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
      throw new Error('Online play is not enabled yet: turn on Anonymous sign-in in the Firebase console (Authentication → Sign-in method).');
    }
    throw err;
  }
  const db = app.database();

  return {
    uid: user.uid,
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
