import { Game, Play, Player } from '../models';

type StatBucket = { [key: string]: number };

interface Score {
  home: number;
  opp: number;
}

const clonePlayers = (players: Player[]): Player[] =>
  players.map((player) => ({
    ...player,
    stats: { ...player.stats },
  }));

const getOrInitPlayerStats = (
  playerStats: Record<string, StatBucket>,
  playerId: string
): StatBucket => {
  if (!playerStats[playerId]) {
    playerStats[playerId] = {};
  }
  return playerStats[playerId];
};

const getScoreDelta = (play: Play): Score => {
  const lowerType = play.type.toLowerCase();
  let homeDelta = 0;
  let oppDelta = 0;

  const isTouchdown = lowerType.includes('td') && (lowerType.includes('run') || lowerType.includes('pass'));
  const isFieldGoal = lowerType.includes('field goal');
  const isPat = lowerType.includes('pat');
  const isTwoPoint = lowerType.includes('two point conversion');
  const isSafety = lowerType.includes('safety');
  const isTurnover = lowerType.includes('turnover');
  const isMissed = lowerType.includes('miss') || lowerType.includes('fail');

  if (isTouchdown) {
    homeDelta += 6;
  }

  if (isFieldGoal && !isMissed) {
    homeDelta += 3;
  }

  if (isPat && !isMissed) {
    homeDelta += 1;
  }

  if (isTwoPoint && !isMissed) {
    homeDelta += 2;
  }

  if (isSafety) {
    homeDelta += 2;
  }

  if (isTurnover) {
    oppDelta += Math.max(0, play.yards);
  }

  return { home: homeDelta, opp: oppDelta };
};

const applyPlayToStats = (playerStats: Record<string, StatBucket>, play: Play) => {
  const lowerType = play.type.toLowerCase();
  const stats = getOrInitPlayerStats(playerStats, play.playerId);

  if (lowerType.includes('run')) {
    stats.rushingYards = (stats.rushingYards || 0) + play.yards;
    stats.rushingAttempts = (stats.rushingAttempts || 0) + 1;
  }

  if (lowerType.includes('pass')) {
    stats.passingYards = (stats.passingYards || 0) + play.yards;
    stats.passingAttempts = (stats.passingAttempts || 0) + 1;
    if (play.yards > 0) {
      stats.completions = (stats.completions || 0) + 1;
    }
  }

  if (lowerType.includes('tackle')) {
    stats.tackles = (stats.tackles || 0) + 1;
  }

  if (lowerType.includes('turnover')) {
    stats.turnovers = (stats.turnovers || 0) + 1;
  }

  if (lowerType.includes('field goal')) {
    stats.fieldGoalAttempts = (stats.fieldGoalAttempts || 0) + 1;
    if (!lowerType.includes('miss')) {
      stats.fieldGoalsMade = (stats.fieldGoalsMade || 0) + 1;
      stats.fieldGoalYards = (stats.fieldGoalYards || 0) + play.yards;
    }
  }

  if (lowerType.includes('pat')) {
    stats.extraPointAttempts = (stats.extraPointAttempts || 0) + 1;
    if (!lowerType.includes('miss')) {
      stats.extraPointsMade = (stats.extraPointsMade || 0) + 1;
    }
  }

  if (lowerType.includes('two point conversion')) {
    stats.twoPointAttempts = (stats.twoPointAttempts || 0) + 1;
    if (!lowerType.includes('fail')) {
      stats.twoPointConversions = (stats.twoPointConversions || 0) + 1;
    }
  }

  if (lowerType.includes('safety')) {
    stats.safeties = (stats.safeties || 0) + 1;
  }
};

export const buildScoreTimeline = (plays: Play[]): Score[] => {
  const timeline: Score[] = [];
  let running: Score = { home: 0, opp: 0 };

  plays.forEach((play) => {
    const delta = getScoreDelta(play);
    running = {
      home: running.home + delta.home,
      opp: running.opp + delta.opp,
    };
    timeline.push({ ...running });
  });

  return timeline;
};

export const recalculateStats = (game: Game): Game => {
  const basePlayers = clonePlayers(game.homePlayers);
  const playerStats: Record<string, StatBucket> = {};
  let homeScore = 0;
  let oppScore = 0;

  basePlayers.forEach((player) => {
    playerStats[player.id] = {};
  });

  game.plays.forEach((play: Play) => {
    applyPlayToStats(playerStats, play);
    const delta = getScoreDelta(play);
    homeScore += delta.home;
    oppScore += delta.opp;
  });

  const recalculatedPlayers = basePlayers.map((player) => ({
    ...player,
    stats: { ...playerStats[player.id] },
  }));

  return {
    ...game,
    homePlayers: recalculatedPlayers,
    homeScore,
    oppScore,
  };
};

export const addPlayAndRecalc = (game: Game, play: Play): Game => {
  const newGame = { ...game, plays: [...game.plays, play] };
  return recalculateStats(newGame);
};

export const editPlayAndRecalc = (
  game: Game,
  playId: string,
  updatedPlay: Partial<Play>
): Game => {
  const newPlays = game.plays.map((p: Play) =>
    p.id === playId ? { ...p, ...updatedPlay } : p
  );
  return recalculateStats({ ...game, plays: newPlays });
};

export const undoLastPlay = (game: Game): Game => {
  const newPlays = game.plays.slice(0, -1);
  return recalculateStats({ ...game, plays: newPlays });
};

export {};
