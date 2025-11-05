import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore';
import {
  Box,
  Button,
  Center,
  Grid,
  GridItem,
  Spinner,
  Stack,
  Text,
  chakra,
  Image,
} from '@chakra-ui/react';
import { Game, Play } from '../models';
import { subscribeToGame, saveGame } from '../services/dbService';
import {
  addPlayAndRecalc,
  editPlayAndRecalc,
  undoLastPlay,
} from '../services/statsService';
import { PageHeader, SectionCard } from './ui';
import { useProgram } from '../context/ProgramContext';

type FeedbackState = {
  status: 'success' | 'error';
  message: string;
};

const resolveOpponent = (game: Game) =>
  game.opponentName ?? game.opponent ?? 'TBD Opponent';

const formatTime = (timestamp: Timestamp) =>
  timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const quickActions = [
  { label: 'Run +5', type: 'Run', yards: 5, color: 'brand.primary' },
  { label: 'Pass +10', type: 'Pass Complete', yards: 10, color: 'brand.secondary' },
  { label: 'Tackle -2', type: 'Tackle', yards: -2, color: 'red.500' },
];

const ScoringScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const {
    team,
    teamLoading,
    teamError,
    activeSeasonId,
    branding,
  } = useProgram();

  const teamId = team?.id ?? null;
  const teamName = team?.name ?? 'Our Team';
  const logoUrl = branding.logoUrl;
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<Game[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0f7a27';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff';
    for (let yard = 10; yard < 100; yard += 10) {
      const x = (yard / 100) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  }, [game?.plays.length]);

  const opponentName = useMemo(() => (game ? resolveOpponent(game) : 'Opponent'), [game]);

  const handleAddPlay = async (type: string, yards: number) => {
    if (!game || !teamId || !activeSeasonId) return;
    const play: Play = {
      id: uuidv4(),
      type,
      yards,
      playerId: 'placeholder',
      description: `${type} for ${yards} yards`,
      timestamp: Timestamp.now(),
    };

    try {
      const nextGame = addPlayAndRecalc(game, play);
      setHistory((prev) => [...prev, game]);
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: `${type} recorded.` });
    } catch (error) {
      console.error('Failed to add play', error);
      setFeedback({ status: 'error', message: 'Unable to add play. Try again.' });
    }
  };

  const handleUndo = async () => {
    if (!game || history.length === 0 || !teamId || !activeSeasonId) return;
    const previous = history[history.length - 1];
    const reverted = undoLastPlay(game);
    setGame(reverted);
    setHistory((prev) => prev.slice(0, -1));
    try {
      await saveGame(reverted, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Last play removed.' });
    } catch (error) {
      console.error('Failed to undo play', error);
      setFeedback({ status: 'error', message: 'Unable to undo play.' });
      setGame(previous);
      setHistory((prev) => [...prev, previous]);
    }
  };

  const handleEditPlay = async (playId: string, updates: Partial<Play>) => {
    if (!game || !teamId || !activeSeasonId) return;
    try {
      const updatedGame = editPlayAndRecalc(game, playId, updates);
      setGame(updatedGame);
      await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Play updated.' });
    } catch (error) {
      console.error('Failed to edit play', error);
      setFeedback({ status: 'error', message: 'Unable to edit play.' });
    }
  };

  if (teamLoading) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" />
          <Text color="text.secondary">Loading team...</Text>
        </Stack>
      </Center>
    );
  }

  if (teamError && !team) {
    return (
      <SectionCard title="Live Scoring">
        <Text color="text.secondary">{teamError}</Text>
      </SectionCard>
    );
  }

  if (gameId === 'new') {
    return (
      <SectionCard title="Live Scoring">
        <Stack gap={3} align="center">
          <Text fontWeight="600">Select a game from the schedule</Text>
          <Text color="text.secondary" textAlign="center">
            Schedule a game or choose an existing matchup to start tracking plays.
          </Text>
          <Button
            variant="outline"
            borderColor="brand.primary"
            color="brand.primary"
            onClick={() => navigate('/')}
          >
            Back to Schedule
          </Button>
        </Stack>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" />
          <Text color="text.secondary">Loading game...</Text>
        </Stack>
      </Center>
    );
  }

  if (!game) {
    return (
      <SectionCard title="Live Scoring">
        <Text color="text.secondary">Game not found. Return to the schedule and select a game.</Text>
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
        title="Live Scoring"
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
          <Button variant="outline" borderColor="brand.primary" color="brand.primary" onClick={() => navigate('/')}>
            Back to Schedule
          </Button>
        }
      />

      <SectionCard title="Scoreboard">
        <Stack
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align={{ base: 'flex-start', md: 'center' }}
          gap={6}
        >
          <Stack gap={2} align="center">
            {logoUrl && (
              <Image
                src={logoUrl}
                alt={`${teamName} logo`}
                boxSize="64px"
                objectFit="contain"
                borderRadius="md"
                border="1px solid"
                borderColor="border.subtle"
                bg="white"
                p={2}
              />
            )}
            <Text fontSize="sm" color="text.secondary">
              {teamName}
            </Text>
            <Text fontSize="3xl" fontWeight="700">
              {game.homeScore}
            </Text>
          </Stack>
          <Stack gap={1} align="center">
            <Text fontSize="sm" color="text.secondary">
              {opponentName}
            </Text>
            <Text fontSize="3xl" fontWeight="700">
              {game.oppScore}
            </Text>
          </Stack>
          <Stack gap={1} align="center">
            <Text fontSize="sm" color="text.secondary">
              Plays Logged
            </Text>
            <Text fontSize="3xl" fontWeight="700">
              {game.plays.length}
            </Text>
          </Stack>
        </Stack>
        <Box mt={6}>
          <chakra.canvas ref={canvasRef} width={600} height={140} borderRadius="md" />
        </Box>
      </SectionCard>

      <SectionCard title="Quick Actions">
        <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }} gap={3}>
          {quickActions.map((action) => (
            <GridItem key={action.label}>
              <Button
                width="100%"
                bg={action.color === 'brand.primary' ? branding.primaryColor : action.color === 'brand.secondary' ? branding.secondaryColor : action.color}
                color="white"
                onClick={() => handleAddPlay(action.type, action.yards)}
              >
                {action.label}
              </Button>
            </GridItem>
          ))}
        </Grid>
        <Button variant="outline" borderColor="brand.primary" color="brand.primary" mt={4} onClick={handleUndo}>
          Undo Last Play
        </Button>
        {feedback && (
          <Box
            mt={4}
            border="1px solid"
            borderColor={feedback.status === 'success' ? 'brand.primary' : 'red.400'}
            borderRadius="md"
            px={4}
            py={3}
            bg="brand.surface"
          >
            <Text color={feedback.status === 'success' ? 'brand.primary' : 'red.600'} fontSize="sm">
              {feedback.message}
            </Text>
          </Box>
        )}
      </SectionCard>

      <SectionCard title="Play-by-Play">
        {game.plays.length === 0 ? (
          <Text fontSize="sm" color="text.secondary">
            No plays logged yet. Use the quick actions to start tracking the drive.
          </Text>
        ) : (
          <Stack gap={3}>
            {game.plays
              .slice()
              .reverse()
              .map((play) => (
                <Stack
                  key={play.id}
                  direction={{ base: 'column', md: 'row' }}
                  justify="space-between"
                  align={{ base: 'flex-start', md: 'center' }}
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="md"
                  px={4}
                  py={3}
                  bg="bg.surface"
                >
                  <Stack gap={1}>
                    <Text fontWeight="600">{play.description}</Text>
                    <Text fontSize="sm" color="text.secondary">
                      Logged at {formatTime(play.timestamp)}
                    </Text>
                  </Stack>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="brand.primary"
                    onClick={() => handleEditPlay(play.id, { yards: play.yards + 1 })}
                  >
                    +1 Yard
                  </Button>
                </Stack>
              ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
};

export default ScoringScreen;







