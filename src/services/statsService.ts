import { Game, Play, Player, PlayType } from '../models';
import { getMyTeamRoster, getOpponentRoster, setGameRoster, setOpponentRoster } from '../utils/gameUtils';

type StatBucket = { [key: string]: number };

interface Score {
  home: number;
  opp: number;
}

const clonePlayers = (players: Player[] = []): Player[] =>
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

/**
 * Calculate score change from a play using proper enum matching.
 * No more fragile string matching!
 */
const getScoreDelta = (play: Play): Score => {
  const delta: Score = { home: 0, opp: 0 };
  const side: keyof Score = play.teamSide === 'away' ? 'opp' : 'home';
  const addScore = (points: number) => {
    delta[side] += points;
  };

  switch (play.type) {
    case PlayType.RUSH_TD:
    case PlayType.PASS_TD:
      addScore(6);
      break;

    case PlayType.FIELD_GOAL_MADE:
      addScore(3);
      break;

    case PlayType.EXTRA_POINT_KICK_MADE:
      addScore(1);
      break;

    case PlayType.TWO_POINT_CONVERSION_MADE:
      addScore(2);
      break;

    case PlayType.SAFETY:
      addScore(2);
      break;

    // Handle legacy string-based play types during migration
    default:
      if (typeof play.type === 'string') {
        const lowerType = play.type.toLowerCase();
        
        const isTouchdown = lowerType.includes('td') && 
                          (lowerType.includes('run') || lowerType.includes('pass'));
        const isFieldGoal = lowerType.includes('field goal') && !lowerType.includes('miss');
        const isPat = lowerType.includes('pat') && !lowerType.includes('miss');
        const isTwoPoint = lowerType.includes('two point') && !lowerType.includes('fail');
        const isSafety = lowerType.includes('safety');

        if (isTouchdown) addScore(6);
        if (isFieldGoal) addScore(3);
        if (isPat) addScore(1);
        if (isTwoPoint) addScore(2);
        if (isSafety) addScore(2);
      }
      break;
  }

  return delta;
};

/**
 * Apply play stats to player using proper enum matching.
 * More reliable than string matching.
 */
const applyPlayToStats = (playerStats: Record<string, StatBucket>, play: Play) => {
  const playerKey = play.playerId ?? play.primaryPlayerId;
  if (!playerKey) {
    return;
  }
  const stats = getOrInitPlayerStats(playerStats, playerKey);

  switch (play.type) {
    // Rushing plays
    case PlayType.RUSH:
    case PlayType.RUSH_TD:
      stats.rushingYards = (stats.rushingYards || 0) + play.yards;
      stats.rushingAttempts = (stats.rushingAttempts || 0) + 1;
      if (play.type === PlayType.RUSH_TD) {
        stats.rushingTouchdowns = (stats.rushingTouchdowns || 0) + 1;
      }
      break;

    // Passing plays
    case PlayType.PASS_COMPLETE:
    case PlayType.PASS_TD:
      stats.passingYards = (stats.passingYards || 0) + play.yards;
      stats.passingAttempts = (stats.passingAttempts || 0) + 1;
      stats.completions = (stats.completions || 0) + 1;
      if (play.type === PlayType.PASS_TD) {
        stats.passingTouchdowns = (stats.passingTouchdowns || 0) + 1;
      }
      break;

    case PlayType.PASS_INCOMPLETE:
      stats.passingAttempts = (stats.passingAttempts || 0) + 1;
      break;

    // Receiving
    case PlayType.RECEPTION:
      stats.receptions = (stats.receptions || 0) + 1;
      stats.receivingYards = (stats.receivingYards || 0) + play.yards;
      break;

    // Defensive plays
    case PlayType.TACKLE:
    case PlayType.TACKLE_FOR_LOSS:
      stats.tackles = (stats.tackles || 0) + 1;
      if (play.type === PlayType.TACKLE_FOR_LOSS) {
        stats.tacklesForLoss = (stats.tacklesForLoss || 0) + 1;
      }
      break;

    case PlayType.SACK:
      stats.sacks = (stats.sacks || 0) + 1;
      stats.tackles = (stats.tackles || 0) + 1;
      break;

    case PlayType.INTERCEPTION:
      stats.interceptions = (stats.interceptions || 0) + 1;
      stats.interceptionYards = (stats.interceptionYards || 0) + play.yards;
      break;

    case PlayType.FUMBLE_RECOVERY:
      stats.fumblesRecovered = (stats.fumblesRecovered || 0) + 1;
      break;

    case PlayType.PASS_DEFENSED:
      stats.passesDefensed = (stats.passesDefensed || 0) + 1;
      break;

    // Kicking
    case PlayType.FIELD_GOAL_MADE:
      stats.fieldGoalAttempts = (stats.fieldGoalAttempts || 0) + 1;
      stats.fieldGoalsMade = (stats.fieldGoalsMade || 0) + 1;
      stats.fieldGoalYards = (stats.fieldGoalYards || 0) + play.yards;
      break;

    case PlayType.FIELD_GOAL_MISSED:
      stats.fieldGoalAttempts = (stats.fieldGoalAttempts || 0) + 1;
      break;

    case PlayType.EXTRA_POINT_KICK_MADE:
      stats.extraPointAttempts = (stats.extraPointAttempts || 0) + 1;
      stats.extraPointsMade = (stats.extraPointsMade || 0) + 1;
      break;

    case PlayType.EXTRA_POINT_KICK_MISSED:
      stats.extraPointAttempts = (stats.extraPointAttempts || 0) + 1;
      break;

    case PlayType.TWO_POINT_CONVERSION_MADE:
      stats.twoPointAttempts = (stats.twoPointAttempts || 0) + 1;
      stats.twoPointConversions = (stats.twoPointConversions || 0) + 1;
      break;

    case PlayType.TWO_POINT_CONVERSION_FAILED:
      stats.twoPointAttempts = (stats.twoPointAttempts || 0) + 1;
      break;

    // Legacy string-based handling
    default:
      if (typeof play.type === 'string') {
        const lowerType = play.type.toLowerCase();

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

        if (lowerType.includes('field goal')) {
          stats.fieldGoalAttempts = (stats.fieldGoalAttempts || 0) + 1;
          if (!lowerType.includes('miss')) {
            stats.fieldGoalsMade = (stats.fieldGoalsMade || 0) + 1;
            stats.fieldGoalYards = (stats.fieldGoalYards || 0) + play.yards;
          }
        }
      }
      break;
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
  const homeRoster = clonePlayers(getMyTeamRoster(game));
  const opponentRoster = clonePlayers(getOpponentRoster(game));
  const homeStats: Record<string, StatBucket> = {};
  const oppStats: Record<string, StatBucket> = {};
  let homeScore = 0;
  let oppScore = 0;

  homeRoster.forEach((player) => {
    homeStats[player.id] = {};
  });
  opponentRoster.forEach((player) => {
    oppStats[player.id] = {};
  });

  game.plays.forEach((play: Play) => {
    const patchedPlay: Play = play.teamSide
      ? play
      : { ...play, teamSide: 'home' }; // Fallback for legacy plays without a side

    const targetStats = patchedPlay.teamSide === 'away' ? oppStats : homeStats;
    applyPlayToStats(targetStats, patchedPlay);
    const delta = getScoreDelta(patchedPlay);
    homeScore += delta.home;
    oppScore += delta.opp;
  });
  const recalculatedHome = homeRoster.map((player) => ({
    ...player,
    stats: { ...homeStats[player.id] },
  }));
  const recalculatedOpp = opponentRoster.map((player) => ({
    ...player,
    stats: { ...oppStats[player.id] },
  }));

  const withHomeRoster = setGameRoster(
    {
      ...game,
      homeScore,
      oppScore,
    },
    recalculatedHome,
    game.myTeamId,
    game.seasonId
  );

  return setOpponentRoster(withHomeRoster, recalculatedOpp, game.opponentTeamId);
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




