import React, { useMemo } from 'react';
import { Box, Text, Badge, HStack, Button } from '@chakra-ui/react';
import { Play, Game } from '../models';
import { Table } from '@chakra-ui/react';

interface EnhancedPlayByPlayTableProps {
  game: Game;
  teamName: string;
  opponentName: string;
  onEditPlay?: (play: Play) => void;
  onDeletePlay?: (playId: string) => void;
}

const formatClock = (seconds?: number): string => {
  if (seconds === undefined) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatYardLine = (yard?: number): string => {
  if (yard === undefined) return '--';
  if (yard === 50) return '50';
  return yard < 50 ? `${yard}` : `${100 - yard}`;
};

export const EnhancedPlayByPlayTable: React.FC<EnhancedPlayByPlayTableProps> = ({
  game,
  teamName,
  opponentName,
  onEditPlay,
  onDeletePlay,
}) => {
  const playsWithNumbers = useMemo(() => {
    return game.plays.map((play, index) => ({
      ...play,
      playNumber: index + 1,
    }));
  }, [game.plays]);

  const getTacklerNames = (play: Play): string => {
    if (!play.participants) return '--';
    const tacklers = play.participants.filter(p => p.role === 'tackler' || p.role === 'assist');
    if (tacklers.length === 0) return '--';
    
    // This would need actual player name lookup from roster
    return tacklers.map(t => `#${t.playerId.slice(-3)}`).join(', ');
  };

  return (
    <Box overflowX="auto" border="1px solid" borderColor="border.subtle" borderRadius="md" bg="white">
      <Table.Root size="sm" variant="outline">
        <Table.Header bg="gray.100">
          <Table.Row>
            <Table.ColumnHeader color="gray.800">#</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Team</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Clock</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">H</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">V</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Down/TS</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">On</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Type</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Yds</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800" minW="300px">Event</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Tackled by</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Formation</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Defense</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Hash</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Start</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">End</Table.ColumnHeader>
            <Table.ColumnHeader color="gray.800">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {playsWithNumbers.length === 0 ? (
            <Table.Row>
              <Table.Cell colSpan={17} textAlign="center" py={8}>
                <Text color="gray.600">No plays logged yet</Text>
              </Table.Cell>
            </Table.Row>
          ) : (
            playsWithNumbers.slice().reverse().map((play) => {
              const isHomePlay = play.teamSide === 'home';
              const teamLabel = isHomePlay ? teamName : opponentName;
              
              // Calculate current score at this play
              const playsUpTo = game.plays.slice(0, play.playNumber);
              let homeScore = 0;
              let oppScore = 0;
              playsUpTo.forEach(p => {
                // This is simplified - you'd use your actual scoring logic
                if (p.type === 'rush_td' || p.type === 'pass_td') {
                  if (p.teamSide === 'home') homeScore += 6;
                  else oppScore += 6;
                }
              });

              return (
                <Table.Row key={play.id} _hover={{ bg: 'gray.50' }}>
                  <Table.Cell fontWeight="600" color="gray.900">{play.playNumber}</Table.Cell>
                  <Table.Cell>
                    <Badge colorScheme={isHomePlay ? 'blue' : 'orange'} fontSize="xs">
                      {teamLabel.slice(0, 3).toUpperCase()}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell fontFamily="mono" color="gray.900">{formatClock(play.playStartTime)}</Table.Cell>
                  <Table.Cell fontWeight="600" color="gray.900">{game.homeScore}</Table.Cell>
                  <Table.Cell fontWeight="600" color="gray.900">{game.oppScore}</Table.Cell>
                  <Table.Cell color="gray.900">
                    {play.down && play.distance ? `${play.down}-${play.distance}` : '--'}
                  </Table.Cell>
                  <Table.Cell color="gray.900">{formatYardLine(play.yardLine)}</Table.Cell>
                  <Table.Cell>
                    <Text fontSize="xs" textTransform="uppercase" color="gray.900">
                      {play.type.replace(/_/g, ' ')}
                    </Text>
                  </Table.Cell>
                  <Table.Cell fontWeight="600" color={play.yards >= 0 ? 'green.600' : 'red.600'}>
                    {play.yards > 0 ? '+' : ''}{play.yards}
                  </Table.Cell>
                  <Table.Cell maxW="300px">
                    <Text fontSize="sm" lineClamp={2} color="gray.900">
                      {play.description}
                    </Text>
                  </Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{getTacklerNames(play)}</Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{play.offensiveFormation || '--'}</Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{play.defensiveFormation || '--'}</Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{play.hashMark ? play.hashMark[0].toUpperCase() : '--'}</Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{formatYardLine(play.yardLine)}</Table.Cell>
                  <Table.Cell fontSize="xs" color="gray.900">{formatYardLine(play.endYardLine)}</Table.Cell>
                  <Table.Cell>
                    <HStack gap={1}>
                      {onEditPlay && (
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="blue"
                          onClick={() => onEditPlay(play)}
                        >
                          Edit
                        </Button>
                      )}
                      {onDeletePlay && (
                        <Button
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={() => onDeletePlay(play.id)}
                        >
                          Del
                        </Button>
                      )}
                    </HStack>
                  </Table.Cell>
                </Table.Row>
              );
            })
          )}
        </Table.Body>
      </Table.Root>
    </Box>
  );
};
