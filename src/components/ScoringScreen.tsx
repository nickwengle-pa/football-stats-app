import React, { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Game, Player, Play } from '../models';
import { saveGame, subscribeToGame } from '../services/dbService';
import { addPlayAndRecalc, buildScoreTimeline, undoLastPlay } from '../services/statsService';

const createBlankGame = (): Game => ({
  id: '',
  opponent: 'Opponent',
  date: Timestamp.now(),
  homePlayers: [],
  plays: [],
  homeScore: 0,
  oppScore: 0,
});

const ScoringScreen: React.FC = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<Game | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPersisting, setIsPersisting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [opponentInput, setOpponentInput] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [playType, setPlayType] = useState('run');
  const [playYards, setPlayYards] = useState('0');
  const [playDescription, setPlayDescription] = useState('');
  const [quarter, setQuarter] = useState(1);
  const [down, setDown] = useState('1st');
  const [distance, setDistance] = useState('10');
  const [assistingPlayerIds, setAssistingPlayerIds] = useState<string[]>([]);
  const scoreTimeline = useMemo(
    () => buildScoreTimeline(game?.plays ?? []),
    [game?.plays]
  );

  useEffect(() => {
    if (!gameId) {
      return;
    }

    const unsubscribe = subscribeToGame(gameId, (nextGame) => {
      setGame(nextGame);
      setError(null);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [gameId]);

  useEffect(() => {
    if (!game) {
      setAssistingPlayerIds([]);
      return;
    }

    setOpponentInput(game.opponent);
    if (game.homePlayers.length > 0) {
      setSelectedPlayerId((prev) => {
        if (prev && game.homePlayers.some((player) => player.id === prev)) {
          return prev;
        }
        return game.homePlayers[0].id;
      });
    } else {
      setSelectedPlayerId('');
      setAssistingPlayerIds([]);
    }
  }, [game]);

  useEffect(() => {
    if (!game) {
      setAssistingPlayerIds([]);
      return;
    }
    setAssistingPlayerIds((prev) =>
      prev.filter(
        (id) =>
          id !== selectedPlayerId &&
          game.homePlayers.some((player) => player.id === id)
      )
    );
  }, [selectedPlayerId, game]);

  const persistGame = useCallback(async (nextGame: Game) => {
    setIsPersisting(true);
    try {
      const savedGame = await saveGame(nextGame);
      setGame(savedGame);
      setError(null);
      return savedGame;
    } catch (err) {
      console.error('Failed to save game', err);
      setError('Unable to sync with Firebase. Working from local memory for now.');
      setGame(nextGame);
      return nextGame;
    } finally {
      setIsPersisting(false);
    }
  }, []);

  const startNewGame = useCallback(async () => {
    setIsCreating(true);
    try {
      const newGame = createBlankGame();
      const savedGame = await saveGame(newGame);
      setGame(savedGame);
      navigate(`/scoring/${savedGame.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to create game', err);
      setError('Unable to create a new game. Check your Firebase configuration.');
    } finally {
      setIsCreating(false);
    }
  }, [navigate]);

  const handleOpponentBlur = async () => {
    if (!game) return;
    const trimmed = opponentInput.trim();
    if (!trimmed || trimmed === game.opponent) {
      setOpponentInput(game.opponent);
      return;
    }
    await persistGame({ ...game, opponent: trimmed });
  };

  const handleAddPlayer = async (event: FormEvent) => {
    event.preventDefault();
    if (!game) return;
    const trimmedName = newPlayerName.trim();
    if (!trimmedName) {
      setError('Enter a player name before adding.');
      return;
    }
    const player: Player = {
      id: uuidv4(),
      name: trimmedName,
      position: newPlayerPosition.trim() || 'Player',
      stats: {},
    };
    const nextGame: Game = {
      ...game,
      homePlayers: [...game.homePlayers, player],
    };
    await persistGame(nextGame);
    setNewPlayerName('');
    setNewPlayerPosition('');
    setSelectedPlayerId(player.id);
    setAssistingPlayerIds([]);
  };

  const handlePrimaryChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedPlayerId(value);
    setAssistingPlayerIds((prev) => prev.filter((id) => id !== value));
  };

  const handleAssistingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    setAssistingPlayerIds(values.filter((id) => id !== selectedPlayerId));
  };

  const handleAddPlay = async (event: FormEvent) => {
    event.preventDefault();
    if (!game) return;
    if (!selectedPlayerId) {
      setError('Add a player before recording plays.');
      return;
    }
    const yardsValue = Number(playYards);
    if (Number.isNaN(yardsValue)) {
      setError('Yards must be a number.');
      return;
    }
    const normalizedType = playType.toLowerCase();
    let generatedDescription = playDescription.trim();
    if (!generatedDescription) {
      if (normalizedType.includes('field goal')) {
        generatedDescription = normalizedType.includes('miss')
          ? `Field goal attempt from ${yardsValue} yards missed`
          : `Field goal made from ${yardsValue} yards`;
      } else if (normalizedType.includes('pat')) {
        generatedDescription = normalizedType.includes('miss')
          ? 'PAT missed'
          : 'PAT made';
      } else if (normalizedType.includes('two point conversion')) {
        generatedDescription = normalizedType.includes('fail')
          ? 'Two-point conversion failed'
          : 'Two-point conversion made';
      } else if (normalizedType.includes('safety')) {
        generatedDescription = 'Safety';
      } else {
        generatedDescription = `${playType} for ${yardsValue} yards`;
      }
    }

    const play: Play = {
      id: uuidv4(),
      type: playType,
      yards: yardsValue,
      playerId: selectedPlayerId,
      description: generatedDescription,
      timestamp: Timestamp.now(),
      quarter,
      down,
      distance,
      assistingPlayerIds: [...assistingPlayerIds],
    };
    const nextGame = addPlayAndRecalc(game, play);
    await persistGame(nextGame);
    setPlayDescription('');
    setPlayYards('0');
    setDown('1st');
    setDistance('10');
    setAssistingPlayerIds([]);
  };

  const handleUndoPlay = async () => {
    if (!game || game.plays.length === 0) {
      return;
    }
    const nextGame = undoLastPlay(game);
    await persistGame(nextGame);
  };

  if (!gameId) {
    return (
      <div className="p-4">
        <h1 className="text-2xl mb-4">Scoring</h1>
        <button className="btn btn-primary" onClick={startNewGame} disabled={isCreating}>
          {isCreating ? 'Creating...' : 'Start New Game'}
        </button>
        {error && <p className="mt-2 text-red-600 text-sm">{error}</p>}
      </div>
    );
  }

  if (!game) {
    return (
      <div className="p-4">
        <h1 className="text-2xl mb-2">Scoring</h1>
        <p>Loading game...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          - Back to Games
        </button>
        {isPersisting && <span className="text-sm text-gray-500">Saving...</span>}
      </div>

      <div>
        <h1 className="text-2xl mb-2">Scoring vs {game.opponent}</h1>
        <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="opponent">
          Opponent Name
        </label>
        <input
          id="opponent"
          className="border rounded px-3 py-2 w-full max-w-md"
          value={opponentInput}
          onChange={(event) => setOpponentInput(event.target.value)}
          onBlur={handleOpponentBlur}
        />
        <p className="text-sm text-gray-600 mt-1">{game.date.toDate().toLocaleString()}</p>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      <section>
        <h2 className="text-xl mb-2">Scoreboard</h2>
        <div className="flex gap-4 items-center">
          <div className="border rounded px-4 py-3">
            <p className="text-sm text-gray-500">Home</p>
            <p className="text-3xl font-semibold">{game.homeScore}</p>
          </div>
          <div className="border rounded px-4 py-3">
            <p className="text-sm text-gray-500">Opponent</p>
            <p className="text-3xl font-semibold">{game.oppScore}</p>
          </div>
          <button className="btn btn-outline" onClick={handleUndoPlay} disabled={game.plays.length === 0}>
            Undo Last Play
          </button>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-xl mb-2">Players</h2>
          <form onSubmit={handleAddPlayer} className="space-y-2 mb-3">
            <input
              type="text"
              placeholder="Player name"
              className="border rounded px-3 py-2 w-full"
              value={newPlayerName}
              onChange={(event) => setNewPlayerName(event.target.value)}
            />
            <input
              type="text"
              placeholder="Position (e.g., QB)"
              className="border rounded px-3 py-2 w-full"
              value={newPlayerPosition}
              onChange={(event) => setNewPlayerPosition(event.target.value)}
            />
            <button type="submit" className="btn btn-primary w-full">
              Add Player
            </button>
          </form>

          {game.homePlayers.length === 0 ? (
            <p className="text-sm text-gray-500">No players yet.</p>
          ) : (
            <ul className="space-y-3">
              {game.homePlayers.map((player) => (
                <li key={player.id} className="border rounded px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-semibold">{player.name}</span>
                    <span className="text-sm text-gray-500">{player.position}</span>
                  </div>
                  {Object.keys(player.stats).length === 0 ? (
                    <p className="text-xs text-gray-500 mt-1">No stats recorded.</p>
                  ) : (
                    <div className="text-xs text-gray-600 mt-1 space-y-1">
                      {Object.entries(player.stats).map(([stat, value]) => (
                        <div key={stat}>
                          {stat}: {value}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h2 className="text-xl mb-2">Record a Play</h2>
          <form onSubmit={handleAddPlay} className="space-y-2">
            <select
              className="border rounded px-3 py-2 w-full"
              value={selectedPlayerId}
              onChange={handlePrimaryChange}
              disabled={game.homePlayers.length === 0}
            >
              <option value="" disabled>
                {game.homePlayers.length === 0 ? 'Add a player first' : 'Select player'}
              </option>
              {game.homePlayers.map((player) => (
                <option value={player.id} key={player.id}>
                  {player.name} ({player.position})
                </option>
              ))}
            </select>

            <select
              multiple
              className="border rounded px-3 py-2 w-full h-24"
              value={assistingPlayerIds}
              onChange={handleAssistingChange}
              disabled={game.homePlayers.length <= 1}
            >
              {game.homePlayers
                .filter((player) => player.id !== selectedPlayerId)
                .map((player) => (
                  <option value={player.id} key={player.id}>
                    {player.name} ({player.position})
                  </option>
                ))}
            </select>
            {game.homePlayers.length > 1 && (
              <p className="text-xs text-gray-500">
                Hold Ctrl/Cmd to select multiple assisting players.
              </p>
            )}

            <select
              className="border rounded px-3 py-2 w-full"
              value={playType}
              onChange={(event) => setPlayType(event.target.value)}
            >
              <option value="run">Run</option>
              <option value="pass">Pass</option>
              <option value="pass TD">Pass TD</option>
              <option value="run TD">Run TD</option>
              <option value="tackle">Tackle</option>
              <option value="turnover">Turnover</option>
              <option value="field goal made">Field Goal - Made</option>
              <option value="field goal missed">Field Goal - Missed</option>
              <option value="pat made">PAT - Made</option>
              <option value="pat missed">PAT - Missed</option>
              <option value="two point conversion made">Two-Point Conversion - Made</option>
              <option value="two point conversion failed">Two-Point Conversion - Failed</option>
              <option value="safety">Safety</option>
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <select
                className="border rounded px-3 py-2 w-full"
                value={quarter.toString()}
                onChange={(event) => setQuarter(Number(event.target.value))}
              >
                <option value="1">1st Quarter</option>
                <option value="2">2nd Quarter</option>
                <option value="3">3rd Quarter</option>
                <option value="4">4th Quarter</option>
                <option value="5">Overtime</option>
              </select>

              <select
                className="border rounded px-3 py-2 w-full"
                value={down}
                onChange={(event) => setDown(event.target.value)}
              >
                <option value="1st">1st Down</option>
                <option value="2nd">2nd Down</option>
                <option value="3rd">3rd Down</option>
                <option value="4th">4th Down</option>
              </select>

              <input
                type="text"
                className="border rounded px-3 py-2 w-full"
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
                placeholder="Distance (e.g., 10, Goal)"
              />
            </div>

            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={playYards}
              onChange={(event) => setPlayYards(event.target.value)}
              placeholder="Yards gained (negative for loss)"
            />

            <textarea
              className="border rounded px-3 py-2 w-full"
              value={playDescription}
              onChange={(event) => setPlayDescription(event.target.value)}
              placeholder="Description (optional)"
              rows={3}
            />

            <button type="submit" className="btn btn-primary w-full" disabled={game.homePlayers.length === 0}>
              Add Play
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="text-xl mb-2">Plays</h2>
        {game.plays.length === 0 ? (
          <p>No plays recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {game.plays.map((play, index) => {
              const scoreAfter = scoreTimeline[index] ?? {
                home: game.homeScore,
                opp: game.oppScore,
              };
              const primaryPlayer = game.homePlayers.find(
                (player) => player.id === play.playerId
              );
              const assistingNames = (play.assistingPlayerIds ?? [])
                .map(
                  (assistId) =>
                    game.homePlayers.find((player) => player.id === assistId)?.name
                )
                .filter((name): name is string => Boolean(name))
                .join(', ');
              const quarterLabel =
                play.quarter === 5
                  ? 'OT'
                  : play.quarter
                    ? `Q${play.quarter}`
                    : 'Q-';
              const downDistance = `${play.down || '-'} & ${play.distance || '-'}`;

              return (
                <li key={play.id} className="border rounded px-3 py-2 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Play #{index + 1}</span>
                    <span className="text-sm text-gray-500">
                      {play.timestamp.toDate().toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {quarterLabel} - {downDistance}
                  </div>
                  <div>{play.description}</div>
                  <div className="text-xs text-gray-500">
                    {play.type} - {play.yards} yards - Score {scoreAfter.home}-
                    {scoreAfter.opp}
                  </div>
                  <div className="text-xs text-gray-500">
                    Primary:{' '}
                    {primaryPlayer
                      ? `${primaryPlayer.name} (${primaryPlayer.position})`
                      : 'Unknown'}
                  </div>
                  {assistingNames && (
                    <div className="text-xs text-gray-500">Assists: {assistingNames}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ScoringScreen;


