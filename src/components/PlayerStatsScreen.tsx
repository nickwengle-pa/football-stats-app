import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Center,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  Image,
  Badge,
  HStack,
} from '@chakra-ui/react';
import { subscribeToGame } from '../services/dbService';
import { Game, Player } from '../models';
import { PageHeader, SectionCard, DataTable, DataTableColumn } from './ui';
import { useProgram } from '../context/ProgramContext';
import { getOpponentName, getMyTeamRoster } from '../utils/gameUtils';

type PlayerStats = {
  player: Player;
  rushingYards: number;
  rushingAttempts: number;
  rushingTouchdowns: number;
  passingYards: number;
  passingAttempts: number;
  completions: number;
  passingTouchdowns: number;
  receivingYards: number;
  receptions: number;
  tackles: number;
  sacks: number;
  interceptions: number;
  totalPoints: number;
};

const PlayerStatsScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { team, teamLoading, activeSeasonId, branding } = useProgram();
  const navigate = useNavigate();
  const teamId = team?.id ?? null;
  const teamName = team?.name ?? 'Our Team';
  const logoUrl = branding.logoUrl;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<'offense' | 'defense' | 'all'>('all');

  useEffect(() => {
    if (!teamId || !activeSeasonId || !gameId || gameId === 'new') {
      setLoading(false);
      setGame(null);
      return;
    }
    const unsubscribe = subscribeToGame(
      gameId,
      (snapshot) => {
        setGame(snapshot);
        setLoading(false);
      },
      { teamId, seasonId: activeSeasonId }
    );
    return unsubscribe;
  }, [teamId, activeSeasonId, gameId]);

  const playerStats = useMemo((): PlayerStats[] => {
    if (!game) return [];
    
    const roster = getMyTeamRoster(game).filter(p => p.id !== 'team-placeholder-player');
    
    return roster.map((player) => {
      const stats = player.stats || {};
      const tds = (stats.rushingTouchdowns || 0) + (stats.passingTouchdowns || 0);
      const fgMade = stats.fieldGoalsMade || 0;
      const patMade = stats.extraPointsMade || 0;
      const twoPoint = stats.twoPointConversions || 0;
      
      return {
        player,
        rushingYards: stats.rushingYards || 0,
        rushingAttempts: stats.rushingAttempts || 0,
        rushingTouchdowns: stats.rushingTouchdowns || 0,
        passingYards: stats.passingYards || 0,
        passingAttempts: stats.passingAttempts || 0,
        completions: stats.completions || 0,
        passingTouchdowns: stats.passingTouchdowns || 0,
        receivingYards: stats.receivingYards || 0,
        receptions: stats.receptions || 0,
        tackles: stats.tackles || 0,
        sacks: stats.sacks || 0,
        interceptions: stats.interceptions || 0,
        totalPoints: (tds * 6) + (fgMade * 3) + patMade + (twoPoint * 2),
      };
    }).filter(ps => {
      // Filter based on category
      if (selectedCategory === 'offense') {
        return ps.rushingYards > 0 || ps.passingYards > 0 || ps.receivingYards > 0;
      }
      if (selectedCategory === 'defense') {
        return ps.tackles > 0 || ps.sacks > 0 || ps.interceptions > 0;
      }
      return true;
    }).sort((a, b) => {
      // Sort by most relevant stat
      if (selectedCategory === 'offense') {
        const aTotal = a.rushingYards + a.passingYards + a.receivingYards;
        const bTotal = b.rushingYards + b.passingYards + b.receivingYards;
        return bTotal - aTotal;
      }
      if (selectedCategory === 'defense') {
        const aTotal = a.tackles + (a.sacks * 2) + (a.interceptions * 3);
        const bTotal = b.tackles + (b.sacks * 2) + (b.interceptions * 3);
        return bTotal - aTotal;
      }
      return b.totalPoints - a.totalPoints;
    });
  }, [game, selectedCategory]);

  const opponentName = useMemo(() => (game ? getOpponentName(game) : 'Opponent'), [game]);

  if (teamLoading || loading) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" />
          <Text color="text.secondary">Loading stats...</Text>
        </Stack>
      </Center>
    );
  }

  if (!game) {
    return (
      <SectionCard title="Player Stats">
        <Text color="text.secondary">Game not found.</Text>
      </SectionCard>
    );
  }

  const gameDate = game.date
    ? game.date.toDate().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Date TBD';

  return (
    <Stack gap={6}>
      <PageHeader
        title="Player Statistics"
        media={
          logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${teamName} logo`}
              boxSize="48px"
              objectFit="contain"
              borderRadius="md"
              border="1px solid"
              borderColor="border.subtle"
              bg="white"
              p={2}
            />
          ) : undefined
        }
        subtitle={`${teamName} vs ${opponentName} - ${gameDate}`}
        actions={
          <HStack gap={2}>
            <Button variant="outline" borderColor="brand.primary" color="brand.primary" onClick={() => navigate(`/reports/${gameId}`)}>
              View Report
            </Button>
            <Button variant="outline" borderColor="brand.primary" color="brand.primary" onClick={() => navigate('/')}>
              Back to Schedule
            </Button>
          </HStack>
        }
      />

      <SectionCard title="Game Summary">
        <SimpleGrid columns={{ base: 2, md: 4 }} gap={6}>
          <Box textAlign="center">
            <Text fontSize="sm" color="text.secondary" mb={1}>Our Score</Text>
            <Text fontSize="3xl" fontWeight="700">{game.homeScore}</Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="text.secondary" mb={1}>Opp Score</Text>
            <Text fontSize="3xl" fontWeight="700">{game.oppScore}</Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="text.secondary" mb={1}>Total Plays</Text>
            <Text fontSize="3xl" fontWeight="700">{game.plays.length}</Text>
          </Box>
          <Box textAlign="center">
            <Text fontSize="sm" color="text.secondary" mb={1}>Result</Text>
            <Badge
              colorScheme={game.homeScore > game.oppScore ? 'green' : game.homeScore < game.oppScore ? 'red' : 'gray'}
              fontSize="xl"
              px={3}
              py={1}
            >
              {game.homeScore > game.oppScore ? 'WIN' : game.homeScore < game.oppScore ? 'LOSS' : 'TIE'}
            </Badge>
          </Box>
        </SimpleGrid>
      </SectionCard>

      <Box>
        <HStack gap={2} mb={4}>
          <Button
            variant={selectedCategory === 'all' ? 'solid' : 'outline'}
            colorScheme="blue"
            onClick={() => setSelectedCategory('all')}
          >
            All Players
          </Button>
          <Button
            variant={selectedCategory === 'offense' ? 'solid' : 'outline'}
            colorScheme="green"
            onClick={() => setSelectedCategory('offense')}
          >
            Offense
          </Button>
          <Button
            variant={selectedCategory === 'defense' ? 'solid' : 'outline'}
            colorScheme="red"
            onClick={() => setSelectedCategory('defense')}
          >
            Defense
          </Button>
        </HStack>

        {playerStats.length === 0 ? (
          <SectionCard title="Player Stats">
            <Text color="text.secondary" textAlign="center" py={4}>
              No stats recorded yet. Add plays during the game to see player statistics here.
            </Text>
          </SectionCard>
        ) : (
          <Stack gap={4}>
            {playerStats.map((ps) => (
              <SectionCard key={ps.player.id} title="">
                <Stack gap={4}>
                  <Stack direction="row" justify="space-between" align="center">
                    <HStack gap={3}>
                      <Badge colorScheme="blue" fontSize="lg" px={2}>
                        #{ps.player.jerseyNumber}
                      </Badge>
                      <Stack gap={0}>
                        <Text fontSize="xl" fontWeight="600">{ps.player.name}</Text>
                        <Text fontSize="sm" color="text.secondary">{ps.player.position || 'Player'}</Text>
                      </Stack>
                    </HStack>
                    {ps.totalPoints > 0 && (
                      <Badge colorScheme="purple" fontSize="lg" px={3} py={1}>
                        {ps.totalPoints} PTS
                      </Badge>
                    )}
                  </Stack>

                  {/* Offensive Stats */}
                  {(ps.rushingYards > 0 || ps.passingYards > 0 || ps.receivingYards > 0) && (
                    <Box>
                      <Text fontSize="sm" fontWeight="600" mb={2} color="text.secondary">Offense</Text>
                      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                        {ps.rushingYards > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Rushing</Text>
                            <Text fontSize="lg" fontWeight="600">
                              {ps.rushingYards} yds ({ps.rushingAttempts} att)
                            </Text>
                            {ps.rushingTouchdowns > 0 && (
                              <Text fontSize="sm" color="green.600">{ps.rushingTouchdowns} TD</Text>
                            )}
                          </Box>
                        )}
                        {ps.passingYards > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Passing</Text>
                            <Text fontSize="lg" fontWeight="600">
                              {ps.completions}/{ps.passingAttempts} - {ps.passingYards} yds
                            </Text>
                            {ps.passingTouchdowns > 0 && (
                              <Text fontSize="sm" color="green.600">{ps.passingTouchdowns} TD</Text>
                            )}
                          </Box>
                        )}
                        {ps.receivingYards > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Receiving</Text>
                            <Text fontSize="lg" fontWeight="600">
                              {ps.receptions} rec - {ps.receivingYards} yds
                            </Text>
                          </Box>
                        )}
                      </SimpleGrid>
                    </Box>
                  )}

                  {/* Defensive Stats */}
                  {(ps.tackles > 0 || ps.sacks > 0 || ps.interceptions > 0) && (
                    <Box>
                      <Text fontSize="sm" fontWeight="600" mb={2} color="text.secondary">Defense</Text>
                      <SimpleGrid columns={{ base: 2, md: 4 }} gap={4}>
                        {ps.tackles > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Tackles</Text>
                            <Text fontSize="lg" fontWeight="600">{ps.tackles}</Text>
                          </Box>
                        )}
                        {ps.sacks > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Sacks</Text>
                            <Text fontSize="lg" fontWeight="600">{ps.sacks}</Text>
                          </Box>
                        )}
                        {ps.interceptions > 0 && (
                          <Box>
                            <Text fontSize="xs" color="text.secondary">Interceptions</Text>
                            <Text fontSize="lg" fontWeight="600">{ps.interceptions}</Text>
                          </Box>
                        )}
                      </SimpleGrid>
                    </Box>
                  )}
                </Stack>
              </SectionCard>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
};

export default PlayerStatsScreen;
