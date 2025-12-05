import React, { useMemo, useState } from 'react';
import {
    Grid,
    GridItem,
    Text,
    Box,
    Heading,
    Stack,
    HStack,
    Portal,
    Button,
    TableRoot,
    TableHeader,
    TableBody,
    TableRow,
    TableColumnHeader,
    TableCell,
} from '@chakra-ui/react';
import { Game, Player } from '../models';
import { calculateGameStats, TeamGameStats } from '../utils/gameStatsUtils';

interface GameStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
    game: Game;
    teamId: string;
}

const StatBox = ({ label, value, subLabel, color = 'white' }: { label: string; value: string | number; subLabel?: string; color?: string }) => (
    <Box bg="gray.700" p={2} borderRadius="md" textAlign="center" border="1px solid" borderColor="gray.600">
        <Text fontSize="xs" color="gray.400" textTransform="uppercase" fontWeight="bold" mb={1}>
            {label}
        </Text>
        <Text fontSize="xl" fontWeight="800" color={color}>
            {value}
        </Text>
        {subLabel && (
            <Text fontSize="xs" color="gray.500">
                {subLabel}
            </Text>
        )}
    </Box>
);

const SectionHeader = ({ title, color = 'blue.300' }: { title: string; color?: string }) => (
    <Heading size="sm" color={color} fontStyle="italic" mb={2} borderBottom="1px solid" borderColor="gray.700" pb={1}>
        {title}
    </Heading>
);

const PlayerStatTable = ({
    headers,
    data,
    renderRow
}: {
    headers: string[];
    data: { player: Player; stats: TeamGameStats }[];
    renderRow: (player: Player, stats: TeamGameStats) => React.ReactNode;
}) => (
    <Box overflowX="auto">
        <TableRoot>
            <TableHeader>
                <TableRow>
                    <TableColumnHeader color="gray.400">Player</TableColumnHeader>
                    {headers.map((h, i) => (
                        <TableColumnHeader key={i} color="gray.400" textAlign="right">{h}</TableColumnHeader>
                    ))}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.map(({ player, stats }) => (
                    <TableRow key={player.id}>
                        <TableCell fontWeight="bold" color="white">
                            #{player.jerseyNumber} {player.lastName}
                        </TableCell>
                        {renderRow(player, stats)}
                    </TableRow>
                ))}
                {data.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={headers.length + 1} textAlign="center" color="gray.500">
                            No stats recorded
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </TableRoot>
    </Box>
);

export const GameStatsModal: React.FC<GameStatsModalProps> = ({ isOpen, onClose, game, teamId }) => {
    const { teamStats, playerStats } = useMemo(() => calculateGameStats(game, teamId), [game, teamId]);
    const [viewMode, setViewMode] = useState<'team' | 'player'>('team');
    const [playerTab, setPlayerTab] = useState('Passing');

    // Get roster map for player names
    const rosterMap = useMemo(() => {
        const map = new Map<string, Player>();
        const roster = game.myTeamSnapshot?.roster || [];
        roster.forEach(p => map.set(p.id, p));
        return map;
    }, [game]);

    const getPlayer = (id: string) => rosterMap.get(id) || { id, lastName: 'Unknown', jerseyNumber: 0 } as Player;

    // Filter players for each category
    const getPlayersWithStats = (filter: (s: TeamGameStats) => boolean) => {
        return Object.entries(playerStats)
            .filter(([_, stats]) => filter(stats))
            .map(([id, stats]) => ({ player: getPlayer(id), stats }))
            .sort((a, b) => (a.player.jerseyNumber || 0) - (b.player.jerseyNumber || 0));
    };

    if (!isOpen) return null;

    return (
        <Portal>
            <Box
                position="fixed"
                top={0}
                left={0}
                right={0}
                bottom={0}
                bg="blackAlpha.800"
                zIndex={1000}
                onClick={onClose}
                backdropFilter="blur(5px)"
            />
            <Box
                position="fixed"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                bg="gray.900"
                borderRadius="xl"
                boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
                border="2px solid"
                borderColor="blue.500"
                maxW="1200px"
                w="95%"
                maxH="90vh"
                display="flex"
                flexDirection="column"
                zIndex={1001}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <HStack
                    px={6}
                    py={4}
                    borderBottom="2px solid"
                    borderColor="blue.500"
                    justify="space-between"
                    bg="gray.800"
                    borderTopRadius="xl"
                    flexShrink={0}
                >
                    <Heading size="md" color="white">Game Stats Report</Heading>
                    <Button size="sm" onClick={onClose} colorScheme="gray">Close</Button>
                </HStack>

                {/* Content */}
                <Box p={0} overflowY="auto" flex={1}>
                    {/* View Mode Tabs */}
                    <HStack gap={0} bg="gray.800" borderBottom="1px solid" borderColor="gray.700">
                        <Button
                            flex={1}
                            variant="ghost"
                            borderRadius={0}
                            color={viewMode === 'team' ? 'blue.300' : 'gray.400'}
                            borderBottom={viewMode === 'team' ? '2px solid' : 'none'}
                            borderColor="blue.300"
                            onClick={() => setViewMode('team')}
                            _hover={{ bg: 'gray.700' }}
                        >
                            Team Stats
                        </Button>
                        <Button
                            flex={1}
                            variant="ghost"
                            borderRadius={0}
                            color={viewMode === 'player' ? 'blue.300' : 'gray.400'}
                            borderBottom={viewMode === 'player' ? '2px solid' : 'none'}
                            borderColor="blue.300"
                            onClick={() => setViewMode('player')}
                            _hover={{ bg: 'gray.700' }}
                        >
                            Player Stats
                        </Button>
                    </HStack>

                    <Box p={6}>
                        {viewMode === 'team' ? (
                            <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, 1fr)' }} gap={6}>
                                {/* Column 1: Offense (Run/Rec/Pass) */}
                                <GridItem>
                                    <Stack gap={6}>
                                        {/* Rushing */}
                                        <Box>
                                            <SectionHeader title="Rushing" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Carries" value={teamStats.rushingAttempts} />
                                                <StatBox label="Yards" value={teamStats.rushingYards} color="green.300" />
                                                <StatBox label="Avg" value={(teamStats.rushingYards / (teamStats.rushingAttempts || 1)).toFixed(1)} />
                                                <StatBox label="Yards +" value={teamStats.rushingYardsPositive} color="green.400" />
                                                <StatBox label="Yards -" value={teamStats.rushingYardsNegative} color="red.400" />
                                                <StatBox label="Longest" value={teamStats.rushingLongest} />
                                                <StatBox label="TDs" value={teamStats.rushingTds} color="yellow.400" />
                                            </Grid>
                                        </Box>

                                        {/* Receiving */}
                                        <Box>
                                            <SectionHeader title="Receiving" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Targets" value={teamStats.receivingAttempts} />
                                                <StatBox label="Catches" value={teamStats.receptions} />
                                                <StatBox label="Yards" value={teamStats.receivingYards} color="green.300" />
                                                <StatBox label="Yards +" value={teamStats.receivingYardsPositive} color="green.400" />
                                                <StatBox label="Yards -" value={teamStats.receivingYardsNegative} color="red.400" />
                                                <StatBox label="Avg" value={(teamStats.receivingYards / (teamStats.receptions || 1)).toFixed(1)} />
                                                <StatBox label="Longest" value={teamStats.receivingLongest} />
                                                <StatBox label="TDs" value={teamStats.receivingTds} color="yellow.400" />
                                                <StatBox label="Drops" value={teamStats.drops} color="red.300" />
                                            </Grid>
                                        </Box>

                                        {/* Passing */}
                                        <Box>
                                            <SectionHeader title="Passing" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Comp/Att" value={`${teamStats.completions}/${teamStats.passingAttempts}`} />
                                                <StatBox label="Yards" value={teamStats.passingYards} color="green.300" />
                                                <StatBox label="Comp %" value={((teamStats.completions / (teamStats.passingAttempts || 1)) * 100).toFixed(0) + '%'} />
                                                <StatBox label="TDs" value={teamStats.passingTds} color="yellow.400" />
                                                <StatBox label="Int" value={teamStats.interceptions} color="red.400" />
                                                <StatBox label="Sacks" value={teamStats.sacks} color="red.300" />
                                                <StatBox label="Longest" value={teamStats.passingLongest} />
                                                <StatBox label="QB Rate" value={teamStats.qbRating} color="cyan.300" />
                                            </Grid>
                                        </Box>
                                    </Stack>
                                </GridItem>

                                {/* Column 2: Special Teams & Returns */}
                                <GridItem>
                                    <Stack gap={6}>
                                        {/* Field Goals */}
                                        <Box>
                                            <SectionHeader title="Field Goals" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Made/Att" value={`${teamStats.fieldGoalsMade}/${teamStats.fieldGoalsAttempted}`} />
                                                <StatBox label="Pct" value={((teamStats.fieldGoalsMade / (teamStats.fieldGoalsAttempted || 1)) * 100).toFixed(0) + '%'} color="green.300" />
                                                <StatBox label="Longest" value={teamStats.fieldGoalLongest} />
                                                <StatBox label="Blocked" value={teamStats.fieldGoalsBlocked} color="red.400" />
                                            </Grid>
                                        </Box>

                                        {/* Extra Points */}
                                        <Box>
                                            <SectionHeader title="Extra Points" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Made/Att" value={`${teamStats.extraPointsMade}/${teamStats.extraPointsAttempted}`} />
                                                <StatBox label="Blocked" value={teamStats.extraPointsBlocked} color="red.400" />
                                            </Grid>
                                        </Box>

                                        {/* Punting */}
                                        <Box>
                                            <SectionHeader title="Punting" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Punts" value={teamStats.punts} />
                                                <StatBox label="Yards" value={teamStats.puntYards} />
                                                <StatBox label="Avg" value={(teamStats.puntYards / (teamStats.punts || 1)).toFixed(1)} />
                                                <StatBox label="Longest" value={teamStats.puntLongest} />
                                                <StatBox label="Blocked" value={teamStats.puntsBlocked} color="red.400" />
                                                <StatBox label="Inside 20" value={teamStats.puntsInside20} />
                                            </Grid>
                                        </Box>

                                        {/* Kickoff Returns */}
                                        <Box>
                                            <SectionHeader title="Kickoff Returns" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Returns" value={teamStats.kickoffReturns} />
                                                <StatBox label="Yards" value={teamStats.kickoffReturnYards} />
                                                <StatBox label="Avg" value={(teamStats.kickoffReturnYards / (teamStats.kickoffReturns || 1)).toFixed(1)} />
                                                <StatBox label="Longest" value={teamStats.kickoffReturnLongest} />
                                                <StatBox label="TDs" value={teamStats.kickoffReturnTds} color="yellow.400" />
                                            </Grid>
                                        </Box>

                                        {/* Punt Returns */}
                                        <Box>
                                            <SectionHeader title="Punt Returns" />
                                            <Grid templateColumns="repeat(3, 1fr)" gap={2}>
                                                <StatBox label="Returns" value={teamStats.puntReturns} />
                                                <StatBox label="Yards" value={teamStats.puntReturnYards} />
                                                <StatBox label="Avg" value={(teamStats.puntReturnYards / (teamStats.puntReturns || 1)).toFixed(1)} />
                                                <StatBox label="Longest" value={teamStats.puntReturnLongest} />
                                                <StatBox label="TDs" value={teamStats.puntReturnTds} color="yellow.400" />
                                                <StatBox label="Fair Catch" value={teamStats.fairCatches} />
                                            </Grid>
                                        </Box>
                                    </Stack>
                                </GridItem>

                                {/* Column 3: Defense & Penalties */}
                                <GridItem>
                                    <Stack gap={6}>
                                        {/* Defense */}
                                        <Box>
                                            <SectionHeader title="Defense" />
                                            <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                                                <StatBox label="Tackles" value={teamStats.tackles} />
                                                <StatBox label="TFL" value={teamStats.tacklesForLoss} />
                                                <StatBox label="Sacks" value={teamStats.sacksMade} />
                                                <StatBox label="Sack Yds" value={teamStats.sackYardsMade} />
                                                <StatBox label="Ints" value={teamStats.interceptionsMade} color="green.300" />
                                                <StatBox label="Int Ret Yds" value={teamStats.interceptionReturnYards} />
                                                <StatBox label="Fum Rec" value={teamStats.fumblesRecovered} color="green.300" />
                                                <StatBox label="Fum Ret Yds" value={teamStats.fumbleReturnYards} />
                                                <StatBox label="Forced Fum" value={teamStats.forcedFumbles} />
                                                <StatBox label="Pass Brk Up" value={teamStats.passBreakups} />
                                                <StatBox label="Missed Tkl" value={teamStats.missedTackles} color="red.300" />
                                                <StatBox label="Safeties" value={teamStats.safeties} color="green.300" />
                                                <StatBox label="Def TDs" value={teamStats.defensiveTds} color="yellow.400" />
                                            </Grid>
                                        </Box>

                                        {/* Penalties */}
                                        <Box>
                                            <SectionHeader title="Penalties" color="yellow.300" />
                                            <Grid templateColumns="repeat(2, 1fr)" gap={2} mb={4}>
                                                <StatBox label="Count" value={teamStats.penalties} color="yellow.300" />
                                                <StatBox label="Yards" value={teamStats.penaltyYards} color="yellow.300" />
                                            </Grid>

                                            {Object.entries(teamStats.penaltyBreakdown).length > 0 && (
                                                <Box bg="gray.800" p={3} borderRadius="md" border="1px solid" borderColor="gray.700">
                                                    <Text fontSize="xs" color="gray.400" mb={2} textTransform="uppercase" fontWeight="bold">Breakdown</Text>
                                                    <Stack gap={1}>
                                                        {Object.entries(teamStats.penaltyBreakdown).map(([type, count]) => (
                                                            <HStack key={type} justify="space-between">
                                                                <Text fontSize="sm" color="gray.300">{type}</Text>
                                                                <Text fontSize="sm" fontWeight="bold" color="white">{count}</Text>
                                                            </HStack>
                                                        ))}
                                                    </Stack>
                                                </Box>
                                            )}
                                        </Box>
                                    </Stack>
                                </GridItem>
                            </Grid>
                        ) : (
                            <Box>
                                <HStack mb={4} flexWrap="wrap" gap={2}>
                                    {['Passing', 'Rushing', 'Receiving', 'Defense', 'Kicking', 'Returns'].map(tab => (
                                        <Button
                                            key={tab}
                                            size="sm"
                                            variant={playerTab === tab ? 'solid' : 'outline'}
                                            colorScheme="blue"
                                            onClick={() => setPlayerTab(tab)}
                                        >
                                            {tab}
                                        </Button>
                                    ))}
                                </HStack>

                                {playerTab === 'Passing' && (
                                    <PlayerStatTable
                                        headers={['C/A', 'Yds', 'TD', 'Int', 'Rate']}
                                        data={getPlayersWithStats(s => s.passingAttempts > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.completions}/{s.passingAttempts}</TableCell>
                                                <TableCell textAlign="right">{s.passingYards}</TableCell>
                                                <TableCell textAlign="right">{s.passingTds}</TableCell>
                                                <TableCell textAlign="right">{s.interceptions}</TableCell>
                                                <TableCell textAlign="right">{s.qbRating}</TableCell>
                                            </>
                                        )}
                                    />
                                )}

                                {playerTab === 'Rushing' && (
                                    <PlayerStatTable
                                        headers={['Car', 'Yds', 'Avg', 'Long', 'TD']}
                                        data={getPlayersWithStats(s => s.rushingAttempts > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.rushingAttempts}</TableCell>
                                                <TableCell textAlign="right">{s.rushingYards}</TableCell>
                                                <TableCell textAlign="right">{(s.rushingYards / (s.rushingAttempts || 1)).toFixed(1)}</TableCell>
                                                <TableCell textAlign="right">{s.rushingLongest}</TableCell>
                                                <TableCell textAlign="right">{s.rushingTds}</TableCell>
                                            </>
                                        )}
                                    />
                                )}

                                {playerTab === 'Receiving' && (
                                    <PlayerStatTable
                                        headers={['Rec', 'Tgt', 'Yds', 'Avg', 'Long', 'TD']}
                                        data={getPlayersWithStats(s => s.receptions > 0 || s.receivingAttempts > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.receptions}</TableCell>
                                                <TableCell textAlign="right">{s.receivingAttempts}</TableCell>
                                                <TableCell textAlign="right">{s.receivingYards}</TableCell>
                                                <TableCell textAlign="right">{(s.receivingYards / (s.receptions || 1)).toFixed(1)}</TableCell>
                                                <TableCell textAlign="right">{s.receivingLongest}</TableCell>
                                                <TableCell textAlign="right">{s.receivingTds}</TableCell>
                                            </>
                                        )}
                                    />
                                )}

                                {playerTab === 'Defense' && (
                                    <PlayerStatTable
                                        headers={['Tkl', 'TFL', 'Sack', 'Int', 'FF', 'PBU']}
                                        data={getPlayersWithStats(s => s.tackles > 0 || s.sacksMade > 0 || s.interceptionsMade > 0 || s.passBreakups > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.tackles}</TableCell>
                                                <TableCell textAlign="right">{s.tacklesForLoss}</TableCell>
                                                <TableCell textAlign="right">{s.sacksMade}</TableCell>
                                                <TableCell textAlign="right">{s.interceptionsMade}</TableCell>
                                                <TableCell textAlign="right">{s.forcedFumbles}</TableCell>
                                                <TableCell textAlign="right">{s.passBreakups}</TableCell>
                                            </>
                                        )}
                                    />
                                )}

                                {playerTab === 'Kicking' && (
                                    <PlayerStatTable
                                        headers={['FG', 'Long', 'XP', 'Punts', 'Avg']}
                                        data={getPlayersWithStats(s => s.fieldGoalsAttempted > 0 || s.extraPointsAttempted > 0 || s.punts > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.fieldGoalsMade}/{s.fieldGoalsAttempted}</TableCell>
                                                <TableCell textAlign="right">{s.fieldGoalLongest}</TableCell>
                                                <TableCell textAlign="right">{s.extraPointsMade}/{s.extraPointsAttempted}</TableCell>
                                                <TableCell textAlign="right">{s.punts}</TableCell>
                                                <TableCell textAlign="right">{(s.puntYards / (s.punts || 1)).toFixed(1)}</TableCell>
                                            </>
                                        )}
                                    />
                                )}

                                {playerTab === 'Returns' && (
                                    <PlayerStatTable
                                        headers={['KR', 'Yds', 'TD', 'PR', 'Yds', 'TD']}
                                        data={getPlayersWithStats(s => s.kickoffReturns > 0 || s.puntReturns > 0)}
                                        renderRow={(p, s) => (
                                            <>
                                                <TableCell textAlign="right">{s.kickoffReturns}</TableCell>
                                                <TableCell textAlign="right">{s.kickoffReturnYards}</TableCell>
                                                <TableCell textAlign="right">{s.kickoffReturnTds}</TableCell>
                                                <TableCell textAlign="right">{s.puntReturns}</TableCell>
                                                <TableCell textAlign="right">{s.puntReturnYards}</TableCell>
                                                <TableCell textAlign="right">{s.puntReturnTds}</TableCell>
                                            </>
                                        )}
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Portal>
    );
};
