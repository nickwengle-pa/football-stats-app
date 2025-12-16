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
import { buildSeasonStatsExport, SeasonStatsExport } from '../services/seasonStatsService';
import { 
  generatePublicSiteHtml, 
  downloadPublicSiteHtml, 
  previewPublicSite 
} from '../services/publicSiteGenerator';
import {
  isCloudflareConfigured,
  publishToCloudflare,
} from '../services/cloudflarePublishService';
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
  const [publishLoading, setPublishLoading] = useState(false);
  const [statsGenerated, setStatsGenerated] = useState(false);
  const [gamesCount, setGamesCount] = useState(0);
  const [playersCount, setPlayersCount] = useState(0);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  
  const teamId = team?.id;
  const teamName = team?.name || 'Team';
  const mascot = team?.mascot;
  
  const canPublish = teamId && activeSeasonId && activeSeason;
  const cloudflareEnabled = isCloudflareConfigured();
  
  const generateStats = useCallback(async (): Promise<SeasonStatsExport | null> => {
    if (!teamId || !activeSeasonId || !activeSeason) {
      showErrorToast('Please select a season to publish');
      return null;
    }
    
    setLoading(true);
    try {
      const games = await getGames({ teamId, seasonId: activeSeasonId });
      const roster = await getSeasonRoster(teamId, activeSeasonId);
      
      if (games.length === 0) {
        showInfoToast('No games found for this season');
        setLoading(false);
        return null;
      }
      
      setGamesCount(games.length);
      setPlayersCount(roster.length);
      
      const exportData = buildSeasonStatsExport(
        games,
        roster,
        teamName,
        activeSeason,
        branding,
        mascot
      );
      
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
  
  const handlePublishToCloudflare = useCallback(async () => {
    setPublishLoading(true);
    setPublishedUrl(null);
    
    try {
      const exportData = await generateStats();
      if (!exportData) {
        setPublishLoading(false);
        return;
      }
      
      const result = await publishToCloudflare(exportData);
      
      if (result.success && result.url) {
        setPublishedUrl(result.url);
        showSuccessToast('Published to Cloudflare!');
      } else {
        showErrorToast(result.error || 'Failed to publish');
      }
    } catch (error) {
      console.error('Publish error:', error);
      showErrorToast('Failed to publish. Please try again.');
    } finally {
      setPublishLoading(false);
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
        
        {publishedUrl && (
          <Box 
            bg="blue.50" 
            p={3} 
            borderRadius="md"
            borderLeft="4px solid"
            borderColor="blue.400"
          >
            <Text fontSize="sm" color="blue.800" mb={2}>
              <strong>Published!</strong>
            </Text>
            <a 
              href={publishedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#2563eb',
                textDecoration: 'underline',
                fontSize: '0.875rem',
                wordBreak: 'break-all',
                display: 'block'
              }}
            >
              {publishedUrl}
            </a>
          </Box>
        )}
        
        <Text fontSize="sm" color="gray.600">
          Generate a static HTML page with your season schedule, 
          team leaders, player statistics, and roster.
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
          
          {cloudflareEnabled && (
            <Button
              colorScheme="orange"
              onClick={handlePublishToCloudflare}
              disabled={publishLoading}
              size="md"
            >
              {publishLoading ? <Spinner size="sm" mr={2} /> : null}
              Publish to Web
            </Button>
          )}
        </HStack>
        
        {!cloudflareEnabled && (
          <Box 
            bg="gray.50" 
            p={3} 
            borderRadius="md" 
            fontSize="xs" 
            color="gray.500"
          >
            <Text>
              💡 To enable direct web publishing, set REACT_APP_CLOUDFLARE_* environment variables.
            </Text>
          </Box>
        )}
        
        {cloudflareEnabled && (
          <Box 
            bg="green.50" 
            p={3} 
            borderRadius="md" 
            fontSize="sm" 
            color="green.700"
          >
            <Text>
              ✅ One-click publishing enabled! Click <strong>Publish to Web</strong> to deploy directly.
            </Text>
          </Box>
        )}
      </Stack>
    </SectionCard>
  );
};

export default PublishSeason;
