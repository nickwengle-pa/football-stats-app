import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, Center, Spinner, Text, Stack } from '@chakra-ui/react';
import GameList from './components/GameList';
import ScoringScreen from './components/ScoringScreen';
import ReportsScreen from './components/ReportsScreen';
import PlayerStatsScreen from './components/PlayerStatsScreen';
import TeamManager from './components/TeamManager';
import CleanDuplicatePlays from './components/CleanDuplicatePlays';
import { AppShell } from './components/layout/AppShell';
import { ProgramProvider, useProgram } from './context/ProgramContext';
import { ErrorBoundary, SectionErrorBoundary } from './components/ErrorBoundary';
import { toaster } from './utils/toast';

const AppRoutes: React.FC = () => {
  const {
    team,
    teamLoading,
    teamError,
    branding,
  } = useProgram();

  if (teamLoading && !team) {
    return (
      <Center minH="100vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" size="lg" />
          <Text color="text.secondary">Loading program...</Text>
        </Stack>
      </Center>
    );
  }

  if (!team && teamError) {
    return (
      <Center minH="100vh">
        <Stack align="center" gap={3}>
          <Text fontWeight="600">Program setup required</Text>
          <Text color="text.secondary">{teamError}</Text>
        </Stack>
      </Center>
    );
  }

  const programName = team?.name ?? 'PL Football';

  return (
    <AppShell branding={branding} teamName={programName}>
      <Box className="App">
        <Routes>
          <Route path="/" element={
            <SectionErrorBoundary>
              <GameList />
            </SectionErrorBoundary>
          } />
          <Route path="/team" element={
            <SectionErrorBoundary>
              <TeamManager />
            </SectionErrorBoundary>
          } />
          <Route path="/scoring/:gameId" element={
            <SectionErrorBoundary>
              <ScoringScreen />
            </SectionErrorBoundary>
          } />
          <Route path="/stats/:gameId" element={
            <SectionErrorBoundary>
              <PlayerStatsScreen />
            </SectionErrorBoundary>
          } />
          <Route path="/reports/:gameId" element={
            <SectionErrorBoundary>
              <ReportsScreen />
            </SectionErrorBoundary>
          } />
          <Route path="/clean-duplicates" element={
            <SectionErrorBoundary>
              <CleanDuplicatePlays />
            </SectionErrorBoundary>
          } />
        </Routes>
      </Box>
    </AppShell>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ProgramProvider>
        <Router>
          <AppRoutes />
        </Router>
      </ProgramProvider>
      {toaster.Toaster && <toaster.Toaster />}
    </ErrorBoundary>
  );
}

export default App;
