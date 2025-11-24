import React from 'react';
import { Box, Grid, GridItem, Text, VStack, HStack, Button } from '@chakra-ui/react';
import { Game } from '../models';

interface GameStatsBoardProps {
  game: Game;
  teamName: string;
  opponentName: string;
  currentQuarter: number;
  timeRemaining: number;
  homeTimeouts: number;
  awayTimeouts: number;
  homeTopSeconds: number;
  awayTopSeconds: number;
  onTimeoutClick?: (team: 'home' | 'away') => void;
}

const formatClock = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTop = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatQuarterLabel = (quarter: number): string => {
  if (quarter <= 4) return `Q${quarter}`;
  return `OT${quarter - 4}`;
};

export const GameStatsBoard: React.FC<GameStatsBoardProps> = ({
  game,
  teamName,
  opponentName,
  currentQuarter,
  timeRemaining,
  homeTimeouts,
  awayTimeouts,
  homeTopSeconds,
  awayTopSeconds,
  onTimeoutClick,
}) => {
  const homeFirstDowns = game.homeFirstDowns || 0;
  const awayFirstDowns = game.awayFirstDowns || 0;
  
  // Count plays by team
  const homePlays = game.plays.filter(p => p.teamSide === 'home').length;
  const awayPlays = game.plays.filter(p => p.teamSide === 'away').length;

  // Mobile-optimized stat cell with larger touch targets
  const StatCell = ({ label, value, color = 'white', bg = 'rgba(0,0,0,0.6)' }: { label: string; value: string | number; color?: string; bg?: string }) => (
    <VStack gap={0} bg={bg} px={{ base: 2, md: 3 }} py={{ base: 2, md: 3 }} borderRadius="md" border="1px solid" borderColor="whiteAlpha.300" minW={{ base: '60px', md: '80px' }} flex="1">
      <Text fontSize={{ base: '2xs', md: 'xs' }} color="whiteAlpha.700" fontWeight="600">{label}</Text>
      <Text fontSize={{ base: 'xl', md: '2xl' }} fontWeight="700" color={color}>{value}</Text>
    </VStack>
  );

  // Larger touch targets for iPad/iPhone
  const TimeoutIndicators = ({ count, team }: { count: number; team: 'home' | 'away' }) => (
    <HStack gap={{ base: 2, md: 1 }}>
      {[1, 2, 3].map((i) => (
        <Box
          key={i}
          w={{ base: '20px', md: '16px' }}
          h={{ base: '20px', md: '16px' }}
          borderRadius="full"
          bg={i <= count ? 'green.400' : 'whiteAlpha.300'}
          border="2px solid"
          borderColor={i <= count ? 'green.600' : 'whiteAlpha.400'}
          cursor={onTimeoutClick && i <= count ? 'pointer' : 'default'}
          onClick={() => onTimeoutClick && i <= count && onTimeoutClick(team)}
          // Touch-friendly tap area
          _active={{ transform: 'scale(0.9)' }}
          transition="transform 0.1s"
        />
      ))}
    </HStack>
  );

  return (
    <Box
      bg="linear-gradient(135deg, #1a202c 0%, #2d3748 100%)"
      p={{ base: 3, md: 4 }}
      borderRadius="lg"
      border="2px solid"
      borderColor="whiteAlpha.300"
      boxShadow="xl"
    >
      {/* Mobile-first layout: Stack on phone, 2-column on iPad portrait, 3-column on iPad landscape */}
      <Grid 
        templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} 
        gap={{ base: 3, md: 4 }} 
        alignItems="center"
      >
        {/* Center Scoreboard - Shows FIRST on mobile for priority */}
        <GridItem order={{ base: 0, lg: 1 }} gridColumn={{ sm: 'span 2', lg: 'auto' }}>
          <VStack gap={{ base: 2, md: 3 }}>
            {/* Scores - Larger for touch */}
            <HStack justify="center" gap={{ base: 4, md: 6 }}>
              <Box textAlign="center">
                <Text fontSize={{ base: '2xs', md: 'xs' }} color="whiteAlpha.700" mb={1}>{teamName.slice(0, 3).toUpperCase()}</Text>
                <Text fontSize={{ base: '4xl', md: '5xl' }} fontWeight="900" color="red.400">{game.homeScore}</Text>
              </Box>
              <Text fontSize={{ base: '2xl', md: '3xl' }} color="whiteAlpha.500" fontWeight="700">-</Text>
              <Box textAlign="center">
                <Text fontSize={{ base: '2xs', md: 'xs' }} color="whiteAlpha.700" mb={1}>{opponentName.slice(0, 3).toUpperCase()}</Text>
                <Text fontSize={{ base: '4xl', md: '5xl' }} fontWeight="900" color="red.400">{game.oppScore}</Text>
              </Box>
            </HStack>

            {/* Clock - Larger for visibility */}
            <Box
              bg="black"
              px={{ base: 4, md: 6 }}
              py={{ base: 2, md: 3 }}
              borderRadius="md"
              border="2px solid"
              borderColor="green.500"
            >
              <Text fontSize={{ base: '3xl', md: '4xl' }} fontWeight="900" color="green.400" fontFamily="mono">
                {formatClock(timeRemaining)}
              </Text>
            </Box>

            {/* Quarter */}
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color="orange.300">
              {formatQuarterLabel(currentQuarter)}
            </Text>
          </VStack>
        </GridItem>

        {/* Home Team Stats */}
        <GridItem order={{ base: 1, lg: 0 }}>
          <VStack align="stretch" gap={{ base: 1, md: 2 }}>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color="white" textAlign="center" mb={1}>
              {teamName}
            </Text>
            <HStack justify="space-between" wrap="nowrap" gap={{ base: 1, md: 2 }}>
              <StatCell label="TO" value={homeTimeouts} />
              <StatCell label="1ST" value={homeFirstDowns} />
              <StatCell label="PLAYS" value={homePlays} />
              <StatCell label="TIME" value={formatTop(homeTopSeconds)} />
            </HStack>
            <Box textAlign="center" mt={1}>
              <Text fontSize="2xs" color="whiteAlpha.600" mb={1}>TIMEOUTS</Text>
              <TimeoutIndicators count={homeTimeouts} team="home" />
            </Box>
          </VStack>
        </GridItem>

        {/* Opponent Stats */}
        <GridItem order={{ base: 2, lg: 2 }}>
          <VStack align="stretch" gap={{ base: 1, md: 2 }}>
            <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="700" color="white" textAlign="center" mb={1}>
              {opponentName}
            </Text>
            <HStack justify="space-between" wrap="nowrap" gap={{ base: 1, md: 2 }}>
              <StatCell label="TO" value={awayTimeouts} />
              <StatCell label="1ST" value={awayFirstDowns} />
              <StatCell label="PLAYS" value={awayPlays} />
              <StatCell label="TIME" value={formatTop(awayTopSeconds)} />
            </HStack>
            <Box textAlign="center" mt={1}>
              <Text fontSize="2xs" color="whiteAlpha.600" mb={1}>TIMEOUTS</Text>
              <TimeoutIndicators count={awayTimeouts} team="away" />
            </Box>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
};
