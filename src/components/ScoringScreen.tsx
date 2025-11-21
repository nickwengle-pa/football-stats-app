import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Timestamp } from 'firebase/firestore';
import {
  Box,
  Button,
  Center,
  Grid,
  GridItem,
  Spinner,
  Stack,
  Text,
  chakra,
  Image,
  Input,
  SimpleGrid,
  Badge,
  useDisclosure,
  Portal,
  HStack,
} from '@chakra-ui/react';
import { Game, Play, PlayType, Player, OpponentTeam } from '../models';
import { subscribeToGame, saveGame, listOpponents, getSeasonRoster } from '../services/dbService';
import {
  addPlayAndRecalc,
  editPlayAndRecalc,
  undoLastPlay,
  recalculateStats,
} from '../services/statsService';
import { PageHeader, SectionCard } from './ui';
import { useProgram } from '../context/ProgramContext';
import { getOpponentName, getMyTeamRoster } from '../utils/gameUtils';

type FeedbackState = {
  status: 'success' | 'error';
  message: string;
};

type PlayInputState = {
  type: PlayType;
  player: Player | null;
  passer: Player | null;
  receiver: Player | null;
  yards: number;
  startYard: number;
  endYard: number;
} | null;

const formatTime = (timestamp: Timestamp) =>
  timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// Updated to use PlayType enum - simplified for manual input
const quickActions = [
  // Offensive - no preset yards
  { label: 'Run', type: PlayType.RUSH, yards: 0, color: 'green', category: 'offense' },
  { label: 'Pass', type: PlayType.PASS_COMPLETE, yards: 0, color: 'blue', category: 'offense' },
  
  // Run play outcomes
  { label: 'Rush', type: PlayType.RUSH, yards: 0, color: 'green', category: 'run-outcome' },
  { label: 'Touchdown', type: PlayType.RUSH_TD, yards: 0, color: 'green', category: 'run-outcome', points: 6 },
  { label: 'Fumble', type: PlayType.FUMBLE_RECOVERY, yards: 0, color: 'orange', category: 'run-outcome' },
  { label: 'Lateral', type: PlayType.LATERAL, yards: 0, color: 'cyan', category: 'run-outcome' },
  { label: 'Safety', type: PlayType.SAFETY, yards: 0, color: 'red', category: 'run-outcome', points: 2 },
  { label: 'Kneel', type: PlayType.KNEEL, yards: 0, color: 'gray', category: 'run-outcome' },
  { label: 'Bad Snap', type: PlayType.BAD_SNAP, yards: 0, color: 'red', category: 'run-outcome' },
  
  // Pass play outcomes
  { label: 'Complete', type: PlayType.PASS_COMPLETE, yards: 0, color: 'blue', category: 'pass-outcome' },
  { label: 'Incomplete', type: PlayType.PASS_INCOMPLETE, yards: 0, color: 'gray', category: 'pass-outcome' },
  { label: 'Sack', type: PlayType.SACK, yards: 0, color: 'red', category: 'pass-outcome' },
  { label: 'Spike', type: PlayType.SPIKE, yards: 0, color: 'gray', category: 'pass-outcome' },
  { label: 'Touchdown', type: PlayType.PASS_TD, yards: 0, color: 'blue', category: 'pass-outcome', points: 6 },
  { label: 'Interception', type: PlayType.INTERCEPTION, yards: 0, color: 'purple', category: 'pass-outcome' },
  { label: 'Fumble', type: PlayType.FUMBLE_RECOVERY, yards: 0, color: 'orange', category: 'pass-outcome' },
  { label: 'Scramble', type: PlayType.RUSH, yards: 0, color: 'green', category: 'pass-outcome' },
  { label: 'Penalty', type: PlayType.PENALTY, yards: 0, color: 'yellow', category: 'pass-outcome' },
  
  // Scoring (after touchdown)
  { label: 'Rush TD', type: PlayType.RUSH_TD, yards: 0, color: 'green', category: 'scoring', points: 6 },
  { label: 'Pass TD', type: PlayType.PASS_TD, yards: 0, color: 'blue', category: 'scoring', points: 6 },
  { label: 'XP Kick', type: PlayType.EXTRA_POINT_KICK_MADE, yards: 0, color: 'teal', category: 'scoring', points: 1 },
  { label: '2PT Conv', type: PlayType.TWO_POINT_CONVERSION_MADE, yards: 0, color: 'cyan', category: 'scoring', points: 2 },
  { label: 'Field Goal', type: PlayType.FIELD_GOAL_MADE, yards: 0, color: 'teal', category: 'scoring', points: 3 },
  { label: 'Safety', type: PlayType.SAFETY, yards: 0, color: 'red', category: 'scoring', points: 2 },
  
  // Defensive
  { label: 'Tackle', type: PlayType.TACKLE, yards: 0, color: 'red', category: 'defense' },
  { label: 'TFL', type: PlayType.TACKLE_FOR_LOSS, yards: 0, color: 'red', category: 'defense' },
  { label: 'Sack', type: PlayType.SACK, yards: 0, color: 'red', category: 'defense' },
  { label: 'INT', type: PlayType.INTERCEPTION, yards: 0, color: 'purple', category: 'defense' },
  { label: 'Fumble Rec', type: PlayType.FUMBLE_RECOVERY, yards: 0, color: 'orange', category: 'defense' },
  
  // Kicking
  { label: 'Punt', type: PlayType.PUNT, yards: 0, color: 'gray', category: 'kicking' },
] as const;

const ScoringScreen: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const {
    team,
    teamLoading,
    teamError,
    activeSeasonId,
    branding,
  } = useProgram();

  const teamId = team?.id ?? null;
  const teamName = team?.name ?? 'Our Team';
  const logoUrl = branding.logoUrl;
  const navigate = useNavigate();

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<Game[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [roster, setRoster] = useState<Player[]>([]);

  // Opponent data
  const [opponent, setOpponent] = useState<OpponentTeam | null>(null);

  // Play input state - new flow
  const [playInput, setPlayInput] = useState<PlayInputState>(null);
  const { open: isPlayInputOpen, onOpen: onPlayInputOpen, onClose: onPlayInputClose } = useDisclosure();

  // Player selection state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ type: PlayType; yards: number } | null>(null);
  const [jerseySearch, setJerseySearch] = useState<string>('');
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const [lastRusher, setLastRusher] = useState<Player | null>(null); // Remember last rusher

  // Play editor state
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);
  const { open: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editForm, setEditForm] = useState({
    yards: 0,
    quarter: 1,
    down: '',
    distance: '',
    yardLine: '',
  });

  // Game clock state
  const [currentQuarter, setCurrentQuarter] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(12 * 60); // 12 minutes in seconds
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Field position state
  const [fieldPosition, setFieldPosition] = useState<number>(25); // Starting at own 25
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [down, setDown] = useState<number>(1);
  const [yardsToGo, setYardsToGo] = useState<number>(10);
  const [direction, setDirection] = useState<'left-to-right' | 'right-to-left'>('left-to-right'); // Which way home team is going

  // Timeout state
  const [homeTimeouts, setHomeTimeouts] = useState<number>(3);
  const [awayTimeouts, setAwayTimeouts] = useState<number>(3);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away' | null>(null);
  const { open: isTimeoutOpen, onOpen: onTimeoutOpen, onClose: onTimeoutClose } = useDisclosure();
  const [timeoutTime, setTimeoutTime] = useState<string>('');

  // Play type selection state (Run or Pass)
  const [selectedPlayType, setSelectedPlayType] = useState<'run' | 'pass' | null>(null);

  // Load roster from season
  useEffect(() => {
    if (!teamId || !activeSeasonId) return;
    
    const loadRoster = async () => {
      try {
        const seasonRoster = await getSeasonRoster(teamId, activeSeasonId);
        const filteredRoster = seasonRoster.filter(p => p.id !== 'team-placeholder-player');
        console.log('Roster loaded from season:', filteredRoster.length, 'players', filteredRoster);
        setRoster(filteredRoster);
      } catch (error) {
        console.error('Failed to load roster:', error);
        setRoster([]);
      }
    };

    loadRoster();
  }, [teamId, activeSeasonId]);

  // Clock management
  useEffect(() => {
    if (isClockRunning && timeRemaining > 0) {
      clockIntervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            setIsClockRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [isClockRunning, timeRemaining]);

  const formatClock = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startClock = () => setIsClockRunning(true);
  const stopClock = () => setIsClockRunning(false);
  const resetClock = () => {
    setTimeRemaining(12 * 60);
    setIsClockRunning(false);
  };
  const nextQuarter = () => {
    setCurrentQuarter(prev => Math.min(prev + 1, 4));
    resetClock();
  };

  useEffect(() => {
    if (!teamId || !activeSeasonId || !gameId || gameId === 'new') {
      setLoading(false);
      setGame(null);
      return;
    }

    const unsubscribe = subscribeToGame(
      gameId,
      (snapshot) => {
        setGame(snapshot);
        setLoading(false);
      },
      { teamId, seasonId: activeSeasonId }
    );

    return unsubscribe;
  }, [teamId, activeSeasonId, gameId]);

  // Load opponent data
  useEffect(() => {
    if (!game || !teamId || !game.opponentTeamId) return;

    const loadOpponent = async () => {
      try {
        const opponents = await listOpponents(teamId);
        const opp = opponents.find(o => o.id === game.opponentTeamId);
        if (opp) {
          setOpponent(opp);
        }
      } catch (error) {
        console.error('Failed to load opponent', error);
      }
    };

    loadOpponent();
  }, [game, teamId]);

  const opponentName = useMemo(() => (game ? getOpponentName(game) : 'Opponent'), [game]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Make canvas responsive
    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.scale(dpr, dpr);
      
      // Use logical dimensions for drawing
      const width = rect.width;
      const height = rect.height;
      
      const endZoneWidth = width * 0.1; // 10% for each end zone
      const fieldWidth = width * 0.8; // 80% for playing field

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Determine which team defends which end zone based on direction
      const leftTeamName = direction === 'left-to-right' ? (team?.shortName || teamName.substring(0, 3).toUpperCase()) : (opponent?.shortName || opponentName.substring(0, 3).toUpperCase());
      const rightTeamName = direction === 'left-to-right' ? (opponent?.shortName || opponentName.substring(0, 3).toUpperCase()) : (team?.shortName || teamName.substring(0, 3).toUpperCase());
      const leftEndZoneColor = direction === 'left-to-right' ? (branding.primaryColor || '#003366') : (opponent?.colors?.primaryColor || '#8B0000');
      const rightEndZoneColor = direction === 'left-to-right' ? (opponent?.colors?.primaryColor || '#8B0000') : (branding.primaryColor || '#003366');

      // Draw left end zone
      ctx.fillStyle = leftEndZoneColor;
      ctx.fillRect(0, 0, endZoneWidth, height);
      
      // Draw right end zone
      ctx.fillStyle = rightEndZoneColor;
      ctx.fillRect(width - endZoneWidth, 0, endZoneWidth, height);

      // Draw field background
      ctx.fillStyle = '#0f7a27';
      ctx.fillRect(endZoneWidth, 0, fieldWidth, height);

      // Draw end zone text (use abbreviations)
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(16, height * 0.12)}px Arial`;
      ctx.textAlign = 'center';
      
      // Left end zone text (rotated)
      ctx.save();
      ctx.translate(endZoneWidth / 2, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(leftTeamName, 0, 0);
      ctx.restore();
      
      // Right end zone text (rotated)
      ctx.save();
      ctx.translate(width - endZoneWidth / 2, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(rightTeamName, 0, 0);
      ctx.restore();

      // Draw yard lines on field (10-90 yards)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let yard = 10; yard <= 90; yard += 10) {
        const x = endZoneWidth + ((yard - 10) / 80) * fieldWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Draw yard numbers
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(12, height * 0.1)}px Arial`;
        ctx.textAlign = 'center';
        const yardLabel = yard <= 50 ? yard : 100 - yard;
        ctx.fillText(yardLabel.toString(), x, height / 2 + (height * 0.04));
      }

      // Draw 50 yard line thicker
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      const midX = endZoneWidth + fieldWidth / 2;
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, height);
      ctx.stroke();

      // Draw current ball position (accounting for end zones)
      let ballX;
      if (fieldPosition <= 0) {
        ballX = endZoneWidth / 2; // In home end zone
      } else if (fieldPosition >= 100) {
        ballX = width - endZoneWidth / 2; // In opponent end zone
      } else {
        ballX = endZoneWidth + ((fieldPosition - 10) / 80) * fieldWidth;
      }
      
      const oppColor = opponent?.colors?.primaryColor || '#8B0000';
      const ballColor = possession === 'home' ? branding.primaryColor : oppColor;
      const ballSize = Math.max(8, height * 0.08);
      ctx.fillStyle = ballColor;
      ctx.beginPath();
      ctx.arc(ballX, height / 2, ballSize, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw possession indicator
      ctx.fillStyle = '#FFD700';
      ctx.font = `bold ${Math.max(10, height * 0.08)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('⚫', ballX, height / 2 - ballSize - 5);

      // Draw down and distance
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(12, height * 0.09)}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`${down} & ${yardsToGo}`, endZoneWidth + 10, 20);
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [fieldPosition, possession, down, yardsToGo, branding.primaryColor, opponent, team, teamName, opponentName, direction]);

  // Filtered roster based on jersey search
  const filteredRoster = useMemo(() => {
    if (!jerseySearch) return roster;
    return roster.filter(p => 
      p.jerseyNumber?.toString().includes(jerseySearch) ||
      p.name.toLowerCase().includes(jerseySearch.toLowerCase())
    );
  }, [roster, jerseySearch]);

  // Auto-select player when exact jersey number match is found
  useEffect(() => {
    if (!playInput || !jerseySearch) return;
    
    // Check for exact jersey number match
    const exactMatch = roster.find(p => p.jerseyNumber?.toString() === jerseySearch);
    if (exactMatch) {
      const action = quickActions.find(a => a.type === playInput.type);
      const isPassPlay = action?.category === 'pass-outcome';
      const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
      
      // Auto-fill based on play type
      if (isPassPlay) {
        // For pass plays, auto-fill passer first if not set
        if (!playInput.passer) {
          setPlayInput({...playInput, passer: exactMatch});
        } else if (isCompletePass && !playInput.receiver) {
          // If passer is set and it's a complete pass, auto-fill receiver
          setPlayInput({...playInput, receiver: exactMatch});
        }
      } else {
        // For run plays, auto-fill player
        setPlayInput({...playInput, player: exactMatch});
      }
    }
  }, [jerseySearch, roster, playInput, quickActions]);

  // Timeout handling
  const openTimeoutModal = (team: 'home' | 'away') => {
    if ((team === 'home' && homeTimeouts <= 0) || (team === 'away' && awayTimeouts <= 0)) {
      setFeedback({ status: 'error', message: 'No timeouts remaining for this team.' });
      return;
    }
    setTimeoutTeam(team);
    setTimeoutTime(formatClock(timeRemaining));
    onTimeoutOpen();
  };

  const recordTimeout = () => {
    if (!timeoutTeam) return;
    
    if (timeoutTeam === 'home') {
      setHomeTimeouts(prev => Math.max(0, prev - 1));
    } else {
      setAwayTimeouts(prev => Math.max(0, prev - 1));
    }
    
    setFeedback({ 
      status: 'success', 
      message: `Timeout charged to ${timeoutTeam === 'home' ? teamName : opponentName} at ${timeoutTime} in Q${currentQuarter}` 
    });
    
    onTimeoutClose();
    setTimeoutTeam(null);
    setTimeoutTime('');
  };

  // New play flow: button click -> open modal for player + yards
  const initiatePlay = (type: PlayType, defaultYards: number = 0, category?: string) => {
    // If clicking Run or Pass from offense, just set the play type
    if (category === 'offense') {
      if (type === PlayType.RUSH) {
        setSelectedPlayType('run');
      } else if (type === PlayType.PASS_COMPLETE) {
        setSelectedPlayType('pass');
      }
      return;
    }
    
    // Otherwise open the play input modal
    const action = quickActions.find(a => a.type === type);
    const points = action && 'points' in action ? action.points : undefined;
    
    // Check if this is a pass play outcome or run play outcome
    const isPassPlay = action?.category === 'pass-outcome';
    const isRunPlay = action?.category === 'run-outcome';
    
    setPlayInput({
      type,
      player: isRunPlay ? lastRusher : null, // Pre-fill last rusher for run plays
      passer: null,
      receiver: null,
      yards: defaultYards,
      startYard: fieldPosition,
      endYard: fieldPosition + defaultYards,
    });
    onPlayInputOpen();
  };

  const swapDirection = () => {
    // Mirror the field position when swapping direction
    // Field position 0-100: 0 is home end zone, 100 is opponent end zone
    // When swapping, we mirror: newPosition = 100 - oldPosition
    const mirroredPosition = 100 - fieldPosition;
    setFieldPosition(mirroredPosition);
    setDirection(direction === 'left-to-right' ? 'right-to-left' : 'left-to-right');
  };

  const submitPlay = async () => {
    if (!playInput || !game || !teamId || !activeSeasonId) return;

    const action = quickActions.find(a => a.type === playInput.type);
    const points = action && 'points' in action ? action.points : 0;
    const isPassPlay = action?.category === 'pass-outcome';
    const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
    
    const actualYards = playInput.endYard - playInput.startYard;
    
    // Determine which player to use for the play
    let finalPlayerId: string;
    let playerName: string;
    
    if (isPassPlay) {
      // For pass plays, use passer as primary player
      finalPlayerId = playInput.passer?.id || 'team-placeholder-player';
      playerName = playInput.passer?.name || 'Team';
      
      // If it's a complete pass, include receiver in description
      if (isCompletePass && playInput.receiver) {
        playerName = `${playInput.passer?.name} to ${playInput.receiver.name}`;
      }
    } else {
      // For run plays, use player
      finalPlayerId = playInput.player?.id || 'team-placeholder-player';
      playerName = playInput.player?.name || 'Team';
    }

    const play: Play = {
      id: uuidv4(),
      type: playInput.type,
      yards: actualYards,
      playerId: finalPlayerId,
      description: `${playerName} - ${playInput.type} for ${actualYards} yards`,
      timestamp: Timestamp.now(),
      quarter: currentQuarter,
      down,
      distance: yardsToGo.toString(),
      yardLine: playInput.startYard,
    };

    try {
      const nextGame = addPlayAndRecalc(game, play);
      
      // Apply NFHS scoring
      if (points) {
        if (possession === 'home') {
          nextGame.homeScore = (nextGame.homeScore || 0) + points;
        } else {
          nextGame.oppScore = (nextGame.oppScore || 0) + points;
        }
      }
      
      setHistory((prev) => [...prev, game]);
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      
      // Update ball position
      setFieldPosition(playInput.endYard);
      
      // Update down and distance logic
      if (actualYards >= yardsToGo) {
        setDown(1);
        setYardsToGo(10);
      } else {
        setDown(Math.min(4, down + 1));
        setYardsToGo(yardsToGo - actualYards);
      }
      
      // Remember last rusher for run plays
      if (!isPassPlay && playInput.player) {
        setLastRusher(playInput.player);
      }
      
      setFeedback({ status: 'success', message: `${playInput.type} recorded${points ? ` (+${points} pts)` : ''}.` });
      onPlayInputClose();
      setPlayInput(null);
      setSelectedPlayType(null); // Reset play type selection
    } catch (error) {
      console.error('Failed to add play', error);
      setFeedback({ status: 'error', message: 'Unable to add play. Try again.' });
    }
  };

  const handleAddPlay = async (type: PlayType, yards: number, playerId?: string) => {
    if (!game || !teamId || !activeSeasonId) return;

    // If no player selected, open picker for plays that need attribution
    const needsPlayer = [
      PlayType.RUSH, PlayType.RUSH_TD,
      PlayType.PASS_COMPLETE, PlayType.PASS_INCOMPLETE, PlayType.PASS_TD,
      PlayType.TACKLE, PlayType.TACKLE_FOR_LOSS, PlayType.SACK,
      PlayType.INTERCEPTION, PlayType.FUMBLE_RECOVERY,
      PlayType.FIELD_GOAL_MADE, PlayType.FIELD_GOAL_MISSED,
      PlayType.EXTRA_POINT_KICK_MADE, PlayType.EXTRA_POINT_KICK_MISSED
    ].includes(type);

    if (needsPlayer && !playerId && !selectedPlayer) {
      setPendingPlay({ type, yards });
      onOpen();
      return;
    }

    const finalPlayerId = playerId || selectedPlayer?.id || 'team-placeholder-player';

    const play: Play = {
      id: uuidv4(),
      type,
      yards,
      playerId: finalPlayerId,
      description: `${selectedPlayer?.name || 'Team'} - ${type} for ${yards} yards`,
      timestamp: Timestamp.now(),
    };

    try {
      const nextGame = addPlayAndRecalc(game, play);
      setHistory((prev) => [...prev, game]);
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: `${type} recorded for ${selectedPlayer?.name || 'Team'}.` });
      setSelectedPlayer(null); // Reset selection after play
    } catch (error) {
      console.error('Failed to add play', error);
      setFeedback({ status: 'error', message: 'Unable to add play. Try again.' });
    }
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
    if (pendingPlay) {
      handleAddPlay(pendingPlay.type, pendingPlay.yards, player.id);
      setPendingPlay(null);
      onClose();
      setJerseySearch('');
    }
  };

  const openPlayEditor = (play: Play) => {
    setEditingPlay(play);
    setEditForm({
      yards: play.yards,
      quarter: play.quarter || currentQuarter,
      down: play.down?.toString() || '',
      distance: play.distance || '',
      yardLine: play.yardLine?.toString() || '',
    });
    onEditOpen();
  };

  const savePlayEdits = async () => {
    if (!editingPlay || !game || !teamId || !activeSeasonId) return;

    try {
      const updates: Partial<Play> = {
        yards: editForm.yards,
        quarter: editForm.quarter,
        down: editForm.down ? parseInt(editForm.down) : undefined,
        distance: editForm.distance || undefined,
        yardLine: editForm.yardLine ? parseInt(editForm.yardLine) : undefined,
        description: `${roster.find(p => p.id === editingPlay.playerId)?.name || 'Team'} - ${editingPlay.type} for ${editForm.yards} yards`,
      };

      const updatedGame = editPlayAndRecalc(game, editingPlay.id, updates);
      setGame(updatedGame);
      await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Play updated successfully.' });
      onEditClose();
      setEditingPlay(null);
    } catch (error) {
      console.error('Failed to update play', error);
      setFeedback({ status: 'error', message: 'Unable to update play.' });
    }
  };

  const deletePlay = async (playId: string) => {
    if (!game || !teamId || !activeSeasonId) return;
    if (!window.confirm('Delete this play?')) return;

    try {
      const newPlays = game.plays.filter((p: Play) => p.id !== playId);
      const updatedGame = { ...game, plays: newPlays };
      const recalculatedGame = recalculateStats(updatedGame);
      setGame(recalculatedGame);
      await saveGame(recalculatedGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Play deleted.' });
    } catch (error) {
      console.error('Failed to delete play', error);
      setFeedback({ status: 'error', message: 'Unable to delete play.' });
    }
  };

  const handleUndo = async () => {
    if (!game || history.length === 0 || !teamId || !activeSeasonId) return;
    const previous = history[history.length - 1];
    const reverted = undoLastPlay(game);
    setGame(reverted);
    setHistory((prev) => prev.slice(0, -1));
    try {
      await saveGame(reverted, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Last play removed.' });
    } catch (error) {
      console.error('Failed to undo play', error);
      setFeedback({ status: 'error', message: 'Unable to undo play.' });
      setGame(previous);
      setHistory((prev) => [...prev, previous]);
    }
  };

  const handleEditPlay = async (playId: string, updates: Partial<Play>) => {
    if (!game || !teamId || !activeSeasonId) return;
    try {
      const updatedGame = editPlayAndRecalc(game, playId, updates);
      setGame(updatedGame);
      await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      setFeedback({ status: 'success', message: 'Play updated.' });
    } catch (error) {
      console.error('Failed to edit play', error);
      setFeedback({ status: 'error', message: 'Unable to edit play.' });
    }
  };

  if (teamLoading) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" />
          <Text color="text.secondary">Loading team...</Text>
        </Stack>
      </Center>
    );
  }

  if (teamError && !team) {
    return (
      <SectionCard title="Live Scoring">
        <Text color="text.secondary">{teamError}</Text>
      </SectionCard>
    );
  }

  if (gameId === 'new') {
    return (
      <SectionCard title="Live Scoring">
        <Stack gap={3} align="center">
          <Text fontWeight="600">Select a game from the schedule</Text>
          <Text color="text.secondary" textAlign="center">
            Schedule a game or choose an existing matchup to start tracking plays.
          </Text>
          <Button
            variant="outline"
            borderColor="brand.primary"
            color="brand.primary"
            onClick={() => navigate('/')}
          >
            Back to Schedule
          </Button>
        </Stack>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Spinner color="brand.primary" />
          <Text color="text.secondary">Loading game...</Text>
        </Stack>
      </Center>
    );
  }

  if (!game) {
    return (
      <SectionCard title="Live Scoring">
        <Text color="text.secondary">Game not found. Return to the schedule and select a game.</Text>
      </SectionCard>
    );
  }

  const gameDate = game.date
    ? game.date.toDate().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Date TBD';

  return (
    <Stack gap={6}>
      <PageHeader
        title="Live Scoring"
        media={
          logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${teamName} logo`}
              boxSize="48px"
              objectFit="contain"
              borderRadius="md"
              border="1px solid"
              borderColor="border.subtle"
              bg="white"
              p={2}
            />
          ) : undefined
        }
        subtitle={`${teamName} vs ${opponentName} - ${gameDate}`}
        actions={
          <HStack gap={2}>
            <Button variant="outline" borderColor="brand.primary" color="brand.primary" onClick={() => navigate(`/stats/${gameId}`)}>
              Player Stats
            </Button>
            <Button variant="outline" borderColor="brand.primary" color="brand.primary" onClick={() => navigate('/')}>
              Back to Schedule
            </Button>
          </HStack>
        }
      />

      <SectionCard title="Scoreboard">
        <Stack gap={4}>
          {/* Main Scoreboard - Football Style */}
          <Box
            bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
            borderRadius="xl"
            p={6}
            border="3px solid"
            borderColor="brand.primary"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
          >
            {/* Top Section: Teams and Scores */}
            <Stack direction="row" justify="space-between" align="center" mb={4}>
              {/* Home Team */}
              <Stack flex={1} align="center" gap={3}>
                <Box 
                  position="relative" 
                  cursor="pointer" 
                  onClick={() => openTimeoutModal('home')}
                  _hover={{ transform: 'scale(1.05)' }}
                  transition="all 0.2s"
                  title="Click to call timeout"
                >
                    {logoUrl && (
                      <Image
                        src={logoUrl}
                        alt={`${teamName} logo`}
                        boxSize="80px"
                        objectFit="contain"
                        borderRadius="md"
                        border="2px solid"
                        borderColor={possession === 'home' ? 'yellow.400' : 'border.subtle'}
                        bg="white"
                        p={2}
                        boxShadow={possession === 'home' ? '0 0 20px rgba(250, 204, 21, 0.6)' : 'none'}
                      />
                    )}
                    {possession === 'home' && (
                      <Box
                        position="absolute"
                        top="-8px"
                        right="-8px"
                        bg="yellow.400"
                        color="black"
                        borderRadius="full"
                        px={2}
                        py={1}
                        fontSize="xs"
                        fontWeight="700"
                      >
                        ⚫
                      </Box>
                    )}
                  </Box>
                <Text fontSize="lg" fontWeight="600" color="white" textTransform="uppercase">
                  {teamName}
                </Text>
                <Text fontSize="6xl" fontWeight="900" color="white" lineHeight="1" fontFamily="mono">
                  {game.homeScore}
                </Text>
                {/* Timeouts */}
                <Stack direction="row" gap={1} align="center">
                  <Text fontSize="xs" color="gray.400" mr={1}>TO:</Text>
                  {[1, 2, 3].map((i) => (
                    <Box
                      key={i}
                      w="12px"
                      h="12px"
                      borderRadius="full"
                      bg={i <= homeTimeouts ? 'yellow.400' : 'gray.600'}
                      border="1px solid"
                      borderColor={i <= homeTimeouts ? 'yellow.500' : 'gray.700'}
                    />
                  ))}
                </Stack>
              </Stack>

              {/* Center Section: Quarter & Clock */}
              <Stack flex={1} align="center" gap={2} px={4}>
                <Text fontSize="md" fontWeight="700" color="yellow.400" textTransform="uppercase">
                  Quarter {currentQuarter}
                </Text>
                <Text fontSize="5xl" fontWeight="900" color="white" fontFamily="mono" lineHeight="1">
                  {formatClock(timeRemaining)}
                </Text>
                <Stack direction="row" gap={2} mt={2}>
                  <Button
                    size="sm"
                    colorScheme={isClockRunning ? 'red' : 'green'}
                    onClick={isClockRunning ? stopClock : startClock}
                  >
                    {isClockRunning ? '⏸' : '▶'}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="solid" 
                    bg="gray.700" 
                    color="gray.300"
                    _hover={{ bg: 'gray.600' }}
                    onClick={resetClock}
                  >
                    Reset
                  </Button>
                  <Button 
                    size="sm" 
                    variant="solid" 
                    bg="gray.700" 
                    color="gray.300"
                    _hover={{ bg: 'gray.600' }}
                    onClick={nextQuarter}
                  >
                    Q{currentQuarter + 1}
                  </Button>
                </Stack>
              </Stack>

              {/* Opponent Team */}
              <Stack flex={1} align="center" gap={3}>
                <Box 
                  position="relative" 
                  cursor="pointer" 
                  onClick={() => openTimeoutModal('away')}
                  _hover={{ transform: 'scale(1.05)' }}
                  transition="all 0.2s"
                  title="Click to call timeout"
                >
                    {opponent?.colors?.logoUrl && (
                      <Image
                        src={opponent.colors.logoUrl}
                        alt={`${opponentName} logo`}
                        boxSize="80px"
                        objectFit="contain"
                        borderRadius="md"
                        border="2px solid"
                        borderColor={possession === 'away' ? 'yellow.400' : 'border.subtle'}
                        bg="white"
                        p={2}
                        boxShadow={possession === 'away' ? '0 0 20px rgba(250, 204, 21, 0.6)' : 'none'}
                      />
                    )}
                    {possession === 'away' && (
                      <Box
                        position="absolute"
                        top="-8px"
                        right="-8px"
                        bg="yellow.400"
                        color="black"
                        borderRadius="full"
                        px={2}
                        py={1}
                        fontSize="xs"
                        fontWeight="700"
                      >
                        ⚫
                      </Box>
                    )}
                  </Box>
                <Text fontSize="lg" fontWeight="600" color="white" textTransform="uppercase">
                  {opponentName}
                </Text>
                <Text fontSize="6xl" fontWeight="900" color="white" lineHeight="1" fontFamily="mono">
                  {game.oppScore}
                </Text>
                {/* Timeouts */}
                <Stack direction="row" gap={1} align="center">
                  <Text fontSize="xs" color="gray.400" mr={1}>TO:</Text>
                  {[1, 2, 3].map((i) => (
                    <Box
                      key={i}
                      w="12px"
                      h="12px"
                      borderRadius="full"
                      bg={i <= awayTimeouts ? 'yellow.400' : 'gray.600'}
                      border="1px solid"
                      borderColor={i <= awayTimeouts ? 'yellow.500' : 'gray.700'}
                    />
                  ))}
                </Stack>
              </Stack>
            </Stack>

            {/* Bottom Section: Game Situation */}
            <Box
              bg="rgba(0, 0, 0, 0.4)"
              borderRadius="lg"
              px={4}
              py={3}
              mt={4}
            >
              <Stack direction="row" justify="center" align="center" gap={8}>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">Down</Text>
                  <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="mono">
                    {down}
                  </Text>
                </Stack>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">To Go</Text>
                  <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="mono">
                    {yardsToGo}
                  </Text>
                </Stack>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">Ball On</Text>
                  <Text fontSize="2xl" fontWeight="700" color="yellow.400" fontFamily="mono">
                    {fieldPosition}
                  </Text>
                </Stack>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">Plays</Text>
                  <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="mono">
                    {game.plays.length}
                  </Text>
                </Stack>
              </Stack>
            </Box>
          </Box>

          {/* Field Visualization - Responsive */}
          <Box 
            w="full" 
            bg="rgba(0, 0, 0, 0.3)" 
            borderRadius="lg" 
            p={4}
            overflow="hidden"
          >
            <Box position="relative" w="full" h={{ base: '150px', md: '180px', lg: '200px' }}>
              <chakra.canvas 
                ref={canvasRef} 
                width="100%" 
                height="100%" 
                borderRadius="md"
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </Box>
            
            {/* Possession Toggle */}
            <Stack direction="row" justify="center" mt={3} gap={2}>
              <Button
                size="sm"
                bg={possession === 'home' ? 'blue.600' : 'gray.700'}
                color="white"
                _hover={{ bg: possession === 'home' ? 'blue.500' : 'gray.600' }}
                onClick={() => setPossession(possession === 'home' ? 'away' : 'home')}
                fontWeight="600"
              >
                {possession === 'home' ? `${team?.shortName || teamName} Ball` : `${opponent?.shortName || opponentName} Ball`}
              </Button>
              
              <Button
                size="sm"
                bg="purple.600"
                color="white"
                _hover={{ bg: 'purple.500' }}
                onClick={swapDirection}
                fontWeight="600"
                title="Swap which direction teams are going"
              >
                ⇄ Swap Direction
              </Button>
            </Stack>
          </Box>
        </Stack>
      </SectionCard>

      {/* Current Player Selection */}
      <SectionCard title="Active Player">
        <Stack gap={4}>
          {selectedPlayer ? (
            <Box
              border="2px solid"
              borderColor="brand.primary"
              borderRadius="md"
              px={4}
              py={3}
              bg="brand.surface"
            >
              <Stack direction="row" justify="space-between" align="center">
                <Stack gap={1}>
                  <Text fontWeight="600" fontSize="lg">
                    #{selectedPlayer.jerseyNumber} {selectedPlayer.name}
                  </Text>
                  <Text fontSize="sm" color="text.secondary">
                    {selectedPlayer.position || 'Player'}
                  </Text>
                </Stack>
                <Button
                  size="sm"
                  variant="ghost"
                  color="red.500"
                  onClick={() => setSelectedPlayer(null)}
                >
                  Clear
                </Button>
              </Stack>
            </Box>
          ) : (
            <Text fontSize="sm" color="text.secondary" textAlign="center">
              No player selected. Click a play button to choose a player.
            </Text>
          )}
          <Button
            variant="outline"
            borderColor="brand.primary"
            color="brand.primary"
            onClick={onOpen}
            size="sm"
          >
            Select Player
          </Button>
        </Stack>
      </SectionCard>

      <Box
        bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
        borderRadius="xl"
        p={6}
        border="3px solid"
        borderColor="brand.primary"
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
      >
        <Text fontSize="xl" fontWeight="700" mb={4} color="white" textTransform="uppercase">
          Quick Actions
        </Text>
        <Stack gap={4}>
          {/* Clear Selection Button - Show when a play type is selected */}
          {selectedPlayType && (
            <Button
              size="sm"
              variant="outline"
              borderColor="yellow.400"
              color="yellow.400"
              _hover={{ bg: 'rgba(250, 240, 137, 0.1)' }}
              onClick={() => setSelectedPlayType(null)}
              alignSelf="flex-start"
            >
              ← Back to Play Selection
            </Button>
          )}

          {/* Offensive Plays */}
          <Box>
            <Text fontSize="sm" fontWeight="600" mb={2} color="yellow.400" textTransform="uppercase">⚡ Offense</Text>
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
              {quickActions.filter(a => a.category === 'offense').map((action) => (
                <Button
                  key={action.label}
                  bg={action.color === 'green' ? 'green.600' : action.color === 'blue' ? 'blue.600' : 'gray.600'}
                  color="white"
                  _hover={{ 
                    bg: action.color === 'green' ? 'green.500' : action.color === 'blue' ? 'blue.500' : 'gray.500',
                    transform: 'scale(1.05)'
                  }}
                  transition="all 0.2s"
                  onClick={() => initiatePlay(action.type, action.yards, action.category)}
                  size="md"
                  fontWeight="700"
                  variant={selectedPlayType === (action.label === 'Run' ? 'run' : 'pass') ? 'solid' : 'outline'}
                  borderColor={selectedPlayType === (action.label === 'Run' ? 'run' : 'pass') ? 'yellow.400' : 'transparent'}
                  borderWidth="2px"
                >
                  {action.label}
                </Button>
              ))}
            </Grid>
          </Box>

          {/* Run Outcomes - Show only when Run is selected */}
          {selectedPlayType === 'run' && (
            <Box>
              <Text fontSize="sm" fontWeight="600" mb={2} color="green.400" textTransform="uppercase">🏃 Run Outcomes</Text>
              <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
                {quickActions.filter(a => a.category === 'run-outcome').map((action) => (
                  <Button
                    key={action.label}
                    bg={
                      action.color === 'green' ? 'green.600' : 
                      action.color === 'orange' ? 'orange.600' : 
                      action.color === 'cyan' ? 'cyan.600' : 
                      action.color === 'red' ? 'red.600' : 
                      action.color === 'gray' ? 'gray.600' : 
                      'gray.600'
                    }
                    color="white"
                    _hover={{ 
                      bg: action.color === 'green' ? 'green.500' : 
                          action.color === 'orange' ? 'orange.500' : 
                          action.color === 'cyan' ? 'cyan.500' : 
                          action.color === 'red' ? 'red.500' : 
                          action.color === 'gray' ? 'gray.500' : 
                          'gray.500',
                      transform: 'scale(1.05)'
                    }}
                    transition="all 0.2s"
                    onClick={() => initiatePlay(action.type, action.yards)}
                    size="md"
                    fontWeight="700"
                  >
                    {action.label}
                  </Button>
                ))}
              </Grid>
            </Box>
          )}

          {/* Pass Outcomes - Show only when Pass is selected */}
          {selectedPlayType === 'pass' && (
            <Box>
              <Text fontSize="sm" fontWeight="600" mb={2} color="blue.400" textTransform="uppercase">🏈 Pass Outcomes</Text>
              <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
                {quickActions.filter(a => a.category === 'pass-outcome').map((action) => (
                  <Button
                    key={action.label}
                    bg={
                      action.color === 'blue' ? 'blue.600' : 
                      action.color === 'gray' ? 'gray.600' : 
                      action.color === 'red' ? 'red.600' : 
                      action.color === 'purple' ? 'purple.600' : 
                      action.color === 'orange' ? 'orange.600' : 
                      action.color === 'green' ? 'green.600' : 
                      action.color === 'yellow' ? 'yellow.600' : 
                      'gray.600'
                    }
                    color="white"
                    _hover={{ 
                      bg: action.color === 'blue' ? 'blue.500' : 
                          action.color === 'gray' ? 'gray.500' : 
                          action.color === 'red' ? 'red.500' : 
                          action.color === 'purple' ? 'purple.500' : 
                          action.color === 'orange' ? 'orange.500' : 
                          action.color === 'green' ? 'green.500' : 
                          action.color === 'yellow' ? 'yellow.500' : 
                          'gray.500',
                      transform: 'scale(1.05)'
                    }}
                    transition="all 0.2s"
                    onClick={() => initiatePlay(action.type, action.yards)}
                    size="md"
                    fontWeight="700"
                  >
                    {action.label}
                  </Button>
                ))}
              </Grid>
            </Box>
          )}

          {/* Defensive Plays */}
          <Box>
            <Text fontSize="sm" fontWeight="600" mb={2} color="yellow.400" textTransform="uppercase">🛡️ Defense</Text>
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
              {quickActions.filter(a => a.category === 'defense').map((action) => (
                <Button
                  key={action.label}
                  bg={action.color === 'red' ? 'red.600' : action.color === 'purple' ? 'purple.600' : 'orange.600'}
                  color="white"
                  _hover={{ 
                    bg: action.color === 'red' ? 'red.500' : action.color === 'purple' ? 'purple.500' : 'orange.500',
                    transform: 'scale(1.05)'
                  }}
                  transition="all 0.2s"
                  onClick={() => initiatePlay(action.type, action.yards)}
                  size="md"
                  fontWeight="700"
                >
                  {action.label}
                </Button>
              ))}
            </Grid>
          </Box>

          {/* Kicking Plays */}
          <Box>
            <Text fontSize="sm" fontWeight="600" mb={2} color="yellow.400" textTransform="uppercase">🥾 Kicking</Text>
            <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
              {quickActions.filter(a => a.category === 'kicking').map((action) => (
                <Button
                  key={action.label}
                  bg="gray.600"
                  color="white"
                  _hover={{ 
                    bg: 'gray.500',
                    transform: 'scale(1.05)'
                  }}
                  transition="all 0.2s"
                  onClick={() => initiatePlay(action.type, action.yards)}
                  size="md"
                  fontWeight="700"
                >
                  {action.label}
                </Button>
              ))}
            </Grid>
          </Box>
        </Stack>
        <Button 
          bg="gray.700" 
          color="gray.300" 
          _hover={{ bg: 'gray.600' }}
          mt={4} 
          onClick={handleUndo}
          w="full"
          fontWeight="600"
        >
          ↩️ Undo Last Play
        </Button>
        {feedback && (
          <Box
            mt={4}
            border="2px solid"
            borderColor={feedback.status === 'success' ? 'green.400' : 'red.400'}
            borderRadius="md"
            px={4}
            py={3}
            bg="rgba(0, 0, 0, 0.4)"
          >
            <Text color={feedback.status === 'success' ? 'green.300' : 'red.300'} fontSize="sm" fontWeight="600">
              {feedback.message}
            </Text>
          </Box>
        )}
      </Box>

      <Box
        bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
        borderRadius="xl"
        p={6}
        border="3px solid"
        borderColor="brand.primary"
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
      >
        <Text fontSize="xl" fontWeight="700" mb={4} color="white" textTransform="uppercase">
          📋 Play-by-Play
        </Text>
        {game.plays.length === 0 ? (
          <Box 
            textAlign="center" 
            py={8}
            bg="rgba(0, 0, 0, 0.3)"
            borderRadius="lg"
          >
            <Text fontSize="md" color="gray.400">
              No plays logged yet. Use the quick actions to start tracking the drive.
            </Text>
          </Box>
        ) : (
          <Stack gap={3}>
            {game.plays
              .slice()
              .reverse()
              .map((play, index) => {
                const playerName = roster.find(p => p.id === play.playerId)?.name || 'Team';
                const isRecent = index < 3;
                return (
                  <Box
                    key={play.id}
                    border="2px solid"
                    borderColor={isRecent ? 'yellow.400' : 'gray.600'}
                    borderRadius="lg"
                    px={4}
                    py={3}
                    bg={isRecent ? 'rgba(250, 204, 21, 0.1)' : 'rgba(0, 0, 0, 0.4)'}
                    _hover={{ bg: 'rgba(250, 204, 21, 0.15)', borderColor: 'yellow.400' }}
                    transition="all 0.2s"
                  >
                    <Stack 
                      direction={{ base: 'column', md: 'row' }}
                      justify="space-between"
                      align={{ base: 'flex-start', md: 'center' }}
                      gap={2}
                    >
                      <Stack gap={1} flex={1}>
                        <Text fontWeight="700" color="white" fontSize="md">
                          {playerName} - {play.type} {play.yards > 0 ? `+${play.yards}` : play.yards < 0 ? play.yards : ''} yards
                        </Text>
                        <Text fontSize="sm" color="gray.400" fontFamily="mono">
                          {play.quarter && `Q${play.quarter} • `}
                          {play.down && play.distance && `${play.down} & ${play.distance} • `}
                          {formatTime(play.timestamp)}
                        </Text>
                      </Stack>
                      <Stack direction="row" gap={2}>
                        <Button
                          size="sm"
                          bg="blue.600"
                          color="white"
                          _hover={{ bg: 'blue.500' }}
                          onClick={() => openPlayEditor(play)}
                          fontWeight="600"
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          size="sm"
                          bg="red.600"
                          color="white"
                          _hover={{ bg: 'red.500' }}
                          onClick={() => deletePlay(play.id)}
                          fontWeight="600"
                        >
                          🗑️ Delete
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                );
              })}
          </Stack>
        )}
      </Box>

      {/* Player Picker Modal */}
      {isOpen && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            zIndex={1000}
            onClick={() => { onClose(); setPendingPlay(null); setJerseySearch(''); }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="white"
            borderRadius="lg"
            boxShadow="2xl"
            maxW="600px"
            w="90%"
            maxH="80vh"
            zIndex={1001}
            overflow="hidden"
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="1px solid" borderColor="border.subtle">
                <Text fontSize="xl" fontWeight="600">Select Player</Text>
              </Box>
              <Box px={6} py={4} overflowY="auto" maxH="60vh">
                <Stack gap={4}>
                  <Input
                    placeholder="Search by jersey # or name..."
                    value={jerseySearch}
                    onChange={(e) => setJerseySearch(e.target.value)}
                    size="lg"
                    autoFocus
                  />
                  {filteredRoster.length === 0 ? (
                    <Text textAlign="center" color="text.secondary" py={4}>
                      No players found. Add players to your roster first.
                    </Text>
                  ) : (
                    <SimpleGrid columns={{ base: 2, md: 3 }} gap={3}>
                      {filteredRoster.map((player) => (
                        <Button
                          key={player.id}
                          onClick={() => handlePlayerSelect(player)}
                          h="auto"
                          py={3}
                          flexDirection="column"
                          variant="outline"
                          borderColor="border.subtle"
                          _hover={{ borderColor: 'brand.primary', bg: 'brand.surface' }}
                        >
                          <Badge colorScheme="blue" mb={1}>
                            #{player.jerseyNumber}
                          </Badge>
                          <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                            {player.name}
                          </Text>
                          {player.position && (
                            <Text fontSize="xs" color="text.secondary">
                              {player.position}
                            </Text>
                          )}
                        </Button>
                      ))}
                    </SimpleGrid>
                  )}
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="1px solid" borderColor="border.subtle">
                <Button
                  variant="ghost"
                  onClick={() => { onClose(); setPendingPlay(null); setJerseySearch(''); }}
                  w="full"
                >
                  Cancel
                </Button>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Play Editor Modal */}
      {isEditOpen && editingPlay && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            zIndex={1000}
            onClick={onEditClose}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="white"
            borderRadius="lg"
            boxShadow="2xl"
            maxW="500px"
            w="90%"
            maxH="80vh"
            zIndex={1001}
            overflow="hidden"
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="1px solid" borderColor="border.subtle">
                <Text fontSize="xl" fontWeight="600">Edit Play</Text>
              </Box>
              <Box px={6} py={4} overflowY="auto">
                <Stack gap={4}>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2}>Player</Text>
                    <Text fontSize="md">{roster.find(p => p.id === editingPlay.playerId)?.name || 'Team'}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2}>Play Type</Text>
                    <Text fontSize="md">{editingPlay.type}</Text>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2}>Yards</Text>
                    <Input
                      type="number"
                      value={editForm.yards}
                      onChange={(e) => setEditForm({ ...editForm, yards: parseInt(e.target.value) || 0 })}
                      placeholder="Yards gained/lost"
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2}>Quarter</Text>
                    <SimpleGrid columns={4} gap={2}>
                      {[1, 2, 3, 4].map((q) => (
                        <Button
                          key={q}
                          variant={editForm.quarter === q ? 'solid' : 'outline'}
                          colorScheme={editForm.quarter === q ? 'blue' : 'gray'}
                          onClick={() => setEditForm({ ...editForm, quarter: q })}
                        >
                          Q{q}
                        </Button>
                      ))}
                    </SimpleGrid>
                  </Box>
                  <Stack direction="row" gap={4}>
                    <Box flex={1}>
                      <Text fontSize="sm" fontWeight="600" mb={2}>Down</Text>
                      <Input
                        type="number"
                        value={editForm.down}
                        onChange={(e) => setEditForm({ ...editForm, down: e.target.value })}
                        placeholder="1-4"
                        min={1}
                        max={4}
                      />
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="sm" fontWeight="600" mb={2}>Distance</Text>
                      <Input
                        value={editForm.distance}
                        onChange={(e) => setEditForm({ ...editForm, distance: e.target.value })}
                        placeholder="10"
                      />
                    </Box>
                  </Stack>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb={2}>Yard Line</Text>
                    <Input
                      type="number"
                      value={editForm.yardLine}
                      onChange={(e) => setEditForm({ ...editForm, yardLine: e.target.value })}
                      placeholder="50"
                      min={1}
                      max={99}
                    />
                  </Box>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="1px solid" borderColor="border.subtle">
                <Stack direction="row" gap={2}>
                  <Button colorScheme="blue" onClick={savePlayEdits} flex={1}>
                    Save Changes
                  </Button>
                  <Button variant="ghost" onClick={onEditClose} flex={1}>
                    Cancel
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Play Input Modal - New Flow */}
      {isPlayInputOpen && playInput && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => { onPlayInputClose(); setPlayInput(null); }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="3px solid"
            borderColor="yellow.400"
            maxW="600px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="yellow.400">
                <Text fontSize="xl" fontWeight="700" color="white">Record Play: {playInput.type}</Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  {/* Determine if this is a pass play */}
                  {(() => {
                    const action = quickActions.find(a => a.type === playInput.type);
                    const isPassPlay = action?.category === 'pass-outcome';
                    const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
                    
                    return (
                      <>
                        {/* Passer Selection - For pass plays only */}
                        {isPassPlay && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="blue.400" mb={2}>Select Passer (Required)</Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={jerseySearch}
                              onChange={(e) => setJerseySearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                            />
                            {filteredRoster.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredRoster.map((player) => (
                                  <Button
                                    key={player.id}
                                    onClick={() => setPlayInput({...playInput, passer: player})}
                                    h="auto"
                                    py={2}
                                    flexDirection="column"
                                    variant="outline"
                                    borderColor={playInput.passer?.id === player.id ? 'blue.400' : 'gray.600'}
                                    bg={playInput.passer?.id === player.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                    color="white"
                                    _hover={{ borderColor: 'blue.400', bg: 'rgba(59, 130, 246, 0.15)' }}
                                  >
                                    <Badge colorScheme="blue" mb={1}>
                                      #{player.jerseyNumber}
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="600">
                                      {player.name}
                                    </Text>
                                  </Button>
                                ))}
                              </SimpleGrid>
                            )}
                          </Box>
                        )}

                        {/* Receiver Selection - For complete passes only */}
                        {isPassPlay && isCompletePass && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="green.400" mb={2}>Select Receiver (Required)</Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={jerseySearch}
                              onChange={(e) => setJerseySearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                            />
                            {filteredRoster.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredRoster.map((player) => (
                                  <Button
                                    key={player.id}
                                    onClick={() => setPlayInput({...playInput, receiver: player})}
                                    h="auto"
                                    py={2}
                                    flexDirection="column"
                                    variant="outline"
                                    borderColor={playInput.receiver?.id === player.id ? 'green.400' : 'gray.600'}
                                    bg={playInput.receiver?.id === player.id ? 'rgba(34, 197, 94, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                    color="white"
                                    _hover={{ borderColor: 'green.400', bg: 'rgba(34, 197, 94, 0.15)' }}
                                  >
                                    <Badge colorScheme="green" mb={1}>
                                      #{player.jerseyNumber}
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="600">
                                      {player.name}
                                    </Text>
                                  </Button>
                                ))}
                              </SimpleGrid>
                            )}
                          </Box>
                        )}

                        {/* Player Selection - For run plays and other plays */}
                        {!isPassPlay && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="yellow.400" mb={2}>Select Player</Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={jerseySearch}
                              onChange={(e) => setJerseySearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                            />
                            {filteredRoster.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredRoster.map((player) => (
                                  <Button
                                    key={player.id}
                                    onClick={() => setPlayInput({...playInput, player})}
                                    h="auto"
                                    py={2}
                                    flexDirection="column"
                                    variant="outline"
                                    borderColor={playInput.player?.id === player.id ? 'yellow.400' : 'gray.600'}
                                    bg={playInput.player?.id === player.id ? 'rgba(250, 204, 21, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                    color="white"
                                    _hover={{ borderColor: 'yellow.400', bg: 'rgba(250, 204, 21, 0.15)' }}
                                  >
                                    <Badge colorScheme="yellow" mb={1}>
                                      #{player.jerseyNumber}
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="600">
                                      {player.name}
                                    </Text>
                                  </Button>
                                ))}
                              </SimpleGrid>
                            )}
                          </Box>
                        )}
                      </>
                    );
                  })()}

                  {/* Yard Input */}
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="yellow.400" mb={2}>Play Result (Yards)</Text>
                    <Stack direction="row" gap={2} align="center">
                      <Text color="white" fontSize="sm" minW="80px">Start Yard:</Text>
                      <Input
                        type="number"
                        value={playInput.startYard}
                        onChange={(e) => {
                          const start = parseInt(e.target.value) || 0;
                          setPlayInput({...playInput, startYard: start});
                        }}
                        bg="rgba(0, 0, 0, 0.4)"
                        borderColor="gray.600"
                        color="white"
                        w="100px"
                      />
                    </Stack>
                    <Stack direction="row" gap={2} align="center" mt={2}>
                      <Text color="white" fontSize="sm" minW="80px">End Yard:</Text>
                      <Input
                        type="number"
                        value={playInput.endYard}
                        onChange={(e) => {
                          const end = parseInt(e.target.value) || 0;
                          setPlayInput({...playInput, endYard: end, yards: end - playInput.startYard});
                        }}
                        bg="rgba(0, 0, 0, 0.4)"
                        borderColor="gray.600"
                        color="white"
                        w="100px"
                      />
                    </Stack>
                    <Text color="yellow.400" fontSize="md" fontWeight="700" mt={2}>
                      Result: {playInput.endYard - playInput.startYard > 0 ? '+' : ''}{playInput.endYard - playInput.startYard} yards
                    </Text>
                  </Box>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="yellow.400">
                <Stack direction="row" gap={2}>
                  <Button
                    bg="yellow.500"
                    color="black"
                    _hover={{ bg: 'yellow.400' }}
                    onClick={submitPlay}
                    flex={1}
                    fontWeight="700"
                    disabled={(() => {
                      const action = quickActions.find(a => a.type === playInput.type);
                      const isPassPlay = action?.category === 'pass-outcome';
                      const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
                      
                      if (isPassPlay) {
                        // Pass plays require passer, and receiver if complete
                        if (!playInput.passer) return true;
                        if (isCompletePass && !playInput.receiver) return true;
                        return false;
                      } else {
                        // Run plays and others require player
                        return !playInput.player;
                      }
                    })()}
                  >
                    ✓ Record Play
                  </Button>
                  <Button
                    bg="gray.700"
                    color="white"
                    _hover={{ bg: 'gray.600' }}
                    onClick={() => { onPlayInputClose(); setPlayInput(null); setJerseySearch(''); }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Timeout Modal */}
      {isTimeoutOpen && timeoutTeam && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => { onTimeoutClose(); setTimeoutTeam(null); setTimeoutTime(''); }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="3px solid"
            borderColor="yellow.400"
            maxW="500px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="yellow.400">
                <Text fontSize="xl" fontWeight="700" color="white">
                  ⏱️ Timeout - {timeoutTeam === 'home' ? teamName : opponentName}
                </Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  <Text color="white" fontSize="md">
                    Recording timeout for <Text as="span" fontWeight="700" color="yellow.400">{timeoutTeam === 'home' ? teamName : opponentName}</Text>
                  </Text>
                  
                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="yellow.400" mb={2}>
                      Timeouts Remaining: {timeoutTeam === 'home' ? homeTimeouts - 1 : awayTimeouts - 1} of 3
                    </Text>
                  </Box>

                  <Box>
                    <Text fontSize="sm" fontWeight="600" color="yellow.400" mb={2}>
                      Game Time
                    </Text>
                    <Input
                      value={timeoutTime}
                      onChange={(e) => setTimeoutTime(e.target.value)}
                      placeholder="MM:SS"
                      bg="rgba(0, 0, 0, 0.4)"
                      borderColor="gray.600"
                      color="white"
                      _placeholder={{ color: 'gray.400' }}
                      size="lg"
                    />
                    <Text fontSize="xs" color="gray.400" mt={1}>
                      Quarter {currentQuarter}
                    </Text>
                  </Box>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="yellow.400">
                <Stack direction="row" gap={2}>
                  <Button
                    bg="yellow.500"
                    color="black"
                    _hover={{ bg: 'yellow.400' }}
                    onClick={recordTimeout}
                    flex={1}
                    fontWeight="700"
                  >
                    ✓ Charge Timeout
                  </Button>
                  <Button
                    bg="gray.700"
                    color="white"
                    _hover={{ bg: 'gray.600' }}
                    onClick={() => { onTimeoutClose(); setTimeoutTeam(null); setTimeoutTime(''); }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}
    </Stack>
  );
};

export default ScoringScreen;







