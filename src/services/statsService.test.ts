import { recalculateStats } from './statsService';
import { Game, Play, PlayType, Player } from '../models';

const fakeTs = { toDate: () => new Date() } as any;

const homePlayer: Player = {
  id: 'home-1',
  name: 'Home Player',
  stats: {},
};

const oppPlayer: Player = {
  id: 'opp-1',
  name: 'Opp Player',
  stats: {},
};

const baseGame: Game = {
  id: 'game-1',
  date: fakeTs,
  plays: [],
  homeScore: 0,
  oppScore: 0,
  myTeamId: 'home-team',
  seasonId: 'season-1',
  myTeamSnapshot: {
    roster: [homePlayer],
  },
  opponentSnapshot: {
    roster: [oppPlayer],
  },
};

describe('statsService recalculateStats', () => {
  it('tracks home and opponent stats and scores by teamSide', () => {
    const plays: Play[] = [
      {
        id: 'p1',
        type: PlayType.RUSH,
        yards: 10,
        playerId: homePlayer.id,
        teamSide: 'home',
        description: 'Home rush',
        timestamp: fakeTs,
      },
      {
        id: 'p2',
        type: PlayType.RUSH_TD,
        yards: 5,
        playerId: oppPlayer.id,
        teamSide: 'away',
        description: 'Away rush TD',
        timestamp: fakeTs,
      },
    ];

    const result = recalculateStats({ ...baseGame, plays });

    expect(result.homeScore).toBe(0);
    expect(result.oppScore).toBe(6);

    const homeRoster = result.myTeamSnapshot?.roster || [];
    const oppRoster = result.opponentSnapshot?.roster || [];

    expect(homeRoster[0].stats.rushingAttempts).toBe(1);
    expect(homeRoster[0].stats.rushingYards).toBe(10);

    expect(oppRoster[0].stats.rushingAttempts).toBe(1);
    expect(oppRoster[0].stats.rushingYards).toBe(5);
    expect(oppRoster[0].stats.rushingTouchdowns).toBe(1);
  });
});
