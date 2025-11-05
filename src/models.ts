import { Timestamp } from 'firebase/firestore';

export type UUID = string;

export type StatBucket = Record<string, number>;

export interface RosterImportMeta {
  source: 'manual' | 'maxpreps' | 'csv';
  sourceLabel?: string;
  sourceUrl?: string;
  importedAt: Timestamp;
  importedBy?: string;
  rawFilename?: string;
  notes?: string;
}

export interface Player {
  id: UUID;
  name: string;
  firstName?: string;
  lastName?: string;
  preferredName?: string;
  jerseyNumber?: number;
  position?: string;
  positions?: string[];
  classYear?: number;
  height?: string;
  weight?: string;
  stats: StatBucket;
  importMeta?: RosterImportMeta;
  metadata?: Record<string, unknown>;
}

export interface Coach {
  id: UUID;
  name: string;
  role: 'head' | 'assistant' | 'coordinator' | string;
  email?: string;
  phone?: string;
}

export interface TeamBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  logoUrl?: string;
  wordmarkUrl?: string;
}

export type TeamLevel =
  | 'varsity'
  | 'junior-varsity'
  | 'freshman'
  | 'middle-school'
  | 'youth'
  | 'other';

export interface TeamSeasonProfile {
  seasonId: UUID;
  year: number;
  level: TeamLevel;
  colors?: TeamBranding;
  coaches: Coach[];
  roster: Player[];
  importMeta?: RosterImportMeta;
  notes?: string;
}

export interface Team {
  id: UUID;
  name: string;
  mascot?: string;
  shortName?: string;
  isMyTeam: boolean;
  defaultColors?: TeamBranding;
  currentSeasonId?: UUID;
  seasons?: Record<UUID, TeamSeasonProfile>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OpponentTeam {
  id: UUID;
  teamId: UUID;
  name: string;
  mascot?: string;
  shortName?: string;
  location?: string;
  colors?: TeamBranding;
  notes?: string;
  roster?: Player[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Season {
  id: UUID;
  teamId: UUID;
  year: number;
  label: string;
  level: TeamLevel;
  startDate: Timestamp;
  endDate?: Timestamp;
  playoffBracketId?: UUID;
  notes?: string;
  coaches?: Coach[];
  colors?: TeamBranding;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TackleScoringMode = 'equal' | 'weighted';

export interface ScoringConfig {
  touchdown: number;
  fieldGoal: number;
  safety: number;
  extraPointKick: number;
  extraPointConversion: number;
}

export interface GameRules {
  quarterLengthMinutes: number;
  overtimeEnabled: boolean;
  tackleMode: TackleScoringMode;
  scoring: ScoringConfig;
  followNfhs?: boolean;
}

export interface GameRosterSnapshot {
  teamId?: UUID;
  seasonId?: UUID;
  roster?: Player[];
  coaches?: Coach[];
}

export type GameStatus = 'scheduled' | 'in-progress' | 'final';
export type GameSite = 'home' | 'away' | 'neutral';

export interface PlayParticipant {
  playerId: UUID;
  role:
    | 'rusher'
    | 'passer'
    | 'receiver'
    | 'tackler'
    | 'assist'
    | 'kicker'
    | 'holder'
    | 'returner'
    | 'blocker'
    | 'other';
  credit?: number;
}

export type PlayType =
  | 'run'
  | 'pass'
  | 'reception'
  | 'tackle'
  | 'sack'
  | 'fieldGoal'
  | 'extraPoint'
  | 'twoPoint'
  | 'turnover'
  | 'kickoff'
  | 'punt'
  | 'penalty'
  | 'safety'
  | 'other';

export interface Play {
  id: UUID;
  type: PlayType | string;
  yards: number;
  playerId?: UUID;
  primaryPlayerId?: UUID;
  description: string;
  timestamp: Timestamp;
  quarter?: number;
  down?: number;
  distance?: string;
  yardLine?: number;
  possessionTeamId?: UUID;
  assistingPlayerIds?: UUID[];
  participants?: PlayParticipant[];
  tags?: string[];
}

export interface Game {
  id: UUID;
  seasonId?: UUID;
  myTeamId?: UUID;
  opponentTeamId?: UUID;
  opponentSeasonId?: UUID;
  date: Timestamp;
  kickoffTime?: string;
  location?: string;
  site?: GameSite;
  status?: GameStatus;
  isPlayoff?: boolean;
  playoffRound?: string;
  rules?: GameRules;
  myTeamSnapshot?: GameRosterSnapshot;
  opponentSnapshot?: GameRosterSnapshot;
  plays: Play[];
  homeScore: number;
  oppScore: number;
  homePlayers?: Player[]; // Legacy support for existing UI
  opponent?: string;
  opponentName?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  notes?: string;
  tags?: string[];
}

export {};
