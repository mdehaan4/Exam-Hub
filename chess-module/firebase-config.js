// Firebase web config for online play (Firebase console → Project settings → Your apps).
//
// These values are not secrets: every Firebase web app ships them to the browser. What protects
// the data is the security rules in /database.rules.json, which must be published to the project.
//
// `databaseURL` is required because the database is in europe-west1 (Belgium); without it the SDK
// would look for a us-central1 database, which doesn't exist.
export const firebaseConfig = {
  apiKey: 'AIzaSyAHsaamws1YRQJfJzKRS9gJY4M0g9S7LvI',
  authDomain: 'the-exam-hub-c9c0b.firebaseapp.com',
  databaseURL: 'https://the-exam-hub-c9c0b-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'the-exam-hub-c9c0b',
  storageBucket: 'the-exam-hub-c9c0b.firebasestorage.app',
  messagingSenderId: '273366828495',
  appId: '1:273366828495:web:cf857bd8c64c9c8dc03eba',
  measurementId: 'G-GB1F0SPEZ6',
};
