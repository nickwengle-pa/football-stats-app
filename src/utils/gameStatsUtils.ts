import { Game, Play, PlayType, PenaltyType } from '../models';

export interface TeamGameStats {
    // Rushing
    rushingAttempts: number;
    rushingYards: number;
    rushingYardsPositive: number;
    rushingYardsNegative: number;
    rushingLongest: number;
    rushingTds: number;

    // Receiving
    receivingAttempts: number; // Targets
    receptions: number;
    receivingYards: number;
    receivingYardsPositive: number;
    receivingYardsNegative: number;
    receivingLongest: number;
    receivingTds: number;
    drops: number;

    // Passing
    passingAttempts: number;
    completions: number;
    passingYards: number;
    passingTds: number;
    interceptions: number;
    sacks: number;
    sackYards: number;
    passingLongest: number;
    qbRating: number;

    // Returns
    kickoffReturns: number;
    kickoffReturnYards: number;
    kickoffReturnLongest: number;
    kickoffReturnTds: number;
    puntReturns: number;
    puntReturnYards: number;
    puntReturnLongest: number;
    puntReturnTds: number;
    fairCatches: number;

    // Kicking
    fieldGoalsMade: number;
    fieldGoalsAttempted: number;
    fieldGoalLongest: number;
    fieldGoalsBlocked: number;
    extraPointsMade: number;
    extraPointsAttempted: number;
    extraPointsBlocked: number;

    // Punting
    punts: number;
    puntYards: number;
    puntLongest: number;
    puntsBlocked: number;
    puntsInside20: number; // Not tracked yet, placeholder

    // Defense
    tackles: number;
    tacklesForLoss: number;
    tackleForLossYards: number;
    sacksMade: number;
    sackYardsMade: number;
    interceptionsMade: number;
    interceptionReturnYards: number;
    fumblesRecovered: number;
    fumbleReturnYards: number;
    forcedFumbles: number;
    passBreakups: number;
    missedTackles: number;
    safeties: number;
    defensiveTds: number;

    // Penalties
    penalties: number;
    penaltyYards: number;
    penaltyBreakdown: Record<string, number>;

    // First Downs (if tracked)
    firstDowns: number;
}

const initialStats: TeamGameStats = {
    rushingAttempts: 0, rushingYards: 0, rushingYardsPositive: 0, rushingYardsNegative: 0, rushingLongest: 0, rushingTds: 0,
    receivingAttempts: 0, receptions: 0, receivingYards: 0, receivingYardsPositive: 0, receivingYardsNegative: 0, receivingLongest: 0, receivingTds: 0, drops: 0,
    passingAttempts: 0, completions: 0, passingYards: 0, passingTds: 0, interceptions: 0, sacks: 0, sackYards: 0, passingLongest: 0, qbRating: 0,
    kickoffReturns: 0, kickoffReturnYards: 0, kickoffReturnLongest: 0, kickoffReturnTds: 0,
    puntReturns: 0, puntReturnYards: 0, puntReturnLongest: 0, puntReturnTds: 0, fairCatches: 0,
    fieldGoalsMade: 0, fieldGoalsAttempted: 0, fieldGoalLongest: 0, fieldGoalsBlocked: 0,
    extraPointsMade: 0, extraPointsAttempted: 0, extraPointsBlocked: 0,
    punts: 0, puntYards: 0, puntLongest: 0, puntsBlocked: 0, puntsInside20: 0,
    tackles: 0, tacklesForLoss: 0, tackleForLossYards: 0, sacksMade: 0, sackYardsMade: 0,
    interceptionsMade: 0, interceptionReturnYards: 0, fumblesRecovered: 0, fumbleReturnYards: 0, forcedFumbles: 0, passBreakups: 0, missedTackles: 0, safeties: 0, defensiveTds: 0,
    penalties: 0, penaltyYards: 0, penaltyBreakdown: {},
    firstDowns: 0
};

export interface GameStatsReport {
    teamStats: TeamGameStats;
    playerStats: Record<string, TeamGameStats>;
}

export const calculateGameStats = (game: Game, teamId: string): GameStatsReport => {
    const teamStats = JSON.parse(JSON.stringify(initialStats)) as TeamGameStats; // Deep copy
    const playerStats: Record<string, TeamGameStats> = {};

    const getOrCreatePlayerStats = (playerId: string): TeamGameStats => {
        if (!playerStats[playerId]) {
            playerStats[playerId] = JSON.parse(JSON.stringify(initialStats));
        }
        return playerStats[playerId];
    };

    const isHome = game.myTeamId === teamId;
    const teamSide = isHome ? 'home' : 'away';

    game.plays.forEach(play => {
        // Only process plays for this team (mostly)
        // Some defensive stats depend on opponent plays
        const isMyPlay = play.teamSide === teamSide;

        // Helper to attribute stats to participants
        const attributeToRole = (role: string, callback: (stats: TeamGameStats) => void) => {
            const participants = play.participants?.filter(p => p.role === role) || [];
            participants.forEach(p => {
                callback(getOrCreatePlayerStats(p.playerId));
            });
            // Fallback for legacy data or simple plays where playerId is the primary actor
            if (participants.length === 0 && play.playerId) {
                // Heuristic: if no participants, assume playerId is the primary role (rusher, passer, etc.)
                // This might need refinement if playerId is used loosely
                if (role === 'rusher' && (play.type === PlayType.RUSH || play.type === PlayType.RUSH_TD)) {
                    callback(getOrCreatePlayerStats(play.playerId));
                } else if (role === 'passer' && (play.type === PlayType.PASS_COMPLETE || play.type === PlayType.PASS_TD || play.type === PlayType.PASS_INCOMPLETE || play.type === PlayType.INTERCEPTION || play.type === PlayType.SACK)) {
                    callback(getOrCreatePlayerStats(play.playerId));
                } else if (role === 'kicker' && (play.type === PlayType.KICKOFF || play.type === PlayType.PUNT || play.type === PlayType.FIELD_GOAL_MADE || play.type === PlayType.FIELD_GOAL_MISSED || play.type === PlayType.EXTRA_POINT_KICK_MADE || play.type === PlayType.EXTRA_POINT_KICK_MISSED)) {
                    callback(getOrCreatePlayerStats(play.playerId));
                } else if (role === 'returner' && (play.type === PlayType.KICKOFF_RETURN || play.type === PlayType.PUNT_RETURN)) {
                    callback(getOrCreatePlayerStats(play.playerId));
                }
            }
        };

        if (isMyPlay) {
            switch (play.type) {
                case PlayType.RUSH:
                case PlayType.RUSH_TD:
                case PlayType.KNEEL: // Kneels count as rushing attempts
                    teamStats.rushingAttempts++;
                    teamStats.rushingYards += play.yards;
                    if (play.yards > 0) teamStats.rushingYardsPositive += play.yards;
                    else teamStats.rushingYardsNegative += Math.abs(play.yards);
                    teamStats.rushingLongest = Math.max(teamStats.rushingLongest, play.yards);
                    if (play.type === PlayType.RUSH_TD) teamStats.rushingTds++;

                    attributeToRole('rusher', (ps) => {
                        ps.rushingAttempts++;
                        ps.rushingYards += play.yards;
                        if (play.yards > 0) ps.rushingYardsPositive += play.yards;
                        else ps.rushingYardsNegative += Math.abs(play.yards);
                        ps.rushingLongest = Math.max(ps.rushingLongest, play.yards);
                        if (play.type === PlayType.RUSH_TD) ps.rushingTds++;
                    });

                    // Specific handling for KNEEL if not assigned to rusher explicitly
                    if (play.type === PlayType.KNEEL && (!play.participants || !play.participants.some(p => p.role === 'rusher')) && play.playerId) {
                        const ps = getOrCreatePlayerStats(play.playerId);
                        ps.rushingAttempts++;
                        ps.rushingYards += play.yards;
                        ps.rushingYardsNegative += Math.abs(play.yards);
                    }
                    break;

                case PlayType.PASS_COMPLETE:
                case PlayType.PASS_TD:
                    teamStats.passingAttempts++;
                    teamStats.completions++;
                    teamStats.passingYards += play.yards;
                    teamStats.passingLongest = Math.max(teamStats.passingLongest, play.yards);
                    if (play.type === PlayType.PASS_TD) teamStats.passingTds++;

                    // Receiving stats (same play)
                    teamStats.receptions++;
                    teamStats.receivingYards += play.yards;
                    if (play.yards > 0) teamStats.receivingYardsPositive += play.yards;
                    else teamStats.receivingYardsNegative += Math.abs(play.yards);
                    teamStats.receivingLongest = Math.max(teamStats.receivingLongest, play.yards);
                    if (play.type === PlayType.PASS_TD) teamStats.receivingTds++;

                    attributeToRole('passer', (ps) => {
                        ps.passingAttempts++;
                        ps.completions++;
                        ps.passingYards += play.yards;
                        ps.passingLongest = Math.max(ps.passingLongest, play.yards);
                        if (play.type === PlayType.PASS_TD) ps.passingTds++;
                    });

                    attributeToRole('receiver', (ps) => {
                        ps.receptions++;
                        ps.receivingYards += play.yards;
                        if (play.yards > 0) ps.receivingYardsPositive += play.yards;
                        else ps.receivingYardsNegative += Math.abs(play.yards);
                        ps.receivingLongest = Math.max(ps.receivingLongest, play.yards);
                        if (play.type === PlayType.PASS_TD) ps.receivingTds++;
                    });
                    break;

                case PlayType.PASS_INCOMPLETE:
                    teamStats.passingAttempts++;
                    teamStats.receivingAttempts++; // Target

                    attributeToRole('passer', (ps) => {
                        ps.passingAttempts++;
                    });
                    attributeToRole('receiver', (ps) => {
                        ps.receivingAttempts++;
                    });
                    break;

                case PlayType.INTERCEPTION:
                    teamStats.passingAttempts++;
                    teamStats.interceptions++;

                    attributeToRole('passer', (ps) => {
                        ps.passingAttempts++;
                        ps.interceptions++;
                    });
                    break;

                case PlayType.SACK:
                    teamStats.sacks++;
                    teamStats.sackYards += Math.abs(play.yards);

                    // In NFHS/NCAA, Sacks count as Rushing Attempts for negative yards
                    teamStats.rushingAttempts++;
                    teamStats.rushingYards += play.yards; // play.yards is negative for sacks
                    teamStats.rushingYardsNegative += Math.abs(play.yards);


                    attributeToRole('passer', (ps) => {
                        ps.sacks++;
                        ps.sackYards += Math.abs(play.yards);

                        // Sacked player gets a rush attempt and negative rushing yards
                        ps.rushingAttempts++;
                        ps.rushingYards += play.yards;
                        ps.rushingYardsNegative += Math.abs(play.yards);
                    });
                    break;

                case PlayType.DROP:
                    teamStats.drops++;
                    teamStats.receivingAttempts++;
                    teamStats.passingAttempts++; // Counts as attempt for QB too

                    attributeToRole('receiver', (ps) => {
                        ps.drops++;
                        ps.receivingAttempts++;
                    });
                    attributeToRole('passer', (ps) => {
                        ps.passingAttempts++;
                    });
                    break;

                case PlayType.KICKOFF_RETURN:
                    teamStats.kickoffReturns++;
                    teamStats.kickoffReturnYards += play.yards;
                    teamStats.kickoffReturnLongest = Math.max(teamStats.kickoffReturnLongest, play.yards);
                    // Check description for TD if not explicit type
                    if (play.description.toLowerCase().includes('touchdown')) teamStats.kickoffReturnTds++;

                    attributeToRole('returner', (ps) => {
                        ps.kickoffReturns++;
                        ps.kickoffReturnYards += play.yards;
                        ps.kickoffReturnLongest = Math.max(ps.kickoffReturnLongest, play.yards);
                        if (play.description.toLowerCase().includes('touchdown')) ps.kickoffReturnTds++;
                    });
                    break;

                case PlayType.PUNT_RETURN:
                    teamStats.puntReturns++;
                    teamStats.puntReturnYards += play.yards;
                    teamStats.puntReturnLongest = Math.max(teamStats.puntReturnLongest, play.yards);
                    if (play.description.toLowerCase().includes('touchdown')) teamStats.puntReturnTds++;

                    attributeToRole('returner', (ps) => {
                        ps.puntReturns++;
                        ps.puntReturnYards += play.yards;
                        ps.puntReturnLongest = Math.max(ps.puntReturnLongest, play.yards);
                        if (play.description.toLowerCase().includes('touchdown')) ps.puntReturnTds++;
                    });
                    break;

                case PlayType.FIELD_GOAL_MADE:
                    teamStats.fieldGoalsMade++;
                    teamStats.fieldGoalsAttempted++;
                    teamStats.fieldGoalLongest = Math.max(teamStats.fieldGoalLongest, play.yards);

                    attributeToRole('kicker', (ps) => {
                        ps.fieldGoalsMade++;
                        ps.fieldGoalsAttempted++;
                        ps.fieldGoalLongest = Math.max(ps.fieldGoalLongest, play.yards);
                    });
                    break;

                case PlayType.FIELD_GOAL_MISSED:
                    teamStats.fieldGoalsAttempted++;
                    attributeToRole('kicker', (ps) => ps.fieldGoalsAttempted++);
                    break;

                case PlayType.BLOCKED_FIELD_GOAL:
                    teamStats.fieldGoalsAttempted++;
                    teamStats.fieldGoalsBlocked++;
                    attributeToRole('kicker', (ps) => {
                        ps.fieldGoalsAttempted++;
                        ps.fieldGoalsBlocked++;
                    });
                    break;

                case PlayType.EXTRA_POINT_KICK_MADE:
                    teamStats.extraPointsMade++;
                    teamStats.extraPointsAttempted++;
                    attributeToRole('kicker', (ps) => {
                        ps.extraPointsMade++;
                        ps.extraPointsAttempted++;
                    });
                    break;

                case PlayType.EXTRA_POINT_KICK_MISSED:
                    teamStats.extraPointsAttempted++;
                    attributeToRole('kicker', (ps) => ps.extraPointsAttempted++);
                    break;

                case PlayType.BLOCKED_PAT:
                    teamStats.extraPointsAttempted++;
                    teamStats.extraPointsBlocked++;
                    attributeToRole('kicker', (ps) => {
                        ps.extraPointsAttempted++;
                        ps.extraPointsBlocked++;
                    });
                    break;

                case PlayType.PUNT:
                    teamStats.punts++;
                    teamStats.puntYards += play.yards;
                    teamStats.puntLongest = Math.max(teamStats.puntLongest, play.yards);

                    attributeToRole('kicker', (ps) => {
                        ps.punts++;
                        ps.puntYards += play.yards;
                        ps.puntLongest = Math.max(ps.puntLongest, play.yards);
                    });
                    break;

                case PlayType.BLOCKED_PUNT:
                    teamStats.punts++;
                    teamStats.puntsBlocked++;
                    attributeToRole('kicker', (ps) => {
                        ps.punts++;
                        ps.puntsBlocked++;
                    });
                    break;

                case PlayType.PENALTY:
                    teamStats.penalties++;
                    teamStats.penaltyYards += play.yards;
                    if (play.penaltyType) {
                        teamStats.penaltyBreakdown[play.penaltyType] = (teamStats.penaltyBreakdown[play.penaltyType] || 0) + 1;
                    } else {
                        teamStats.penaltyBreakdown['Other'] = (teamStats.penaltyBreakdown['Other'] || 0) + 1;
                    }
                    // Attribute penalty to player if identified
                    if (play.playerId) {
                        const ps = getOrCreatePlayerStats(play.playerId);
                        ps.penalties++;
                        ps.penaltyYards += play.yards;
                    }
                    break;
            }
        } else {
            // Opponent plays -> My Defense stats
            // For defensive stats, we look for 'tackler', 'interceptor', etc. in participants
            // If not found, we might fall back to play.playerId if it represents the defensive player

            const attributeDefense = (callback: (stats: TeamGameStats) => void) => {
                // Try specific roles first
                let found = false;
                // Tacklers
                const tacklers = play.participants?.filter(p => p.role === 'tackler') || [];
                tacklers.forEach(p => {
                    callback(getOrCreatePlayerStats(p.playerId));
                    found = true;
                });

                // Interceptor / Fumble Recoverer / etc usually 'defensivePlayer' or 'interceptor' role?
                // In ScoringScreen, we might just use 'tackler' or generic role. 
                // Let's check other roles if no tacklers found or for specific plays
                if (!found && play.participants) {
                    play.participants.forEach(p => {
                        // If it's a defensive play, any participant on my team is likely defensive
                        // But we need to be careful not to count offensive players if they tackle on a turnover?
                        // For now, assume participants on opponent plays are my defenders
                        callback(getOrCreatePlayerStats(p.playerId));
                    });
                }
            };

            switch (play.type) {
                case PlayType.TACKLE:
                    teamStats.tackles++;
                    attributeDefense(ps => ps.tackles++);
                    break;
                case PlayType.TACKLE_FOR_LOSS:
                    teamStats.tackles++;
                    teamStats.tacklesForLoss++;
                    teamStats.tackleForLossYards += Math.abs(play.yards);
                    attributeDefense(ps => {
                        ps.tackles++;
                        ps.tacklesForLoss++;
                        ps.tackleForLossYards += Math.abs(play.yards);
                    });
                    break;
                case PlayType.SACK:
                    teamStats.sacksMade++;
                    teamStats.sackYardsMade += Math.abs(play.yards);
                    attributeDefense(ps => {
                        ps.sacksMade++;
                        ps.sackYardsMade += Math.abs(play.yards);
                    });
                    break;
                case PlayType.INTERCEPTION:
                    teamStats.interceptionsMade++;
                    teamStats.interceptionReturnYards += play.yards;
                    if (play.description.toLowerCase().includes('touchdown')) teamStats.defensiveTds++;
                    attributeDefense(ps => {
                        ps.interceptionsMade++;
                        ps.interceptionReturnYards += play.yards;
                        if (play.description.toLowerCase().includes('touchdown')) ps.defensiveTds++;
                    });
                    break;
                case PlayType.FUMBLE_RECOVERY:
                    teamStats.fumblesRecovered++;
                    teamStats.fumbleReturnYards += play.yards;
                    if (play.description.toLowerCase().includes('touchdown')) teamStats.defensiveTds++;
                    attributeDefense(ps => {
                        ps.fumblesRecovered++;
                        ps.fumbleReturnYards += play.yards;
                        if (play.description.toLowerCase().includes('touchdown')) ps.defensiveTds++;
                    });
                    break;
                case PlayType.FORCED_FUMBLE:
                    teamStats.forcedFumbles++;
                    attributeDefense(ps => ps.forcedFumbles++);
                    break;
                case PlayType.PASS_DEFENSED:
                    teamStats.passBreakups++;
                    attributeDefense(ps => ps.passBreakups++);
                    break;
                case PlayType.MISSED_TACKLE:
                    teamStats.missedTackles++;
                    attributeDefense(ps => ps.missedTackles++);
                    break;
                case PlayType.SAFETY:
                    teamStats.safeties++;
                    attributeDefense(ps => ps.safeties++);
                    break;
            }
        }
    });

    // Calculate QB Rating (NCAA Formula) for Team
    if (teamStats.passingAttempts > 0) {
        const numerator = (8.4 * teamStats.passingYards) + (330 * teamStats.passingTds) + (100 * teamStats.completions) - (200 * teamStats.interceptions);
        teamStats.qbRating = parseFloat((numerator / teamStats.passingAttempts).toFixed(1));
    }

    // Calculate QB Rating for each player
    Object.values(playerStats).forEach(ps => {
        if (ps.passingAttempts > 0) {
            const numerator = (8.4 * ps.passingYards) + (330 * ps.passingTds) + (100 * ps.completions) - (200 * ps.interceptions);
            ps.qbRating = parseFloat((numerator / ps.passingAttempts).toFixed(1));
        }
    });

    return { teamStats, playerStats };
};
