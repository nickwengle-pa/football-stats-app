import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import {
  Button,
  Center,
  HStack,
  Spinner,
  Stack,
  Text,
  Image,
} from '@chakra-ui/react';
import { subscribeToGame } from '../services/dbService';
import { Game } from '../models';
import { PageHeader, SectionCard, DataTable, DataTableColumn } from './ui';
import { useProgram } from '../context/ProgramContext';
import { getOpponentName } from '../utils/gameUtils';

type PlayRow = {
  description: string;
  timestamp: string;
};

const buildPdf = (game: Game, teamName: string, opponent: string) => {
  const doc = new jsPDF();
  const title = `${teamName} vs ${opponent}`;
  doc.setFontSize(16);
  doc.text(title, 10, 15);
  doc.setFontSize(12);
  const dateLine = game.date
    ? game.date.toDate().toLocaleString()
    : 'Date TBD';
  doc.text(`Kickoff: ${dateLine}`, 10, 25);
  doc.text(`Final Score: ${game.homeScore} - ${game.oppScore}`, 10, 35);

  doc.text('Play-by-Play', 10, 50);
  doc.setFontSize(10);
  game.plays.forEach((play, index) => {
    const line = `${index + 1}. ${play.description} (${play.timestamp.toDate().toLocaleTimeString()})`;
    const y = 60 + index * 6;
    if (y > 280) {
      doc.addPage();
      doc.text('Play-by-Play (cont.)', 10, 20);
    }
    doc.text(line, 10, (y % 280) + (y > 280 ? 20 : 0));
  });

  doc.save(`game-report-${game.id}.pdf`);
};

const ReportsScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { team, teamLoading, teamError, activeSeasonId, branding } = useProgram();
  const navigate = useNavigate();
  const teamId = team?.id ?? null;
  const teamName = team?.name ?? 'Our Team';
  const logoUrl = branding.logoUrl;

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const opponentName = useMemo(
    () => (game ? getOpponentName(game) : 'Opponent'),
    [game]
  );

  const playRows: PlayRow[] = useMemo(
    () =>
      game
        ? game.plays.map((play) => ({
            description: play.description,
            timestamp: play.timestamp.toDate().toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit',
            }),
          }))
        : [],
    [game]
  );

  const columns: DataTableColumn<PlayRow>[] = useMemo(
    () => [
      {
        header: 'Description',
        accessor: (row) => row.description,
      },
      {
        header: 'Logged At',
        accessor: (row) => row.timestamp,
        width: '160px',
      },
    ],
    []
  );

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
      <SectionCard title="Game Reports">
        <Text color="text.secondary">{teamError}</Text>
      </SectionCard>
    );
  }

  if (gameId === 'new') {
    return (
      <SectionCard title="Game Reports">
        <Stack gap={3} align="center">
          <Text fontWeight="600">Select a completed game</Text>
          <Text color="text.secondary" textAlign="center">
            Choose a matchup from the schedule to generate detailed reports and exports.
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
          <Text color="text.secondary">Loading report...</Text>
        </Stack>
      </Center>
    );
  }

  if (!game) {
    return (
      <SectionCard title="Game Reports">
        <Text color="text.secondary">Game not found. Select a different matchup from the schedule.</Text>
      </SectionCard>
    );
  }

  const kickoffDate = game.date
    ? game.date.toDate().toLocaleString()
    : 'Date TBD';

  return (
    <Stack gap={6}>
      <PageHeader
        title="Game Reports"
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
        subtitle={`${teamName} vs ${opponentName}`}
        actions={
          <Button
            bg="brand.primary"
            color="white"
            onClick={() => buildPdf(game, teamName, opponentName)}
          >
            Generate PDF
          </Button>
        }
      />

      <SectionCard title="Summary">
        <Stack gap={2}>
          <HStack justify="space-between">
            <Text fontWeight="600">Kickoff</Text>
            <Text color="text.secondary">{kickoffDate}</Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontWeight="600">Result</Text>
            <Text color="text.secondary">
              {game.homeScore} - {game.oppScore}
            </Text>
          </HStack>
          <HStack justify="space-between">
            <Text fontWeight="600">Total Plays Logged</Text>
            <Text color="text.secondary">{game.plays.length}</Text>
          </HStack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Play-by-Play"
        description="Review every snap captured in the scoring interface."
      >
        <DataTable
          data={playRows}
          columns={columns}
          emptyState={
            <Stack gap={3} align="center">
              <Text fontWeight="600">No plays recorded</Text>
              <Text fontSize="sm" color="text.secondary" textAlign="center">
                Log plays from the live scoring screen to build the report history.
              </Text>
            </Stack>
          }
        />
      </SectionCard>

      <SectionCard
        title="Exports"
        description="Download the official PDF report or integrate with external systems."
      >
        <Stack direction={{ base: 'column', md: 'row' }} gap={3}>
          <Button
            variant="outline"
            borderColor="brand.primary"
            color="brand.primary"
            onClick={() => buildPdf(game, teamName, opponentName)}
          >
            Export PDF Summary
          </Button>
          <Button variant="ghost" color="brand.primary" disabled>
            Export CSV (coming soon)
          </Button>
        </Stack>
      </SectionCard>
    </Stack>
  );
};

export default ReportsScreen;
