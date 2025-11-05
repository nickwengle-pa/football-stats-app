import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInAnonymously, UserCredential } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCjxmva_mvlmNhpoHIsl3wPN5dSa4QYHTo",
  authDomain: "pl-stats-52e57.firebaseapp.com",
  projectId: "pl-stats-52e57",
  storageBucket: "pl-stats-52e57.appspot.com",
  messagingSenderId: "976569830835",
  appId: "1:976569830835:web:aabdb14074e79d6e8b8fc6",
  measurementId: "G-E37BQ2P48E"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

let authInitPromise: Promise<UserCredential> | null = null;

export const ensureAuth = () => {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  if (!authInitPromise) {
    authInitPromise = signInAnonymously(auth).catch((error) => {
      authInitPromise = null;
      if (error.code === 'auth/operation-not-allowed') {
        console.error('Enable anonymous auth in Firebase console.');
      } else if (error.code !== 'auth/credential-already-in-use') {
        console.error('Anonymous sign-in failed', error);
      }
      throw error;
    });
  }

  return authInitPromise.then((cred) => cred.user);
};

if (typeof window !== 'undefined') {
  ensureAuth().catch((err) => {
    console.error('Failed to initialize authentication', err);
  });
}

// Enable offline persistence (seamless sync)
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.log('Persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.log('Persistence not supported');
    }
  });

export {};
