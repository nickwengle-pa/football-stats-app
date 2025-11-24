import React, { useState } from 'react';
import { Button, VStack, Text, Box, Code } from '@chakra-ui/react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Play } from '../models';

/**
 * Temporary utility component to clean duplicate plays from a game.
 * Add this to your routes temporarily, run it once, then remove it.
 */
const CleanDuplicatePlays: React.FC = () => {
  const [status, setStatus] = useState<string>('Ready');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog(prev => [...prev, message]);
    console.log(message);
  };

  const cleanDuplicates = async () => {
    try {
      setStatus('Running...');
      setLog([]);

      // Update these with your actual IDs from the URL
      const teamId = 'wnszPCToi72VOKFMX2tg';
      const seasonId = '2025-varsity';
      const gameId = 'f5b185e0-1d66-4486-9a63-d1b09e2eebc0';

      addLog(`Fetching game ${gameId}...`);

      const gameRef = doc(db, 'teams', teamId, 'seasons', seasonId, 'games', gameId);
      const gameSnap = await getDoc(gameRef);

      if (!gameSnap.exists()) {
        addLog('❌ Game not found!');
        setStatus('Error: Game not found');
        return;
      }

      const game = gameSnap.data();
      const plays: Play[] = game.plays || [];

      addLog(`Found ${plays.length} total plays`);

      // Remove duplicates by keeping first occurrence of each ID
      const seenIds = new Set<string>();
      const uniquePlays: Play[] = [];
      const duplicates: string[] = [];

      plays.forEach((play) => {
        if (!seenIds.has(play.id)) {
          seenIds.add(play.id);
          uniquePlays.push(play);
        } else {
          duplicates.push(play.id);
        }
      });

      if (duplicates.length === 0) {
        addLog('✅ No duplicates found! Game is clean.');
        setStatus('Complete - No duplicates found');
        return;
      }

      addLog(`Found ${duplicates.length} duplicate plays:`);
      duplicates.forEach(id => addLog(`  - ${id}`));

      addLog(`\nRemoving duplicates...`);
      addLog(`Before: ${plays.length} plays`);
      addLog(`After: ${uniquePlays.length} plays`);

      // Update the game with deduplicated plays
      await updateDoc(gameRef, {
        plays: uniquePlays
      });

      addLog('✅ Duplicates removed successfully!');
      addLog('Refresh the scoring screen to see the changes.');
      setStatus('Complete - Duplicates removed!');

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error: ${message}`);
      setStatus(`Error: ${message}`);
      console.error(error);
    }
  };

  return (
    <Box p={8} maxW="800px" mx="auto">
      <VStack gap={4} align="stretch">
        <Text fontSize="2xl" fontWeight="bold">Clean Duplicate Plays</Text>
        
        <Text>
          This will remove duplicate plays from the current game in Firestore.
        </Text>

        <Button 
          colorScheme="red" 
          onClick={cleanDuplicates}
          disabled={status === 'Running...'}
        >
          Remove Duplicates
        </Button>

        <Box>
          <Text fontWeight="bold">Status: {status}</Text>
        </Box>

        {log.length > 0 && (
          <Box
            p={4}
            bg="gray.900"
            color="green.300"
            borderRadius="md"
            fontFamily="monospace"
            fontSize="sm"
            maxH="400px"
            overflowY="auto"
          >
            {log.map((line, i) => (
              <Code key={i} display="block" bg="transparent" color="inherit" p={0}>
                {line}
              </Code>
            ))}
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default CleanDuplicatePlays;
