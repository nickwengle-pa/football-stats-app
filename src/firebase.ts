import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCjxmva_mvlmNhpoHIsl3wPN5dSa4QYHTo",
  authDomain: "pl-stats-52e57.firebaseapp.com",
  projectId: "pl-stats-52e57",
  storageBucket: "pl-stats-52e57.firebasestorage.app",
  messagingSenderId: "976569830835",
  appId: "1:976569830835:web:aabdb14074e79d6e8b8fc6",
  measurementId: "G-E37BQ2P48E"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

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