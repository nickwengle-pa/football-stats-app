import { Game } from '../models';
import { normalizeGame, hasLegacyStructure, getLegacyFieldsDescription } from '../utils/gameUtils';
import { saveGame } from '../services/dbService';

/**
 * Migration utility to help transition games from legacy data structure
 * to the new standardized format.
 * 
 * LEGACY FIELDS:
 * - homePlayers → myTeamSnapshot.roster
 * - opponent → opponentName
 * 
 * This script helps identify and migrate games with legacy data.
 */

export interface MigrationReport {
  totalGames: number;
  legacyGames: number;
  migratedGames: number;
  failedMigrations: number;
  errors: Array<{ gameId: string; error: string }>;
}

/**
 * Analyze games to identify which ones need migration.
 */
export const analyzeGamesForMigration = (games: Game[]): MigrationReport => {
  const report: MigrationReport = {
    totalGames: games.length,
    legacyGames: 0,
    migratedGames: 0,
    failedMigrations: 0,
    errors: [],
  };

  games.forEach((game) => {
    if (hasLegacyStructure(game)) {
      report.legacyGames++;
      
      const issues = getLegacyFieldsDescription(game);
      console.log(`Game ${game.id} has legacy structure:`, issues);
    }
  });

  return report;
};

/**
 * Migrate a single game to the new data structure.
 * Returns the normalized game.
 */
export const migrateGame = (game: Game): Game => {
  return normalizeGame(game);
};

/**
 * Migrate multiple games and optionally save them to the database.
 * 
 * @param games - Array of games to migrate
 * @param saveToDb - Whether to save migrated games to database
 * @param context - Optional context for save operation (teamId, seasonId)
 * @returns Migration report with statistics
 */
export const migrateGames = async (
  games: Game[],
  saveToDb: boolean = false,
  context?: { teamId?: string; seasonId?: string }
): Promise<MigrationReport> => {
  const report: MigrationReport = {
    totalGames: games.length,
    legacyGames: 0,
    migratedGames: 0,
    failedMigrations: 0,
    errors: [],
  };

  for (const game of games) {
    if (hasLegacyStructure(game)) {
      report.legacyGames++;
      
      try {
        const normalized = normalizeGame(game);
        
        if (saveToDb) {
          await saveGame(normalized, context);
        }
        
        report.migratedGames++;
        console.log(`✓ Migrated game ${game.id}`);
      } catch (error) {
        report.failedMigrations++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        report.errors.push({
          gameId: game.id,
          error: errorMessage,
        });
        console.error(`✗ Failed to migrate game ${game.id}:`, errorMessage);
      }
    }
  }

  return report;
};

/**
 * Generate a migration report as a formatted string.
 */
export const formatMigrationReport = (report: MigrationReport): string => {
  const lines = [
    '=== Game Data Migration Report ===',
    '',
    `Total games analyzed: ${report.totalGames}`,
    `Games with legacy structure: ${report.legacyGames}`,
    `Successfully migrated: ${report.migratedGames}`,
    `Failed migrations: ${report.failedMigrations}`,
    '',
  ];

  if (report.errors.length > 0) {
    lines.push('Errors:');
    report.errors.forEach((err) => {
      lines.push(`  - Game ${err.gameId}: ${err.error}`);
    });
    lines.push('');
  }

  const successRate = report.legacyGames > 0
    ? ((report.migratedGames / report.legacyGames) * 100).toFixed(1)
    : '100.0';

  lines.push(`Migration success rate: ${successRate}%`);
  
  return lines.join('\n');
};

/**
 * CLI-friendly migration function.
 * Usage: Call this from a script or component to migrate your data.
 */
export const runMigration = async (
  games: Game[],
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    context?: { teamId?: string; seasonId?: string };
  } = {}
): Promise<void> => {
  const { dryRun = true, verbose = true, context } = options;

  if (verbose) {
    console.log('Starting game data migration...');
    console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
    console.log('');
  }

  // First, analyze what needs to be migrated
  const analysis = analyzeGamesForMigration(games);
  
  if (verbose) {
    console.log(`Found ${analysis.legacyGames} games that need migration`);
  }

  if (analysis.legacyGames === 0) {
    if (verbose) {
      console.log('✓ All games are already using the new data structure!');
    }
    return;
  }

  // Perform migration
  const report = await migrateGames(games, !dryRun, context);

  if (verbose) {
    console.log('');
    console.log(formatMigrationReport(report));
  }

  if (dryRun && verbose) {
    console.log('');
    console.log('⚠️  This was a DRY RUN. No data was saved.');
    console.log('   Run with dryRun: false to apply changes.');
  }
};
