/**
 * Script to remove duplicate plays from a game
 * Run with: npx ts-node scripts/removeDuplicatePlays.ts
 */

import dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Load environment variables
dotenv.config();

interface Play {
  id: string;
  [key: string]: any;
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

console.log('Firebase config:', {
  projectId: firebaseConfig.projectId,
  hasApiKey: !!firebaseConfig.apiKey
});

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function removeDuplicatePlays(
  teamId: string,
  seasonId: string,
  gameId: string
) {
  console.log(`Fetching game ${gameId}...`);
  
  const gameRef = doc(db, 'teams', teamId, 'seasons', seasonId, 'games', gameId);
  const gameSnap = await getDoc(gameRef);
  
  if (!gameSnap.exists()) {
    console.error('Game not found!');
    return;
  }
  
  const game = gameSnap.data();
  const plays: Play[] = game.plays || [];
  
  console.log(`Found ${plays.length} total plays`);
  
  // Remove duplicates by keeping first occurrence of each ID
  const seenIds = new Set<string>();
  const uniquePlays: Play[] = [];
  const duplicates: string[] = [];
  
  plays.forEach((play) => {
    if (!seenIds.has(play.id)) {
      seenIds.add(play.id);
      uniquePlays.push(play);
    } else {
      duplicates.push(play.id);
    }
  });
  
  console.log(`Found ${duplicates.length} duplicate plays:`);
  duplicates.forEach(id => console.log(`  - ${id}`));
  
  if (duplicates.length === 0) {
    console.log('No duplicates found! Game is clean.');
    return;
  }
  
  console.log(`\nRemoving duplicates...`);
  console.log(`Before: ${plays.length} plays`);
  console.log(`After: ${uniquePlays.length} plays`);
  
  // Update the game with deduplicated plays
  await updateDoc(gameRef, {
    plays: uniquePlays
  });
  
  console.log('✅ Duplicates removed successfully!');
}

// Get parameters from command line or use these defaults
const teamId = process.argv[2] || 'wnszPCToi72VOKFMX2tg';
const seasonId = process.argv[3] || '2025-varsity';
const gameId = process.argv[4] || 'f5b185e0-1d66-4486-9a63-d1b09e2eebc0';

removeDuplicatePlays(teamId, seasonId, gameId)
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
