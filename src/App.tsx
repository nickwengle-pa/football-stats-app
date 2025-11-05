import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box, Center, Spinner, Text, Stack } from '@chakra-ui/react';
import GameList from './components/GameList';
import ScoringScreen from './components/ScoringScreen';
import ReportsScreen from './components/ReportsScreen';
import TeamManager from './components/TeamManager';
import { AppShell } from './components/layout/AppShell';
import { ProgramProvider, useProgram } from './context/ProgramContext';

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
          <Route path="/" element={<GameList />} />
          <Route path="/team" element={<TeamManager />} />
          <Route path="/scoring/:gameId" element={<ScoringScreen />} />
          <Route path="/reports/:gameId" element={<ReportsScreen />} />
        </Routes>
      </Box>
    </AppShell>
  );
};

function App() {
  return (
    <ProgramProvider>
      <Router>
        <AppRoutes />
      </Router>
    </ProgramProvider>
  );
}

export default App;
