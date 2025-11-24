import React, { useState } from 'react';
import { Box, Button, Grid, HStack, Text, VStack } from '@chakra-ui/react';

interface YardKeypadProps {
  onSubmit: (value: number, side: 'PL' | 'CT') => void;
  onClose: () => void;
  label?: string;
  initialSide?: 'PL' | 'CT';
}

export const YardKeypad: React.FC<YardKeypadProps> = ({ 
  onSubmit, 
  onClose, 
  label = 'Enter Yards',
  initialSide = 'PL'
}) => {
  const [value, setValue] = useState('');
  const [side, setSide] = useState<'PL' | 'CT'>(initialSide);

  const handleNumberClick = (num: string) => {
    if (value.length < 3) {
      setValue(value + num);
    }
  };

  const handleClear = () => {
    setValue('');
  };

  const handleBackspace = () => {
    setValue(value.slice(0, -1));
  };

  const handleSubmit = () => {
    const numValue = parseInt(value) || 0;
    if (numValue >= 0 && numValue <= 50) {
      onSubmit(numValue, side);
      setValue('');
    }
  };

  const displayValue = value || '0';

  return (
    <Box
      position="fixed"
      bottom="0"
      left="0"
      right="0"
      bg="rgba(0, 0, 0, 0.95)"
      borderTop="2px solid"
      borderColor="purple.500"
      p={4}
      zIndex={9999}
      maxW="500px"
      mx="auto"
    >
      <VStack gap={3} align="stretch">
        {/* Label */}
        <Text fontSize="sm" color="gray.400" textAlign="center">
          {label}
        </Text>

        {/* Side Selection */}
        <HStack justify="center" gap={2}>
          <Button
            size="lg"
            flex={1}
            bg={side === 'PL' ? 'blue.600' : 'gray.700'}
            color="white"
            _hover={{ bg: side === 'PL' ? 'blue.500' : 'gray.600' }}
            onClick={() => setSide('PL')}
            fontWeight="bold"
          >
            PL
          </Button>
          <Button
            size="lg"
            flex={1}
            bg={side === 'CT' ? 'orange.600' : 'gray.700'}
            color="white"
            _hover={{ bg: side === 'CT' ? 'orange.500' : 'gray.600' }}
            onClick={() => setSide('CT')}
            fontWeight="bold"
          >
            CT
          </Button>
        </HStack>

        {/* Display */}
        <Box
          bg="rgba(0, 0, 0, 0.5)"
          border="2px solid"
          borderColor="purple.400"
          borderRadius="md"
          p={4}
          textAlign="center"
        >
          <Text fontSize="3xl" fontWeight="bold" color="white" fontFamily="mono">
            {side} {displayValue}
          </Text>
        </Box>

        {/* Number Pad */}
        <Grid templateColumns="repeat(3, 1fr)" gap={2}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <Button
              key={num}
              size="lg"
              fontSize="xl"
              bg="gray.700"
              color="white"
              _hover={{ bg: 'gray.600' }}
              _active={{ bg: 'gray.500' }}
              onClick={() => handleNumberClick(num)}
              h="60px"
            >
              {num}
            </Button>
          ))}
          <Button
            size="lg"
            fontSize="xl"
            bg="red.700"
            color="white"
            _hover={{ bg: 'red.600' }}
            _active={{ bg: 'red.500' }}
            onClick={handleClear}
            h="60px"
          >
            CLR
          </Button>
          <Button
            size="lg"
            fontSize="xl"
            bg="gray.700"
            color="white"
            _hover={{ bg: 'gray.600' }}
            _active={{ bg: 'gray.500' }}
            onClick={() => handleNumberClick('0')}
            h="60px"
          >
            0
          </Button>
          <Button
            size="lg"
            fontSize="xl"
            bg="orange.700"
            color="white"
            _hover={{ bg: 'orange.600' }}
            _active={{ bg: 'orange.500' }}
            onClick={handleBackspace}
            h="60px"
          >
            ⌫
          </Button>
        </Grid>

        {/* Action Buttons */}
        <HStack gap={2}>
          <Button
            flex={1}
            size="lg"
            bg="gray.600"
            color="white"
            _hover={{ bg: 'gray.500' }}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            flex={2}
            size="lg"
            bg="green.600"
            color="white"
            _hover={{ bg: 'green.500' }}
            onClick={handleSubmit}
            disabled={!value}
          >
            Enter
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};
