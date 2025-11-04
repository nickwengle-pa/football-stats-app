import React, { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { getGames, saveGame } from '../services/dbService';
import { Game } from '../models';
import { useNavigate } from 'react-router-dom'; // Ensure react-router-dom is installed: npm install react-router-dom @types/react-router-dom

const GameList: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getGames()
      .then((loadedGames) => {
        setGames(loadedGames);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load games', err);
        setError('Unable to load games. Working offline.');
      });
  }, []);

  const startNewGame = async () => {
    setIsCreating(true);
    try {
      const newGame: Game = {
        id: '',
        opponent: 'Opponent', // Prompt for input
        date: Timestamp.now(),
        homePlayers: [], // Add players UI
        plays: [],
        homeScore: 0,
        oppScore: 0,
      };
      const savedGame = await saveGame(newGame);
      setGames((prev) => [...prev, savedGame]);
      navigate(`/scoring/${savedGame.id}`);
      setError(null);
    } catch (err) {
      console.error('Failed to create game', err);
      setError('Unable to create a game right now. Check your Firebase configuration or try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl">Games</h1>
      <button onClick={startNewGame} className="btn btn-primary" disabled={isCreating}>
        {isCreating ? 'Creating...' : 'Start New Game'}
      </button>
      {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      <ul>
        {games.length === 0 && (
          <li className="text-sm text-gray-600 mt-3">No games yet. Click "Start New Game" to begin tracking.</li>
        )}
        {games.map((g) => (
          <li key={g.id} onClick={() => navigate(`/scoring/${g.id}`)}>
            vs {g.opponent} - {g.date.toDate().toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GameList;

export {};
