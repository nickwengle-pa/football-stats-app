import React from 'react';
import { SimpleGrid, Button, Text, VStack, Box } from '@chakra-ui/react';
import { PlayType } from '../models';

interface PlayResult {
  label: string;
  type: PlayType;
  yardsModifier?: number; // How many yards this typically represents (can be overridden)
  color: string;
  category: 'gain' | 'loss' | 'score' | 'turnover' | 'special';
}

const playResults: PlayResult[] = [
  // Positive plays
  { label: 'Gain', type: PlayType.RUSH, yardsModifier: 1, color: 'green.500', category: 'gain' },
  { label: '1st Down', type: PlayType.RUSH, yardsModifier: 10, color: 'blue.500', category: 'gain' },
  
  // No change
  { label: 'No Gain', type: PlayType.RUSH, yardsModifier: 0, color: 'gray.500', category: 'gain' },
  
  // Negative plays
  { label: 'Loss', type: PlayType.RUSH, yardsModifier: -2, color: 'orange.500', category: 'loss' },
  { label: 'Sacked', type: PlayType.SACK, yardsModifier: -5, color: 'red.500', category: 'loss' },
  
  // Scoring plays
  { label: 'TouchDown', type: PlayType.RUSH_TD, yardsModifier: 0, color: 'yellow.500', category: 'score' },
  { label: 'Extra Point', type: PlayType.EXTRA_POINT_KICK_MADE, yardsModifier: 0, color: 'cyan.500', category: 'score' },
  { label: 'Safety', type: PlayType.SAFETY, yardsModifier: 0, color: 'red.600', category: 'score' },
  
  // Turnovers
  { label: 'Fumble/Rec', type: PlayType.FUMBLE_RECOVERY, yardsModifier: 0, color: 'purple.500', category: 'turnover' },
  { label: 'Fumble/Lost', type: PlayType.FUMBLE_RECOVERY, yardsModifier: 0, color: 'red.700', category: 'turnover' },
  { label: 'Fumbled Snap', type: PlayType.BAD_SNAP, yardsModifier: 0, color: 'red.800', category: 'turnover' },
  
  // Special plays
  { label: 'Ran OB', type: PlayType.RUSH, yardsModifier: 0, color: 'teal.500', category: 'special' },
  { label: 'Kneel', type: PlayType.KNEEL, yardsModifier: -1, color: 'gray.600', category: 'special' },
  { label: 'No Play', type: PlayType.OTHER, yardsModifier: 0, color: 'gray.700', category: 'special' },
];

interface PlayResultGridProps {
  onResultSelect: (type: PlayType, yardsModifier?: number, label?: string) => void;
  disabled?: boolean;
}

export const PlayResultGrid: React.FC<PlayResultGridProps> = ({
  onResultSelect,
  disabled = false,
}) => {
  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'gain': return 'green';
      case 'loss': return 'orange';
      case 'score': return 'yellow';
      case 'turnover': return 'red';
      case 'special': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <Box>
      <Text fontSize={{ base: 'xs', md: 'sm' }} fontWeight="600" color="text.secondary" mb={2}>
        Play Results
      </Text>
      {/* Optimized for iPad: 4 columns portrait, 5 landscape. iPhone: 3 columns */}
      <SimpleGrid columns={{ base: 3, sm: 4, lg: 5 }} gap={{ base: 2, md: 3 }}>
        {playResults.map((result) => (
          <Button
            key={result.label}
            // Larger buttons for touch - minimum 44px tap target (Apple HIG)
            size={{ base: 'md', md: 'lg' }}
            h={{ base: '48px', md: '56px' }}
            colorScheme={getCategoryColor(result.category)}
            variant="solid"
            onClick={() => onResultSelect(result.type, result.yardsModifier, result.label)}
            disabled={disabled}
            // Touch feedback
            _active={{
              transform: 'scale(0.95)',
              boxShadow: 'inner',
            }}
            _hover={{
              transform: 'translateY(-1px)',
              boxShadow: 'lg',
            }}
            transition="all 0.15s"
            fontSize={{ base: 'sm', md: 'md' }}
            fontWeight="600"
          >
            {result.label}
          </Button>
        ))}
      </SimpleGrid>
    </Box>
  );
};
