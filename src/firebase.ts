import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, signInAnonymously, UserCredential } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Firebase config from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Validate required config
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    'Firebase configuration is missing. Please check your .env file and ensure all REACT_APP_FIREBASE_* variables are set.'
  );
}

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
