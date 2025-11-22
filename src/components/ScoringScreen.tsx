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
  status: 'success' | 'error' | 'info';
  message: string;
};

type PlayInputState = {
  type: PlayType;
  player: Player | null;
  passer: Player | null;
  receiver: Player | null;
  defensivePlayer: Player | null; // For INTs, sacks, tackles, etc.
  yards: number;
  startYard: number;
  interceptionYard: number; // Where the INT was caught (for interceptions)
  endYard: number;
  side: 'home' | 'away';
} | null;

const formatTime = (timestamp: Timestamp) =>
  timestamp.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatQuarterLabel = (quarter: number) => {
  if (quarter <= 4) return `Q${quarter}`;
  const otNumber = quarter - 4;
  return `OT${otNumber}`;
};

const formatBallDisplay = (spot: number, homeLabel: string, awayLabel: string) => {
  const yard = clamp(Math.round(spot), 0, 100);
  if (yard === 50) return '50';
  if (yard < 50) return `${homeLabel} ${yard}`;
  return `${awayLabel} ${100 - yard}`;
};

// Updated to use PlayType enum - simplified for manual input
const quickActions = [
  // Offensive - no preset yards (these are just UI triggers, not actual plays)
  { label: 'Run', type: PlayType.RUSH, yards: 0, color: 'green', category: 'offense' },
  // Note: Pass button removed from this list since PASS_COMPLETE should only match pass-outcome
  
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
  
  // Kicking
  { label: 'Kickoff', type: PlayType.KICKOFF, yards: 0, color: 'purple', category: 'kicking' },
  { label: 'Punt', type: PlayType.PUNT, yards: 0, color: 'gray', category: 'kicking' },
  { label: 'Field Goal', type: PlayType.FIELD_GOAL_MADE, yards: 0, color: 'teal', category: 'kicking', points: 3 },
  { label: 'FG Missed', type: PlayType.FIELD_GOAL_MISSED, yards: 0, color: 'red', category: 'kicking' },
  { label: 'XP Kick', type: PlayType.EXTRA_POINT_KICK_MADE, yards: 0, color: 'teal', category: 'kicking', points: 1 },
  { label: 'XP Missed', type: PlayType.EXTRA_POINT_KICK_MISSED, yards: 0, color: 'red', category: 'kicking' },
  { label: '2PT Conv', type: PlayType.TWO_POINT_CONVERSION_MADE, yards: 0, color: 'cyan', category: 'kicking', points: 2 },
  { label: '2PT Failed', type: PlayType.TWO_POINT_CONVERSION_FAILED, yards: 0, color: 'red', category: 'kicking' },
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

  // Defensive result state
  const [defensiveResult, setDefensiveResult] = useState<{
    type: 'tackle' | 'penalty' | null;
    tacklers: Player[]; // Up to 3 players who made the tackle
  } | null>(null);

  // Player selection state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ type: PlayType; yards: number; side: 'home' | 'away' } | null>(null);
  const [jerseySearch, setJerseySearch] = useState<string>('');
  const [passerSearch, setPasserSearch] = useState<string>('');
  const [receiverSearch, setReceiverSearch] = useState<string>('');
  const [defenseSearch, setDefenseSearch] = useState<string>('');
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const [lastRusher, setLastRusher] = useState<Player | null>(null); // Remember last rusher
  const [lastPasser, setLastPasser] = useState<Player | null>(null); // Remember last passer
  const [lastReceiver, setLastReceiver] = useState<Player | null>(null); // Remember last receiver

  // Play editor state
  const [editingPlay, setEditingPlay] = useState<Play | null>(null);
  const { open: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const [editForm, setEditForm] = useState({
    playerId: '',
    playType: '',
    yards: 0,
    quarter: 1,
    down: '',
    distance: '',
    yardLine: '',
  });
  const [editTacklers, setEditTacklers] = useState<Player[]>([]);
  const [editDefenseSearch, setEditDefenseSearch] = useState<string>('');
  const [editPlayerSearch, setEditPlayerSearch] = useState<string>('');

  // Quick stats panel
  const { open: isStatsOpen, onOpen: onStatsOpen, onClose: onStatsClose } = useDisclosure();
  const [statsView, setStatsView] = useState<'players' | 'reports'>('players');

  // Game clock state
  const [currentQuarter, setCurrentQuarter] = useState<number>(1);
  const [timeRemaining, setTimeRemaining] = useState<number>(12 * 60); // 12 minutes in seconds
  const [isClockRunning, setIsClockRunning] = useState<boolean>(false);
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef<boolean>(true); // Track if this is the first load
  const gameRef = useRef<Game | null>(null); // Store game for save operations

  // Field position state
  const [fieldPosition, setFieldPosition] = useState<number>(25); // Starting at own 25
  const [possession, setPossession] = useState<'home' | 'away'>('home');
  const [down, setDown] = useState<number>(1);
  const [yardsToGo, setYardsToGo] = useState<number>(10);
  const [direction, setDirection] = useState<'left-to-right' | 'right-to-left'>('left-to-right'); // Which way home team is going
  const [possessionClockStart, setPossessionClockStart] = useState<number>(12 * 60);
  const [homeTopSeconds, setHomeTopSeconds] = useState<number>(0);
  const [awayTopSeconds, setAwayTopSeconds] = useState<number>(0);
  const [openingKickoffReceiver, setOpeningKickoffReceiver] = useState<'home' | 'away' | null>(null); // Track who received opening kickoff
  const [pendingPossessionReason, setPendingPossessionReason] = useState<string | null>(null);
  const [clockMinutes, setClockMinutes] = useState<number>(12);
  const [clockSeconds, setClockSeconds] = useState<number>(0);
  const [clockDigits, setClockDigits] = useState<string>('1200');
  const handleJerseyDigit = (digit: number) => {
    setJerseySearch((prev) => `${prev}${digit}`);
  };
  const handleJerseyBackspace = () => {
    setJerseySearch((prev) => prev.slice(0, -1));
  };
  const handleJerseyClear = () => setJerseySearch('');
  const [showJerseyPad, setShowJerseyPad] = useState<boolean>(false);
  
  // Return yard number pad handlers
  const handleReturnYardDigit = (digit: number) => {
    const newValue = returnYardValue === '0' ? `${digit}` : `${returnYardValue}${digit}`;
    const numValue = parseInt(newValue);
    if (numValue <= 50) {
      setReturnYardValue(newValue);
      const actualYard = convertFromPlCt(returnYardSide, numValue);
      setPlayInput(prev => prev ? { ...prev, endYard: actualYard } : prev);
    }
  };
  const handleReturnYardBackspace = () => {
    const newValue = returnYardValue.slice(0, -1) || '0';
    setReturnYardValue(newValue);
    const numValue = parseInt(newValue);
    const actualYard = convertFromPlCt(returnYardSide, numValue);
    setPlayInput(prev => prev ? { ...prev, endYard: actualYard } : prev);
  };
  const handleReturnYardClear = () => {
    setReturnYardValue('0');
    const actualYard = convertFromPlCt(returnYardSide, 0);
    setPlayInput(prev => prev ? { ...prev, endYard: actualYard } : prev);
  };
  
  const {
    open: isPossessionPromptOpen,
    onOpen: onPossessionPromptOpen,
    onClose: onPossessionPromptClose,
  } = useDisclosure();

  // Timeout state
  const [homeTimeouts, setHomeTimeouts] = useState<number>(3);
  const [awayTimeouts, setAwayTimeouts] = useState<number>(3);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away' | null>(null);

  // Interception time state (for possession change tracking)
  const [pendingInterception, setPendingInterception] = useState<{
    play: Play;
    nextGame: any;
  } | null>(null);
  const { open: isInterceptionTimeOpen, onOpen: onInterceptionTimeOpen, onClose: onInterceptionTimeClose } = useDisclosure();
  const [interceptionTime, setInterceptionTime] = useState<string>('');

  // Quarter change confirmation state
  const [pendingQuarterChange, setPendingQuarterChange] = useState<{ newQuarter: number } | null>(null);
  const { open: isQuarterChangeOpen, onOpen: onQuarterChangeOpen, onClose: onQuarterChangeClose } = useDisclosure();

  // Extra point / 2PT conversion state (after touchdowns)
  const [pendingExtraPoint, setPendingExtraPoint] = useState<{
    scoringTeam: 'home' | 'away';
    tdGame: any;
  } | null>(null);
  const { open: isExtraPointOpen, onOpen: onExtraPointOpen, onClose: onExtraPointClose } = useDisclosure();
  const [extraPointType, setExtraPointType] = useState<'xp-made' | 'xp-missed' | '2pt-made' | '2pt-failed' | null>(null);
  const [extraPointPlayer, setExtraPointPlayer] = useState<Player | null>(null);
  const [extraPointSearch, setExtraPointSearch] = useState<string>('');
  const [pendingKickoff, setPendingKickoff] = useState<{ kickingTeam: 'home' | 'away' } | null>(null);

  // Kickoff return state
  const [pendingKickoffReturn, setPendingKickoffReturn] = useState<{
    kickPlay: Play;
    kickEndYard: number;
    kickingTeam: 'home' | 'away';
    kickGame: any;
  } | null>(null);
  const { open: isKickoffReturnOpen, onOpen: onKickoffReturnOpen, onClose: onKickoffReturnClose } = useDisclosure();
  const [kickoffReturner, setKickoffReturner] = useState<Player | null>(null);
  const [kickoffReturnSearch, setKickoffReturnSearch] = useState<string>('');
  const [returnYardSide, setReturnYardSide] = useState<'PL' | 'CT'>('CT');
  const [returnYardValue, setReturnYardValue] = useState<string>('50');
  const [showReturnYardPad, setShowReturnYardPad] = useState<boolean>(false);

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

  // Update roster with recalculated stats when game changes
  useEffect(() => {
    if (game) {
      const rosterWithStats = getMyTeamRoster(game);
      console.log('Game roster with stats:', rosterWithStats);
      if (rosterWithStats.length > 0) {
        console.log('Sample player stats:', rosterWithStats[0]?.stats);
        setRoster(rosterWithStats);
      }
    }
  }, [game]);

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
  
  const openClockAdjustment = () => {
    setClockMinutes(Math.floor(timeRemaining / 60));
    setClockSeconds(timeRemaining % 60);
    setPendingPossessionReason('Clock adjustment');
    setTimeoutTeam(null); // Not a timeout, just a clock adjustment
    onPossessionPromptOpen();
  };
  
  const changeQuarter = (delta: number) => {
    const newQuarter = Math.max(1, currentQuarter + delta);
    if (newQuarter !== currentQuarter) {
      setPendingQuarterChange({ newQuarter });
      onQuarterChangeOpen();
    }
  };
  
  const confirmQuarterChange = async () => {
    if (!pendingQuarterChange) return;
    
    // Calculate time of possession for the quarter that just ended
    const quarterElapsed = 12 * 60 - timeRemaining;
    
    // Set new quarter
    setCurrentQuarter(pendingQuarterChange.newQuarter);
    
    // Reset clock to 12:00
    setTimeRemaining(12 * 60);
    setIsClockRunning(false);
    
    // Reset possession clock start to 12:00 (start of new quarter)
    // The possession will accumulate from here until next change
    setPossessionClockStart(12 * 60);
    
    // Swap field direction (quarters 2 and 4 swap directions)
    const willSwapDirection = pendingQuarterChange.newQuarter === 2 || pendingQuarterChange.newQuarter === 4;
    if (willSwapDirection) {
      swapDirection();
    }
    
    // Handle halftime kickoff (start of Q3)
    // The team that received the opening kickoff kicks off at halftime
    if (pendingQuarterChange.newQuarter === 3 && openingKickoffReceiver) {
      const halftimeKickingTeam = openingKickoffReceiver; // The team that received opening kickoff now kicks
      
      await logGameEvent(
        `Second half kickoff by ${halftimeKickingTeam === 'home' ? teamName : opponentName}`,
        PlayType.OTHER
      );
      
      // Setup kickoff modal for halftime kickoff
      setPendingKickoff({ kickingTeam: halftimeKickingTeam });
      setClockMinutes(Math.floor(timeRemaining / 60));
      setClockSeconds(timeRemaining % 60);
      setPendingPossessionReason(`Halftime kickoff by ${halftimeKickingTeam === 'home' ? teamName : opponentName}`);
      onPossessionPromptOpen();
    }
    
    // Log quarter change to play-by-play
    const quarterName = formatQuarterLabel(pendingQuarterChange.newQuarter);
    await logGameEvent(
      `${quarterName} started. Clock reset to 12:00.${willSwapDirection ? ' Teams switched sides.' : ''}`,
      PlayType.OTHER
    );
    
    onQuarterChangeClose();
    setPendingQuarterChange(null);
    
    setFeedback({ 
      status: 'success', 
      message: `Quarter ${pendingQuarterChange.newQuarter} started. Direction swapped. Clock reset to 12:00.` 
    });
  };

  // Helper function to log game events to play-by-play
  const logGameEvent = async (description: string, eventType: PlayType = PlayType.OTHER) => {
    if (!game || !teamId || !activeSeasonId) return;
    
    const eventPlay: Play = {
      id: uuidv4(),
      type: eventType,
      yards: 0,
      playerId: 'team-placeholder-player',
      description,
      timestamp: Timestamp.now(),
      quarter: currentQuarter,
      teamSide: possession,
    };
    
    const updatedGame = addPlayAndRecalc(game, eventPlay);
    setGame(updatedGame);
    await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
  };

  const setManualDown = (value: number) => setDown(clamp(Math.round(value) || 1, 1, 4));
  const setManualDistance = (value: number) => setYardsToGo(clamp(Math.round(value) || 1, 1, 99));
  const setManualBallSpot = (value: number) => setFieldPosition(clamp(value || 0, 0, 100));
  
  // Helper to advance ball toward opponent's goal (accounts for direction)
  const advanceBall = () => {
    // Home team attacks toward 100 when left-to-right, toward 0 when right-to-left
    // Away team attacks toward 0 when left-to-right, toward 100 when right-to-left
    const shouldIncrease = 
      (possession === 'home' && direction === 'left-to-right') ||
      (possession === 'away' && direction === 'right-to-left');
    
    const newPosition = shouldIncrease ? fieldPosition + 1 : fieldPosition - 1;
    setFieldPosition(clamp(newPosition, 0, 100));
  };
  
  // Helper to retreat ball toward own goal (accounts for direction)
  const retreatBall = () => {
    // Home team retreats toward 0 when left-to-right, toward 100 when right-to-left
    // Away team retreats toward 100 when left-to-right, toward 0 when right-to-left
    const shouldIncrease = 
      (possession === 'home' && direction === 'right-to-left') ||
      (possession === 'away' && direction === 'left-to-right');
    
    const newPosition = shouldIncrease ? fieldPosition + 1 : fieldPosition - 1;
    setFieldPosition(clamp(newPosition, 0, 100));
  };

  const updateClockFromDigits = (raw: string) => {
    const clean = raw.replace(/\D/g, '').slice(-4);
    const padded = clean.padStart(2, '0');
    const minsPart = padded.length > 2 ? padded.slice(0, padded.length - 2) : '0';
    const secsPart = padded.slice(-2);
    const mins = clamp(parseInt(minsPart, 10) || 0, 0, 12);
    const secs = clamp(parseInt(secsPart, 10) || 0, 0, 59);
    setClockMinutes(mins);
    setClockSeconds(secs);
    setClockDigits(clean);
  };

  const handleDigitPress = (digit: number) => {
    updateClockFromDigits(clockDigits + digit.toString());
  };

  const handleClockClear = () => {
    setClockDigits('');
    setClockMinutes(0);
    setClockSeconds(0);
  };

  const adjustMinutes = (delta: number) => {
    setClockMinutes((prev) => clamp(prev + delta, 0, 12));
  };

  const adjustSeconds = (delta: number) => {
    setClockSeconds((prevSecs) => {
      let nextSecs = prevSecs + delta;
      let nextMins = clockMinutes;
      while (nextSecs >= 60) {
        nextSecs -= 60;
        nextMins = clamp(nextMins + 1, 0, 12);
      }
      while (nextSecs < 0) {
        nextSecs += 60;
        nextMins = clamp(nextMins - 1, 0, 12);
      }
      setClockMinutes(nextMins);
      return nextSecs;
    });
  };

  const formatTop = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const recordPossessionTime = (side: 'home' | 'away') => {
    const delta = Math.max(0, possessionClockStart - timeRemaining);
    if (delta > 0) {
      if (side === 'home') {
        setHomeTopSeconds((prev) => prev + delta);
      } else {
        setAwayTopSeconds((prev) => prev + delta);
      }
    }
    setPossessionClockStart(timeRemaining);
  };

  const changePossession = async (reason?: string) => {
    recordPossessionTime(possession);
    const oldPossession = possession;
    const newPossession = oldPossession === 'home' ? 'away' : 'home';
    setPossession(newPossession);
    
    // Log possession change to play-by-play
    const possessionTeam = newPossession === 'home' ? teamName : opponentName;
    const changeReason = reason || 'Possession change';
    await logGameEvent(
      `${changeReason}. ${possessionTeam} takes possession.`,
      PlayType.OTHER
    );
    
    if (reason) {
      setFeedback({ status: 'info', message: reason });
    }
  };

  const requestPossessionChange = (reason: string) => {
    setPendingPossessionReason(reason);
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    setClockMinutes(mins);
    setClockSeconds(secs);
    setClockDigits(`${mins}${secs.toString().padStart(2, '0')}`);
    onPossessionPromptOpen();
  };

  const confirmPossessionChange = async () => {
    const nextTime = clamp(clockMinutes * 60 + clockSeconds, 0, 12 * 60);
    setTimeRemaining(nextTime);
    setPossessionClockStart(nextTime);
    
    // If this is a timeout, record it and don't change possession
    if (timeoutTeam) {
      await recordTimeout();
      onPossessionPromptClose();
      return;
    }
    
    // If this is just a clock adjustment (no timeout, no kickoff, no possession change)
    if (pendingPossessionReason === 'Clock adjustment') {
      onPossessionPromptClose();
      setPendingPossessionReason(null);
      return;
    }
    
    // If this is a kickoff after scoring, setup the kickoff position
    if (pendingKickoff) {
      const kickingTeam = pendingKickoff.kickingTeam;
      
      // Change possession to the scoring team (they kick off)
      changePossession(`Kickoff by ${kickingTeam === 'home' ? teamName : opponentName}`);
      
      // Place ball at kicking team's 40-yard line
      // If home team is kicking: their 40 is at position 40
      // If away team is kicking: their 40 is at position 60 (100 - 40)
      const kickoffPosition = kickingTeam === 'home' ? 40 : 60;
      setFieldPosition(kickoffPosition);
      setYardsToGo(10);
      setDown(1);
      
      setPendingKickoff(null);
    } else {
      changePossession(pendingPossessionReason || 'Possession flipped');
    }
    
    setPendingPossessionReason(null);
    onPossessionPromptClose();
  };

  // Helper functions to convert between 0-100 yard scale and PL/CT format
  const convertToPlCt = (yard: number): { side: 'PL' | 'CT', value: number } => {
    if (yard === 50) return { side: 'CT', value: 50 };
    if (yard < 50) return { side: 'PL', value: yard };
    return { side: 'CT', value: 100 - yard };
  };

  const convertFromPlCt = (side: 'PL' | 'CT', value: number): number => {
    if (side === 'CT' && value === 50) return 50;
    if (side === 'PL') return value;
    return 100 - value; // CT side (opponent's side)
  };

  // Play yard helpers (functional updates to avoid stale state and keep fields in sync)
  const setPlayStart = (value: number) => {
    const start = clamp(Math.round(value) || 0, 0, 100);
    if (!playInput) return;
    setPlayInput({ ...playInput, startYard: start });
  };

  const setPlayEnd = (value: number) => {
    const end = clamp(Math.round(value) || 0, 0, 100);
    if (!playInput) return;
    const yards = end - playInput.startYard;
    setPlayInput({ ...playInput, endYard: end, yards });
  };

  const setPlayYards = (value: number) => {
    if (!playInput) return;
    const yards = Math.round(value) || 0;
    const end = clamp(playInput.startYard + yards, 0, 100);
    const adjustedYards = end - playInput.startYard;
    setPlayInput({ ...playInput, yards: adjustedYards, endYard: end });
  };

  useEffect(() => {
    if (!teamId || !activeSeasonId || !gameId || gameId === 'new') {
      setLoading(false);
      setGame(null);
      return;
    }

    // Reset initial load flag when game changes
    isInitialLoadRef.current = true;

    const unsubscribe = subscribeToGame(
      gameId,
      (snapshot) => {
        setGame(snapshot);
        gameRef.current = snapshot; // Store in ref for save operations
        setLoading(false);
        
        // Only restore game state on initial load, not on subsequent updates
        if (snapshot && isInitialLoadRef.current) {
          if (snapshot.currentQuarter !== undefined) setCurrentQuarter(snapshot.currentQuarter);
          if (snapshot.timeRemaining !== undefined) setTimeRemaining(snapshot.timeRemaining);
          if (snapshot.possession !== undefined) setPossession(snapshot.possession);
          if (snapshot.down !== undefined) setDown(snapshot.down);
          if (snapshot.yardsToGo !== undefined) setYardsToGo(snapshot.yardsToGo);
          if (snapshot.fieldPosition !== undefined) setFieldPosition(snapshot.fieldPosition);
          if (snapshot.direction !== undefined) setDirection(snapshot.direction);
          if (snapshot.homeTimeouts !== undefined) setHomeTimeouts(snapshot.homeTimeouts);
          if (snapshot.awayTimeouts !== undefined) setAwayTimeouts(snapshot.awayTimeouts);
          if (snapshot.possessionClockStart !== undefined) setPossessionClockStart(snapshot.possessionClockStart);
          if (snapshot.homeTopSeconds !== undefined) setHomeTopSeconds(snapshot.homeTopSeconds);
          if (snapshot.awayTopSeconds !== undefined) setAwayTopSeconds(snapshot.awayTopSeconds);
          if (snapshot.openingKickoffReceiver !== undefined) setOpeningKickoffReceiver(snapshot.openingKickoffReceiver);
          
          isInitialLoadRef.current = false; // Mark that initial load is complete
        }
      },
      { teamId, seasonId: activeSeasonId }
    );

    return unsubscribe;
  }, [teamId, activeSeasonId, gameId]);

  // Save game state whenever it changes
  useEffect(() => {
    if (!gameRef.current || !teamId || !activeSeasonId || gameId === 'new' || isInitialLoadRef.current) return;

    const timeoutId = setTimeout(async () => {
      const updatedGame: Game = {
        ...gameRef.current!,
        currentQuarter,
        timeRemaining,
        possession,
        down,
        yardsToGo,
        fieldPosition,
        direction,
        homeTimeouts,
        awayTimeouts,
        possessionClockStart,
        homeTopSeconds,
        awayTopSeconds,
        openingKickoffReceiver,
      };
      
      try {
        await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      } catch (error) {
        console.error('Failed to save game state', error);
      }
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(timeoutId);
  }, [
    currentQuarter,
    timeRemaining,
    possession,
    down,
    yardsToGo,
    fieldPosition,
    direction,
    homeTimeouts,
    awayTimeouts,
    possessionClockStart,
    homeTopSeconds,
    awayTopSeconds,
    openingKickoffReceiver,
    homeTopSeconds,
    awayTopSeconds,
    // Note: Don't include 'game' to avoid save loops when Firestore updates
    teamId,
    activeSeasonId,
    gameId,
  ]);

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
      
      const TOTAL_YARDS = 120; // 100 field + 10 each end zone
      const FIELD_YARDS = 100;
      const ENDZONE_YARDS = 10;

      const endZoneWidth = width * (ENDZONE_YARDS / TOTAL_YARDS);
      const fieldWidth = width * (FIELD_YARDS / TOTAL_YARDS);

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

      const toX = (yard: number) => {
        const clamped = clamp(yard, 0, FIELD_YARDS);
        return endZoneWidth + (clamped / FIELD_YARDS) * fieldWidth;
      };

      // Draw yard lines (every 5 yards; 10-yard lines bolder, 50 boldest)
      for (let yard = 0; yard <= 100; yard += 5) {
        const x = toX(yard);
        if (yard === 0 || yard === 100) continue;

        const isTen = yard % 10 === 0;
        const isMid = yard === 50;
        ctx.strokeStyle = isMid || isTen ? '#ffffff' : 'rgba(255,255,255,0.4)';
        ctx.lineWidth = isMid ? 4 : isTen ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        if (isTen && yard !== 50) {
          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(12, height * 0.1)}px Arial`;
          ctx.textAlign = 'center';
          const yardLabel = yard <= 50 ? yard : 100 - yard;
          // place numbers near bottom sideline
          ctx.fillText(yardLabel.toString(), x, height - 6);
        }
      }

      // Down & distance badge
      const badgeText = `${down} & ${yardsToGo}`;
      const badgeFontSize = Math.max(14, height * 0.12);
      ctx.font = `bold ${badgeFontSize}px Arial`;
      ctx.textAlign = 'center';
      const metrics = ctx.measureText(badgeText);
      const padX = 10;
      const padY = 6;
      const badgeWidth = metrics.width + padX * 2;
      const badgeHeight = badgeFontSize + padY * 2;
      const badgeX = endZoneWidth + fieldWidth / 2 - badgeWidth / 2;
      const badgeY = height * 0.05;

      const radius = 8;
      const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      };

      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      drawRoundedRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
      ctx.fill();
      ctx.strokeStyle = '#ffd52e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#00e7ff';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + badgeFontSize * 0.32);
      ctx.shadowBlur = 0;

      // Hash marks every yard (NFL-ish thirds: top, middle-ish, bottom)
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      const hashInsetTop = height * 0.15;
      const hashInsetBottom = height * 0.15;
      const hashInsetMiddle = height * 0.5;
      const hashLen = Math.max(4, height * 0.018);
      for (let yard = 1; yard < 100; yard++) {
        const x = toX(yard);
        ctx.beginPath();
        // top
        ctx.moveTo(x, hashInsetTop);
        ctx.lineTo(x, hashInsetTop + hashLen);
        // middle
        ctx.moveTo(x, hashInsetMiddle - hashLen / 2);
        ctx.lineTo(x, hashInsetMiddle + hashLen / 2);
        // bottom
        ctx.moveTo(x, height - hashInsetBottom - hashLen);
        ctx.lineTo(x, height - hashInsetBottom);
        ctx.stroke();
      }

      // Draw line of scrimmage and line to gain
      const driveDirection =
        possession === 'home'
          ? (direction === 'left-to-right' ? 1 : -1)
          : (direction === 'left-to-right' ? -1 : 1);
      const lineToGainYards = clamp(fieldPosition + driveDirection * yardsToGo, 0, 100);

      const losX = toX(fieldPosition);
      const l2gX = toX(lineToGainYards);

      // LOS marker
      ctx.strokeStyle = '#ff1030'; // bright red
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(losX, 0);
      ctx.lineTo(losX, height);
      ctx.stroke();

      // Line to gain marker (dashed)
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#ffd52e'; // bright yellow
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(l2gX, 0);
      ctx.lineTo(l2gX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw current ball position (accounting for end zones)
      const ballX = toX(fieldPosition);
      
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

  // Filtered roster based on jersey search (for run plays and old modal)
  const filteredRoster = useMemo(() => {
    // Use opponent roster when opponent has possession
    const activeRoster = (playInput?.side === 'away' && opponent?.roster) 
      ? opponent.roster 
      : roster;
    
    if (!jerseySearch) return activeRoster;
    return activeRoster.filter(p => 
      p.jerseyNumber?.toString().includes(jerseySearch) ||
      p.name.toLowerCase().includes(jerseySearch.toLowerCase())
    );
  }, [roster, opponent, playInput, jerseySearch]);

  // Filtered roster for passer selection
  const filteredPassers = useMemo(() => {
    const activeRoster = (playInput?.side === 'away' && opponent?.roster) 
      ? opponent.roster 
      : roster;
    
    if (!passerSearch) return activeRoster;
    return activeRoster.filter(p => 
      p.jerseyNumber?.toString().includes(passerSearch) ||
      p.name.toLowerCase().includes(passerSearch.toLowerCase())
    );
  }, [roster, opponent, playInput, passerSearch]);

  // Filtered roster for receiver selection
  const filteredReceivers = useMemo(() => {
    const activeRoster = (playInput?.side === 'away' && opponent?.roster) 
      ? opponent.roster 
      : roster;
    
    if (!receiverSearch) return activeRoster;
    return activeRoster.filter(p => 
      p.jerseyNumber?.toString().includes(receiverSearch) ||
      p.name.toLowerCase().includes(receiverSearch.toLowerCase())
    );
  }, [roster, opponent, playInput, receiverSearch]);

  // Auto-select player when exact jersey number match is found
  useEffect(() => {
    if (!playInput || !jerseySearch) return;
    
    // Use opponent roster when opponent has possession
    const activeRoster = (playInput?.side === 'away' && opponent?.roster) 
      ? opponent.roster 
      : roster;
    
    // Check for exact jersey number match
    const exactMatch = activeRoster.find(p => p.jerseyNumber?.toString() === jerseySearch);
    if (exactMatch) {
      const action = quickActions.find(a => a.type === playInput.type);
      const isPassPlay = action?.category === 'pass-outcome';
      const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
      
      // Auto-fill based on play type
      if (isPassPlay) {
        // For pass plays, auto-fill passer first if not set
        if (!playInput.passer) {
          setPlayInput(prev => prev ? {...prev, passer: exactMatch} : prev);
        } else if (isCompletePass && !playInput.receiver) {
          // If passer is set and it's a complete pass, auto-fill receiver
          setPlayInput(prev => prev ? {...prev, receiver: exactMatch} : prev);
        }
      } else {
        // For run plays, auto-fill player
        setPlayInput(prev => prev ? {...prev, player: exactMatch} : prev);
      }
    }
  }, [jerseySearch, roster, opponent, quickActions]);

  // Timeout handling
  const openTimeoutModal = (team: 'home' | 'away') => {
    if ((team === 'home' && homeTimeouts <= 0) || (team === 'away' && awayTimeouts <= 0)) {
      setFeedback({ status: 'error', message: 'No timeouts remaining for this team.' });
      return;
    }
    setTimeoutTeam(team);
    
    // Set clock to current time and open clock modal
    setClockMinutes(Math.floor(timeRemaining / 60));
    setClockSeconds(timeRemaining % 60);
    setPendingPossessionReason(`Timeout called by ${team === 'home' ? teamName : opponentName}`);
    onPossessionPromptOpen();
  };

  const recordTimeout = async () => {
    if (!timeoutTeam) return;
    
    if (timeoutTeam === 'home') {
      setHomeTimeouts(prev => Math.max(0, prev - 1));
    } else {
      setAwayTimeouts(prev => Math.max(0, prev - 1));
    }
    
    // Format the clock time
    const clockTime = `${clockMinutes.toString().padStart(2, '0')}:${clockSeconds.toString().padStart(2, '0')}`;
    const timeoutMessage = `Timeout charged to ${timeoutTeam === 'home' ? teamName : opponentName} at ${clockTime} in Q${currentQuarter}`;
    
    // Update the game clock to the set time
    const nextTime = clamp(clockMinutes * 60 + clockSeconds, 0, 12 * 60);
    setTimeRemaining(nextTime);
    
    // Log timeout to play-by-play
    await logGameEvent(timeoutMessage, PlayType.TIMEOUT);
    
    setFeedback({ 
      status: 'success', 
      message: timeoutMessage
    });
    
    setTimeoutTeam(null);
    setPendingPossessionReason(null);
  };

  const recordInterceptionTime = async () => {
    if (!pendingInterception || !teamId || !activeSeasonId) return;
    
    const { play, nextGame } = pendingInterception;
    
    try {
      // Save the game with the interception play
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      
      // Calculate drive elapsed time for the throwing team
      const driveElapsed = Math.max(0, possessionClockStart - timeRemaining);
      
      // Change possession to the defensive team
      const newPossession = possession === 'home' ? 'away' : 'home';
      const newPossessionTeam = newPossession === 'home' ? teamName : opponentName;
      setPossession(newPossession);
      setDown(1);
      setYardsToGo(10);
      
      // Update ball position to where the return ended
      if (playInput) {
        setFieldPosition(playInput.endYard);
      }
      
      // Set possession clock start for the new drive
      setPossessionClockStart(timeRemaining);
      
      // Format the clock time for the message
      const clockTime = `${clockMinutes.toString().padStart(2, '0')}:${clockSeconds.toString().padStart(2, '0')}`;
      
      // Log possession change after interception
      await logGameEvent(
        `Interception return complete. ${newPossessionTeam} takes possession at yard line ${playInput?.endYard}. Drive TOP: ${formatTop(driveElapsed)}`,
        PlayType.OTHER
      );
      
      setFeedback({ 
        status: 'success', 
        message: `Interception at ${clockTime} Q${currentQuarter}. Possession changes to ${newPossessionTeam}. Drive TOP: ${formatTop(driveElapsed)}` 
      });
      
      // Close modals and reset state
      onInterceptionTimeClose();
      setPendingInterception(null);
      setInterceptionTime('');
      onPlayInputClose();
      setPlayInput(null);
      setSelectedPlayType(null);
    } catch (error) {
      console.error('Failed to record interception', error);
      setFeedback({ status: 'error', message: 'Unable to record interception. Try again.' });
    }
  };

  const recordExtraPoint = async () => {
    if (!pendingExtraPoint || !extraPointType || !teamId || !activeSeasonId) return;
    
    const { scoringTeam, tdGame } = pendingExtraPoint;
    
    try {
      let updatedGame = { ...tdGame };
      let pointsAwarded = 0;
      let playDescription = '';
      let playType = PlayType.OTHER;
      let playerId = 'team-placeholder-player';
      
      // Handle each extra point type
      if (extraPointType === 'xp-made') {
        if (!extraPointPlayer) return; // Kicker required
        pointsAwarded = 1;
        playerId = extraPointPlayer.id;
        playType = PlayType.EXTRA_POINT_KICK_MADE;
        playDescription = `Extra point by ${extraPointPlayer.name} is GOOD`;
      } else if (extraPointType === 'xp-missed') {
        if (!extraPointPlayer) return; // Kicker required
        playerId = extraPointPlayer.id;
        playType = PlayType.EXTRA_POINT_KICK_MISSED;
        playDescription = `Extra point by ${extraPointPlayer.name} is NO GOOD`;
      } else if (extraPointType === '2pt-made') {
        if (!extraPointPlayer) return; // Player required
        pointsAwarded = 2;
        playerId = extraPointPlayer.id;
        playType = PlayType.TWO_POINT_CONVERSION_MADE;
        playDescription = `2-point conversion by ${extraPointPlayer.name} is GOOD`;
      } else if (extraPointType === '2pt-failed') {
        playType = PlayType.TWO_POINT_CONVERSION_FAILED;
        playDescription = `2-point conversion attempt failed`;
      }
      
      // Add points to score
      if (pointsAwarded > 0) {
        if (scoringTeam === 'home') {
          updatedGame = { ...updatedGame, homeScore: (updatedGame.homeScore || 0) + pointsAwarded };
        } else {
          updatedGame = { ...updatedGame, oppScore: (updatedGame.oppScore || 0) + pointsAwarded };
        }
      }
      
      // Create the extra point play
      const extraPointPlay: Play = {
        id: uuidv4(),
        type: playType,
        yards: 0,
        playerId,
        description: playDescription,
        timestamp: Timestamp.now(),
        quarter: currentQuarter,
        teamSide: scoringTeam,
      };
      
      // Add play and save
      updatedGame = addPlayAndRecalc(updatedGame, extraPointPlay);
      setGame(updatedGame);
      await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      
      // Close extra point modal and show clock modal to set kickoff time
      onExtraPointClose();
      setPendingExtraPoint(null);
      
      // Setup kickoff: Set the flag so confirmPossessionChange knows to setup kickoff
      setPendingKickoff({ kickingTeam: scoringTeam });
      
      // Set clock for kickoff
      setClockMinutes(Math.floor(timeRemaining / 60));
      setClockSeconds(timeRemaining % 60);
      setPendingPossessionReason(`Kickoff after ${scoringTeam === 'home' ? teamName : opponentName} scored`);
      onPossessionPromptOpen();
      
      setFeedback({ status: 'success', message: `${playDescription}` });
    } catch (error) {
      console.error('Failed to record extra point', error);
      setFeedback({ status: 'error', message: 'Unable to record extra point. Try again.' });
    }
  };

  const recordKickoffReturn = async () => {
    if (!pendingKickoffReturn || !kickoffReturner || !teamId || !activeSeasonId || !playInput) return;
    
    const { kickPlay, kickEndYard, kickingTeam, kickGame } = pendingKickoffReturn;
    const receivingTeam = kickingTeam === 'home' ? 'away' : 'home';
    
    try {
      // If this is the opening kickoff (Q1, first play), track who received it
      if (currentQuarter === 1 && openingKickoffReceiver === null) {
        setOpeningKickoffReceiver(receivingTeam);
      }
      
      // Create the kickoff return play
      const returnYards = playInput.endYard - kickEndYard;
      const returnPlay: Play = {
        id: uuidv4(),
        type: PlayType.KICKOFF_RETURN,
        yards: returnYards,
        playerId: kickoffReturner.id,
        description: `Kickoff return by ${kickoffReturner.name} for ${Math.abs(returnYards)} yards`,
        timestamp: Timestamp.now(),
        quarter: currentQuarter,
        teamSide: receivingTeam,
      };
      
      // Add return play and save
      let updatedGame = addPlayAndRecalc(kickGame, returnPlay);
      setGame(updatedGame);
      await saveGame(updatedGame, { teamId, seasonId: activeSeasonId });
      
      // Change possession to receiving team and set field position to return end yard
      changePossession(`${receivingTeam === 'home' ? teamName : opponentName} possession after kickoff return`);
      setFieldPosition(playInput.endYard);
      setDown(1);
      setYardsToGo(10);
      
      // Close both modals
      onKickoffReturnClose();
      onPlayInputClose();
      setPendingKickoffReturn(null);
      setPlayInput(null);
      
      setFeedback({ status: 'success', message: `Kickoff return recorded` });
    } catch (error) {
      console.error('Failed to record kickoff return', error);
      setFeedback({ status: 'error', message: 'Unable to record kickoff return. Try again.' });
    }
  };

  // New play flow: button click -> open modal for player + yards
  const initiatePlay = (type: PlayType, defaultYards: number = 0, category?: string) => {
    // If clicking Run from offense, just set the play type
    if (category === 'offense') {
      if (type === PlayType.RUSH) {
        setSelectedPlayType('run');
      }
      return;
    }
    
    // Otherwise open the play input modal
    const action = quickActions.find(a => a.type === type);
    const points = action && 'points' in action ? action.points : undefined;
    
    // Check if this is a pass play outcome or run play outcome
    const isPassPlay = action?.category === 'pass-outcome';
    const isRunPlay = action?.category === 'run-outcome';
    const isCompletePass = type === PlayType.PASS_COMPLETE || type === PlayType.PASS_TD;
    
    setPlayInput({
      type,
      player: isRunPlay ? lastRusher : null, // Pre-fill last rusher for run plays
      passer: isPassPlay ? lastPasser : null, // Pre-fill last passer for pass plays
      receiver: (isPassPlay && isCompletePass) ? lastReceiver : null, // Pre-fill last receiver for complete passes
      defensivePlayer: null, // Will be selected for INTs, sacks (later)
      yards: defaultYards,
      startYard: fieldPosition,
      interceptionYard: fieldPosition, // Initialize to same as start
      endYard: fieldPosition + defaultYards,
      side: possession, // Track which team is making the play
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
    if (!playInput || !game || !teamId || !activeSeasonId) {
      return;
    }

    const action = quickActions.find(a => a.type === playInput.type);
    const points = action && 'points' in action ? action.points : 0;
    const isPassPlay = action?.category === 'pass-outcome';
    const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
    const isPassTD = playInput.type === PlayType.PASS_TD;
    const isRushTD = playInput.type === PlayType.RUSH_TD;
    const isTouchdown = isPassTD || isRushTD;
    const isInterception = playInput.type === PlayType.INTERCEPTION;
    const isKickoff = playInput.type === PlayType.KICKOFF;
    
    // For TDs (both pass and rush), calculate yardage to goal line automatically
    let actualYards: number;
    if (isPassTD || isRushTD) {
      // Home team goes toward 100 (away goal), away team goes toward 0 (home goal)
      if (playInput.side === 'home') {
        actualYards = 100 - playInput.startYard; // Distance to away goal (100)
      } else {
        actualYards = playInput.startYard - 0; // Distance to home goal (0)
      }
    } else {
      actualYards = playInput.startYard === playInput.endYard ? 0 : (playInput.endYard - playInput.startYard);
    }
    
    // Determine which player to use for the play
    let finalPlayerId: string;
    let playerName: string;
    
    if (isInterception) {
      // For interceptions, the QB is the primary player (gets the INT against them)
      // The defensive player who made the INT is in participants
      finalPlayerId = playInput.passer?.id || 'team-placeholder-player';
      playerName = `${playInput.passer?.name} intercepted by ${playInput.defensivePlayer?.name}`;
    } else if (isPassPlay) {
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

    const side: 'home' | 'away' = possession;
    const driveElapsed = Math.max(0, possessionClockStart - timeRemaining);
    const driveLabel = ` (Drive TOP ${formatTop(driveElapsed)})`;

    // Build participants array based on play type
    const participants: any[] = [];
    if (isInterception) {
      // For interceptions: QB who threw it and defensive player who caught it
      if (playInput.passer) {
        participants.push({ playerId: playInput.passer.id, role: 'passer' });
      }
      if (playInput.defensivePlayer) {
        participants.push({ playerId: playInput.defensivePlayer.id, role: 'interceptor' });
      }
    } else if (isPassPlay) {
      if (playInput.passer) {
        participants.push({ playerId: playInput.passer.id, role: 'passer' });
      }
      if (isCompletePass && playInput.receiver) {
        participants.push({ playerId: playInput.receiver.id, role: 'receiver' });
      }
    } else if (playInput.player) {
      participants.push({ playerId: playInput.player.id, role: 'rusher' });
    }
    
    // Add tacklers with proper credit calculation
    if (defensiveResult?.type === 'tackle' && defensiveResult.tacklers.length > 0) {
      const tackleCredit = defensiveResult.tacklers.length === 1 ? 1.0 : 0.5;
      defensiveResult.tacklers.forEach(tackler => {
        participants.push({ 
          playerId: tackler.id, 
          role: 'tackler',
          credit: tackleCredit 
        });
      });
    }

    // Build play description based on type
    let playDescription: string;
    if (isInterception) {
      const passDistance = Math.abs(playInput.interceptionYard - playInput.startYard);
      const returnDistance = Math.abs(playInput.endYard - playInput.interceptionYard);
      const isReturnTD = playInput.endYard === 0 || playInput.endYard === 100;
      
      playDescription = `${playerName} - Pass ${passDistance}yd, returned ${returnDistance}yd${isReturnTD ? ' for TOUCHDOWN' : ''}${driveLabel}`;
    } else {
      playDescription = actualYards === 0
        ? `${playerName} - ${playInput.type} for no gain${driveLabel}`
        : `${playerName} - ${playInput.type} for ${actualYards} yards${driveLabel}`;
    }
    
    // Add tackler info to description
    if (defensiveResult?.type === 'tackle' && defensiveResult.tacklers.length > 0) {
      const tacklerNames = defensiveResult.tacklers.map(t => `#${t.jerseyNumber} ${t.name}`).join(', ');
      const tackleType = actualYards < 0 ? 'TFL' : 'Tackle';
      playDescription += ` (${tackleType} by ${tacklerNames})`;
    }
    
    // Add penalty note if applicable
    if (defensiveResult?.type === 'penalty') {
      playDescription += ' (Penalty on play)';
    }

    const play: Play = {
      id: uuidv4(),
      type: playInput.type,
      yards: actualYards,
      playerId: finalPlayerId,
      participants: participants.length > 0 ? participants : undefined,
      description: playDescription,
      timestamp: Timestamp.now(),
      quarter: currentQuarter,
      down,
      distance: yardsToGo.toString(),
      yardLine: playInput.startYard,
      teamSide: side,
    };

    try {
      let nextGame = addPlayAndRecalc(game, play);
      setHistory((prev) => [...prev, game]);
      
      // For touchdowns, add 6 points to the scoreboard
      if (isTouchdown) {
        if (side === 'home') {
          nextGame = { ...nextGame, homeScore: (nextGame.homeScore || 0) + 6 };
        } else {
          nextGame = { ...nextGame, oppScore: (nextGame.oppScore || 0) + 6 };
        }
      }
      
      // Handle interception possession change - prompt for time first
      if (isInterception) {
        // Store the play and game state, then prompt for time
        setPendingInterception({ play, nextGame });
        // Pre-fill clock with current time
        setClockMinutes(Math.floor(timeRemaining / 60));
        setClockSeconds(timeRemaining % 60);
        onInterceptionTimeOpen();
        // Don't close the play input modal yet, will close after time is recorded
        return;
      }
      
      // Handle touchdown - prompt for extra point/2PT conversion
      if (isTouchdown) {
        // Save the game with the TD
        setGame(nextGame);
        await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
        
        // Store the game state and trigger extra point modal
        setPendingExtraPoint({ scoringTeam: side, tdGame: nextGame });
        setExtraPointType(null);
        setExtraPointPlayer(null);
        setExtraPointSearch('');
        onExtraPointOpen();
        
        // Don't close play input modal yet
        return;
      }
      
      // Handle kickoff - prompt for return player
      if (isKickoff) {
        // Save the kickoff play
        setGame(nextGame);
        await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
        
        // Store kickoff data and trigger return modal
        const receivingTeam = side === 'home' ? 'away' : 'home';
        setPendingKickoffReturn({
          kickPlay: play,
          kickEndYard: playInput.endYard,
          kickingTeam: side,
          kickGame: nextGame
        });
        setKickoffReturner(null);
        setKickoffReturnSearch('');
        
        // Initialize return yard display in PL/CT format
        const kickEndPlCt = convertToPlCt(playInput.endYard);
        setReturnYardSide(kickEndPlCt.side);
        setReturnYardValue(kickEndPlCt.value.toString());
        setShowReturnYardPad(false);
        
        onKickoffReturnOpen();
        
        // Don't close play input modal yet
        return;
      }
      
      // For non-interception plays, save immediately
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      
      // Update ball position
      // For TDs (pass or rush), set to opponent's goal line
      if (isPassTD || isRushTD) {
        // Home team scores at 100, away team scores at 0
        const goalLine = playInput.side === 'home' ? 100 : 0;
        setFieldPosition(goalLine);
      } else {
        setFieldPosition(playInput.endYard);
      }
      
      // Normal down and distance logic (turnover on downs if 4th and failed)
      if (actualYards >= yardsToGo) {
        setDown(1);
        setYardsToGo(10);
      } else {
        if (down === 4) {
          // Turnover on downs: flip possession, reset counts, log event
          requestPossessionChange('Turnover on downs.');
          const driveElapsed = Math.max(0, possessionClockStart - timeRemaining);
          const turnoverPlay: Play = {
            id: uuidv4(),
            type: PlayType.OTHER,
            yards: 0,
            playerId: 'team-placeholder-player',
            description: `Turnover on downs (Drive TOP ${formatTop(driveElapsed)})`,
            timestamp: Timestamp.now(),
            quarter: currentQuarter,
            down,
            distance: yardsToGo.toString(),
            yardLine: playInput.endYard,
            teamSide: possession,
          };
          const withTurnover = addPlayAndRecalc({ ...nextGame, plays: [...nextGame.plays, turnoverPlay] }, turnoverPlay);
          setGame(withTurnover);
          await saveGame(withTurnover, { teamId, seasonId: activeSeasonId });
          setDown(1);
          setYardsToGo(10);
        } else {
          setDown(Math.min(4, down + 1));
          setYardsToGo(yardsToGo - actualYards);
        }
      }
      setFeedback({ status: 'success', message: `${playInput.type} recorded${points ? ` (+${points} pts)` : ''}.` });
      
      // Remember last players for pre-filling next time
      if (isPassPlay) {
        if (playInput.passer) {
          setLastPasser(playInput.passer);
        }
        if (isCompletePass && playInput.receiver) {
          setLastReceiver(playInput.receiver);
        }
      } else if (playInput.player) {
        setLastRusher(playInput.player);
      }
      
      onPlayInputClose();
      setPlayInput(null);
      setSelectedPlayType(null); // Reset play type selection
      setDefensiveResult(null); // Clear defensive result
      setDefenseSearch(''); // Clear defense search
    } catch (error) {
      console.error('Failed to add play', error);
      setFeedback({ status: 'error', message: 'Unable to add play. Try again.' });
    }
  };

  const handleAddPlay = async (
    type: PlayType,
    yards: number,
    playerId?: string,
    side: 'home' | 'away' = possession
  ) => {
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
      setPendingPlay({ type, yards, side });
      onOpen();
      return;
    }

    const finalPlayerId = playerId || selectedPlayer?.id || 'team-placeholder-player';
    const sideLabel = side === 'home' ? (selectedPlayer?.name || 'Team') : opponentName || 'Opponent';

    const play: Play = {
      id: uuidv4(),
      type,
      yards,
      playerId: finalPlayerId,
      description: `${sideLabel} - ${type} for ${yards} yards`,
      timestamp: Timestamp.now(),
      teamSide: side,
    };

    try {
      const nextGame = addPlayAndRecalc(game, play);
      setHistory((prev) => [...prev, game]);
      setGame(nextGame);
      await saveGame(nextGame, { teamId, seasonId: activeSeasonId });
      setFeedback({
        status: 'success',
        message: `${type} recorded for ${side === 'home' ? (selectedPlayer?.name || 'Team') : opponentName}.`,
      });
      setSelectedPlayer(null); // Reset selection after play
    } catch (error) {
      console.error('Failed to add play', error);
      setFeedback({ status: 'error', message: 'Unable to add play. Try again.' });
    }
  };

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player);
    if (pendingPlay) {
      handleAddPlay(pendingPlay.type, pendingPlay.yards, player.id, pendingPlay.side);
      setPendingPlay(null);
      onClose();
      setJerseySearch('');
    }
  };

  const openPlayEditor = (play: Play) => {
    setEditingPlay(play);
    setEditForm({
      playerId: play.playerId || '',
      playType: play.type,
      yards: play.yards,
      quarter: play.quarter || currentQuarter,
      down: play.down?.toString() || '',
      distance: play.distance || '',
      yardLine: play.yardLine?.toString() || '',
    });
    
    // Extract current tacklers from participants
    const tacklerParticipants = play.participants?.filter(p => p.role === 'tackler') || [];
    const tacklerPlayers: Player[] = [];
    tacklerParticipants.forEach(tp => {
      // Find the player - check both rosters based on play side
      const opposingRoster = play.teamSide === 'home' ? (opponent?.roster || []) : roster;
      const player = opposingRoster.find(p => p.id === tp.playerId);
      if (player) {
        tacklerPlayers.push(player);
      }
    });
    setEditTacklers(tacklerPlayers);
    setEditDefenseSearch('');
    setEditPlayerSearch('');
    
    onEditOpen();
  };

  const savePlayEdits = async () => {
    if (!editingPlay || !game || !teamId || !activeSeasonId) return;

    try {
      // Build updated participants array
      let updatedParticipants = editingPlay.participants?.filter(p => p.role !== 'tackler') || [];
      
      // Add new tacklers with proper credit
      if (editTacklers.length > 0) {
        const tackleCredit = editTacklers.length === 1 ? 1.0 : 0.5;
        const tacklerParticipants = editTacklers.map(t => ({
          playerId: t.id,
          role: 'tackler' as const,
          credit: tackleCredit
        }));
        updatedParticipants = [...updatedParticipants, ...tacklerParticipants];
      }
      
      // Build description with tackler info
      const playerName = roster.find(p => p.id === editForm.playerId)?.name || 'Team';
      let baseDescription = `${playerName} - ${editForm.playType} for ${editForm.yards} yards`;
      if (editTacklers.length > 0) {
        const tacklerNames = editTacklers.map(t => `#${t.jerseyNumber} ${t.name}`).join(', ');
        const tackleType = editForm.yards < 0 ? 'TFL' : 'Tackle';
        baseDescription += ` (${tackleType} by ${tacklerNames})`;
      }
      
      const updates: Partial<Play> = {
        playerId: editForm.playerId,
        type: editForm.playType as PlayType,
        yards: editForm.yards,
        quarter: editForm.quarter,
        down: editForm.down ? parseInt(editForm.down) : undefined,
        distance: editForm.distance || undefined,
        yardLine: editForm.yardLine ? parseInt(editForm.yardLine) : undefined,
        description: baseDescription,
        participants: updatedParticipants.length > 0 ? updatedParticipants : undefined,
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
            <Button variant="solid" colorScheme="blue" onClick={onStatsOpen}>
              📊 Quick Stats
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
                  {formatQuarterLabel(currentQuarter)}
                </Text>
                <Text 
                  fontSize="5xl" 
                  fontWeight="900" 
                  color="white" 
                  fontFamily="mono" 
                  lineHeight="1"
                  cursor="pointer"
                  onClick={openClockAdjustment}
                  _hover={{ color: 'yellow.400', transform: 'scale(1.05)' }}
                  transition="all 0.2s"
                  title="Click to adjust time"
                >
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
                    onClick={() => changeQuarter(-1)}
                    disabled={currentQuarter <= 1}
                    title="Previous quarter or OT"
                  >
                    ‹
                  </Button>
                  <Button
                    size="sm"
                    variant="solid"
                    bg="gray.700"
                    color="gray.300"
                    _hover={{ bg: 'gray.600' }}
                    onClick={() => changeQuarter(1)}
                    title="Next quarter or OT"
                  >
                    ›
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
                  <HStack gap={2} align="center">
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={() => setManualDown(down + 1)}
                      aria-label="Increase down"
                    >
                      +
                    </Button>
                    <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="mono" minW="36px" textAlign="center">
                      {down}
                    </Text>
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={() => setManualDown(down - 1)}
                      aria-label="Decrease down"
                      disabled={down <= 1}
                    >
                      -
                    </Button>
                  </HStack>
                </Stack>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">To Go</Text>
                  <HStack gap={2} align="center">
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={() => setManualDistance(yardsToGo + 1)}
                      aria-label="Increase distance"
                    >
                      +
                    </Button>
                    <Text fontSize="2xl" fontWeight="700" color="white" fontFamily="mono" minW="48px" textAlign="center">
                      {yardsToGo}
                    </Text>
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={() => setManualDistance(yardsToGo - 1)}
                      aria-label="Decrease distance"
                      disabled={yardsToGo <= 1}
                    >
                      -
                    </Button>
                  </HStack>
                </Stack>
                <Stack align="center" gap={1}>
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase">Ball On</Text>
                  <HStack gap={2} align="center">
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={advanceBall}
                      aria-label="Advance ball"
                    >
                      +
                    </Button>
                    <Text fontSize="2xl" fontWeight="700" color="yellow.400" fontFamily="mono" minW="72px" textAlign="center">
                      {formatBallDisplay(
                        fieldPosition,
                        team?.shortName || teamName.substring(0, 2).toUpperCase(),
                        opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                      )}
                    </Text>
                    <Button
                      size="xs"
                      variant="outline"
                      borderColor="whiteAlpha.700"
                      color="yellow.300"
                      _hover={{ bg: 'whiteAlpha.200' }}
                      onClick={retreatBall}
                      aria-label="Retreat ball"
                    >
                      -
                    </Button>
                  </HStack>
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
                onClick={() => requestPossessionChange('Possession flipped')}
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
        <HStack justify="space-between" align="center">
          <Text fontSize="sm" color="gray.300">
            Logging for: <Text as="span" fontWeight="700" color="white">{possession === 'home' ? teamName : opponentName}</Text>
          </Text>
          <Button
            size="sm"
            variant="outline"
            borderColor="yellow.400"
            color="yellow.300"
            _hover={{ bg: 'rgba(250, 240, 137, 0.1)' }}
            onClick={() => setPossession(possession === 'home' ? 'away' : 'home')}
          >
            Switch to {possession === 'home' ? 'Opponent' : 'Home'}
          </Button>
        </HStack>
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
              {/* Run button */}
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
                  variant={selectedPlayType === 'run' ? 'solid' : 'outline'}
                  borderColor={selectedPlayType === 'run' ? 'yellow.400' : 'transparent'}
                  borderWidth="2px"
                >
                  {action.label}
                </Button>
              ))}
              {/* Pass button - added manually */}
              <Button
                bg="blue.600"
                color="white"
                _hover={{ 
                  bg: 'blue.500',
                  transform: 'scale(1.05)'
                }}
                transition="all 0.2s"
                onClick={() => setSelectedPlayType('pass')}
                size="md"
                fontWeight="700"
                variant={selectedPlayType === 'pass' ? 'solid' : 'outline'}
                borderColor={selectedPlayType === 'pass' ? 'yellow.400' : 'transparent'}
                borderWidth="2px"
              >
                Pass
              </Button>
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
                          {play.description
                            ? play.description
                            : `${playerName} - ${play.type} ${
                                play.yards === 0 ? '- no gain' : `${play.yards > 0 ? '+' : ''}${play.yards} yards`
                              }`}
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
                <Text fontSize="xl" fontWeight="600">
                  Select Player - {playInput?.side === 'away' ? opponentName : team?.name || 'Home'}
                </Text>
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
                      {filteredRoster.map((player, idx) => (
                        <Button
                          key={`quickadd-${player.id}-${idx}`}
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
              <Box px={4} py={3} borderBottom="1px solid" borderColor="border.subtle">
                <Text fontSize="lg" fontWeight="600">Edit Play</Text>
              </Box>
              <Box px={4} py={3} overflowY="auto">
                <Stack gap={3}>
                  {/* Player Selection */}
                  <Box>
                    <Text fontSize="xs" fontWeight="600" mb={1}>Player</Text>
                    <Input
                      placeholder="Search jersey # or name..."
                      value={editPlayerSearch}
                      onChange={(e) => setEditPlayerSearch(e.target.value)}
                      size="sm"
                      mb={2}
                    />
                    {(() => {
                      const searchLower = editPlayerSearch.toLowerCase().trim();
                      const filteredRoster = searchLower === ''
                        ? []
                        : roster.filter((p: Player) =>
                            p.jerseyNumber?.toString() === searchLower ||
                            p.name.toLowerCase().includes(searchLower)
                          );
                      
                      const selectedPlayer = roster.find(p => p.id === editForm.playerId);
                      
                      return (
                        <>
                          {selectedPlayer && (
                            <Box p={2} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200" mb={2}>
                              <Text fontSize="sm" fontWeight="600">
                                #{selectedPlayer.jerseyNumber} {selectedPlayer.name}
                              </Text>
                            </Box>
                          )}
                          {filteredRoster.length > 0 && (
                            <SimpleGrid columns={3} gap={1} maxH="100px" overflowY="auto">
                              {filteredRoster.map((player: Player) => (
                                <Button
                                  key={player.id}
                                  onClick={() => {
                                    setEditForm({ ...editForm, playerId: player.id });
                                    setEditPlayerSearch('');
                                  }}
                                  size="xs"
                                  variant="outline"
                                  borderColor="blue.300"
                                  _hover={{ bg: 'blue.50' }}
                                >
                                  <Text fontSize="xs">
                                    #{player.jerseyNumber} {player.name.split(' ')[0]}
                                  </Text>
                                </Button>
                              ))}
                            </SimpleGrid>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                  
                  {/* Play Type */}
                  <Box>
                    <Text fontSize="xs" fontWeight="600" mb={1}>Play Type</Text>
                    <SimpleGrid columns={4} gap={1}>
                      {['Rush', 'Pass', 'Kickoff', 'Punt'].map((type) => {
                        const playTypeLower = editForm.playType.toLowerCase();
                        const isSelected = 
                          playTypeLower === type.toLowerCase() ||
                          (type === 'Pass' && playTypeLower.includes('pass'));
                        return (
                          <Button
                            key={type}
                            size="sm"
                            variant={isSelected ? 'solid' : 'outline'}
                            colorScheme={isSelected ? 'blue' : 'gray'}
                            onClick={() => setEditForm({ ...editForm, playType: type })}
                          >
                            {type}
                          </Button>
                        );
                      })}
                    </SimpleGrid>
                  </Box>
                  
                  <HStack gap={3}>
                    <Box flex={1}>
                      <Text fontSize="xs" fontWeight="600" mb={1}>Yards</Text>
                      <Input
                        type="number"
                        value={editForm.yards}
                        onChange={(e) => setEditForm({ ...editForm, yards: parseInt(e.target.value) || 0 })}
                        placeholder="Yards"
                        size="sm"
                      />
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="xs" fontWeight="600" mb={1}>Quarter</Text>
                      <HStack gap={1}>
                        {[1, 2, 3, 4].map((q) => (
                          <Button
                            key={q}
                            size="sm"
                            variant={editForm.quarter === q ? 'solid' : 'outline'}
                            colorScheme={editForm.quarter === q ? 'blue' : 'gray'}
                            onClick={() => setEditForm({ ...editForm, quarter: q })}
                            flex={1}
                          >
                            {q}
                          </Button>
                        ))}
                      </HStack>
                    </Box>
                  </HStack>
                  
                  <HStack gap={3}>
                    <Box flex={1}>
                      <Text fontSize="xs" fontWeight="600" mb={1}>Down</Text>
                      <Input
                        type="number"
                        value={editForm.down}
                        onChange={(e) => setEditForm({ ...editForm, down: e.target.value })}
                        placeholder="1-4"
                        min={1}
                        max={4}
                        size="sm"
                      />
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="xs" fontWeight="600" mb={1}>Distance</Text>
                      <Input
                        value={editForm.distance}
                        onChange={(e) => setEditForm({ ...editForm, distance: e.target.value })}
                        placeholder="10"
                        size="sm"
                      />
                    </Box>
                    <Box flex={1}>
                      <Text fontSize="xs" fontWeight="600" mb={1}>Yard Line</Text>
                      <Input
                        type="number"
                        value={editForm.yardLine}
                        onChange={(e) => setEditForm({ ...editForm, yardLine: e.target.value })}
                        placeholder="50"
                        min={1}
                        max={99}
                        size="sm"
                      />
                    </Box>
                  </HStack>
                  
                  {/* Tackler Selection */}
                  <Box p={3} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                    <HStack justify="space-between" mb={2}>
                      <Text fontSize="xs" fontWeight="600">
                        Tacklers {editForm.yards < 0 && <Badge colorScheme="red" ml={1} fontSize="xs">TFL</Badge>}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        {editTacklers.length === 1 ? '1.0 credit' : editTacklers.length > 1 ? '0.5 credit each' : 'Up to 3'}
                      </Text>
                    </HStack>
                    <Input
                      placeholder="Search jersey # or name..."
                      value={editDefenseSearch}
                      onChange={(e) => setEditDefenseSearch(e.target.value)}
                      bg="white"
                      borderColor="gray.300"
                      mb={2}
                      size="sm"
                    />
                    {(() => {
                      // Get opponent roster for defensive player selection
                      const opposingRoster = editingPlay.teamSide === 'home' 
                        ? (opponent?.roster || [])
                        : roster;
                      
                      const searchLower = editDefenseSearch.toLowerCase().trim();
                      const filteredOpposingRoster = searchLower === ''
                        ? opposingRoster
                        : opposingRoster.filter((p: Player) =>
                            p.jerseyNumber?.toString() === searchLower ||
                            p.name.toLowerCase().includes(searchLower)
                          );
                      
                      return (
                        <>
                          {filteredOpposingRoster.length === 0 ? (
                            <Text textAlign="center" color="gray.500" py={2} fontSize="xs">
                              No players found
                            </Text>
                          ) : (
                            <SimpleGrid columns={3} gap={1} maxH="120px" overflowY="auto">
                              {filteredOpposingRoster.map((player: Player, idx: number) => {
                                const isSelected = editTacklers.some(t => t.id === player.id);
                                return (
                                  <Button
                                    key={`edit-tackler-${player.id}-${idx}`}
                                    onClick={() => {
                                      if (isSelected) {
                                        setEditTacklers(editTacklers.filter(t => t.id !== player.id));
                                      } else if (editTacklers.length < 3) {
                                        setEditTacklers([...editTacklers, player]);
                                      }
                                      setEditDefenseSearch('');
                                    }}
                                    size="xs"
                                    h="auto"
                                    py={1}
                                    px={2}
                                    variant="outline"
                                    borderColor={isSelected ? 'red.500' : 'gray.300'}
                                    bg={isSelected ? 'red.50' : 'white'}
                                    _hover={{ borderColor: 'red.400', bg: isSelected ? 'red.100' : 'gray.50' }}
                                    disabled={!isSelected && editTacklers.length >= 3}
                                  >
                                    <Text fontSize="xs" fontWeight={isSelected ? '600' : '500'}>
                                      #{player.jerseyNumber} {player.name.split(' ')[0]}
                                    </Text>
                                  </Button>
                                );
                              })}
                            </SimpleGrid>
                          )}
                          {editTacklers.length > 0 && (
                            <HStack mt={2} flexWrap="wrap" gap={1}>
                              {editTacklers.map(t => (
                                <Badge key={t.id} colorScheme="red" fontSize="xs">
                                  #{t.jerseyNumber} {t.name}
                                </Badge>
                              ))}
                            </HStack>
                          )}
                        </>
                      );
                    })()}
                  </Box>
                </Stack>
              </Box>
              <Box px={4} py={3} borderTop="1px solid" borderColor="border.subtle">
                <HStack gap={2}>
                  <Button colorScheme="blue" onClick={savePlayEdits} flex={1} size="sm">
                    Save
                  </Button>
                  <Button variant="ghost" onClick={onEditClose} flex={1} size="sm">
                    Cancel
                  </Button>
                </HStack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Play Input Modal - New Flow */}
      {isPlayInputOpen && playInput && (() => {
        const action = quickActions.find(a => a.type === playInput.type);
        const isPassPlay = action?.category === 'pass-outcome';
        const isCompletePass = playInput.type === PlayType.PASS_COMPLETE || playInput.type === PlayType.PASS_TD;
        const isPassTD = playInput.type === PlayType.PASS_TD;
        const isRushTD = playInput.type === PlayType.RUSH_TD;
        const isIncompletePass = playInput.type === PlayType.PASS_INCOMPLETE;
        const isSack = playInput.type === PlayType.SACK;
        const isInterception = playInput.type === PlayType.INTERCEPTION;
        
        // Check if we need player selection
        const needsPasser = isPassPlay && !playInput.passer;
        const needsDefensivePlayer = isInterception && !playInput.defensivePlayer;
        const needsReceiver = isPassPlay && isCompletePass && !playInput.receiver;
        const needsPlayer = !isPassPlay && !playInput.player;
        const showPlayerSelection = needsPasser || needsDefensivePlayer || needsReceiver || needsPlayer;
        
        // For incomplete passes and TDs (pass or rush), skip yards adjustment
        const skipYardsAdjustment = isIncompletePass || isPassTD || isRushTD;
        
        return (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => { 
              onPlayInputClose(); 
              setPlayInput(null); 
              setJerseySearch('');
              setPasserSearch('');
              setReceiverSearch('');
              setDefensiveResult(null);
            }}
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
            maxW={showPlayerSelection ? "600px" : "500px"}
            w="90%"
            maxH="90vh"
            overflowY="auto"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="yellow.400">
                <Text fontSize="xl" fontWeight="700" color="white">
                  {showPlayerSelection ? 'Select Players' : 
                   skipYardsAdjustment ? (isPassTD ? 'Record Touchdown Pass' : isRushTD ? 'Record Rushing Touchdown' : 'Record Incomplete Pass') : 
                   isSack ? 'Adjust Sack Yardage' : 
                   isInterception ? 'Interception Return Yards' : 
                   'Adjust Yards'}
                </Text>
                {!showPlayerSelection && (
                  <Stack direction="row" gap={2} mt={2} flexWrap="wrap">
                    {playInput.passer && (
                      <Badge 
                        colorScheme="blue" 
                        fontSize="sm" 
                        cursor="pointer"
                        px={3}
                        py={1}
                        _hover={{ bg: 'blue.600', transform: 'scale(1.05)' }}
                        transition="all 0.2s"
                        onClick={() => {
                          setPlayInput({...playInput, passer: null});
                          setPasserSearch('');
                        }}
                        title="Click to change passer"
                      >
                        QB: #{playInput.passer.jerseyNumber} {playInput.passer.name} ✎
                      </Badge>
                    )}
                    {playInput.receiver && (
                      <Badge 
                        colorScheme="green" 
                        fontSize="sm"
                        cursor="pointer"
                        px={3}
                        py={1}
                        _hover={{ bg: 'green.600', transform: 'scale(1.05)' }}
                        transition="all 0.2s"
                        onClick={() => {
                          setPlayInput({...playInput, receiver: null});
                          setReceiverSearch('');
                        }}
                        title="Click to change receiver"
                      >
                        WR: #{playInput.receiver.jerseyNumber} {playInput.receiver.name} ✎
                      </Badge>
                    )}
                    {playInput.player && (
                      <Badge 
                        colorScheme="yellow" 
                        fontSize="sm"
                        cursor="pointer"
                        px={3}
                        py={1}
                        _hover={{ bg: 'yellow.600', transform: 'scale(1.05)' }}
                        transition="all 0.2s"
                        onClick={() => {
                          setPlayInput({...playInput, player: null});
                          setJerseySearch('');
                        }}
                        title="Click to change player"
                      >
                        #{playInput.player.jerseyNumber} {playInput.player.name} ✎
                      </Badge>
                    )}
                  </Stack>
                )}
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  {showPlayerSelection ? (
                    // PLAYER SELECTION MODE
                    <>
                      {/* Passer Selection - For pass plays only */}
                      {needsPasser && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="blue.400" mb={2}>
                              {isSack ? 'Select QB (Required)' : 'Select Passer (Required)'} {playInput.passer && `✓ #${playInput.passer.jerseyNumber} ${playInput.passer.name}`}
                            </Text>
                        <Input
                          placeholder="Search by jersey # or name..."
                          value={passerSearch}
                          onChange={(e) => setPasserSearch(e.target.value)}
                          bg="rgba(0, 0, 0, 0.4)"
                          borderColor="gray.600"
                          color="white"
                          _placeholder={{ color: 'gray.400' }}
                          mb={3}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                            {filteredPassers.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredPassers.map((player, idx) => (
                                  <Button
                                    key={`passer-${player.id}-${idx}`}
                                    onClick={() => {
                                      setPlayInput({...playInput, passer: player});
                                      setPasserSearch(''); // Clear search after selection
                                    }}
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

                        {/* Receiver Selection - For complete passes (required) */}
                        {isPassPlay && isCompletePass && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="green.400" mb={2}>
                              Select Receiver (Required) {playInput.receiver && `✓ #${playInput.receiver.jerseyNumber} ${playInput.receiver.name}`}
                            </Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={receiverSearch}
                              onChange={(e) => setReceiverSearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                            {filteredReceivers.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredReceivers.map((player, idx) => (
                                  <Button
                                    key={`receiver-${player.id}-${idx}`}
                                    onClick={() => {
                                      setPlayInput({...playInput, receiver: player});
                                      setReceiverSearch(''); // Clear search after selection
                                    }}
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

                        {/* Receiver Selection - For incomplete passes (optional) */}
                        {isPassPlay && isIncompletePass && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="gray.400" mb={2}>
                              Select Target/Receiver (Optional) {playInput.receiver && `✓ #${playInput.receiver.jerseyNumber} ${playInput.receiver.name}`}
                            </Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={receiverSearch}
                              onChange={(e) => setReceiverSearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                            {filteredReceivers.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredReceivers.map((player, idx) => (
                                  <Button
                                    key={`incomplete-receiver-${player.id}-${idx}`}
                                    onClick={() => {
                                      setPlayInput({...playInput, receiver: player});
                                      setReceiverSearch(''); // Clear search after selection
                                    }}
                                    h="auto"
                                    py={2}
                                    flexDirection="column"
                                    variant="outline"
                                    borderColor={playInput.receiver?.id === player.id ? 'gray.400' : 'gray.600'}
                                    bg={playInput.receiver?.id === player.id ? 'rgba(156, 163, 175, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                    color="white"
                                    _hover={{ borderColor: 'gray.400', bg: 'rgba(156, 163, 175, 0.15)' }}
                                  >
                                    <Badge colorScheme="gray" mb={1}>
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

                        {/* Defensive Player Selection - For interceptions */}
                        {isInterception && playInput.passer && (
                          <Box>
                            <Text fontSize="sm" fontWeight="600" color="purple.400" mb={2}>
                              Select Defensive Player (Required) - Who intercepted the ball {playInput.defensivePlayer && `✓ #${playInput.defensivePlayer.jerseyNumber} ${playInput.defensivePlayer.name}`}
                            </Text>
                            <Input
                              placeholder="Search by jersey # or name..."
                              value={defenseSearch}
                              onChange={(e) => setDefenseSearch(e.target.value)}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              _placeholder={{ color: 'gray.400' }}
                              mb={3}
                              inputMode="numeric"
                              pattern="[0-9]*"
                            />
                            {(() => {
                              // Get opponent roster for defensive player selection
                              const opposingRoster = playInput.side === 'home' 
                                ? (opponent?.roster || [])
                                : roster;
                              
                              const searchLower = defenseSearch.toLowerCase().trim();
                              const filteredOpposingRoster = searchLower === ''
                                ? opposingRoster
                                : opposingRoster.filter((p: Player) =>
                                    p.jerseyNumber?.toString() === searchLower ||
                                    p.name.toLowerCase().includes(searchLower)
                                  );
                              
                              const opposingTeamName = playInput.side === 'home' 
                                ? opponent?.name 
                                : teamName;
                              
                              return filteredOpposingRoster.length === 0 ? (
                                <Text textAlign="center" color="gray.400" py={4}>
                                  No players found on {opposingTeamName}
                                </Text>
                              ) : (
                                <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                  {filteredOpposingRoster.map((player: Player, idx: number) => (
                                    <Button
                                      key={`defense-${player.id}-${idx}`}
                                      onClick={() => {
                                        setPlayInput({...playInput, defensivePlayer: player});
                                        setDefenseSearch(''); // Clear search after selection
                                      }}
                                      h="auto"
                                      py={2}
                                      flexDirection="column"
                                      variant="outline"
                                      borderColor={playInput.defensivePlayer?.id === player.id ? 'purple.400' : 'gray.600'}
                                      bg={playInput.defensivePlayer?.id === player.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                      color="white"
                                      _hover={{ borderColor: 'purple.400', bg: 'rgba(168, 85, 247, 0.15)' }}
                                    >
                                      <Badge colorScheme="purple" mb={1}>
                                        #{player.jerseyNumber}
                                      </Badge>
                                      <Text fontSize="sm" fontWeight="600">
                                        {player.name}
                                      </Text>
                                    </Button>
                                  ))}
                                </SimpleGrid>
                              );
                            })()}
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
                              inputMode="numeric"
                              pattern="[0-9]*"
                              onFocus={() => setShowJerseyPad(true)}
                            />
                            {showJerseyPad && (
                              <SimpleGrid columns={3} gap={2} mb={3}>
                                {[1,2,3,4,5,6,7,8,9,0].map((n) => (
                                  <Button
                                    key={`digit-${n}`}
                                    bg="gray.800"
                                    color="white"
                                    _hover={{ bg: 'gray.700' }}
                                    onClick={() => handleJerseyDigit(n)}
                                  >
                                    {n}
                                  </Button>
                                ))}
                                <Button bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={handleJerseyBackspace}>
                                  ←
                                </Button>
                                <Button bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={handleJerseyClear}>
                                  Clear
                                </Button>
                                <Button bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={() => setShowJerseyPad(false)}>
                                  Hide
                                </Button>
                              </SimpleGrid>
                            )}
                            {filteredRoster.length === 0 ? (
                              <Text textAlign="center" color="gray.400" py={4}>
                                No players found
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, md: 3 }} gap={2} maxH="200px" overflowY="auto">
                                {filteredRoster.map((player, idx) => (
                                  <Button
                                    key={`player-${player.id}-${idx}`}
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
                    ) : skipYardsAdjustment ? (
                    // INCOMPLETE PASS OR TD - No yards adjustment needed
                    <Box>
                      {isPassTD ? (
                        <>
                          <Text fontSize="md" fontWeight="600" color="green.400" mb={4} textAlign="center">
                            🏈 Touchdown Pass - Ready to Record
                          </Text>
                          <Text fontSize="sm" color="gray.400" textAlign="center" mb={2}>
                            {playInput.passer?.name} to {playInput.receiver?.name}
                          </Text>
                          <Text fontSize="sm" color="green.400" textAlign="center">
                            +6 points • Yardage calculated to goal line
                          </Text>
                        </>
                      ) : isRushTD ? (
                        <>
                          <Text fontSize="md" fontWeight="600" color="green.400" mb={4} textAlign="center">
                            🏈 Rushing Touchdown - Ready to Record
                          </Text>
                          <Text fontSize="sm" color="gray.400" textAlign="center" mb={2}>
                            {playInput.player?.name}
                          </Text>
                          <Text fontSize="sm" color="green.400" textAlign="center">
                            +6 points • Yardage calculated to goal line
                          </Text>
                        </>
                      ) : (
                        <>
                          <Text fontSize="md" fontWeight="600" color="white" mb={4} textAlign="center">
                            Incomplete Pass - Ready to Record
                          </Text>
                          <Text fontSize="sm" color="gray.400" textAlign="center">
                            No yards gained. Down will advance automatically.
                          </Text>
                        </>
                      )}
                    </Box>
                    ) : (
                    // YARD ADJUSTMENT MODE
                    <Box>
                      {isInterception ? (
                        // THREE-POINT SYSTEM FOR INTERCEPTIONS
                        <>
                          <Text fontSize="sm" fontWeight="600" color="purple.400" mb={3} textAlign="center">
                            Interception Return - Three Points
                          </Text>
                          
                          {/* 1. Line of Scrimmage (Start) */}
                          <Stack direction="row" gap={2} align="center" mb={3}>
                            <Text color="white" fontSize="sm" minW="120px">Line of Scrimmage:</Text>
                            <HStack>
                              <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayStart(playInput.startYard - 1)} aria-label="Decrease start">-</Button>
                              <Box
                                w="100px"
                                px={3}
                                py={2}
                                bg="rgba(0, 0, 0, 0.5)"
                                border="1px solid"
                                borderColor="gray.600"
                                borderRadius="md"
                                color="white"
                                fontWeight="700"
                                fontFamily="mono"
                                textAlign="center"
                              >
                                {formatBallDisplay(
                                  playInput.startYard,
                                  team?.shortName || teamName.substring(0, 2).toUpperCase(),
                                  opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                                )}
                              </Box>
                              <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayStart(playInput.startYard + 1)} aria-label="Increase start">+</Button>
                            </HStack>
                          </Stack>
                          
                          {/* 2. Interception Point */}
                          <Stack direction="row" gap={2} align="center" mb={3}>
                            <Text color="white" fontSize="sm" minW="120px">Intercepted At:</Text>
                            <HStack>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                borderColor="whiteAlpha.700" 
                                color="purple.300" 
                                _hover={{ bg: 'whiteAlpha.200' }} 
                                onClick={() => setPlayInput({...playInput, interceptionYard: playInput.interceptionYard - 1})} 
                                aria-label="Decrease interception point"
                              >-</Button>
                              <Box
                                w="100px"
                                px={3}
                                py={2}
                                bg="rgba(0, 0, 0, 0.5)"
                                border="1px solid"
                                borderColor="purple.600"
                                borderRadius="md"
                                color="purple.300"
                                fontWeight="700"
                                fontFamily="mono"
                                textAlign="center"
                              >
                                {formatBallDisplay(
                                  playInput.interceptionYard,
                                  team?.shortName || teamName.substring(0, 2).toUpperCase(),
                                  opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                                )}
                              </Box>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                borderColor="whiteAlpha.700" 
                                color="purple.300" 
                                _hover={{ bg: 'whiteAlpha.200' }} 
                                onClick={() => setPlayInput({...playInput, interceptionYard: playInput.interceptionYard + 1})} 
                                aria-label="Increase interception point"
                              >+</Button>
                            </HStack>
                          </Stack>
                          
                          {/* 3. Return End */}
                          <Stack direction="row" gap={2} align="center" mb={3}>
                            <Text color="white" fontSize="sm" minW="120px">Tackled/Scored At:</Text>
                            <HStack>
                              <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayEnd(playInput.endYard - 1)} aria-label="Decrease end">-</Button>
                              <Box
                                w="100px"
                                px={3}
                                py={2}
                                bg="rgba(0, 0, 0, 0.5)"
                                border="1px solid"
                                borderColor="gray.600"
                                borderRadius="md"
                                color="white"
                                fontWeight="700"
                                fontFamily="mono"
                                textAlign="center"
                              >
                                {formatBallDisplay(
                                  playInput.endYard,
                                  team?.shortName || teamName.substring(0, 2).toUpperCase(),
                                  opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                                )}
                              </Box>
                              <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayEnd(playInput.endYard + 1)} aria-label="Increase end">+</Button>
                            </HStack>
                          </Stack>
                          
                          {/* Yardage Summary */}
                          <Box mt={4} p={3} bg="rgba(168, 85, 247, 0.1)" borderRadius="md" border="1px solid" borderColor="purple.600">
                            <Text fontSize="xs" color="gray.400" mb={1}>Pass Distance: {Math.abs(playInput.interceptionYard - playInput.startYard)} yards</Text>
                            <Text fontSize="xs" color="gray.400" mb={1}>Return Distance: {Math.abs(playInput.endYard - playInput.interceptionYard)} yards</Text>
                            <Text fontSize="sm" color="purple.300" fontWeight="700">
                              Total Play: {playInput.yards > 0 ? '+' : ''}{playInput.yards} yards
                            </Text>
                            {(playInput.endYard === 0 || playInput.endYard === 100) && (
                              <Text fontSize="sm" color="green.400" fontWeight="700" mt={2}>
                                🏈 INTERCEPTION RETURN TOUCHDOWN!
                              </Text>
                            )}
                          </Box>
                        </>
                      ) : (
                        // STANDARD TWO-POINT SYSTEM
                        <>
                          <Text fontSize="sm" fontWeight="600" color="yellow.400" mb={2}>
                            {isSack ? 'Sack Yardage Loss' : 'Play Result (Yards)'}
                          </Text>
                          {isSack && (
                            <Text fontSize="xs" color="red.400" mb={2}>
                              Loss of yards counts against QB rushing stats
                            </Text>
                          )}
                        <Stack direction="row" gap={2} align="center">
                          <Text color="white" fontSize="sm" minW="80px">Start:</Text>
                          <HStack>
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayStart(playInput.startYard - 1)} aria-label="Decrease start">-</Button>
                            <Box
                              w="100px"
                              px={3}
                              py={2}
                              bg="rgba(0, 0, 0, 0.5)"
                              border="1px solid"
                              borderColor="gray.600"
                              borderRadius="md"
                              color="white"
                              fontWeight="700"
                              fontFamily="mono"
                              textAlign="center"
                            >
                              {formatBallDisplay(
                                playInput.startYard,
                                team?.shortName || teamName.substring(0, 2).toUpperCase(),
                                opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                              )}
                            </Box>
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayStart(playInput.startYard + 1)} aria-label="Increase start">+</Button>
                          </HStack>
                        </Stack>
                        <Stack direction="row" gap={2} align="center" mt={2}>
                          <Text color="white" fontSize="sm" minW="80px">End:</Text>
                          <HStack>
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayEnd(playInput.endYard - 1)} aria-label="Decrease end">-</Button>
                            <Box
                              w="100px"
                              px={3}
                              py={2}
                              bg="rgba(0, 0, 0, 0.5)"
                              border="1px solid"
                              borderColor="gray.600"
                              borderRadius="md"
                              color="white"
                              fontWeight="700"
                              fontFamily="mono"
                              textAlign="center"
                            >
                              {formatBallDisplay(
                                playInput.endYard,
                                team?.shortName || teamName.substring(0, 2).toUpperCase(),
                                opponent?.shortName || opponentName.substring(0, 2).toUpperCase()
                              )}
                            </Box>
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayEnd(playInput.endYard + 1)} aria-label="Increase end">+</Button>
                          </HStack>
                        </Stack>
                        <Stack direction="row" gap={2} align="center" mt={2}>
                          <Text color="white" fontSize="sm" minW="80px">Total:</Text>
                          <HStack>
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayYards(playInput.yards - 1)} aria-label="Decrease yards">-</Button>
                            <Input
                              type="number"
                              value={playInput.yards}
                              onChange={(e) => {
                                const num = Number.isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : 0;
                                setPlayYards(num);
                              }}
                              bg="rgba(0, 0, 0, 0.4)"
                              borderColor="gray.600"
                              color="white"
                              w="100px"
                            />
                            <Button size="sm" variant="outline" borderColor="whiteAlpha.700" color="yellow.300" _hover={{ bg: 'whiteAlpha.200' }} onClick={() => setPlayYards(playInput.yards + 1)} aria-label="Increase yards">+</Button>
                          </HStack>
                        </Stack>
                        <Text color="yellow.400" fontSize="md" fontWeight="700" mt={2}>
                          Result: {playInput.yards > 0 ? '+' : ''}{playInput.yards} yards
                        </Text>
                        </>
                      )}
                  </Box>
                  )}
                  
                  {/* Defensive Result Section */}
                  {!showPlayerSelection && (
                  <Box mt={4} p={4} bg="rgba(0, 0, 0, 0.3)" borderRadius="md" border="1px solid" borderColor="gray.600">
                    <Text fontSize="md" fontWeight="700" color="purple.400" mb={3}>
                      🛡️ Defensive Result (Optional)
                    </Text>
                    <Text fontSize="xs" color="gray.400" mb={3}>
                      Add tackle credits or penalty
                    </Text>
                    <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                      <Button
                        size="sm"
                        bg={defensiveResult?.type === 'tackle' ? 'red.600' : 'gray.700'}
                        color="white"
                        _hover={{ bg: defensiveResult?.type === 'tackle' ? 'red.500' : 'gray.600' }}
                        onClick={() => setDefensiveResult(
                          defensiveResult?.type === 'tackle' 
                            ? null 
                            : { type: 'tackle', tacklers: [] }
                        )}
                      >
                        �️ Tackle
                      </Button>
                      <Button
                        size="sm"
                        bg={defensiveResult?.type === 'penalty' ? 'yellow.600' : 'gray.700'}
                        color="white"
                        _hover={{ bg: defensiveResult?.type === 'penalty' ? 'yellow.500' : 'gray.600' }}
                        onClick={() => setDefensiveResult(
                          defensiveResult?.type === 'penalty' 
                            ? null 
                            : { type: 'penalty', tacklers: [] }
                        )}
                      >
                        🚩 Penalty
                      </Button>
                    </Grid>
                    
                    {/* Tackle Player Selection */}
                    {defensiveResult?.type === 'tackle' && (
                      <Box mt={3} p={3} bg="rgba(0, 0, 0, 0.4)" borderRadius="md">
                        <Text fontSize="sm" fontWeight="600" color="gray.300" mb={2}>
                          Select Tacklers (up to 3 players)
                          {playInput.yards < 0 && <Badge colorScheme="red" ml={2}>TFL</Badge>}
                        </Text>
                        <Input
                          placeholder="Search by jersey # or name..."
                          value={defenseSearch}
                          onChange={(e) => setDefenseSearch(e.target.value)}
                          bg="rgba(0, 0, 0, 0.4)"
                          borderColor="gray.600"
                          color="white"
                          _placeholder={{ color: 'gray.400' }}
                          mb={3}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                        {(() => {
                          // Get opponent roster for defensive player selection
                          const opposingRoster = playInput.side === 'home' 
                            ? (opponent?.roster || [])
                            : roster;
                          
                          const searchLower = defenseSearch.toLowerCase().trim();
                          const filteredOpposingRoster = searchLower === ''
                            ? opposingRoster
                            : opposingRoster.filter((p: Player) =>
                                p.jerseyNumber?.toString() === searchLower ||
                                p.name.toLowerCase().includes(searchLower)
                              );
                          
                          return filteredOpposingRoster.length === 0 ? (
                            <Text textAlign="center" color="gray.400" py={4}>
                              No players found
                            </Text>
                          ) : (
                            <SimpleGrid columns={2} gap={2} maxH="200px" overflowY="auto">
                              {filteredOpposingRoster.map((player: Player, idx: number) => {
                                const isSelected = defensiveResult.tacklers.some(t => t.id === player.id);
                                return (
                                  <Button
                                    key={`tackler-${player.id}-${idx}`}
                                    onClick={() => {
                                      if (isSelected) {
                                        // Remove player
                                        setDefensiveResult({
                                          ...defensiveResult,
                                          tacklers: defensiveResult.tacklers.filter(t => t.id !== player.id)
                                        });
                                      } else if (defensiveResult.tacklers.length < 3) {
                                        // Add player (max 3)
                                        setDefensiveResult({
                                          ...defensiveResult,
                                          tacklers: [...defensiveResult.tacklers, player]
                                        });
                                      }
                                      setDefenseSearch('');
                                    }}
                                    h="auto"
                                    py={2}
                                    flexDirection="column"
                                    variant="outline"
                                    borderColor={isSelected ? 'red.400' : 'gray.600'}
                                    bg={isSelected ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 0, 0, 0.4)'}
                                    color="white"
                                    _hover={{ borderColor: 'red.400', bg: 'rgba(239, 68, 68, 0.15)' }}
                                    disabled={!isSelected && defensiveResult.tacklers.length >= 3}
                                  >
                                    <Badge colorScheme={isSelected ? 'red' : 'gray'} mb={1}>
                                      #{player.jerseyNumber}
                                    </Badge>
                                    <Text fontSize="sm" fontWeight="600">
                                      {player.name}
                                    </Text>
                                    {isSelected && <Text fontSize="xs" color="red.300">✓</Text>}
                                  </Button>
                                );
                              })}
                            </SimpleGrid>
                          );
                        })()}
                        {defensiveResult.tacklers.length > 0 && (
                          <Box mt={2}>
                            <Text fontSize="xs" color="gray.400" mb={1}>Selected:</Text>
                            <Stack direction="row" flexWrap="wrap" gap={1}>
                              {defensiveResult.tacklers.map(t => (
                                <Badge key={t.id} colorScheme="red">
                                  #{t.jerseyNumber} {t.name}
                                </Badge>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    {/* Penalty Note */}
                    {defensiveResult?.type === 'penalty' && (
                      <Box mt={3} p={3} bg="rgba(0, 0, 0, 0.4)" borderRadius="md">
                        <Text fontSize="sm" color="gray.300">
                          🚩 Penalty on the play - Make sure to adjust the yards above to reflect the penalty result
                        </Text>
                      </Box>
                    )}
                  </Box>
                  )}
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
                      if (isPassPlay) {
                        // Pass plays require passer
                        if (!playInput.passer) return true;
                        // Interceptions require both passer and defensive player
                        if (isInterception && !playInput.defensivePlayer) return true;
                        // Complete passes require receiver
                        if (isCompletePass && !playInput.receiver) return true;
                        // Incomplete passes and sacks: passer is enough, receiver is optional
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
                    onClick={() => { 
                      onPlayInputClose(); 
                      setPlayInput(null); 
                      setJerseySearch('');
                      setPasserSearch('');
                      setReceiverSearch('');
                    }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
        );
      })()}

      {/* Quarter Change Confirmation Modal */}
      {isQuarterChangeOpen && pendingQuarterChange && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => {
              onQuarterChangeClose();
              setPendingQuarterChange(null);
            }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.900"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="2px solid"
            borderColor="blue.400"
            maxW="500px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="blue.400">
                <Text fontSize="xl" fontWeight="700" color="white">
                  Start Quarter {pendingQuarterChange.newQuarter}?
                </Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  <Text color="gray.200" fontSize="md">
                    Starting Quarter {pendingQuarterChange.newQuarter} will:
                  </Text>
                  <Stack gap={2} pl={4}>
                    <HStack gap={2}>
                      <Text color="blue.400" fontSize="lg">•</Text>
                      <Text color="gray.300">Reset game clock to 12:00</Text>
                    </HStack>
                    {(pendingQuarterChange.newQuarter === 2 || pendingQuarterChange.newQuarter === 4) && (
                      <HStack gap={2}>
                        <Text color="blue.400" fontSize="lg">•</Text>
                        <Text color="gray.300">Swap field direction (teams switch sides)</Text>
                      </HStack>
                    )}
                    <HStack gap={2}>
                      <Text color="blue.400" fontSize="lg">•</Text>
                      <Text color="gray.300">Reset possession clock for new quarter</Text>
                    </HStack>
                    <HStack gap={2}>
                      <Text color="blue.400" fontSize="lg">•</Text>
                      <Text color="gray.300">Continue tracking time of possession from current drive</Text>
                    </HStack>
                  </Stack>
                  <Box bg="blue.900" p={3} borderRadius="md" border="1px solid" borderColor="blue.400">
                    <Text color="blue.200" fontSize="sm" fontWeight="600">
                      ℹ️ Current possession time will carry over to the new quarter until possession changes.
                    </Text>
                  </Box>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="blue.400">
                <Stack direction="row" gap={3}>
                  <Button
                    variant="ghost"
                    color="gray.200"
                    onClick={() => {
                      onQuarterChangeClose();
                      setPendingQuarterChange(null);
                    }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                  <Button
                    bg="blue.500"
                    color="white"
                    _hover={{ bg: 'blue.400' }}
                    onClick={confirmQuarterChange}
                    flex={1}
                    fontWeight="700"
                  >
                    ✓ Start Quarter {pendingQuarterChange.newQuarter}
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Extra Point / 2PT Conversion Modal */}
      {isExtraPointOpen && pendingExtraPoint && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => {
              onExtraPointClose();
              setPendingExtraPoint(null);
              setExtraPointType(null);
              setExtraPointPlayer(null);
              setExtraPointSearch('');
            }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.900"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="2px solid"
            borderColor="orange.400"
            maxW="600px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="orange.400">
                <Text fontSize="xl" fontWeight="700" color="white">
                  Extra Point / 2-Point Conversion
                </Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  {!extraPointType ? (
                    <>
                      <Text color="gray.200" mb={2}>
                        Select the outcome of the extra point attempt:
                      </Text>
                      <SimpleGrid columns={2} gap={3}>
                        <Button
                          h="60px"
                          bg="green.600"
                          color="white"
                          _hover={{ bg: 'green.500' }}
                          onClick={() => setExtraPointType('xp-made')}
                          fontSize="md"
                          fontWeight="700"
                        >
                          ✓ XP Made (+1)
                        </Button>
                        <Button
                          h="60px"
                          bg="red.600"
                          color="white"
                          _hover={{ bg: 'red.500' }}
                          onClick={() => setExtraPointType('xp-missed')}
                          fontSize="md"
                          fontWeight="700"
                        >
                          ✗ XP Missed
                        </Button>
                        <Button
                          h="60px"
                          bg="blue.600"
                          color="white"
                          _hover={{ bg: 'blue.500' }}
                          onClick={() => setExtraPointType('2pt-made')}
                          fontSize="md"
                          fontWeight="700"
                        >
                          ✓ 2PT Made (+2)
                        </Button>
                        <Button
                          h="60px"
                          bg="gray.600"
                          color="white"
                          _hover={{ bg: 'gray.500' }}
                          onClick={() => {
                            setExtraPointType('2pt-failed');
                            recordExtraPoint();
                          }}
                          fontSize="md"
                          fontWeight="700"
                        >
                          ✗ 2PT Failed
                        </Button>
                      </SimpleGrid>
                    </>
                  ) : (
                    <>
                      <Text color="gray.200" mb={2}>
                        {extraPointType === 'xp-made' && 'Select kicker for successful extra point:'}
                        {extraPointType === 'xp-missed' && 'Select kicker for missed extra point:'}
                        {extraPointType === '2pt-made' && 'Select player for successful 2-point conversion:'}
                      </Text>
                      <Input
                        placeholder="Search by name or jersey..."
                        value={extraPointSearch}
                        onChange={(e) => setExtraPointSearch(e.target.value.toLowerCase())}
                        bg="gray.800"
                        border="1px solid"
                        borderColor="gray.600"
                        color="white"
                        _placeholder={{ color: 'gray.400' }}
                        size="lg"
                      />
                      {extraPointPlayer && (
                        <Box
                          bg="orange.500"
                          color="white"
                          px={4}
                          py={3}
                          borderRadius="md"
                          fontWeight="700"
                        >
                          Selected: #{extraPointPlayer.jerseyNumber} {extraPointPlayer.name}
                        </Box>
                      )}
                      <Box
                        maxH="300px"
                        overflowY="auto"
                        border="1px solid"
                        borderColor="gray.700"
                        borderRadius="md"
                      >
                        {roster
                          .filter((p) =>
                            extraPointSearch === '' ||
                            p.name.toLowerCase().includes(extraPointSearch) ||
                            (p.jerseyNumber && p.jerseyNumber.toString().includes(extraPointSearch))
                          )
                          .map((p) => (
                            <Box
                              key={p.id}
                              px={4}
                              py={3}
                              cursor="pointer"
                              bg={extraPointPlayer?.id === p.id ? 'orange.600' : 'transparent'}
                              _hover={{ bg: extraPointPlayer?.id === p.id ? 'orange.600' : 'gray.800' }}
                              onClick={() => setExtraPointPlayer(p)}
                              borderBottom="1px solid"
                              borderColor="gray.700"
                            >
                              <Text color="white" fontWeight={extraPointPlayer?.id === p.id ? '700' : '400'}>
                                #{p.jerseyNumber} {p.name}
                              </Text>
                            </Box>
                          ))}
                      </Box>
                    </>
                  )}
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="orange.400">
                <Stack direction="row" gap={3}>
                  <Button
                    variant="ghost"
                    color="gray.200"
                    onClick={() => {
                      if (extraPointType) {
                        setExtraPointType(null);
                        setExtraPointPlayer(null);
                        setExtraPointSearch('');
                      } else {
                        onExtraPointClose();
                        setPendingExtraPoint(null);
                      }
                    }}
                    flex={1}
                  >
                    {extraPointType ? '← Back' : 'Cancel'}
                  </Button>
                  {extraPointType && extraPointPlayer && (
                    <Button
                      bg="orange.500"
                      color="white"
                      _hover={{ bg: 'orange.400' }}
                      onClick={recordExtraPoint}
                      flex={1}
                      fontWeight="700"
                    >
                      ✓ Confirm
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Kickoff Return Modal */}
      {isKickoffReturnOpen && pendingKickoffReturn && playInput && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => {
              onKickoffReturnClose();
              setPendingKickoffReturn(null);
              setKickoffReturner(null);
              setKickoffReturnSearch('');
            }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.900"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="2px solid"
            borderColor="purple.400"
            maxW="600px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="purple.400">
                <Text fontSize="xl" fontWeight="700" color="white">
                  Kickoff Return
                </Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={4}>
                  <Text color="gray.200">
                    Select the return player from the {pendingKickoffReturn.kickingTeam === 'home' ? opponentName : teamName}:
                  </Text>
                  <Input
                    placeholder="Search by name or jersey..."
                    value={kickoffReturnSearch}
                    onChange={(e) => setKickoffReturnSearch(e.target.value.toLowerCase())}
                    bg="gray.800"
                    border="1px solid"
                    borderColor="gray.600"
                    color="white"
                    _placeholder={{ color: 'gray.400' }}
                    size="lg"
                  />
                  {kickoffReturner && (
                    <Box
                      bg="purple.500"
                      color="white"
                      px={4}
                      py={3}
                      borderRadius="md"
                      fontWeight="700"
                    >
                      Returner: #{kickoffReturner.jerseyNumber} {kickoffReturner.name}
                    </Box>
                  )}
                  <Text color="gray.400" fontSize="sm" fontWeight="600">
                    Return End Position:
                  </Text>
                  <Stack gap={3}>
                    {/* PL/CT Selector */}
                    <HStack gap={2}>
                      <Button
                        size="sm"
                        bg={returnYardSide === 'PL' ? 'purple.500' : 'gray.700'}
                        color="white"
                        _hover={{ bg: returnYardSide === 'PL' ? 'purple.400' : 'gray.600' }}
                        onClick={() => {
                          setReturnYardSide('PL');
                          const actualYard = convertFromPlCt('PL', parseInt(returnYardValue));
                          setPlayInput(prev => prev ? { ...prev, endYard: actualYard } : prev);
                        }}
                        flex={1}
                        fontWeight="700"
                      >
                        PL (Plus)
                      </Button>
                      <Button
                        size="sm"
                        bg={returnYardSide === 'CT' ? 'purple.500' : 'gray.700'}
                        color="white"
                        _hover={{ bg: returnYardSide === 'CT' ? 'purple.400' : 'gray.600' }}
                        onClick={() => {
                          setReturnYardSide('CT');
                          const actualYard = convertFromPlCt('CT', parseInt(returnYardValue));
                          setPlayInput(prev => prev ? { ...prev, endYard: actualYard } : prev);
                        }}
                        flex={1}
                        fontWeight="700"
                      >
                        CT (Center)
                      </Button>
                    </HStack>
                    
                    {/* Yard Line Input with Number Pad */}
                    <Box>
                      <Input
                        value={`${returnYardSide} ${returnYardValue}`}
                        readOnly
                        onClick={() => setShowReturnYardPad(!showReturnYardPad)}
                        bg="gray.800"
                        border="2px solid"
                        borderColor="purple.400"
                        color="white"
                        size="lg"
                        textAlign="center"
                        fontWeight="700"
                        fontSize="xl"
                        cursor="pointer"
                        _placeholder={{ color: 'gray.400' }}
                        placeholder="Tap to enter yard line"
                      />
                      
                      {showReturnYardPad && (
                        <Box mt={2} p={3} bg="gray.800" borderRadius="md" border="1px solid" borderColor="purple.400">
                          <SimpleGrid columns={3} gap={2}>
                            {[7,8,9,4,5,6,1,2,3].map((n) => (
                              <Button
                                key={n}
                                h="45px"
                                bg="gray.700"
                                color="white"
                                _hover={{ bg: 'gray.600' }}
                                onClick={() => handleReturnYardDigit(n)}
                                fontWeight="700"
                                fontSize="lg"
                              >
                                {n}
                              </Button>
                            ))}
                            <Button
                              h="45px"
                              bg="gray.700"
                              color="white"
                              _hover={{ bg: 'gray.600' }}
                              onClick={() => handleReturnYardDigit(0)}
                              fontWeight="700"
                              fontSize="lg"
                            >
                              0
                            </Button>
                            <Button
                              h="45px"
                              bg="red.600"
                              color="white"
                              _hover={{ bg: 'red.500' }}
                              onClick={handleReturnYardBackspace}
                              fontWeight="700"
                            >
                              ←
                            </Button>
                            <Button
                              h="45px"
                              bg="orange.600"
                              color="white"
                              _hover={{ bg: 'orange.500' }}
                              onClick={handleReturnYardClear}
                              fontWeight="700"
                              fontSize="sm"
                            >
                              CLR
                            </Button>
                          </SimpleGrid>
                        </Box>
                      )}
                    </Box>
                    
                    {/* Return Stats Display */}
                    <Stack gap={1} fontSize="sm">
                      <HStack justify="space-between">
                        <Text color="gray.400">Kickoff End (0-100 scale):</Text>
                        <Text color="purple.300" fontWeight="700">{pendingKickoffReturn.kickEndYard}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text color="gray.400">Return End (0-100 scale):</Text>
                        <Text color="purple.300" fontWeight="700">{playInput.endYard}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text color="gray.400">Return Yards:</Text>
                        <Text color="purple.300" fontWeight="700" fontSize="lg">
                          {Math.abs(playInput.endYard - pendingKickoffReturn.kickEndYard)} yards
                        </Text>
                      </HStack>
                    </Stack>
                  </Stack>
                  
                  <Text color="gray.400" fontSize="sm" fontWeight="600" mt={2}>
                    Select Returner:
                  </Text>
                  <Box
                    maxH="200px"
                    overflowY="auto"
                    border="1px solid"
                    borderColor="gray.700"
                    borderRadius="md"
                  >
                    {(pendingKickoffReturn.kickingTeam === 'home' ? (opponent?.roster || []) : roster)
                      .filter((p: Player) =>
                        kickoffReturnSearch === '' ||
                        p.name.toLowerCase().includes(kickoffReturnSearch) ||
                        (p.jerseyNumber && p.jerseyNumber.toString().includes(kickoffReturnSearch))
                      )
                      .map((p: Player) => (
                        <Box
                          key={p.id}
                          px={4}
                          py={3}
                          cursor="pointer"
                          bg={kickoffReturner?.id === p.id ? 'purple.600' : 'transparent'}
                          _hover={{ bg: kickoffReturner?.id === p.id ? 'purple.600' : 'gray.800' }}
                          onClick={() => setKickoffReturner(p)}
                          borderBottom="1px solid"
                          borderColor="gray.700"
                        >
                          <Text color="white" fontWeight={kickoffReturner?.id === p.id ? '700' : '400'}>
                            #{p.jerseyNumber} {p.name}
                          </Text>
                        </Box>
                      ))}
                  </Box>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="purple.400">
                <Stack direction="row" gap={3}>
                  <Button
                    variant="ghost"
                    color="gray.200"
                    onClick={() => {
                      onKickoffReturnClose();
                      setPendingKickoffReturn(null);
                      setKickoffReturner(null);
                      setKickoffReturnSearch('');
                    }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                  {kickoffReturner && (
                    <Button
                      bg="purple.500"
                      color="white"
                      _hover={{ bg: 'purple.400' }}
                      onClick={recordKickoffReturn}
                      flex={1}
                      fontWeight="700"
                    >
                      ✓ Confirm Return
                    </Button>
                  )}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Interception Time Modal */}
      {isInterceptionTimeOpen && pendingInterception && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => { onInterceptionTimeClose(); setPendingInterception(null); setInterceptionTime(''); }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.900"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="2px solid"
            borderColor="purple.400"
            maxW="500px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="purple.400">
                <Text fontSize="xl" fontWeight="700" color="white">Interception - Set Clock Time</Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={3}>
                  <Text color="gray.200">
                    Enter game clock time of interception (MM:SS).
                  </Text>
                  <Stack align="center" gap={3} py={2}>
                    <HStack gap={4} align="center">
                      <Stack align="center" gap={1}>
                        <Button size="xs" variant="ghost" color="purple.300" onClick={() => adjustMinutes(1)}>▲</Button>
                        <Text fontFamily="mono" fontSize="4xl" color="purple.300">
                          {clockMinutes.toString().padStart(2, '0')}
                        </Text>
                        <Button size="xs" variant="ghost" color="purple.300" onClick={() => adjustMinutes(-1)}>▼</Button>
                      </Stack>
                      <Text fontFamily="mono" fontSize="4xl" color="purple.300">:</Text>
                      <Stack align="center" gap={1}>
                        <Button size="xs" variant="ghost" color="purple.300" onClick={() => adjustSeconds(1)}>▲</Button>
                        <Text fontFamily="mono" fontSize="4xl" color="purple.300">
                          {clockSeconds.toString().padStart(2, '0')}
                        </Text>
                        <Button size="xs" variant="ghost" color="purple.300" onClick={() => adjustSeconds(-1)}>▼</Button>
                      </Stack>
                    </HStack>
                    <SimpleGrid columns={3} gap={2} w="100%">
                      {[1,2,3,4,5,6,7,8,9].map((n) => (
                        <Button key={n} h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={() => handleDigitPress(n)}>
                          {n}
                        </Button>
                      ))}
                      <Button h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={() => handleDigitPress(0)}>
                        0
                      </Button>
                      <Button h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={handleClockClear}>
                        Clear
                      </Button>
                    </SimpleGrid>
                  </Stack>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="purple.400">
                <Stack direction="row" gap={3}>
                  <Button
                    variant="ghost"
                    color="gray.200"
                    onClick={() => { onInterceptionTimeClose(); setPendingInterception(null); setInterceptionTime(''); }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                  <Button
                    bg="purple.500"
                    color="white"
                    _hover={{ bg: 'purple.400' }}
                    onClick={recordInterceptionTime}
                    flex={1}
                    fontWeight="700"
                  >
                    ✓ Confirm
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Possession change prompt */}
      {isPossessionPromptOpen && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.700"
            zIndex={1000}
            onClick={() => {
              onPossessionPromptClose();
              setPendingPossessionReason(null);
            }}
          />
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="gray.900"
            borderRadius="xl"
            boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
            border="2px solid"
            borderColor="yellow.400"
            maxW="500px"
            w="90%"
            zIndex={1001}
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0}>
              <Box px={6} py={4} borderBottom="2px solid" borderColor="yellow.400">
                <Text fontSize="xl" fontWeight="700" color="white">Possession Change</Text>
              </Box>
              <Box px={6} py={6}>
                <Stack gap={3}>
                  <Text color="gray.200">
                    {pendingPossessionReason || 'Change of possession'}. Enter current game clock (MM:SS).
                  </Text>
                  <Stack align="center" gap={3} py={2}>
                    <HStack gap={4} align="center">
                      <Stack align="center" gap={1}>
                        <Button size="xs" variant="ghost" color="yellow.300" onClick={() => adjustMinutes(1)}>▲</Button>
                        <Text fontFamily="mono" fontSize="4xl" color="yellow.300">
                          {clockMinutes.toString().padStart(2, '0')}
                        </Text>
                        <Button size="xs" variant="ghost" color="yellow.300" onClick={() => adjustMinutes(-1)}>▼</Button>
                      </Stack>
                      <Text fontFamily="mono" fontSize="4xl" color="yellow.300">:</Text>
                      <Stack align="center" gap={1}>
                        <Button size="xs" variant="ghost" color="yellow.300" onClick={() => adjustSeconds(1)}>▲</Button>
                        <Text fontFamily="mono" fontSize="4xl" color="yellow.300">
                          {clockSeconds.toString().padStart(2, '0')}
                        </Text>
                        <Button size="xs" variant="ghost" color="yellow.300" onClick={() => adjustSeconds(-1)}>▼</Button>
                      </Stack>
                    </HStack>
                    <SimpleGrid columns={3} gap={2} w="100%">
                      {[1,2,3,4,5,6,7,8,9].map((n) => (
                        <Button key={n} h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={() => handleDigitPress(n)}>
                          {n}
                        </Button>
                      ))}
                      <Button h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={() => handleDigitPress(0)}>
                        0
                      </Button>
                      <Button h="48px" bg="gray.800" color="white" _hover={{ bg: 'gray.700' }} onClick={handleClockClear}>
                        Clear
                      </Button>
                    </SimpleGrid>
                  </Stack>
                </Stack>
              </Box>
              <Box px={6} py={4} borderTop="2px solid" borderColor="yellow.400">
                <Stack direction="row" gap={3}>
                  <Button
                    variant="ghost"
                    color="gray.200"
                    onClick={() => {
                      onPossessionPromptClose();
                      setPendingPossessionReason(null);
                    }}
                    flex={1}
                  >
                    Cancel
                  </Button>
                  <Button 
                    bg="yellow.500" 
                    color="black" 
                    _hover={{ bg: 'yellow.400' }} 
                    onClick={confirmPossessionChange}
                    flex={1}
                  >
                    Confirm
                  </Button>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}

      {/* Quick Stats Panel */}
      {isStatsOpen && (
        <Portal>
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="blackAlpha.600"
            zIndex={1000}
            onClick={onStatsClose}
          />
          <Box
            position="fixed"
            top={0}
            right={0}
            bottom={0}
            w={{ base: '100%', md: '600px' }}
            bg="white"
            zIndex={1001}
            boxShadow="-4px 0 20px rgba(0,0,0,0.3)"
            overflowY="auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Stack gap={0} h="full">
              {/* Header */}
              <Box px={4} py={3} borderBottom="2px solid" borderColor="gray.200" bg="gray.50">
                <HStack justify="space-between" mb={3}>
                  <Text fontSize="xl" fontWeight="700">Quick Stats</Text>
                  <Button size="sm" variant="ghost" onClick={onStatsClose}>✕</Button>
                </HStack>
                <HStack gap={2}>
                  <Button
                    size="sm"
                    colorScheme={statsView === 'players' ? 'blue' : 'gray'}
                    variant={statsView === 'players' ? 'solid' : 'outline'}
                    onClick={() => setStatsView('players')}
                    flex={1}
                  >
                    Player Stats
                  </Button>
                  <Button
                    size="sm"
                    colorScheme={statsView === 'reports' ? 'blue' : 'gray'}
                    variant={statsView === 'reports' ? 'solid' : 'outline'}
                    onClick={() => setStatsView('reports')}
                    flex={1}
                  >
                    Team Reports
                  </Button>
                </HStack>
              </Box>

              {/* Content */}
              <Box flex={1} p={4}>
                {statsView === 'players' ? (
                  <Stack gap={4}>
                    <Text fontSize="lg" fontWeight="600">Player Statistics</Text>
                    <Box overflowX="auto">
                      {(() => {
                        console.log('Quick Stats - Roster length:', roster.length);
                        console.log('Quick Stats - First player:', roster[0]);
                        const playersWithStats = roster.filter(p => 
                          (p.stats.rushingYards || 0) > 0 ||
                          (p.stats.passingYards || 0) > 0 ||
                          (p.stats.receivingYards || 0) > 0 ||
                          (p.stats.rushingTouchdowns || 0) > 0 ||
                          (p.stats.passingTouchdowns || 0) > 0 ||
                          (p.stats.tackles || 0) > 0
                        );
                        console.log('Quick Stats - Players with stats:', playersWithStats.length);
                        return null;
                      })()}
                      <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>#</th>
                            <th style={{ textAlign: 'left', padding: '8px', fontWeight: '600' }}>Player</th>
                            <th style={{ textAlign: 'center', padding: '8px', fontWeight: '600' }}>Rush Yds</th>
                            <th style={{ textAlign: 'center', padding: '8px', fontWeight: '600' }}>Pass Yds</th>
                            <th style={{ textAlign: 'center', padding: '8px', fontWeight: '600' }}>Rec Yds</th>
                            <th style={{ textAlign: 'center', padding: '8px', fontWeight: '600' }}>TDs</th>
                            <th style={{ textAlign: 'center', padding: '8px', fontWeight: '600' }}>Tackles</th>
                          </tr>
                        </thead>
                        <tbody>
                          {roster
                            .filter(p => 
                              (p.stats.rushingYards || 0) > 0 ||
                              (p.stats.passingYards || 0) > 0 ||
                              (p.stats.receivingYards || 0) > 0 ||
                              (p.stats.rushingTouchdowns || 0) > 0 ||
                              (p.stats.passingTouchdowns || 0) > 0 ||
                              (p.stats.tackles || 0) > 0
                            )
                            .sort((a, b) => {
                              const totalA = (a.stats.rushingYards || 0) + (a.stats.passingYards || 0) + (a.stats.receivingYards || 0);
                              const totalB = (b.stats.rushingYards || 0) + (b.stats.passingYards || 0) + (b.stats.receivingYards || 0);
                              return totalB - totalA;
                            })
                            .map((player) => (
                              <tr key={player.id} style={{ borderBottom: '1px solid #f7fafc' }}>
                                <td style={{ padding: '8px' }}>#{player.jerseyNumber}</td>
                                <td style={{ padding: '8px', fontWeight: '500' }}>{player.name}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{player.stats.rushingYards || 0}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{player.stats.passingYards || 0}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{player.stats.receivingYards || 0}</td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>
                                  {(player.stats.rushingTouchdowns || 0) + (player.stats.passingTouchdowns || 0)}
                                </td>
                                <td style={{ padding: '8px', textAlign: 'center' }}>{player.stats.tackles || 0}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {roster.filter(p => 
                        (p.stats.rushingYards || 0) > 0 ||
                        (p.stats.passingYards || 0) > 0 ||
                        (p.stats.receivingYards || 0) > 0 ||
                        (p.stats.rushingTouchdowns || 0) > 0 ||
                        (p.stats.passingTouchdowns || 0) > 0 ||
                        (p.stats.tackles || 0) > 0
                      ).length === 0 && (
                        <Text textAlign="center" color="gray.500" py={8}>
                          No stats recorded yet
                        </Text>
                      )}
                    </Box>
                  </Stack>
                ) : (
                  <Stack gap={4}>
                    <Text fontSize="lg" fontWeight="600">Team Reports</Text>
                    <Stack gap={3}>
                      <Box p={3} bg="blue.50" borderRadius="md" border="1px solid" borderColor="blue.200">
                        <Text fontSize="sm" fontWeight="600" mb={2}>Total Offense</Text>
                        <Text fontSize="2xl" fontWeight="700">
                          {roster.reduce((sum, p) => sum + (p.stats.rushingYards || 0) + (p.stats.passingYards || 0) + (p.stats.receivingYards || 0), 0)} yards
                        </Text>
                      </Box>
                      <Box p={3} bg="green.50" borderRadius="md" border="1px solid" borderColor="green.200">
                        <Text fontSize="sm" fontWeight="600" mb={2}>Rushing</Text>
                        <Text fontSize="xl" fontWeight="600">
                          {roster.reduce((sum, p) => sum + (p.stats.rushingYards || 0), 0)} yards
                        </Text>
                      </Box>
                      <Box p={3} bg="purple.50" borderRadius="md" border="1px solid" borderColor="purple.200">
                        <Text fontSize="sm" fontWeight="600" mb={2}>Passing</Text>
                        <Text fontSize="xl" fontWeight="600">
                          {roster.reduce((sum, p) => sum + (p.stats.passingYards || 0), 0)} yards
                        </Text>
                      </Box>
                      <Box p={3} bg="red.50" borderRadius="md" border="1px solid" borderColor="red.200">
                        <Text fontSize="sm" fontWeight="600" mb={2}>Turnovers</Text>
                        <Text fontSize="xl" fontWeight="600">
                          {roster.reduce((sum, p) => sum + (p.stats.interceptions || 0) + (p.stats.fumblesLost || 0), 0)}
                        </Text>
                      </Box>
                      <Box p={3} bg="gray.50" borderRadius="md" border="1px solid" borderColor="gray.200">
                        <Text fontSize="sm" fontWeight="600" mb={2}>Total Plays</Text>
                        <Text fontSize="xl" fontWeight="600">
                          {game.plays?.length || 0}
                        </Text>
                      </Box>
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Stack>
          </Box>
        </Portal>
      )}
    </Stack>
  );
};

export default ScoringScreen;







