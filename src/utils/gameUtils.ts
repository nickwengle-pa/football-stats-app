import { Game, Player } from '../models';

/**
 * Utility functions to handle legacy Game model fields and standardize data access.
 * 
 * LEGACY ISSUES:
 * - homePlayers vs myTeamSnapshot.roster
 * - opponent vs opponentName
 * - Inconsistent field usage across components
 * 
 * These helpers provide a consistent interface while maintaining backward compatibility.
 */

/**
 * Get the team roster from a game, handling both legacy and new formats.
 */
export const getMyTeamRoster = (game: Game): Player[] => {
  // Prefer new format
  if (game.myTeamSnapshot?.roster && game.myTeamSnapshot.roster.length > 0) {
    return game.myTeamSnapshot.roster;
  }
  
  // Fallback to legacy format
  if (game.homePlayers && game.homePlayers.length > 0) {
    return game.homePlayers;
  }
  
  return [];
};

/**
 * Get the opponent roster from a game.
 */
export const getOpponentRoster = (game: Game): Player[] => {
  return game.opponentSnapshot?.roster ?? [];
};

/**
 * Get the opponent name, handling both legacy and new formats.
 */
export const getOpponentName = (game: Game): string => {
  // Prefer opponentName (more specific)
  if (game.opponentName) {
    return game.opponentName;
  }
  
  // Fallback to opponent field
  if (game.opponent) {
    return game.opponent;
  }
  
  return 'TBD Opponent';
};

/**
 * Update a game with roster data in the standardized format.
 * Automatically handles migration from legacy format to new format.
 */
export const setGameRoster = (
  game: Game,
  roster: Player[],
  teamId?: string,
  seasonId?: string
): Game => {
  return {
    ...game,
    myTeamSnapshot: {
      teamId: teamId ?? game.myTeamId,
      seasonId: seasonId ?? game.seasonId,
      roster,
    },
    // Keep homePlayers for backward compatibility but mark as deprecated in code
    homePlayers: roster,
  };
};

/**
 * Update a game with opponent roster data.
 */
export const setOpponentRoster = (
  game: Game,
  roster: Player[],
  opponentTeamId?: string
): Game => {
  return {
    ...game,
    opponentSnapshot: {
      teamId: opponentTeamId ?? game.opponentTeamId,
      roster,
    },
  };
};

/**
 * Set opponent name in the standardized format.
 */
export const setOpponentName = (game: Game, name: string): Game => {
  return {
    ...game,
    opponentName: name,
    // Keep opponent field for backward compatibility
    opponent: name,
  };
};

/**
 * Normalize a game object, ensuring all required fields are present
 * and legacy fields are properly mapped to new format.
 */
export const normalizeGame = (game: Game): Game => {
  const normalized: Game = {
    ...game,
  };

  // Migrate homePlayers to myTeamSnapshot if needed
  if (game.homePlayers && !game.myTeamSnapshot?.roster) {
    normalized.myTeamSnapshot = {
      teamId: game.myTeamId,
      seasonId: game.seasonId,
      roster: game.homePlayers,
    };
  }

  // Standardize opponent name
  if (!normalized.opponentName && normalized.opponent) {
    normalized.opponentName = normalized.opponent;
  } else if (normalized.opponentName && !normalized.opponent) {
    normalized.opponent = normalized.opponentName;
  }

  return normalized;
};

/**
 * Check if a game has legacy data structure.
 * Useful for identifying games that need migration.
 */
export const hasLegacyStructure = (game: Game): boolean => {
  const hasLegacyRoster = !!(game.homePlayers && !game.myTeamSnapshot?.roster);
  const hasLegacyOpponent = !!(game.opponent && !game.opponentName);
  
  return hasLegacyRoster || hasLegacyOpponent;
};

/**
 * Get a human-readable description of what legacy fields are present.
 */
export const getLegacyFieldsDescription = (game: Game): string[] => {
  const issues: string[] = [];
  
  if (game.homePlayers && !game.myTeamSnapshot?.roster) {
    issues.push('Using homePlayers instead of myTeamSnapshot.roster');
  }
  
  if (game.opponent && !game.opponentName) {
    issues.push('Using opponent instead of opponentName');
  }
  
  return issues;
};
