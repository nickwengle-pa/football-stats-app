import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore';

export interface Player {
  id: string;
  name: string;
  position: string; // e.g., 'QB', 'RB'
  stats: { [key: string]: number }; // e.g., { rushingYards: 0, attempts: 0 }
}

export interface Play {
  id: string;
  type: string; // 'run', 'pass', 'tackle', etc.
  yards: number;
  playerId: string;
  description: string; // e.g., 'QB #12 pass to WR #5 for 15 yards'
  timestamp: Timestamp;
  quarter: number;
  down: string;
  distance: string;
  assistingPlayerIds: string[];
}

export interface Game {
  id: string;
  opponent: string;
  date: Timestamp;
  homePlayers: Player[];
  plays: Play[];
  homeScore: number;
  oppScore: number;
  // Add quarters, clock if expanding
}

export {};
