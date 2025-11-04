import { collection, addDoc, getDocs, updateDoc, doc, onSnapshot, QuerySnapshot, DocumentSnapshot, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Game } from '../models';

export const saveGame = async (game: Game) => {
  if (!game.id) {
    const docRef = await addDoc(collection(db, 'games'), game);
    game.id = docRef.id;
  } else {
    await updateDoc(doc(db, 'games', game.id), game as any);  // Cast to any fixes TS2345 (Firestore limitation with mapped types)
  }
  // Offline: Firestore handles local cache, syncs on connect
};

export const getGames = async (): Promise<Game[]> => {
  const snapshot = await getDocs(collection(db, 'games'));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Game));
};

export const subscribeToGame = (gameId: string, callback: (game: Game) => void) => {
  return onSnapshot(doc(db, 'games', gameId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() } as Game);
  });
};

export {};