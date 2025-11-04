import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Game, Play } from '../models'; // Fix TS2304: Import Game/Play
import { subscribeToGame, saveGame } from '../services/dbService';
import { addPlayAndRecalc, undoLastPlay, editPlayAndRecalc } from '../services/statsService';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore'; // Fix TS2304: Import Timestamp

const ScoringScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [history, setHistory] = useState<Game[]>([]); // For undo
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (gameId) {
      const unsub = subscribeToGame(gameId, (g) => setGame(g));
      return unsub;
    }
  }, [gameId]);

  const addPlay = (type: string, yards: number, playerId: string) => {
    if (!game) return;
    const desc = `${type} for ${yards} yards`; // Enhance
    const play: Play = {
      id: uuidv4(),
      type,
      yards,
      playerId,
      description: desc,
      timestamp: Timestamp.now(), // Use Timestamp for consistency
    };
    const newGame = addPlayAndRecalc(game, play);
    setHistory([...history, game]); // Push old for undo
    setGame(newGame);
    saveGame(newGame); // Syncs offline/online
  };

  const undo = () => {
    if (!game || history.length === 0) return;
    const prevGame = history.pop()!;
    setGame(undoLastPlay(game)); // Or restore prev
    setHistory([...history]);
    saveGame(game);
  };

  const editPlay = (playId: string, updates: Partial<Play>) => {
    if (!game) return;
    const newGame = editPlayAndRecalc(game, playId, updates);
    setHistory([...history, game]);
    setGame(newGame);
    saveGame(newGame);
  };

  // Canvas for field (simple example)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'green';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Add lines, tap handler: canvas.onClick = (e) => { set ball position }
      }
    }
  }, []);

  if (!game) return <div>Loading...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl">Scoring vs {game.opponent}</h1>
      <div className="flex justify-between text-xl">
        <span>Home: {game.homeScore}</span>
        <span>Opp: {game.oppScore}</span>
      </div>
      <canvas ref={canvasRef} width={300} height={200} className="bg-green-500 my-4" onClick={() => { /* Tap to set position */ }} />
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => addPlay('Run', 5, 'player1')} className="btn-play bg-blue-500 text-white">Run +5</button>
        <button onClick={() => addPlay('Pass Complete', 10, 'player2')} className="btn-play bg-green-500 text-white">Pass +10</button>
        <button onClick={() => addPlay('Tackle', -2, 'player3')} className="btn-play bg-red-500 text-white">Tackle -2</button>
        {/* Add more buttons; use modals for custom yards/player select */}
      </div>
      <button onClick={undo} className="btn btn-warning mt-4">Undo Last Play</button>
      <h2 className="text-xl mt-4">Play-by-Play</h2>
      <ul className="overflow-y-auto h-40">
        {game.plays.map((play) => (
          <li key={play.id} className="flex justify-between">
            <span>{play.description} ({play.timestamp.toDate().toLocaleTimeString()})</span> {/* Use toDate() for formatting */}
            <button onClick={() => editPlay(play.id, { yards: play.yards + 1 })}>Edit</button> {/* Example; use modal for full edit */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ScoringScreen;

export {}; // Fix TS1208: Mark as module