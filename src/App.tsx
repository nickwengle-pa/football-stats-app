import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GameList from './components/GameList';
import ScoringScreen from './components/ScoringScreen';
import ReportsScreen from './components/ReportsScreen';
// Import auth if needed: signInAnonymously(auth);

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<GameList />} />
          <Route path="/scoring/:gameId" element={<ScoringScreen />} />
          <Route path="/reports/:gameId" element={<ReportsScreen game={{} as any} />} /> {/* Pass game */}
        </Routes>
      </div>
    </Router>
  );
}

export default App;