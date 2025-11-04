import React, { useEffect, useState } from 'react';
import { getGames } from '../services/dbService';
import { Game } from '../models';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore'; // Add for Timestamp.now()

const GameList: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getGames().then(setGames);
  }, []);

  const startNewGame = () => {
    const newGame: Game = {
      id: '',
      opponent: 'Opponent', // Prompt for input (add modal later)
      date: Timestamp.now(), // Fix TS2739: Use Timestamp instead of Date
      homePlayers: [], // Add players UI
      plays: [],
      homeScore: 0,
      oppScore: 0,
    };
    // Save first in real impl: saveGame(newGame).then(() => navigate(`/scoring/${newGame.id}`));
    navigate(`/scoring/${newGame.id}`); // Placeholder
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl">Games</h1>
      <button onClick={startNewGame} className="btn btn-primary">Start New Game</button>
      <ul>
        {games.map((g) => (
          <li key={g.id} onClick={() => navigate(`/scoring/${g.id}`)}>
            vs {g.opponent} - {g.date.toDate().toLocaleDateString()} {/* Fix TS2339: Call toDate() first */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GameList;

export {}; // Ensure module