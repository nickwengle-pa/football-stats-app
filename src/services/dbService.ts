import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  QueryDocumentSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';
import { Game, Player, Season, Team, Coach, OpponentTeam } from '../models';

const gamesCollectionRoot = () => collection(db, 'games');
const legacyGameDoc = (gameId: string) => doc(db, 'games', gameId);
const teamsCollection = () => collection(db, 'teams');
const teamDoc = (teamId: string) => doc(db, 'teams', teamId);
const seasonsCollection = (teamId: string) => collection(db, 'teams', teamId, 'seasons');
const seasonDoc = (teamId: string, seasonId: string) =>
  doc(db, 'teams', teamId, 'seasons', seasonId);
const opponentsCollection = (teamId: string) => collection(db, 'teams', teamId, 'opponents');
const opponentDoc = (teamId: string, opponentId: string) =>
  doc(db, 'teams', teamId, 'opponents', opponentId);
const rosterCollection = (teamId: string, seasonId: string) =>
  collection(db, 'teams', teamId, 'seasons', seasonId, 'roster');
const rosterDoc = (teamId: string, seasonId: string, playerId: string) =>
  doc(db, 'teams', teamId, 'seasons', seasonId, 'roster', playerId);
const seasonGamesCollection = (teamId: string, seasonId: string) =>
  collection(db, 'teams', teamId, 'seasons', seasonId, 'games');
const seasonGameDoc = (teamId: string, seasonId: string, gameId: string) =>
  doc(db, 'teams', teamId, 'seasons', seasonId, 'games', gameId);

const extractEntity = <T>(snap: QueryDocumentSnapshot): T => {
  const data = snap.data() as Omit<T, 'id'>;
  return { id: snap.id, ...data } as T;
};

const withoutId = <T extends { id?: string }>(entity: T) => {
  const { id: _ignored, ...rest } = entity;
  return rest;
};

const createDeferredUnsubscribe = (factory: () => Promise<Unsubscribe>): Unsubscribe => {
  let unsubscribe: Unsubscribe | null = null;
  let completed = false;

  factory()
    .then((fn) => {
      unsubscribe = fn;
      if (completed) {
        unsubscribe?.();
      }
    })
    .catch((error) => {
      console.error('Failed to start Firestore subscription', error);
    });

  return () => {
    completed = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  };
};

export const upsertTeam = async (team: Team): Promise<Team> => {
  await ensureAuth();
  await setDoc(teamDoc(team.id), withoutId(team), { merge: true });
  return team;
};

export const getTeam = async (teamId: string): Promise<Team | null> => {
  await ensureAuth();
  const snap = await getDoc(teamDoc(teamId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Team, 'id'>;
  return { id: snap.id, ...data };
};

export const listTeams = async (): Promise<Team[]> => {
  await ensureAuth();
  const snapshot = await getDocs(teamsCollection());
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Team, 'id'>;
    return { id: docSnap.id, ...data };
  });
};

export const upsertSeason = async (teamId: string, season: Season): Promise<Season> => {
  await ensureAuth();
  const seasonData = withoutId(season);
  if (!season.id) {
    const docRef = await addDoc(seasonsCollection(teamId), seasonData);
    return { ...season, id: docRef.id };
  }
  await setDoc(seasonDoc(teamId, season.id), seasonData, { merge: true });
  return season;
};

export const listSeasons = async (teamId: string): Promise<Season[]> => {
  await ensureAuth();
  const snapshot = await getDocs(seasonsCollection(teamId));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Season, 'id'>;
    return { id: docSnap.id, ...data };
  });
};

export const listOpponents = async (teamId: string): Promise<OpponentTeam[]> => {
  await ensureAuth();
  const snapshot = await getDocs(opponentsCollection(teamId));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<OpponentTeam, 'id'>;
    return { id: docSnap.id, ...data };
  });
};

export const upsertRosterPlayer = async (
  teamId: string,
  seasonId: string,
  player: Player
): Promise<Player> => {
  await ensureAuth();
  await setDoc(rosterDoc(teamId, seasonId, player.id), withoutId(player), { merge: true });
  return player;
};

export const getSeasonRoster = async (
  teamId: string,
  seasonId: string
): Promise<Player[]> => {
  await ensureAuth();
  const snapshot = await getDocs(rosterCollection(teamId, seasonId));
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Player, 'id'>;
    return { id: docSnap.id, ...data };
  });
};

export const importRosterBatch = async (
  teamId: string,
  seasonId: string,
  players: Player[]
) => {
  if (!players.length) return;
  await ensureAuth();
  const batch = writeBatch(db);
  players.forEach((player) => {
    batch.set(rosterDoc(teamId, seasonId, player.id), withoutId(player), { merge: true });
  });
  await batch.commit();
};

export const deleteRosterPlayer = async (
  teamId: string,
  seasonId: string,
  playerId: string
) => {
  await ensureAuth();
  await deleteDoc(rosterDoc(teamId, seasonId, playerId));
};

export const updateSeasonCoaches = async (
  teamId: string,
  seasonId: string,
  coaches: Coach[]
) => {
  await ensureAuth();
  await setDoc(seasonDoc(teamId, seasonId), { coaches }, { merge: true });
};

export const updateSeasonNotes = async (
  teamId: string,
  seasonId: string,
  notes: string | undefined
) => {
  await ensureAuth();
  await setDoc(seasonDoc(teamId, seasonId), { notes: notes ?? null }, { merge: true });
};

export type TeamBrandingUpdate = {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string | null | undefined;
  logoUrl?: string | null | undefined;
  wordmarkUrl?: string | null | undefined;
};

export const updateTeamBranding = async (teamId: string, branding: TeamBrandingUpdate) => {
  await ensureAuth();
  const payload: Record<string, unknown> = {};
  if (branding.primaryColor !== undefined) {
    payload.primaryColor = branding.primaryColor;
  }
  if (branding.secondaryColor !== undefined) {
    payload.secondaryColor = branding.secondaryColor;
  }
  if (branding.accentColor !== undefined) {
    payload.accentColor = branding.accentColor ?? null;
  }
  if (branding.logoUrl !== undefined) {
    payload.logoUrl = branding.logoUrl ?? null;
  }
  if (branding.wordmarkUrl !== undefined) {
    payload.wordmarkUrl = branding.wordmarkUrl ?? null;
  }
  if (Object.keys(payload).length === 0) {
    return;
  }
  await setDoc(teamDoc(teamId), { defaultColors: payload }, { merge: true });
};

export const upsertOpponent = async (
  teamId: string,
  opponent: OpponentTeam
): Promise<OpponentTeam> => {
  await ensureAuth();
  const payload = withoutId(opponent);
  if (!opponent.id) {
    const docRef = await addDoc(opponentsCollection(teamId), payload);
    return { ...opponent, id: docRef.id };
  }
  await setDoc(opponentDoc(teamId, opponent.id), payload, { merge: true });
  return opponent;
};

export const deleteOpponent = async (teamId: string, opponentId: string): Promise<void> => {
  await ensureAuth();
  await deleteDoc(opponentDoc(teamId, opponentId));
};

const prepareGameWrite = (
  game: Game,
  teamId: string,
  seasonId: string
): Omit<Game, 'id'> => {
  const base: Game = {
    ...game,
    seasonId,
    myTeamId: teamId,
    myTeamSnapshot: game.myTeamSnapshot ?? {
      teamId,
      seasonId,
      roster: game.homePlayers ?? [],
    },
  };
  const { id: _ignored, ...payload } = base;
  return payload;
};

export const deleteSeasonGame = async (
  teamId: string,
  seasonId: string,
  gameId: string
): Promise<void> => {
  await ensureAuth();
  await deleteDoc(seasonGameDoc(teamId, seasonId, gameId));
};
export const saveGame = async (game: Game, context?: GameSubscriptionContext) => {
  await ensureAuth();
  const scopedTeamId = context?.teamId ?? game.myTeamId;
  const scopedSeasonId = context?.seasonId ?? game.seasonId;

  if (scopedTeamId && scopedSeasonId) {
    return upsertSeasonGame(scopedTeamId, scopedSeasonId, { ...game, myTeamId: scopedTeamId, seasonId: scopedSeasonId });
  }

  if (!game.id) {
    const docRef = await addDoc(gamesCollectionRoot(), withoutId(game));
    game.id = docRef.id;
  } else {
    await updateDoc(legacyGameDoc(game.id), withoutId(game) as any);
  }

  return game;
};

export const getGames = async (context: GameSubscriptionContext = {}): Promise<Game[]> => {
  await ensureAuth();
  if (context.teamId && context.seasonId) {
    return listGamesForSeason(context.teamId, context.seasonId);
  }

  const snapshot = await getDocs(gamesCollectionRoot());
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Game, 'id'>;
    return { id: docSnap.id, ...data };
  });
};

export const subscribeToGame = (
  gameId: string,
  callback: (game: Game) => void,
  context: GameSubscriptionContext = {}
) => {
  return createDeferredUnsubscribe(async () => {
    await ensureAuth();
    if (context.teamId && context.seasonId) {
      return onSnapshot(seasonGameDoc(context.teamId, context.seasonId, gameId), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<Game, 'id'>;
          callback({ id: snap.id, ...data });
        }
      });
    }

    return onSnapshot(legacyGameDoc(gameId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Omit<Game, 'id'>;
        callback({ id: snap.id, ...data });
      }
    });
  });
};

export {};


