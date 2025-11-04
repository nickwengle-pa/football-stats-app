import {
  collection,
  addDoc,
  getDocs,
  doc,
  onSnapshot,
  QuerySnapshot,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  updateDoc,
  FirestoreDataConverter,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../firebase';
import { Game } from '../models';

// Converter for Game: Handles TS types for mapped/nested fields on reads
const gameConverter: FirestoreDataConverter<Game> = {
  toFirestore(game: Game): any {
    return {
      opponent: game.opponent,
      date: game.date,
      homePlayers: game.homePlayers.map((player) => ({
        id: player.id,
        name: player.name,
        position: player.position,
        stats: { ...player.stats }, // Spread for mapped type
      })),
      plays: game.plays.map((play) => ({
        id: play.id,
        type: play.type,
        yards: play.yards,
        playerId: play.playerId,
        description: play.description,
        timestamp: play.timestamp,
        quarter: play.quarter,
        down: play.down,
        distance: play.distance,
        assistingPlayerIds: play.assistingPlayerIds ?? [],
      })),
      homeScore: game.homeScore,
      oppScore: game.oppScore,
    };
  },
  fromFirestore(snapshot: QueryDocumentSnapshot | DocumentSnapshot, options): Game {
    const data = snapshot.data(options)!;
    return {
      id: snapshot.id,
      opponent: data.opponent,
      date: data.date,
      homePlayers: (data.homePlayers || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        position: p.position,
        stats: { ...(p.stats || {}) },
      })),
      plays: (data.plays || []).map((play: any) => ({
        id: play.id,
        type: play.type,
        yards: play.yards,
        playerId: play.playerId,
        description: play.description,
        timestamp: play.timestamp,
        quarter: play.quarter ?? 1,
        down: play.down ?? '1st',
        distance: play.distance ?? '10',
        assistingPlayerIds: play.assistingPlayerIds ?? [],
      })),
      homeScore: data.homeScore ?? 0,
      oppScore: data.oppScore ?? 0,
    };
  },
};

const fallbackGames: Game[] = [];
const fallbackSubscribers = new Map<string, Set<(game: Game) => void>>();
let firestoreUnavailable = false;

const disableFirestore = (reason: unknown) => {
  if (!firestoreUnavailable) {
    console.warn('Disabling Firestore usage; switching to in-memory store.', reason);
  }
  firestoreUnavailable = true;
};

const cloneGame = (game: Game): Game => ({
  ...game,
  homePlayers: game.homePlayers.map((player) => ({
    ...player,
    stats: { ...player.stats },
  })),
  plays: game.plays.map((play) => ({
    ...play,
    timestamp: play.timestamp,
    assistingPlayerIds: [...(play.assistingPlayerIds ?? [])],
  })),
});

const notifyLocalSubscribers = (game: Game) => {
  if (!game.id) return;
  const listeners = fallbackSubscribers.get(game.id);
  if (!listeners) return;
  listeners.forEach((listener) => listener(cloneGame(game)));
};

const cacheGameLocally = (game: Game): Game => {
  if (!game.id) {
    game.id = uuidv4();
  }
  const storedGame = cloneGame(game);
  const existingIndex = fallbackGames.findIndex((g) => g.id === storedGame.id);
  if (existingIndex >= 0) {
    fallbackGames[existingIndex] = storedGame;
  } else {
    fallbackGames.push(storedGame);
  }
  notifyLocalSubscribers(storedGame);
  return cloneGame(storedGame);
};

const getLocalGames = (): Game[] => fallbackGames.map((game) => cloneGame(game));

const subscribeToLocalGame = (gameId: string, callback: (game: Game) => void) => {
  const existing = fallbackGames.find((g) => g.id === gameId);
  if (existing) {
    callback(cloneGame(existing));
  }

  let listeners = fallbackSubscribers.get(gameId);
  if (!listeners) {
    listeners = new Set();
    fallbackSubscribers.set(gameId, listeners);
  }
  listeners.add(callback);

  return () => {
    listeners?.delete(callback);
    if (listeners && listeners.size === 0) {
      fallbackSubscribers.delete(gameId);
    }
  };
};

export const saveGame = async (game: Game): Promise<Game> => {
  if (firestoreUnavailable) {
    return cacheGameLocally(game);
  }

  try {
    const serialized = gameConverter.toFirestore(game); // Manual serialization to plain object
    if (!game.id) {
      const docRef = await addDoc(collection(db, 'games'), serialized);
      game.id = docRef.id;
    } else {
      await updateDoc(doc(db, 'games', game.id), serialized); // Now accepts serialized (fixes TS2345)
    }
    return cacheGameLocally(game);
  } catch (error) {
    console.warn('Falling back to in-memory game store', error);
    disableFirestore(error);
    return cacheGameLocally(game);
  }
};

export const getGames = async (): Promise<Game[]> => {
  if (firestoreUnavailable) {
    return getLocalGames();
  }

  try {
    const collRef = collection(db, 'games').withConverter(gameConverter);
    const snapshot: QuerySnapshot<Game> = await getDocs(collRef);
    const games = snapshot.docs.map((d) => d.data());
    games.forEach(cacheGameLocally);
    return games;
  } catch (error) {
    console.warn('Returning games from in-memory fallback store', error);
    disableFirestore(error);
    return getLocalGames();
  }
};

export const subscribeToGame = (gameId: string, callback: (game: Game) => void) => {
  if (firestoreUnavailable) {
    return subscribeToLocalGame(gameId, callback);
  }

  let unsubscribeFirestore: (() => void) | undefined;
  let unsubscribeLocal: (() => void) | undefined;

  const ensureLocalSubscription = () => {
    if (!unsubscribeLocal) {
      unsubscribeLocal = subscribeToLocalGame(gameId, callback);
    }
  };

  try {
    const docRef = doc(db, 'games', gameId).withConverter(gameConverter);
    unsubscribeFirestore = onSnapshot(
      docRef,
      (snap: DocumentSnapshot<Game>) => {
        const data = snap.data();
        if (data) {
          const hydrated = { ...data, id: gameId };
          cacheGameLocally(hydrated);
          callback(hydrated);
        } else {
          // Document might be missing; fall back to local cache if we have one.
          const localGame = fallbackGames.find((g) => g.id === gameId);
          if (localGame) {
            callback(cloneGame(localGame));
          } else {
            ensureLocalSubscription();
          }
        }
      },
      (error) => {
        console.warn('Falling back to local subscription', error);
        disableFirestore(error);
        ensureLocalSubscription();
        queueMicrotask(() => {
          if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = undefined;
          }
        });
      }
    );
  } catch (error) {
    console.warn('Falling back to local subscription', error);
    disableFirestore(error);
    ensureLocalSubscription();
  }

  return () => {
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
    if (unsubscribeLocal) {
      unsubscribeLocal();
    }
  };
};

export {};
