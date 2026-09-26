// Firebase web config for online play (Firebase console → Project settings → Your apps).
//
// These values are not secrets: every Firebase web app ships them to the browser. What protects
// the data is the security rules in /database.rules.json, which must be published to the project.
//
// With no `databaseURL`, the SDK uses https://<projectId>-default-rtdb.firebaseio.com, which is
// where a Realtime Database created in the us-central1 location lives. A database created in any
// other location needs its URL (shown at the top of the Realtime Database page) added here.
export const firebaseConfig = {
  apiKey: 'AIzaSyAHsaamws1YRQJfJzKRS9gJY4M0g9S7LvI',
  authDomain: 'the-exam-hub-c9c0b.firebaseapp.com',
  projectId: 'the-exam-hub-c9c0b',
  storageBucket: 'the-exam-hub-c9c0b.firebasestorage.app',
  messagingSenderId: '273366828495',
  appId: '1:273366828495:web:cf857bd8c64c9c8dc03eba',
  measurementId: 'G-GB1F0SPEZ6',
};
