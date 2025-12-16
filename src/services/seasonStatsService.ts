import { Game, Player, Play, PlayType, Season, TeamBranding } from '../models';
import { getMyTeamRoster, getOpponentName } from '../utils/gameUtils';

/**
 * Season-level statistics aggregation service.
 * Aggregates player and team stats across all games in a season.
 */

export interface PlayerSeasonStats {
  playerId: string;
  name: string;
  jerseyNumber?: number;
  position?: string;
  gamesPlayed: number;
  
  // Rushing
  rushingAttempts: number;
  rushingYards: number;
  rushingTouchdowns: number;
  rushingLong: number;
  rushingYardsPerAttempt: number;
  rushingYardsPerGame: number;
  
  // Passing
  passingAttempts: number;
  completions: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  completionPercentage: number;
  passingYardsPerGame: number;
  passingLong: number;
  qbRating: number;
  
  // Receiving
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  receivingLong: number;
  receivingYardsPerCatch: number;
  receivingYardsPerGame: number;
  targets: number;
  
  // Defense
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptionsDef: number;
  interceptionYards: number;
  fumblesRecovered: number;
  passesDefensed: number;
  forcedFumbles: number;
  
  // Kicking
  fieldGoalAttempts: number;
  fieldGoalsMade: number;
  fieldGoalPercentage: number;
  fieldGoalLong: number;
  extraPointAttempts: number;
  extraPointsMade: number;
  extraPointPercentage: number;
  
  // Special Teams
  puntReturns: number;
  puntReturnYards: number;
  puntReturnAverage: number;
  puntReturnLong: number;
  puntReturnTouchdowns: number;
  kickoffReturns: number;
  kickoffReturnYards: number;
  kickoffReturnAverage: number;
  kickoffReturnLong: number;
  kickoffReturnTouchdowns: number;
  
  // Scoring
  totalPoints: number;
  totalTouchdowns: number;
  twoPointConversions: number;
  
  // Misc
  fumbles: number;
  firstDowns: number;
}

export interface TeamSeasonStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  
  // Scoring
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  pointsPerGame: number;
  
  // Offense
  totalOffensiveYards: number;
  rushingYards: number;
  passingYards: number;
  yardsPerGame: number;
  firstDowns: number;
  
  // Turnovers
  fumbles: number;
  interceptions: number;
  turnovers: number;
}

export interface GameResult {
  gameId: string;
  date: Date;
  opponent: string;
  site: 'home' | 'away' | 'neutral';
  homeScore: number;
  oppScore: number;
  result: 'W' | 'L' | 'T';
  isPlayoff?: boolean;
}

// Per-game stats for a single player in a single game
export interface PlayerGameStats {
  gameId: string;
  opponent: string;
  date: Date;
  result: 'W' | 'L' | 'T';
  
  rushingAttempts: number;
  rushingYards: number;
  rushingTouchdowns: number;
  rushingLong: number;
  
  passingAttempts: number;
  completions: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  passingLong: number;
  
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
  receivingLong: number;
  
  tackles: number;
  tacklesForLoss: number;
  sacks: number;
  interceptionsDef: number;
  passesDefensed: number;
  forcedFumbles: number;
  fumblesRecovered: number;
  
  totalPoints: number;
}

// Detailed stats for a single game - player breakdown by category
export interface GameDetailStats {
  gameId: string;
  opponent: string;
  date: Date;
  site: 'home' | 'away' | 'neutral';
  homeScore: number;
  oppScore: number;
  result: 'W' | 'L' | 'T';
  
  // Team totals
  teamStats: {
    totalOffenseYards: number;
    rushingYards: number;
    passingYards: number;
    rushingAttempts: number;
    passingAttempts: number;
    completions: number;
    firstDowns: number;
    turnovers: number;
    penalties: number;
    penaltyYards: number;
    // Defense
    defenseYardsAllowed: number;
    defenseRushingYardsAllowed: number;
    defensePassingYardsAllowed: number;
    sacks: number;
    tacklesForLoss: number;
    interceptions: number;
    fumblesRecovered: number;
  };
  
  // Individual player stats
  rushing: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    long: number;
  }>;
  
  passing: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    completions: number;
    attempts: number;
    yards: number;
    touchdowns: number;
    interceptions: number;
    long: number;
  }>;
  
  receiving: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    receptions: number;
    yards: number;
    touchdowns: number;
    long: number;
  }>;
  
  defense: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    tackles: number;
    tacklesForLoss: number;
    sacks: number;
    interceptions: number;
    passesDefensed: number;
    forcedFumbles: number;
    fumblesRecovered: number;
  }>;
  
  kicking: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    fgMade: number;
    fgAttempts: number;
    fgLong: number;
    xpMade: number;
    xpAttempts: number;
    kickoffs: number;
    kickoffYards: number;
    punts: number;
    puntYards: number;
    puntLong: number;
  }>;
  
  scoring: Array<{
    playerId: string;
    name: string;
    jerseyNumber?: number;
    touchdowns: number;
    twoPointConversions: number;
    fieldGoals: number;
    extraPoints: number;
    totalPoints: number;
  }>;
}

export interface SeasonLeader {
  category: string;
  displayLabel: string;
  value: number;
  displayValue: string;
  playerId: string;
  playerName: string;
  jerseyNumber?: number;
}

export interface SeasonStatsExport {
  teamName: string;
  mascot?: string;
  season: {
    year: number;
    label: string;
    level: string;
  };
  branding?: TeamBranding;
  record: {
    wins: number;
    losses: number;
    ties: number;
    display: string;
  };
  schedule: GameResult[];
  teamStats: TeamSeasonStats;
  playerStats: PlayerSeasonStats[];
  leaders: {
    offense: SeasonLeader[];
    defense: SeasonLeader[];
    specialTeams: SeasonLeader[];
    scoring: SeasonLeader[];
  };
  roster: Array<{
    id: string;
    name: string;
    jerseyNumber?: number;
    position?: string;
    classYear?: number;
  }>;
  // Per-game stats for each player
  playerGameStats: Record<string, PlayerGameStats[]>;
  // Detailed stats for each game
  gameDetails: Record<string, GameDetailStats>;
  generatedAt: Date;
}

// Initialize empty player stats
const createEmptyPlayerStats = (player: Player): PlayerSeasonStats => ({
  playerId: player.id,
  name: player.preferredName || player.name,
  jerseyNumber: player.jerseyNumber,
  position: player.position,
  gamesPlayed: 0,
  
  rushingAttempts: 0,
  rushingYards: 0,
  rushingTouchdowns: 0,
  rushingLong: 0,
  rushingYardsPerAttempt: 0,
  rushingYardsPerGame: 0,
  
  passingAttempts: 0,
  completions: 0,
  passingYards: 0,
  passingTouchdowns: 0,
  interceptions: 0,
  completionPercentage: 0,
  passingYardsPerGame: 0,
  passingLong: 0,
  qbRating: 0,
  
  receptions: 0,
  receivingYards: 0,
  receivingTouchdowns: 0,
  receivingLong: 0,
  receivingYardsPerCatch: 0,
  receivingYardsPerGame: 0,
  targets: 0,
  
  tackles: 0,
  tacklesForLoss: 0,
  sacks: 0,
  interceptionsDef: 0,
  interceptionYards: 0,
  fumblesRecovered: 0,
  passesDefensed: 0,
  forcedFumbles: 0,
  
  fieldGoalAttempts: 0,
  fieldGoalsMade: 0,
  fieldGoalPercentage: 0,
  fieldGoalLong: 0,
  extraPointAttempts: 0,
  extraPointsMade: 0,
  extraPointPercentage: 0,
  
  puntReturns: 0,
  puntReturnYards: 0,
  puntReturnAverage: 0,
  puntReturnLong: 0,
  puntReturnTouchdowns: 0,
  kickoffReturns: 0,
  kickoffReturnYards: 0,
  kickoffReturnAverage: 0,
  kickoffReturnLong: 0,
  kickoffReturnTouchdowns: 0,
  
  totalPoints: 0,
  totalTouchdowns: 0,
  twoPointConversions: 0,
  
  fumbles: 0,
  firstDowns: 0,
});

// Accumulate stats from a single play into player stats
const accumulatePlayStats = (
  stats: PlayerSeasonStats,
  play: Play,
  allPlays: Play[]
): void => {
  const yards = play.yards || 0;
  
  switch (play.type) {
    case PlayType.RUSH:
      stats.rushingAttempts++;
      stats.rushingYards += yards;
      stats.rushingLong = Math.max(stats.rushingLong, yards);
      if (play.resultedInFirstDown) stats.firstDowns++;
      break;
      
    case PlayType.RUSH_TD:
      stats.rushingAttempts++;
      stats.rushingYards += yards;
      stats.rushingTouchdowns++;
      stats.totalTouchdowns++;
      stats.totalPoints += 6;
      stats.rushingLong = Math.max(stats.rushingLong, yards);
      break;
      
    case PlayType.PASS_COMPLETE:
      stats.passingAttempts++;
      stats.completions++;
      stats.passingYards += yards;
      stats.passingLong = Math.max(stats.passingLong, yards);
      if (play.resultedInFirstDown) stats.firstDowns++;
      break;
      
    case PlayType.PASS_TD:
      stats.passingAttempts++;
      stats.completions++;
      stats.passingYards += yards;
      stats.passingTouchdowns++;
      stats.totalTouchdowns++;
      stats.totalPoints += 6;
      stats.passingLong = Math.max(stats.passingLong, yards);
      break;
      
    case PlayType.PASS_INCOMPLETE:
      stats.passingAttempts++;
      break;
      
    case PlayType.RECEPTION:
      stats.receptions++;
      stats.receivingYards += yards;
      stats.receivingLong = Math.max(stats.receivingLong, yards);
      if (play.resultedInFirstDown) stats.firstDowns++;
      break;
      
    case PlayType.TACKLE:
      stats.tackles++;
      break;
      
    case PlayType.TACKLE_FOR_LOSS:
      stats.tackles++;
      stats.tacklesForLoss++;
      break;
      
    case PlayType.SACK:
      stats.sacks++;
      stats.tackles++;
      break;
      
    case PlayType.INTERCEPTION:
      stats.interceptionsDef++;
      stats.interceptionYards += yards;
      break;
      
    case PlayType.FUMBLE_RECOVERY:
      stats.fumblesRecovered++;
      break;
      
    case PlayType.PASS_DEFENSED:
      stats.passesDefensed++;
      break;
      
    case PlayType.FORCED_FUMBLE:
      stats.forcedFumbles++;
      break;
      
    case PlayType.FIELD_GOAL_MADE:
      stats.fieldGoalAttempts++;
      stats.fieldGoalsMade++;
      stats.fieldGoalLong = Math.max(stats.fieldGoalLong, yards);
      stats.totalPoints += 3;
      break;
      
    case PlayType.FIELD_GOAL_MISSED:
      stats.fieldGoalAttempts++;
      break;
      
    case PlayType.EXTRA_POINT_KICK_MADE:
      stats.extraPointAttempts++;
      stats.extraPointsMade++;
      stats.totalPoints += 1;
      break;
      
    case PlayType.EXTRA_POINT_KICK_MISSED:
      stats.extraPointAttempts++;
      break;
      
    case PlayType.TWO_POINT_CONVERSION_MADE:
      stats.twoPointConversions++;
      stats.totalPoints += 2;
      break;
      
    case PlayType.PUNT_RETURN:
      stats.puntReturns++;
      stats.puntReturnYards += yards;
      stats.puntReturnLong = Math.max(stats.puntReturnLong, yards);
      break;
      
    case PlayType.KICKOFF_RETURN:
      stats.kickoffReturns++;
      stats.kickoffReturnYards += yards;
      stats.kickoffReturnLong = Math.max(stats.kickoffReturnLong, yards);
      break;
      
    case PlayType.DROP:
      // Track drops if needed
      break;
  }
};

// Calculate derived stats (averages, percentages)
const calculateDerivedStats = (stats: PlayerSeasonStats): void => {
  // Rushing
  if (stats.rushingAttempts > 0) {
    stats.rushingYardsPerAttempt = stats.rushingYards / stats.rushingAttempts;
  }
  if (stats.gamesPlayed > 0) {
    stats.rushingYardsPerGame = stats.rushingYards / stats.gamesPlayed;
  }
  
  // Passing
  if (stats.passingAttempts > 0) {
    stats.completionPercentage = (stats.completions / stats.passingAttempts) * 100;
  }
  if (stats.gamesPlayed > 0) {
    stats.passingYardsPerGame = stats.passingYards / stats.gamesPlayed;
  }
  
  // QB Rating (simplified passer rating formula)
  if (stats.passingAttempts >= 1) {
    const a = Math.min(Math.max(((stats.completions / stats.passingAttempts) - 0.3) * 5, 0), 2.375);
    const b = Math.min(Math.max(((stats.passingYards / stats.passingAttempts) - 3) * 0.25, 0), 2.375);
    const c = Math.min(Math.max((stats.passingTouchdowns / stats.passingAttempts) * 20, 0), 2.375);
    const d = Math.min(Math.max(2.375 - ((stats.interceptions / stats.passingAttempts) * 25), 0), 2.375);
    stats.qbRating = ((a + b + c + d) / 6) * 100;
  }
  
  // Receiving
  if (stats.receptions > 0) {
    stats.receivingYardsPerCatch = stats.receivingYards / stats.receptions;
  }
  if (stats.gamesPlayed > 0) {
    stats.receivingYardsPerGame = stats.receivingYards / stats.gamesPlayed;
  }
  
  // Kicking
  if (stats.fieldGoalAttempts > 0) {
    stats.fieldGoalPercentage = (stats.fieldGoalsMade / stats.fieldGoalAttempts) * 100;
  }
  if (stats.extraPointAttempts > 0) {
    stats.extraPointPercentage = (stats.extraPointsMade / stats.extraPointAttempts) * 100;
  }
  
  // Returns
  if (stats.puntReturns > 0) {
    stats.puntReturnAverage = stats.puntReturnYards / stats.puntReturns;
  }
  if (stats.kickoffReturns > 0) {
    stats.kickoffReturnAverage = stats.kickoffReturnYards / stats.kickoffReturns;
  }
};

// Get player participation in a game
const playerParticipatedInGame = (playerId: string, plays: Play[]): boolean => {
  return plays.some(play => 
    play.playerId === playerId || 
    play.primaryPlayerId === playerId ||
    play.assistingPlayerIds?.includes(playerId) ||
    play.participants?.some(p => p.playerId === playerId)
  );
};

/**
 * Aggregate all player stats across games in a season
 */
export const aggregateSeasonPlayerStats = (
  games: Game[],
  roster: Player[]
): PlayerSeasonStats[] => {
  // Initialize stats for all players
  const playerStatsMap = new Map<string, PlayerSeasonStats>();
  
  roster.forEach(player => {
    playerStatsMap.set(player.id, createEmptyPlayerStats(player));
  });
  
  // Process each game
  games.forEach(game => {
    const gamePlays = game.plays || [];
    
    // Track games played per player
    roster.forEach(player => {
      if (playerParticipatedInGame(player.id, gamePlays)) {
        const stats = playerStatsMap.get(player.id);
        if (stats) {
          stats.gamesPlayed++;
        }
      }
    });
    
    // Accumulate stats from plays
    gamePlays.forEach(play => {
      const playerId = play.playerId || play.primaryPlayerId;
      if (playerId && playerStatsMap.has(playerId)) {
        const stats = playerStatsMap.get(playerId)!;
        accumulatePlayStats(stats, play, gamePlays);
      }
      
      // Handle assists
      play.assistingPlayerIds?.forEach(assistId => {
        if (playerStatsMap.has(assistId)) {
          const stats = playerStatsMap.get(assistId)!;
          // Assists typically get half tackle credit
          if (play.type === PlayType.TACKLE || play.type === PlayType.TACKLE_FOR_LOSS) {
            stats.tackles += 0.5;
          }
        }
      });
    });
  });
  
  // Calculate derived stats
  playerStatsMap.forEach(stats => {
    calculateDerivedStats(stats);
  });
  
  return Array.from(playerStatsMap.values());
};

/**
 * Aggregate team-level stats across all games
 */
export const aggregateTeamStats = (games: Game[]): TeamSeasonStats => {
  const stats: TeamSeasonStats = {
    gamesPlayed: games.length,
    wins: 0,
    losses: 0,
    ties: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    pointDifferential: 0,
    pointsPerGame: 0,
    totalOffensiveYards: 0,
    rushingYards: 0,
    passingYards: 0,
    yardsPerGame: 0,
    firstDowns: 0,
    fumbles: 0,
    interceptions: 0,
    turnovers: 0,
  };
  
  games.forEach(game => {
    const homeScore = game.homeScore || 0;
    const oppScore = game.oppScore || 0;
    
    stats.pointsFor += homeScore;
    stats.pointsAgainst += oppScore;
    
    if (homeScore > oppScore) stats.wins++;
    else if (homeScore < oppScore) stats.losses++;
    else stats.ties++;
    
    // Aggregate from plays
    (game.plays || []).forEach(play => {
      if (play.teamSide !== 'away') {
        const yards = play.yards || 0;
        
        switch (play.type) {
          case PlayType.RUSH:
          case PlayType.RUSH_TD:
            stats.rushingYards += yards;
            stats.totalOffensiveYards += yards;
            break;
            
          case PlayType.PASS_COMPLETE:
          case PlayType.PASS_TD:
            stats.passingYards += yards;
            stats.totalOffensiveYards += yards;
            break;
        }
        
        if (play.resultedInFirstDown) {
          stats.firstDowns++;
        }
      }
    });
  });
  
  stats.pointDifferential = stats.pointsFor - stats.pointsAgainst;
  if (stats.gamesPlayed > 0) {
    stats.pointsPerGame = stats.pointsFor / stats.gamesPlayed;
    stats.yardsPerGame = stats.totalOffensiveYards / stats.gamesPlayed;
  }
  
  stats.turnovers = stats.fumbles + stats.interceptions;
  
  return stats;
};

// Helper to convert various date formats to Date object
const toDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  
  // Firestore Timestamp
  if (typeof dateValue?.toDate === 'function') {
    return dateValue.toDate();
  }
  
  // Already a Date
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // Firestore Timestamp-like object with seconds
  if (typeof dateValue?.seconds === 'number') {
    return new Date(dateValue.seconds * 1000);
  }
  
  // String or number
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  
  return new Date();
};

/**
 * Build game results/schedule
 */
export const buildSchedule = (games: Game[]): GameResult[] => {
  return games
    .map(game => ({
      gameId: game.id,
      date: toDate(game.date),
      opponent: getOpponentName(game),
      site: (game.site || 'home') as 'home' | 'away' | 'neutral',
      homeScore: game.homeScore || 0,
      oppScore: game.oppScore || 0,
      result: (game.homeScore || 0) > (game.oppScore || 0) ? 'W' as const : 
              (game.homeScore || 0) < (game.oppScore || 0) ? 'L' as const : 'T' as const,
      isPlayoff: game.isPlayoff,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * Calculate team leaders for each stat category
 */
export const calculateSeasonLeaders = (
  playerStats: PlayerSeasonStats[]
): SeasonStatsExport['leaders'] => {
  const findLeader = (
    category: string,
    displayLabel: string,
    getValue: (s: PlayerSeasonStats) => number,
    formatValue: (v: number) => string = v => v.toString(),
    minGames: number = 0
  ): SeasonLeader | null => {
    const eligible = playerStats.filter(s => s.gamesPlayed >= minGames && getValue(s) > 0);
    if (eligible.length === 0) return null;
    
    const leader = eligible.reduce((best, curr) => 
      getValue(curr) > getValue(best) ? curr : best
    );
    
    return {
      category,
      displayLabel,
      value: getValue(leader),
      displayValue: formatValue(getValue(leader)),
      playerId: leader.playerId,
      playerName: leader.name,
      jerseyNumber: leader.jerseyNumber,
    };
  };
  
  const formatDecimal = (v: number) => v.toFixed(1);
  const formatPercent = (v: number) => `${v.toFixed(0)}%`;
  
  const offenseLeaders = [
    findLeader('totalPoints', 'Total Points', s => s.totalPoints),
    findLeader('totalOffensiveYards', 'Total Offensive Yards', s => s.rushingYards + s.receivingYards),
    findLeader('rushingYards', 'Yards Rushing', s => s.rushingYards),
    findLeader('rushingTouchdowns', 'TD Rushing', s => s.rushingTouchdowns),
    findLeader('rushingLong', 'Longest Rush', s => s.rushingLong),
    findLeader('rushingYardsPerAttempt', 'Avg Yards/Rush', s => s.rushingYardsPerAttempt, formatDecimal),
    findLeader('passingYards', 'Passing Yards', s => s.passingYards),
    findLeader('passingTouchdowns', 'TD Passing', s => s.passingTouchdowns),
    findLeader('completionPercentage', 'Completion%', s => s.completionPercentage, formatPercent),
    findLeader('qbRating', 'QB Rating', s => s.qbRating, formatDecimal),
    findLeader('passingLong', 'Longest Pass', s => s.passingLong),
    findLeader('receivingYards', 'Receiving Yards', s => s.receivingYards),
    findLeader('receptions', 'Receptions', s => s.receptions),
    findLeader('receivingTouchdowns', 'TD Receiving', s => s.receivingTouchdowns),
    findLeader('receivingLong', 'Longest Reception', s => s.receivingLong),
    findLeader('receivingYardsPerCatch', 'Yards/Reception', s => s.receivingYardsPerCatch, formatDecimal),
  ].filter((l): l is SeasonLeader => l !== null);
  
  const defenseLeaders = [
    findLeader('tackles', 'Tackles', s => s.tackles),
    findLeader('tacklesForLoss', 'Tackles for Loss', s => s.tacklesForLoss),
    findLeader('sacks', 'Sacks', s => s.sacks),
    findLeader('interceptionsDef', 'Interceptions', s => s.interceptionsDef),
    findLeader('fumblesRecovered', 'Fumbles Recovered', s => s.fumblesRecovered),
    findLeader('passesDefensed', 'Passes Defensed', s => s.passesDefensed),
    findLeader('forcedFumbles', 'Forced Fumbles', s => s.forcedFumbles),
  ].filter((l): l is SeasonLeader => l !== null);
  
  const specialTeamsLeaders = [
    findLeader('puntReturnYards', 'Punt Return Yards', s => s.puntReturnYards),
    findLeader('puntReturnAverage', 'Punt Return Avg', s => s.puntReturnAverage, formatDecimal),
    findLeader('kickoffReturnYards', 'Kickoff Return Yards', s => s.kickoffReturnYards),
    findLeader('kickoffReturnAverage', 'Kickoff Return Avg', s => s.kickoffReturnAverage, formatDecimal),
    findLeader('fieldGoalsMade', 'Field Goals Made', s => s.fieldGoalsMade),
    findLeader('fieldGoalLong', 'Longest Field Goal', s => s.fieldGoalLong),
    findLeader('extraPointsMade', 'Extra Points Made', s => s.extraPointsMade),
  ].filter((l): l is SeasonLeader => l !== null);
  
  const scoringLeaders = [
    findLeader('totalPoints', 'Total Points', s => s.totalPoints),
    findLeader('totalTouchdowns', 'Total Touchdowns', s => s.totalTouchdowns),
    findLeader('rushingTouchdowns', 'Rushing TDs', s => s.rushingTouchdowns),
    findLeader('receivingTouchdowns', 'Receiving TDs', s => s.receivingTouchdowns),
    findLeader('twoPointConversions', '2-Point Conversions', s => s.twoPointConversions),
  ].filter((l): l is SeasonLeader => l !== null);
  
  return {
    offense: offenseLeaders,
    defense: defenseLeaders,
    specialTeams: specialTeamsLeaders,
    scoring: scoringLeaders,
  };
};

/**
 * Aggregate per-game stats for each player
 */
export const aggregatePlayerGameStats = (
  games: Game[],
  roster: Player[]
): Record<string, PlayerGameStats[]> => {
  const playerGameStatsMap: Record<string, PlayerGameStats[]> = {};
  
  // Initialize empty arrays for all players
  roster.forEach(player => {
    playerGameStatsMap[player.id] = [];
  });
  
  // Process each game
  games.forEach(game => {
    const gamePlays = game.plays || [];
    const opponent = getOpponentName(game);
    const gameDate = toDate(game.date);
    const homeScore = game.homeScore || 0;
    const oppScore = game.oppScore || 0;
    const result: 'W' | 'L' | 'T' = homeScore > oppScore ? 'W' : homeScore < oppScore ? 'L' : 'T';
    
    // Track stats for each player in this game
    const gamePlayerStats: Record<string, PlayerGameStats> = {};
    
    // Initialize game stats for players who participated
    roster.forEach(player => {
      if (playerParticipatedInGame(player.id, gamePlays)) {
        gamePlayerStats[player.id] = {
          gameId: game.id,
          opponent,
          date: gameDate,
          result,
          rushingAttempts: 0,
          rushingYards: 0,
          rushingTouchdowns: 0,
          rushingLong: 0,
          passingAttempts: 0,
          completions: 0,
          passingYards: 0,
          passingTouchdowns: 0,
          interceptions: 0,
          passingLong: 0,
          receptions: 0,
          receivingYards: 0,
          receivingTouchdowns: 0,
          receivingLong: 0,
          tackles: 0,
          tacklesForLoss: 0,
          sacks: 0,
          interceptionsDef: 0,
          passesDefensed: 0,
          forcedFumbles: 0,
          fumblesRecovered: 0,
          totalPoints: 0,
        };
      }
    });
    
    // Accumulate stats from plays
    gamePlays.forEach(play => {
      const playerId = play.playerId || play.primaryPlayerId;
      if (playerId && gamePlayerStats[playerId]) {
        const stats = gamePlayerStats[playerId];
        const yards = play.yards || 0;
        
        switch (play.type) {
          case PlayType.RUSH:
            stats.rushingAttempts++;
            stats.rushingYards += yards;
            stats.rushingLong = Math.max(stats.rushingLong, yards);
            break;
          case PlayType.RUSH_TD:
            stats.rushingAttempts++;
            stats.rushingYards += yards;
            stats.rushingTouchdowns++;
            stats.totalPoints += 6;
            stats.rushingLong = Math.max(stats.rushingLong, yards);
            break;
          case PlayType.PASS_COMPLETE:
            stats.passingAttempts++;
            stats.completions++;
            stats.passingYards += yards;
            stats.passingLong = Math.max(stats.passingLong, yards);
            break;
          case PlayType.PASS_TD:
            stats.passingAttempts++;
            stats.completions++;
            stats.passingYards += yards;
            stats.passingTouchdowns++;
            stats.totalPoints += 6;
            stats.passingLong = Math.max(stats.passingLong, yards);
            break;
          case PlayType.PASS_INCOMPLETE:
            stats.passingAttempts++;
            break;
          case PlayType.RECEPTION:
            stats.receptions++;
            stats.receivingYards += yards;
            stats.receivingLong = Math.max(stats.receivingLong, yards);
            break;
          case PlayType.TACKLE:
            stats.tackles++;
            break;
          case PlayType.TACKLE_FOR_LOSS:
            stats.tackles++;
            stats.tacklesForLoss++;
            break;
          case PlayType.SACK:
            stats.sacks++;
            stats.tackles++;
            break;
          case PlayType.INTERCEPTION:
            stats.interceptionsDef++;
            break;
          case PlayType.FUMBLE_RECOVERY:
            stats.fumblesRecovered++;
            break;
          case PlayType.PASS_DEFENSED:
            stats.passesDefensed++;
            break;
          case PlayType.FORCED_FUMBLE:
            stats.forcedFumbles++;
            break;
          case PlayType.FIELD_GOAL_MADE:
            stats.totalPoints += 3;
            break;
          case PlayType.EXTRA_POINT_KICK_MADE:
            stats.totalPoints += 1;
            break;
          case PlayType.TWO_POINT_CONVERSION_MADE:
            stats.totalPoints += 2;
            break;
        }
      }
    });
    
    // Add game stats to player arrays
    Object.entries(gamePlayerStats).forEach(([playerId, stats]) => {
      if (playerGameStatsMap[playerId]) {
        playerGameStatsMap[playerId].push(stats);
      }
    });
  });
  
  // Sort each player's games by date
  Object.values(playerGameStatsMap).forEach(games => {
    games.sort((a, b) => a.date.getTime() - b.date.getTime());
  });
  
  return playerGameStatsMap;
};

/**
 * Aggregate detailed stats for each game
 */
export const aggregateGameDetails = (
  games: Game[],
  roster: Player[]
): Record<string, GameDetailStats> => {
  const gameDetailsMap: Record<string, GameDetailStats> = {};
  
  // Create lookup for player info
  const playerLookup = new Map<string, Player>();
  roster.forEach(p => playerLookup.set(p.id, p));
  
  games.forEach(game => {
    const gameDate = toDate(game.date);
    const opponent = getOpponentName(game);
    const site = game.site || 'home';
    const result: 'W' | 'L' | 'T' = 
      game.homeScore > game.oppScore ? 'W' :
      game.homeScore < game.oppScore ? 'L' : 'T';
    
    // Initialize player stats maps for this game
    const rushingMap = new Map<string, GameDetailStats['rushing'][0]>();
    const passingMap = new Map<string, GameDetailStats['passing'][0]>();
    const receivingMap = new Map<string, GameDetailStats['receiving'][0]>();
    const defenseMap = new Map<string, GameDetailStats['defense'][0]>();
    const kickingMap = new Map<string, GameDetailStats['kicking'][0]>();
    const scoringMap = new Map<string, GameDetailStats['scoring'][0]>();
    
    // Team stats
    const teamStats = {
      totalOffenseYards: 0,
      rushingYards: 0,
      passingYards: 0,
      rushingAttempts: 0,
      passingAttempts: 0,
      completions: 0,
      firstDowns: game.homeFirstDowns || 0,
      turnovers: 0,
      penalties: 0,
      penaltyYards: 0,
      defenseYardsAllowed: 0,
      defenseRushingYardsAllowed: 0,
      defensePassingYardsAllowed: 0,
      sacks: 0,
      tacklesForLoss: 0,
      interceptions: 0,
      fumblesRecovered: 0
    };
    
    const getPlayerInfo = (playerId: string) => {
      const player = playerLookup.get(playerId);
      return {
        playerId,
        name: player?.preferredName || player?.name || 'Unknown',
        jerseyNumber: player?.jerseyNumber
      };
    };
    
    const ensureRushing = (playerId: string) => {
      if (!rushingMap.has(playerId)) {
        rushingMap.set(playerId, {
          ...getPlayerInfo(playerId),
          attempts: 0, yards: 0, touchdowns: 0, long: 0
        });
      }
      return rushingMap.get(playerId)!;
    };
    
    const ensurePassing = (playerId: string) => {
      if (!passingMap.has(playerId)) {
        passingMap.set(playerId, {
          ...getPlayerInfo(playerId),
          completions: 0, attempts: 0, yards: 0, touchdowns: 0, interceptions: 0, long: 0
        });
      }
      return passingMap.get(playerId)!;
    };
    
    const ensureReceiving = (playerId: string) => {
      if (!receivingMap.has(playerId)) {
        receivingMap.set(playerId, {
          ...getPlayerInfo(playerId),
          receptions: 0, yards: 0, touchdowns: 0, long: 0
        });
      }
      return receivingMap.get(playerId)!;
    };
    
    const ensureDefense = (playerId: string) => {
      if (!defenseMap.has(playerId)) {
        defenseMap.set(playerId, {
          ...getPlayerInfo(playerId),
          tackles: 0, tacklesForLoss: 0, sacks: 0, interceptions: 0,
          passesDefensed: 0, forcedFumbles: 0, fumblesRecovered: 0
        });
      }
      return defenseMap.get(playerId)!;
    };
    
    const ensureKicking = (playerId: string) => {
      if (!kickingMap.has(playerId)) {
        kickingMap.set(playerId, {
          ...getPlayerInfo(playerId),
          fgMade: 0, fgAttempts: 0, fgLong: 0,
          xpMade: 0, xpAttempts: 0,
          kickoffs: 0, kickoffYards: 0,
          punts: 0, puntYards: 0, puntLong: 0
        });
      }
      return kickingMap.get(playerId)!;
    };
    
    const ensureScoring = (playerId: string) => {
      if (!scoringMap.has(playerId)) {
        scoringMap.set(playerId, {
          ...getPlayerInfo(playerId),
          touchdowns: 0, twoPointConversions: 0, fieldGoals: 0, extraPoints: 0, totalPoints: 0
        });
      }
      return scoringMap.get(playerId)!;
    };
    
    // Process all plays
    game.plays.forEach(play => {
      const playerId = play.primaryPlayerId || play.playerId;
      const yards = play.yards || 0;
      const isHomeSide = play.teamSide !== 'away';
      
      // Penalties
      if (play.type === PlayType.PENALTY && isHomeSide) {
        teamStats.penalties++;
        teamStats.penaltyYards += Math.abs(yards);
      }
      
      // Away team yards allowed
      if (play.teamSide === 'away') {
        if ([PlayType.RUSH, PlayType.RUSH_TD].includes(play.type)) {
          teamStats.defenseRushingYardsAllowed += yards;
          teamStats.defenseYardsAllowed += yards;
        }
        if ([PlayType.PASS_COMPLETE, PlayType.PASS_TD, PlayType.RECEPTION].includes(play.type)) {
          teamStats.defensePassingYardsAllowed += yards;
          teamStats.defenseYardsAllowed += yards;
        }
      }
      
      // Only process home team player stats
      if (!isHomeSide || !playerId) return;
      
      switch (play.type) {
        case PlayType.RUSH: {
          const stats = ensureRushing(playerId);
          stats.attempts++;
          stats.yards += yards;
          stats.long = Math.max(stats.long, yards);
          teamStats.rushingAttempts++;
          teamStats.rushingYards += yards;
          teamStats.totalOffenseYards += yards;
          break;
        }
        case PlayType.RUSH_TD: {
          const stats = ensureRushing(playerId);
          stats.attempts++;
          stats.yards += yards;
          stats.touchdowns++;
          stats.long = Math.max(stats.long, yards);
          teamStats.rushingAttempts++;
          teamStats.rushingYards += yards;
          teamStats.totalOffenseYards += yards;
          const scoring = ensureScoring(playerId);
          scoring.touchdowns++;
          scoring.totalPoints += 6;
          break;
        }
        case PlayType.PASS_COMPLETE: {
          const stats = ensurePassing(playerId);
          stats.completions++;
          stats.attempts++;
          stats.yards += yards;
          stats.long = Math.max(stats.long, yards);
          teamStats.completions++;
          teamStats.passingAttempts++;
          teamStats.passingYards += yards;
          teamStats.totalOffenseYards += yards;
          break;
        }
        case PlayType.PASS_TD: {
          const stats = ensurePassing(playerId);
          stats.completions++;
          stats.attempts++;
          stats.yards += yards;
          stats.touchdowns++;
          stats.long = Math.max(stats.long, yards);
          teamStats.completions++;
          teamStats.passingAttempts++;
          teamStats.passingYards += yards;
          teamStats.totalOffenseYards += yards;
          break;
        }
        case PlayType.PASS_INCOMPLETE: {
          const stats = ensurePassing(playerId);
          stats.attempts++;
          teamStats.passingAttempts++;
          break;
        }
        case PlayType.INTERCEPTION: {
          // Thrown interception (turnover)
          if (play.teamSide === 'home') {
            const stats = ensurePassing(playerId);
            stats.interceptions++;
            teamStats.turnovers++;
          } else {
            // Defensive interception
            const stats = ensureDefense(playerId);
            stats.interceptions++;
            teamStats.interceptions++;
          }
          break;
        }
        case PlayType.RECEPTION: {
          const stats = ensureReceiving(playerId);
          stats.receptions++;
          stats.yards += yards;
          stats.long = Math.max(stats.long, yards);
          // Receiver gets receiving TD credit if noted
          break;
        }
        case PlayType.TACKLE: {
          const stats = ensureDefense(playerId);
          stats.tackles++;
          // Handle assists
          play.assistingPlayerIds?.forEach(assistId => {
            const assistStats = ensureDefense(assistId);
            assistStats.tackles += 0.5;
          });
          break;
        }
        case PlayType.TACKLE_FOR_LOSS: {
          const stats = ensureDefense(playerId);
          stats.tackles++;
          stats.tacklesForLoss++;
          teamStats.tacklesForLoss++;
          play.assistingPlayerIds?.forEach(assistId => {
            const assistStats = ensureDefense(assistId);
            assistStats.tackles += 0.5;
          });
          break;
        }
        case PlayType.SACK: {
          const stats = ensureDefense(playerId);
          stats.tackles++;
          stats.sacks++;
          teamStats.sacks++;
          break;
        }
        case PlayType.PASS_DEFENSED: {
          const stats = ensureDefense(playerId);
          stats.passesDefensed++;
          break;
        }
        case PlayType.FORCED_FUMBLE: {
          const stats = ensureDefense(playerId);
          stats.forcedFumbles++;
          break;
        }
        case PlayType.FUMBLE_RECOVERY: {
          const stats = ensureDefense(playerId);
          stats.fumblesRecovered++;
          teamStats.fumblesRecovered++;
          break;
        }
        case PlayType.FIELD_GOAL_MADE: {
          const stats = ensureKicking(playerId);
          stats.fgMade++;
          stats.fgAttempts++;
          stats.fgLong = Math.max(stats.fgLong, yards);
          const scoring = ensureScoring(playerId);
          scoring.fieldGoals++;
          scoring.totalPoints += 3;
          break;
        }
        case PlayType.FIELD_GOAL_MISSED: {
          const stats = ensureKicking(playerId);
          stats.fgAttempts++;
          break;
        }
        case PlayType.EXTRA_POINT_KICK_MADE: {
          const stats = ensureKicking(playerId);
          stats.xpMade++;
          stats.xpAttempts++;
          const scoring = ensureScoring(playerId);
          scoring.extraPoints++;
          scoring.totalPoints += 1;
          break;
        }
        case PlayType.EXTRA_POINT_KICK_MISSED: {
          const stats = ensureKicking(playerId);
          stats.xpAttempts++;
          break;
        }
        case PlayType.TWO_POINT_CONVERSION_MADE: {
          const scoring = ensureScoring(playerId);
          scoring.twoPointConversions++;
          scoring.totalPoints += 2;
          break;
        }
        case PlayType.KICKOFF: {
          const stats = ensureKicking(playerId);
          stats.kickoffs++;
          stats.kickoffYards += yards;
          break;
        }
        case PlayType.PUNT: {
          const stats = ensureKicking(playerId);
          stats.punts++;
          stats.puntYards += yards;
          stats.puntLong = Math.max(stats.puntLong, yards);
          break;
        }
      }
    });
    
    // Convert maps to sorted arrays
    gameDetailsMap[game.id] = {
      gameId: game.id,
      opponent,
      date: gameDate,
      site,
      homeScore: game.homeScore,
      oppScore: game.oppScore,
      result,
      teamStats,
      rushing: Array.from(rushingMap.values())
        .filter(p => p.attempts > 0)
        .sort((a, b) => b.yards - a.yards),
      passing: Array.from(passingMap.values())
        .filter(p => p.attempts > 0)
        .sort((a, b) => b.yards - a.yards),
      receiving: Array.from(receivingMap.values())
        .filter(p => p.receptions > 0)
        .sort((a, b) => b.yards - a.yards),
      defense: Array.from(defenseMap.values())
        .filter(p => p.tackles > 0 || p.sacks > 0 || p.interceptions > 0)
        .sort((a, b) => b.tackles - a.tackles),
      kicking: Array.from(kickingMap.values())
        .filter(p => p.fgAttempts > 0 || p.xpAttempts > 0 || p.punts > 0 || p.kickoffs > 0)
        .sort((a, b) => b.fgMade - a.fgMade),
      scoring: Array.from(scoringMap.values())
        .filter(p => p.totalPoints > 0)
        .sort((a, b) => b.totalPoints - a.totalPoints)
    };
  });
  
  return gameDetailsMap;
};

/**
 * Build complete season stats export
 */
export const buildSeasonStatsExport = (
  games: Game[],
  roster: Player[],
  teamName: string,
  season: Season,
  branding?: TeamBranding,
  mascot?: string
): SeasonStatsExport => {
  const playerStats = aggregateSeasonPlayerStats(games, roster);
  const teamStats = aggregateTeamStats(games);
  const schedule = buildSchedule(games);
  const leaders = calculateSeasonLeaders(playerStats);
  const playerGameStats = aggregatePlayerGameStats(games, roster);
  const gameDetails = aggregateGameDetails(games, roster);
  
  const recordDisplay = teamStats.ties > 0 
    ? `${teamStats.wins}-${teamStats.losses}-${teamStats.ties}`
    : `${teamStats.wins}-${teamStats.losses}`;
  
  return {
    teamName,
    mascot,
    season: {
      year: season.year,
      label: season.label,
      level: season.level,
    },
    branding,
    record: {
      wins: teamStats.wins,
      losses: teamStats.losses,
      ties: teamStats.ties,
      display: recordDisplay,
    },
    schedule,
    teamStats,
    playerStats: playerStats
      .filter(p => p.gamesPlayed > 0)
      .sort((a, b) => b.totalPoints - a.totalPoints),
    leaders,
    roster: roster.map(p => ({
      id: p.id,
      name: p.preferredName || p.name,
      jerseyNumber: p.jerseyNumber,
      position: p.position,
      classYear: p.classYear,
    })),
    playerGameStats,
    gameDetails,
    generatedAt: new Date(),
  };
};

export { };
