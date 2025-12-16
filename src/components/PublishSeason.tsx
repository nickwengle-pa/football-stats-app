import React, { useState, useCallback } from 'react';
import {
  Button,
  Stack,
  HStack,
  Text,
  Box,
  Spinner,
} from '@chakra-ui/react';
import { useProgram } from '../context/ProgramContext';
import { getGames, getSeasonRoster } from '../services/dbService';
import { buildSeasonStatsExport } from '../services/seasonStatsService';
import { 
  generatePublicSiteHtml, 
  downloadPublicSiteHtml, 
  previewPublicSite 
} from '../services/publicSiteGenerator';
import { SectionCard } from './ui';
import { showSuccessToast, showErrorToast, showInfoToast } from '../utils/toast';

/**
 * PublishSeason Component
 * Generates and exports static HTML stats pages for a season.
 */
export const PublishSeason: React.FC = () => {
  const { team, activeSeason, activeSeasonId, branding } = useProgram();
  
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [statsGenerated, setStatsGenerated] = useState(false);
  const [gamesCount, setGamesCount] = useState(0);
  const [playersCount, setPlayersCount] = useState(0);
  
  const teamId = team?.id;
  const teamName = team?.name || 'Team';
  const mascot = team?.mascot;
  
  const canPublish = teamId && activeSeasonId && activeSeason;
  
  const generateStats = useCallback(async () => {
    if (!teamId || !activeSeasonId || !activeSeason) {
      showErrorToast('Please select a season to publish');
      return null;
    }
    
    setLoading(true);
    try {
      // Fetch all games for the season
      console.log('Fetching games for team:', teamId, 'season:', activeSeasonId);
      const games = await getGames({ teamId, seasonId: activeSeasonId });
      console.log('Games fetched:', games.length, games);
      
      // Fetch roster
      const roster = await getSeasonRoster(teamId, activeSeasonId);
      console.log('Roster fetched:', roster.length, roster);
      
      if (games.length === 0) {
        showInfoToast('No games found for this season');
        setLoading(false);
        return null;
      }
      
      setGamesCount(games.length);
      setPlayersCount(roster.length);
      
      // Build the stats export
      const exportData = buildSeasonStatsExport(
        games,
        roster,
        teamName,
        activeSeason,
        branding,
        mascot
      );
      
      console.log('Export data built:', exportData);
      setStatsGenerated(true);
      return exportData;
    } catch (error) {
      console.error('Error generating stats:', error);
      showErrorToast('Failed to generate stats. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [teamId, activeSeasonId, activeSeason, teamName, mascot, branding]);
  
  const handlePreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const exportData = await generateStats();
      if (exportData) {
        previewPublicSite(exportData);
        showSuccessToast('Preview opened in new window');
      }
    } finally {
      setPreviewLoading(false);
    }
  }, [generateStats]);
  
  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const exportData = await generateStats();
      if (exportData) {
        downloadPublicSiteHtml(exportData);
        showSuccessToast('HTML file downloaded successfully');
      }
    } finally {
      setLoading(false);
    }
  }, [generateStats]);
  
  const handleCopyHtml = useCallback(async () => {
    setLoading(true);
    try {
      const exportData = await generateStats();
      if (exportData) {
        const html = generatePublicSiteHtml(exportData);
        await navigator.clipboard.writeText(html);
        showSuccessToast('HTML copied to clipboard');
      }
    } finally {
      setLoading(false);
    }
  }, [generateStats]);
  
  if (!canPublish) {
    return (
      <SectionCard title="Publish Season Stats">
        <Text color="gray.500">
          Select a team and season to publish stats to the web.
        </Text>
      </SectionCard>
    );
  }
  
  return (
    <SectionCard title="Publish Season Stats">
      <Stack gap={4}>
        <Box>
          <Text fontWeight="600" mb={1}>{teamName}</Text>
          <Text color="gray.600" fontSize="sm">
            {activeSeason.year} {activeSeason.label} ({activeSeason.level})
          </Text>
        </Box>
        
        {statsGenerated && (
          <Box 
            bg="green.50" 
            p={3} 
            borderRadius="md" 
            borderLeft="4px solid" 
            borderColor="green.400"
          >
            <Text fontSize="sm" color="green.800">
              Stats generated: {gamesCount} games, {playersCount} players
            </Text>
          </Box>
        )}
        
        <Text fontSize="sm" color="gray.600">
          Generate a static HTML page with your season schedule, 
          team leaders, player statistics, and roster. The page can be hosted 
          anywhere or shared directly.
        </Text>
        
        <HStack gap={3} flexWrap="wrap">
          <Button
            colorScheme="blue"
            onClick={handlePreview}
            disabled={loading || previewLoading}
            size="md"
          >
            {previewLoading ? <Spinner size="sm" mr={2} /> : null}
            Preview
          </Button>
          
          <Button
            colorScheme="green"
            onClick={handleDownload}
            disabled={loading}
            size="md"
          >
            {loading ? <Spinner size="sm" mr={2} /> : null}
            Download HTML
          </Button>
          
          <Button
            variant="outline"
            onClick={handleCopyHtml}
            disabled={loading}
            size="md"
          >
            Copy to Clipboard
          </Button>
        </HStack>
        
        <Box 
          bg="gray.50" 
          p={3} 
          borderRadius="md" 
          fontSize="sm" 
          color="gray.600"
        >
          <Text fontWeight="500" mb={1}>Publishing Options:</Text>
          <Text>
            • <strong>Preview</strong> - Opens the stats page in a new window<br/>
            • <strong>Download HTML</strong> - Save as a single HTML file<br/>
            • <strong>Copy to Clipboard</strong> - Paste into any hosting service
          </Text>
        </Box>
      </Stack>
    </SectionCard>
  );
};

export default PublishSeason;
