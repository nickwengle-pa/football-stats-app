import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  Badge,
  Box,
  Button,
  Center,
  HStack,
  Image,
  Input,
  Spinner,
  SimpleGrid,
  Stack,
  Text,
  chakra,
} from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid';
import { useNavigate } from 'react-router-dom';
import {
  subscribeToSeasonGames,
  upsertSeasonGame,
  upsertSeason,
  upsertOpponent,
  deleteOpponent,
} from '../services/dbService';
import { Game, GameRules, OpponentTeam, Player, Season, TeamBranding, TeamLevel } from '../models';
import { useProgram } from '../context/ProgramContext';
import { PageHeader, SectionCard, DataTable, DataTableColumn } from './ui';

type GameFormState = {
  opponent: string;
  date: string;
  time: string;
  site: 'home' | 'away' | 'neutral';
  location: string;
  notes: string;
  opponentTeamId: string;
};

type SeasonFormState = {
  year: string;
  label: string;
  level: TeamLevel;
  startDate: string;
};

type ParsedRosterResult = {
  players: Player[];
  issues: string[];
};

type ImporterMessage = {
  tone: 'success' | 'error' | 'info';
  text: string;
};

type OpponentPlayerFormState = {
  id?: string;
  name: string;
  jerseyNumber: string;
  position: string;
  grade: string;
  height: string;
  weight: string;
};

type OpponentFormState = {
  id?: string;
  name: string;
  mascot: string;
  shortName: string;
  location: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoDataUrl: string | null;
  notes: string;
};

const defaultRules: GameRules = {
  quarterLengthMinutes: 12,
  overtimeEnabled: true,
  tackleMode: 'equal',
  scoring: {
    touchdown: 6,
    fieldGoal: 3,
    safety: 2,
    extraPointKick: 1,
    extraPointConversion: 2,
  },
  followNfhs: true,
};

const OPPONENT_PLACEHOLDER_PLAYER_ID = 'opponent-team-placeholder';

const opponentPlaceholderPlayer: Player = {
  id: OPPONENT_PLACEHOLDER_PLAYER_ID,
  name: 'TEAM',
  preferredName: 'TEAM',
  jerseyNumber: 100,
  stats: {},
};

const MAX_OPPONENT_LOGO_SIZE = 2 * 1024 * 1024;

const defaultGameForm: GameFormState = {
  opponent: '',
  date: '',
  time: '19:00',
  site: 'home',
  location: '',
  notes: '',
  opponentTeamId: '',
};

const defaultSeasonForm = (): SeasonFormState => {
  const currentYear = new Date().getFullYear();
  const defaultStart = new Date(currentYear, 7, 1);
  return {
    year: String(currentYear),
    label: `${currentYear}-${currentYear + 1}`,
    level: 'varsity',
    startDate: defaultStart.toISOString().split('T')[0],
  };
};

const defaultOpponentPlayerForm = (): OpponentPlayerFormState => ({
  id: undefined,
  name: '',
  jerseyNumber: '',
  position: '',
  grade: '',
  height: '',
  weight: '',
});

const defaultOpponentForm = (): OpponentFormState => ({
  id: undefined,
  name: '',
  mascot: '',
  shortName: '',
  location: '',
  primaryColor: '#1A202C',
  secondaryColor: '#4A5568',
  accentColor: '#CBD5F5',
  logoDataUrl: null,
  notes: '',
});

const gameSiteLabel: Record<GameFormState['site'], string> = {
  home: 'Home',
  away: 'Away',
  neutral: 'Neutral',
};

const levelOptions: { value: TeamLevel; label: string }[] = [
  { value: 'varsity', label: 'Varsity' },
  { value: 'junior-varsity', label: 'Junior Varsity' },
  { value: 'freshman', label: 'Freshman' },
  { value: 'middle-school', label: 'Middle School' },
  { value: 'youth', label: 'Youth' },
  { value: 'other', label: 'Other' },
];

const formatDateForInput = (timestamp?: Timestamp): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toISOString().split('T')[0] ?? '';
};

const formatTimeForInput = (kickoff?: string, timestamp?: Timestamp): string => {
  if (kickoff) return kickoff;
  if (!timestamp) return '19:00';
  const date = timestamp.toDate();
  return date.toISOString().substring(11, 16);
};

const combineDateTimeToTimestamp = (date: string, time: string): Timestamp => {
  if (!date) {
    return Timestamp.now();
  }
  const [hours, minutes] = time ? time.split(':').map(Number) : [19, 0];
  const dateObj = new Date(date);
  dateObj.setHours(hours ?? 19, minutes ?? 0, 0, 0);
  return Timestamp.fromDate(dateObj);
};

const sortGames = (games: Game[]) =>
  [...games].sort((a, b) => {
    if (a.date && b.date) {
      return a.date.toMillis() - b.date.toMillis();
    }
    if (a.date) return -1;
    if (b.date) return 1;
    return (a.opponent ?? '').localeCompare(b.opponent ?? '');
  });

const getSeasonDisplayName = (season: Season) => {
  const levelLabel = levelOptions.find((option) => option.value === season.level)?.label ?? '';
  return `${season.label} ${levelLabel ? `(${levelLabel})` : ''}`.trim();
};

const formatGameDate = (timestamp?: Timestamp) => {
  if (!timestamp) return '--';
  const date = timestamp.toDate();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatGameTime = (kick?: string, timestamp?: Timestamp) => {
  if (kick) return kick;
  if (!timestamp) return '--';
  return timestamp.toDate().toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const useSeasonById = (seasons: Season[], seasonId?: string) =>
  useMemo(() => seasons.find((season) => season.id === seasonId), [seasons, seasonId]);

const isPlaceholderPlayer = (player: Player) => {
  const name = (player.name ?? '').toUpperCase();
  return (
    player.id === OPPONENT_PLACEHOLDER_PLAYER_ID ||
    (player.jerseyNumber === 100 && name === 'TEAM') ||
    (player.preferredName?.toUpperCase?.() === 'TEAM' && player.jerseyNumber === 100)
  );
};

const ensurePlaceholderPlayer = (players: Player[]) => {
  const sanitized = players
    .filter((player): player is Player => Boolean(player))
    .map((player) =>
      isPlaceholderPlayer(player)
        ? { ...opponentPlaceholderPlayer, id: OPPONENT_PLACEHOLDER_PLAYER_ID }
        : player
    );
  if (sanitized.some(isPlaceholderPlayer)) {
    return sanitized.map((player) =>
      isPlaceholderPlayer(player) ? { ...opponentPlaceholderPlayer } : player
    );
  }
  return [...sanitized, { ...opponentPlaceholderPlayer }];
};

const sortOpponentRoster = (players: Player[]) =>
  [...players].sort((a, b) => {
    const aPlaceholder = isPlaceholderPlayer(a);
    const bPlaceholder = isPlaceholderPlayer(b);
    if (aPlaceholder && !bPlaceholder) return 1;
    if (!aPlaceholder && bPlaceholder) return -1;
    const aNumber = typeof a.jerseyNumber === 'number' ? a.jerseyNumber : Infinity;
    const bNumber = typeof b.jerseyNumber === 'number' ? b.jerseyNumber : Infinity;
    if (aNumber !== bNumber) return aNumber - bNumber;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

const normalizeOpponentRoster = (players: Player[]) =>
  sortOpponentRoster(ensurePlaceholderPlayer(players));

const formatClassYear = (value?: number) => {
  if (!value) return '--';
  if (value > 2000) return value.toString();
  return `20${value.toString().padStart(2, '0')}`;
};

const formatGradeLabel = (player: Player) => {
  if (player.metadata && typeof player.metadata.grade === 'string') {
    return player.metadata.grade;
  }
  return formatClassYear(player.classYear);
};

const GameList: React.FC = () => {
  const navigate = useNavigate();
  const {
    team,
    teamLoading,
    teamError,
    seasons,
    seasonsLoading,
    seasonsError,
    opponents,
    opponentsLoading,
    opponentsError,
    activeSeasonId,
    setActiveSeasonId,
    refreshSeasons,
    refreshOpponents,
  } = useProgram();

  const activeSeason = useSeasonById(seasons, activeSeasonId);
  const teamId = team?.id ?? null;

  const [seasonFormOpen, setSeasonFormOpen] = useState(false);
  const [seasonForm, setSeasonForm] = useState<SeasonFormState>(() => defaultSeasonForm());
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonFeedback, setSeasonFeedback] = useState<string | null>(null);

  const [games, setGames] = useState<Game[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);

  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [gameForm, setGameForm] = useState<GameFormState>(() => ({ ...defaultGameForm }));
  const [gameSaving, setGameSaving] = useState(false);
  const [gameFeedback, setGameFeedback] = useState<string | null>(null);

  const [opponentRoster, setOpponentRoster] = useState<Player[]>(normalizeOpponentRoster([]));

  const [opponentFormOpen, setOpponentFormOpen] = useState(false);
  const [opponentForm, setOpponentForm] = useState<OpponentFormState>(() => defaultOpponentForm());
  const [opponentSaving, setOpponentSaving] = useState(false);
  const [opponentFeedback, setOpponentFeedback] = useState<string | null>(null);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [editingOpponentId, setEditingOpponentId] = useState<string | null>(null);
  const opponentLogoInputRef = useRef<HTMLInputElement | null>(null);
  const [libraryRoster, setLibraryRoster] = useState<Player[]>(normalizeOpponentRoster([]));
  const [libraryRosterError, setLibraryRosterError] = useState<string | null>(null);
  const [libraryRosterFeedback, setLibraryRosterFeedback] = useState<string | null>(null);
  const [libraryPlayerFormOpen, setLibraryPlayerFormOpen] = useState(false);
  const [libraryPlayerForm, setLibraryPlayerForm] = useState<OpponentPlayerFormState>(() =>
    defaultOpponentPlayerForm()
  );
  const [libraryEditingPlayerId, setLibraryEditingPlayerId] = useState<string | null>(null);
  const [libraryImportOpen, setLibraryImportOpen] = useState(false);
  const [libraryImportText, setLibraryImportText] = useState('');
  const [libraryImportMessage, setLibraryImportMessage] = useState<ImporterMessage | null>(null);

  const selectedOpponent = useMemo(
    () => opponents.find((opponent) => opponent.id === gameForm.opponentTeamId),
    [opponents, gameForm.opponentTeamId]
  );

  const sortedOpponents = useMemo(
    () => [...opponents].sort((a, b) => a.name.localeCompare(b.name)),
    [opponents]
  );

  const resetSeasonForm = useCallback(() => {
    setSeasonForm(defaultSeasonForm());
    setSeasonFeedback(null);
  }, []);

  const resetLibraryRosterState = useCallback(() => {
    setLibraryRoster(normalizeOpponentRoster([]));
    setLibraryRosterError(null);
    setLibraryRosterFeedback(null);
    setLibraryPlayerForm(defaultOpponentPlayerForm());
    setLibraryPlayerFormOpen(false);
    setLibraryEditingPlayerId(null);
    setLibraryImportOpen(false);
    setLibraryImportText('');
    setLibraryImportMessage(null);
  }, []);

  const resetOpponentFormState = useCallback(() => {
    setOpponentForm(defaultOpponentForm());
    setOpponentFeedback(null);
    setOpponentError(null);
    setEditingOpponentId(null);
    resetLibraryRosterState();
    if (opponentLogoInputRef.current) {
      opponentLogoInputRef.current.value = '';
    }
  }, [resetLibraryRosterState]);

  const resetOpponentRosterUi = useCallback(() => {
    setOpponentRoster(normalizeOpponentRoster([]));
  }, []);

  const resetGameForm = useCallback(() => {
    setGameForm({ ...defaultGameForm });
    setSelectedGameId(null);
    setGameFeedback(null);
    resetOpponentRosterUi();
    resetOpponentFormState();
    setOpponentFormOpen(false);
  }, [resetOpponentFormState, resetOpponentRosterUi]);

  const handleOpponentFormChange = useCallback(
    (field: keyof OpponentFormState, value: string) => {
      setOpponentForm((prev) => ({ ...prev, [field]: value }));
      setOpponentError(null);
      setOpponentFeedback(null);
    },
    []
  );

  const handleOpponentLogoSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_OPPONENT_LOGO_SIZE) {
        setOpponentError('Logo must be 2MB or smaller.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setOpponentForm((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
          setOpponentError(null);
        } else {
          setOpponentError('Unsupported logo format. Try a PNG or JPG image.');
        }
      };
      reader.onerror = () => {
        setOpponentError('Unable to read logo file. Please try a different image.');
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleOpponentLogoRemove = useCallback(() => {
    setOpponentForm((prev) => ({ ...prev, logoDataUrl: null }));
    if (opponentLogoInputRef.current) {
      opponentLogoInputRef.current.value = '';
    }
  }, []);

  const openCreateOpponent = useCallback(() => {
    resetOpponentFormState();
    setOpponentFormOpen(true);
  }, [resetOpponentFormState]);

  const handleEditOpponent = useCallback(
    (opponent: OpponentTeam) => {
      setOpponentForm({
        id: opponent.id,
        name: opponent.name ?? '',
        mascot: opponent.mascot ?? '',
        shortName: opponent.shortName ?? '',
        location: opponent.location ?? '',
        primaryColor: opponent.colors?.primaryColor ?? '#1A202C',
        secondaryColor: opponent.colors?.secondaryColor ?? '#4A5568',
        accentColor: opponent.colors?.accentColor ?? '#CBD5F5',
        logoDataUrl: opponent.colors?.logoUrl ?? null,
        notes: opponent.notes ?? '',
      });
      setOpponentError(null);
      setOpponentFeedback(null);
      setEditingOpponentId(opponent.id);
      setLibraryRoster(normalizeOpponentRoster(opponent.roster ?? []));
      setLibraryRosterError(null);
      setLibraryRosterFeedback(null);
      setLibraryPlayerForm(defaultOpponentPlayerForm());
      setLibraryPlayerFormOpen(false);
      setLibraryEditingPlayerId(null);
      setLibraryImportOpen(false);
      setLibraryImportText('');
      setLibraryImportMessage(null);
      setOpponentFormOpen(true);
      if (opponentLogoInputRef.current) {
        opponentLogoInputRef.current.value = '';
      }
    },
    []
  );

  const handleSelectOpponent = useCallback(
    (opponentId: string) => {
      if (!opponentId) {
        setGameForm((prev) => ({ ...prev, opponentTeamId: '' }));
        setGameFeedback(null);
        return;
      }
      const opponentRecord = opponents.find((item) => item.id === opponentId);
      setGameForm((prev) => ({
        ...prev,
        opponentTeamId: opponentId,
        opponent:
          prev.opponent.trim().length > 0
            ? prev.opponent
            : opponentRecord?.name ?? prev.opponent,
        location:
          prev.location.trim().length > 0 || !opponentRecord?.location
            ? prev.location
            : opponentRecord.location ?? '',
      }));
      setGameFeedback(null);
    },
    [opponents]
  );

  const handleUseOpponentForGame = useCallback(
    (opponent: OpponentTeam) => {
      setGameForm((prev) => ({
        ...prev,
        opponentTeamId: opponent.id,
        opponent: prev.opponent.trim().length > 0 ? prev.opponent : opponent.name,
        location:
          prev.location.trim().length > 0 || !opponent.location
            ? prev.location
            : opponent.location ?? '',
      }));
      setGameFeedback(null);
    },
    []
  );

  const handleSaveOpponent = useCallback(async () => {
    if (!teamId) return;
    const trimmedName = opponentForm.name.trim();
    if (!trimmedName) {
      setOpponentError('Opponent name is required.');
      return;
    }

    setOpponentSaving(true);
    setOpponentError(null);
    setOpponentFeedback(null);
    try {
      const now = Timestamp.now();
      const existing = opponentForm.id
        ? opponents.find((opponent) => opponent.id === opponentForm.id)
        : undefined;
      const colors: TeamBranding = {
        primaryColor: opponentForm.primaryColor || '#1A202C',
        secondaryColor: opponentForm.secondaryColor || '#4A5568',
      };

      const accent = opponentForm.accentColor?.trim();
      if (accent) {
        colors.accentColor = accent;
      }
      if (opponentForm.logoDataUrl) {
        colors.logoUrl = opponentForm.logoDataUrl;
      }

      const rosterForSave = normalizeOpponentRoster(libraryRoster);

      const payload: OpponentTeam = {
        id: opponentForm.id ?? uuidv4(),
        teamId,
        name: trimmedName,
        colors,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const mascot = opponentForm.mascot.trim();
      if (mascot) {
        payload.mascot = mascot;
      }
      const shortName = opponentForm.shortName.trim();
      if (shortName) {
        payload.shortName = shortName;
      }
      const location = opponentForm.location.trim();
      if (location) {
        payload.location = location;
      }
      const notes = opponentForm.notes.trim();
      if (notes) {
        payload.notes = notes;
      }
      payload.roster = rosterForSave;

      await upsertOpponent(teamId, payload);
      await refreshOpponents();
      setLibraryRoster(rosterForSave);
      setOpponentFeedback('Opponent saved.');
      setOpponentFormOpen(false);
      resetOpponentFormState();
    } catch (error) {
      console.error('Failed to save opponent', error);
      setOpponentError('Unable to save opponent. Please try again.');
    } finally {
      setOpponentSaving(false);
    }
  }, [teamId, opponentForm, opponents, refreshOpponents, libraryRoster, resetOpponentFormState]);

  const handleDeleteOpponentEntry = useCallback(
    async (opponentId: string) => {
      if (!teamId) return;
      setOpponentError(null);
      setOpponentFeedback(null);
      setOpponentSaving(true);
      try {
        await deleteOpponent(teamId, opponentId);
        if (gameForm.opponentTeamId === opponentId) {
          setGameForm((prev) => ({ ...prev, opponentTeamId: '' }));
        }
        await refreshOpponents();
        if (editingOpponentId === opponentId) {
          resetOpponentFormState();
          setOpponentFormOpen(false);
        }
        setOpponentFeedback('Opponent removed.');
      } catch (error) {
        console.error('Failed to delete opponent', error);
        setOpponentError('Unable to delete opponent right now.');
      } finally {
        setOpponentSaving(false);
      }
    },
    [teamId, gameForm.opponentTeamId, refreshOpponents, editingOpponentId, resetOpponentFormState]
  );

  const handleClearOpponentSelection = useCallback(() => {
    handleSelectOpponent('');
  }, [handleSelectOpponent]);

  useEffect(() => {
    if (!teamId || !activeSeasonId) {
      setGames([]);
      return;
    }

    setGamesLoading(true);
    setGamesError(null);

    const unsubscribe = subscribeToSeasonGames(teamId, activeSeasonId, (records) => {
      setGames(sortGames(records));
      setGamesLoading(false);
    });

    return () => {
      unsubscribe?.();
    };
  }, [teamId, activeSeasonId]);

  useEffect(() => {
    if (!selectedGameId) {
      setGameForm({ ...defaultGameForm });
      resetOpponentRosterUi();
      resetOpponentFormState();
      setOpponentFormOpen(false);
      return;
    }
    const nextGame = games.find((game) => game.id === selectedGameId);
    if (!nextGame) {
      setGameForm({ ...defaultGameForm });
      setSelectedGameId(null);
      resetOpponentRosterUi();
      resetOpponentFormState();
      setOpponentFormOpen(false);
      return;
    }
    setGameForm({
      opponent: nextGame.opponentName ?? nextGame.opponent ?? '',
      date: formatDateForInput(nextGame.date),
      time: formatTimeForInput(nextGame.kickoffTime, nextGame.date),
      site: (nextGame.site as GameFormState['site']) ?? 'home',
      location: nextGame.location ?? '',
      notes: nextGame.notes ?? '',
      opponentTeamId: nextGame.opponentTeamId ?? '',
    });
    setOpponentRoster(normalizeOpponentRoster(nextGame.opponentSnapshot?.roster ?? []));
  }, [selectedGameId, games, resetOpponentFormState, resetOpponentRosterUi]);

  const handleSeasonFormChange = (field: keyof SeasonFormState, value: string) => {
    setSeasonForm((prev) => ({ ...prev, [field]: value }));
    setSeasonFeedback(null);
  };

  const handleGameFormChange = (field: keyof GameFormState, value: string) => {
    setGameForm((prev) => ({ ...prev, [field]: value }));
    setGameFeedback(null);
  };

  const parseMaxPrepsOpponentRoster = useCallback(
    (raw: string): ParsedRosterResult => {
      if (!raw.trim()) {
        return { players: [], issues: ['No roster text provided.'] };
      }

      const sections = raw.replace(/\r/g, '').split(/#\s*Player\s*Grade\s*Position\s*Height\s*Weight/i);
      if (sections.length <= 1) {
        return {
          players: [],
          issues: ['Could not find the roster header "# Player Grade Position Height Weight".'],
        };
      }

      const section = sections[1];
      const issues: string[] = [];
      const gradeOffsets: Record<string, number> = {
        sr: 0,
        senior: 0,
        jr: 1,
        junior: 1,
        so: 2,
        soph: 2,
        sophomore: 2,
        fr: 3,
        freshman: 3,
        '8th': 4,
        '8thgrade': 4,
        '7th': 5,
        '7thgrade': 5,
        '6th': 6,
        '6thgrade': 6,
        '5th': 7,
        '5thgrade': 7,
      };

      const normalizeGradeKey = (value: string) => {
        const key = value.toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
        if (gradeOffsets[key] !== undefined) return key;
        if (key.startsWith('senior')) return 'senior';
        if (key.startsWith('junior')) return 'junior';
        if (key.startsWith('soph')) return 'soph';
        if (key.startsWith('fresh')) return 'freshman';
        if (key.startsWith('eight')) return '8th';
        if (key.startsWith('seven')) return '7th';
        if (key.startsWith('six')) return '6th';
        if (key.startsWith('five')) return '5th';
        return key;
      };

      const isHeightValue = (value: string) => {
        const normalized = value.toLowerCase().replace(/\s+/g, '');
        if (normalized === '-' || normalized === '') return true;
        return /^(\d{1,2}'\d{0,2}"?|\d{1,2}"|-\s*)$/.test(normalized);
      };

      const normalizeHeight = (value?: string) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        if (!trimmed || trimmed === '-') return undefined;
        const match = trimmed.match(/(\d{1,2})\s*'\s*(\d{1,2})"?/);
        if (match) {
          const feet = match[1];
          const inches = match[2] ?? '0';
          return `${feet}'${inches}"`;
        }
        return trimmed;
      };

      const isWeightValue = (value: string) => {
        const normalized = value.toLowerCase().replace(/\s+/g, '');
        if (!normalized || normalized === '-') return true;
        return /^\d{2,3}(lbs|pounds)?$/.test(normalized);
      };

      const normalizeWeight = (value?: string) => {
        if (!value) return undefined;
        const normalized = value.toLowerCase().replace(/\s+/g, '');
        if (!normalized || normalized === '-') return undefined;
        const match = normalized.match(/^(\d{2,3})(?:lbs|pounds)?$/);
        if (match) {
          return `${match[1]} lbs`;
        }
        return value.trim();
      };

      const lines = section
        .split('\n')
        .map((line) => line.replace(/\u00a0/g, ' ').trim())
        .filter((line) => line !== '');

      const endTokens = [
        /^volunteer/i,
        /^help the coach/i,
        /^roster last updated/i,
        /^print$/i,
        /^latest videos/i,
        /^contribute to the team/i,
      ];

      const players: Player[] = [];
      const seenKeys = new Set<string>();
      let index = 0;

      const pushIssue = (message: string) => {
        issues.push(message);
        console.warn('[Opponent Roster Import]', message);
      };

      while (index < lines.length) {
        let jerseyLine: string | undefined;
        while (index < lines.length) {
          const candidate = lines[index++];
          if (endTokens.some((regex) => regex.test(candidate))) {
            jerseyLine = undefined;
            index = lines.length;
            break;
          }
          const normalized = candidate.replace(/^#/, '');
          if (/^\d{1,3}$/.test(normalized)) {
            jerseyLine = normalized;
            break;
          }
        }

        if (!jerseyLine) {
          break;
        }

        let nameLine: string | undefined;
        while (index < lines.length) {
          const candidate = lines[index++];
          if (!candidate) continue;
          if (/^#\s*player/i.test(candidate)) {
            index -= 1;
            break;
          }
          nameLine = candidate.replace(/\s+/g, ' ').trim();
          break;
        }

        if (!nameLine) {
          pushIssue(`Skipped #${jerseyLine}: missing player name.`);
          continue;
        }

        let detailsLine: string | undefined;
        while (index < lines.length) {
          const candidate = lines[index++];
          if (!candidate) continue;
          detailsLine = candidate;
          break;
        }

        if (!detailsLine) {
          pushIssue(`Skipped ${nameLine}: missing grade/position information.`);
          continue;
        }

        let segments = detailsLine.split(/\t+/).map((part) => part.trim()).filter(Boolean);
        if (segments.length <= 1) {
          segments = detailsLine.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
        }
        if (!segments.length) {
          pushIssue(`Skipped ${nameLine}: could not parse columns.`);
          continue;
        }

        const gradeLabel = segments[0];
        const gradeKey = normalizeGradeKey(gradeLabel);
        if (!gradeKey || gradeOffsets[gradeKey] === undefined) {
          pushIssue(`Skipped ${nameLine}: grade "${gradeLabel}" is not supported.`);
          continue;
        }

        const remaining = segments.slice(1);
        const positionBuffer: string[] = [];
        let heightValue: string | undefined;
        let weightValue: string | undefined;

        remaining.forEach((segment) => {
          if (!heightValue && isHeightValue(segment)) {
            heightValue = segment;
            return;
          }
          if (!weightValue && isWeightValue(segment)) {
            weightValue = segment;
            return;
          }
          positionBuffer.push(segment);
        });

        const positionString = positionBuffer.join(' ').replace(/\s+/g, ' ').trim();
        const positions =
          positionString.length > 0
            ? positionString
                .split(/[,/]/)
                .map((value) => value.trim())
                .filter(Boolean)
            : undefined;

        const jerseyMatch = jerseyLine.match(/\d{1,3}/);
        const jerseyNumber = jerseyMatch ? Number(jerseyMatch[0]) : undefined;

        let classYear: number | undefined;
        const offset = gradeOffsets[gradeKey];
        if (activeSeason?.year !== undefined && offset !== undefined) {
          classYear = activeSeason.year + offset;
        }

        const metadata: Record<string, unknown> = { grade: gradeLabel };
        const normalizedHeight = normalizeHeight(heightValue);
        const normalizedWeight = normalizeWeight(weightValue);

        const player: Player = {
          id: uuidv4(),
          name: nameLine,
          preferredName: nameLine,
          stats: {},
          metadata,
        };

        if (Number.isFinite(jerseyNumber)) {
          player.jerseyNumber = jerseyNumber as number;
        }
        if (positions?.length) {
          player.position = positions[0];
          player.positions = positions;
        }
        if (typeof classYear === 'number') {
          player.classYear = classYear;
        }
        if (normalizedHeight) {
          player.height = normalizedHeight;
        }
        if (normalizedWeight) {
          player.weight = normalizedWeight;
        }

        const dedupeKey = `${player.name.toLowerCase()}-${player.jerseyNumber ?? 'na'}`;
        if (seenKeys.has(dedupeKey)) {
          pushIssue(
            `Duplicate entry skipped for ${player.name}${
              player.jerseyNumber ? ` (#${player.jerseyNumber})` : ''
            }.`
          );
          continue;
        }

        seenKeys.add(dedupeKey);
        players.push(player);
      }

      if (!players.length && !issues.length) {
        issues.push('No players could be parsed from the pasted text.');
      }

      return { players, issues };
    },
    [activeSeason?.year]
  );

  const persistLibraryRoster = useCallback(
    (players: Player[], successMessage?: string) => {
      const normalized = normalizeOpponentRoster(players);
      setLibraryRoster(normalized);
      setLibraryRosterError(null);
      setLibraryRosterFeedback(successMessage ?? null);
    },
    []
  );

  const openLibraryPlayerForm = useCallback(() => {
    setLibraryPlayerForm(defaultOpponentPlayerForm());
    setLibraryPlayerFormOpen(true);
    setLibraryEditingPlayerId(null);
    setLibraryRosterError(null);
    setLibraryRosterFeedback(null);
  }, []);

  const handleLibraryPlayerFormChange = useCallback(
    (field: keyof OpponentPlayerFormState, value: string) => {
      setLibraryPlayerForm((prev) => ({ ...prev, [field]: value }));
      setLibraryRosterError(null);
      setLibraryRosterFeedback(null);
    },
    []
  );

  const handleLibraryCancelPlayer = useCallback(() => {
    setLibraryPlayerForm(defaultOpponentPlayerForm());
    setLibraryPlayerFormOpen(false);
    setLibraryEditingPlayerId(null);
    setLibraryRosterError(null);
  }, []);

  const handleLibrarySavePlayer = useCallback(() => {
    const trimmedName = libraryPlayerForm.name.trim();
    if (!trimmedName) {
      setLibraryRosterError('Player name is required.');
      return;
    }

    const jerseyInput = libraryPlayerForm.jerseyNumber.trim();
    let jerseyNumber: number | undefined;
    if (jerseyInput) {
      const parsed = Number(jerseyInput);
      if (!Number.isInteger(parsed)) {
        setLibraryRosterError('Jersey number must be a whole number.');
        return;
      }
      if (parsed < 0 || parsed > 999) {
        setLibraryRosterError('Jersey number must be between 0 and 999.');
        return;
      }
      jerseyNumber = parsed;
    }

    const positionTokens = libraryPlayerForm.position
      .split(/[,/]/)
      .map((part) => part.trim())
      .filter(Boolean);

    const gradeLabel = libraryPlayerForm.grade.trim();
    const height = libraryPlayerForm.height.trim();
    const weight = libraryPlayerForm.weight.trim();

    const existingPlayer = libraryEditingPlayerId
      ? libraryRoster.find((player) => player.id === libraryEditingPlayerId)
      : undefined;

    if (existingPlayer && isPlaceholderPlayer(existingPlayer)) {
      setLibraryRosterError('The TEAM placeholder cannot be edited.');
      return;
    }

    const stats = existingPlayer?.stats ?? {};
    const nextPlayer: Player = {
      ...(existingPlayer ?? { id: uuidv4(), stats }),
      stats,
      name: trimmedName,
      preferredName: trimmedName,
    };

    nextPlayer.jerseyNumber = jerseyNumber;
    if (positionTokens.length) {
      nextPlayer.position = positionTokens[0];
      nextPlayer.positions = positionTokens;
    } else {
      nextPlayer.position = undefined;
      nextPlayer.positions = undefined;
    }
    nextPlayer.height = height || undefined;
    nextPlayer.weight = weight || undefined;

    const metadata = { ...(nextPlayer.metadata ?? {}) };
    if (gradeLabel) {
      metadata.grade = gradeLabel;
    } else {
      delete metadata.grade;
    }
    nextPlayer.metadata = Object.keys(metadata).length ? metadata : undefined;

    let updatedRoster: Player[];
    if (existingPlayer) {
      updatedRoster = libraryRoster.map((player) =>
        player.id === existingPlayer.id ? nextPlayer : player
      );
    } else {
      const withoutPlaceholder = libraryRoster.filter((player) => !isPlaceholderPlayer(player));
      updatedRoster = [...withoutPlaceholder, nextPlayer];
    }

    persistLibraryRoster(
      updatedRoster,
      existingPlayer ? 'Player updated.' : 'Player added.'
    );
    setLibraryPlayerForm(defaultOpponentPlayerForm());
    setLibraryPlayerFormOpen(false);
    setLibraryEditingPlayerId(null);
  }, [
    libraryEditingPlayerId,
    libraryPlayerForm,
    libraryRoster,
    persistLibraryRoster,
  ]);

  const handleLibraryEditPlayer = useCallback((player: Player) => {
    if (isPlaceholderPlayer(player)) {
      return;
    }
    setLibraryPlayerForm({
      id: player.id,
      name: player.preferredName ?? player.name ?? '',
      jerseyNumber:
        typeof player.jerseyNumber === 'number' ? String(player.jerseyNumber) : '',
      position: player.positions?.join(', ') ?? player.position ?? '',
      grade: typeof player.metadata?.grade === 'string' ? String(player.metadata.grade) : '',
      height: player.height ?? '',
      weight: player.weight ?? '',
    });
    setLibraryEditingPlayerId(player.id ?? null);
    setLibraryPlayerFormOpen(true);
    setLibraryRosterError(null);
    setLibraryRosterFeedback(null);
  }, []);

  const handleLibraryDeletePlayer = useCallback(
    (playerId: string) => {
      const target = libraryRoster.find((player) => player.id === playerId);
      if (!target || isPlaceholderPlayer(target)) {
        return;
      }

      const updatedRoster = libraryRoster.filter((player) => player.id !== playerId);
      persistLibraryRoster(updatedRoster, 'Player removed.');

      if (libraryEditingPlayerId === playerId) {
        setLibraryPlayerForm(defaultOpponentPlayerForm());
        setLibraryPlayerFormOpen(false);
        setLibraryEditingPlayerId(null);
      }
    },
    [libraryEditingPlayerId, libraryRoster, persistLibraryRoster]
  );

  const handleLibraryImportRoster = useCallback(() => {
    const raw = libraryImportText.trim();
    if (!raw) {
      setLibraryImportMessage({
        tone: 'error',
        text: 'Paste the roster text from MaxPreps before importing.',
      });
      return;
    }
    setLibraryImportMessage(null);
    try {
      const { players: parsedPlayers, issues } = parseMaxPrepsOpponentRoster(raw);
      if (!parsedPlayers.length) {
        const errorLines = [
          'No players were imported from the pasted roster.',
          ...(issues.length
            ? issues.slice(0, 5).map((issue) => `- ${issue}`)
            : ['Make sure you include the header row and at least one player.']),
        ];
        if (issues.length > 5) {
          errorLines.push(`- and ${issues.length - 5} more issues.`);
        }
        setLibraryImportMessage({ tone: 'error', text: errorLines.join('\n') });
        return;
      }
      persistLibraryRoster(parsedPlayers, `${parsedPlayers.length} players imported.`);
      setLibraryImportText('');
      setLibraryImportOpen(false);
      if (issues.length) {
        const summary = [
          `${issues.length} entries were skipped or adjusted:`,
          ...issues.slice(0, 5).map((issue) => `- ${issue}`),
        ];
        if (issues.length > 5) summary.push(`...and ${issues.length - 5} more issues.`);
        setLibraryImportMessage({ tone: 'info', text: summary.join('\n') });
      } else {
        setLibraryImportMessage({
          tone: 'success',
          text: 'Roster imported successfully from MaxPreps.',
        });
      }
    } catch (error) {
      console.error('Failed to import opponent library roster', error);
      setLibraryImportMessage({
        tone: 'error',
        text: 'Unable to import roster. Please try again.',
      });
    }
  }, [libraryImportText, parseMaxPrepsOpponentRoster, persistLibraryRoster]);

  const handleCreateSeason = async () => {
    if (!teamId) return;
    const yearValue = Number(seasonForm.year.trim());
    if (!seasonForm.year.trim() || Number.isNaN(yearValue)) {
      setSeasonFeedback('Enter a valid season year.');
      return;
    }

    setSeasonSaving(true);
    setSeasonFeedback(null);
    try {
      const startDateValue = seasonForm.startDate
        ? new Date(seasonForm.startDate)
        : new Date(yearValue, 7, 1);

      const payload: Season = {
        id: uuidv4(),
        teamId,
        year: yearValue,
        label: seasonForm.label.trim() || `${yearValue}-${yearValue + 1}`,
        level: seasonForm.level,
        startDate: Timestamp.fromDate(startDateValue),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        coaches: [],
      };
      await upsertSeason(teamId, payload);
      await refreshSeasons();
      setActiveSeasonId(payload.id);
      setSeasonFeedback('Season created.');
      setSeasonFormOpen(false);
      resetSeasonForm();
    } catch (error) {
      console.error('Failed to create season', error);
      setSeasonFeedback('Unable to save season. Try again.');
    } finally {
      setSeasonSaving(false);
    }
  };

  const handleGameSelect = (gameId: string) => {
    setSelectedGameId((prev) => (prev === gameId ? null : gameId));
  };

  const prepareGamePayload = (base?: Partial<Game>): Game => {
    const dateTimestamp = combineDateTimeToTimestamp(gameForm.date, gameForm.time);
    const now = Timestamp.now();
    const normalizedRoster = normalizeOpponentRoster(
      base?.opponentSnapshot?.roster ?? opponentRoster
    );
    const nextOpponentTeamId =
      gameForm.opponentTeamId && gameForm.opponentTeamId.trim().length > 0
        ? gameForm.opponentTeamId
        : base?.opponentTeamId;
    const opponentSnapshot = {
      ...(base?.opponentSnapshot ?? {}),
      roster: normalizedRoster,
      seasonId: base?.opponentSnapshot?.seasonId ?? activeSeasonId,
      teamId: nextOpponentTeamId ?? base?.opponentSnapshot?.teamId,
    };
    return {
      id: base?.id ?? uuidv4(),
      seasonId: activeSeasonId,
      myTeamId: teamId ?? undefined,
      opponent: gameForm.opponent.trim(),
      opponentName: gameForm.opponent.trim(),
      opponentTeamId: nextOpponentTeamId ?? undefined,
      date: dateTimestamp,
      kickoffTime: gameForm.time,
      location: gameForm.location.trim() || undefined,
      site: gameForm.site,
      notes: gameForm.notes.trim() || undefined,
      status: base?.status ?? 'scheduled',
      plays: base?.plays ?? [],
      homeScore: base?.homeScore ?? 0,
      oppScore: base?.oppScore ?? 0,
      rules: base?.rules ?? defaultRules,
      myTeamSnapshot: base?.myTeamSnapshot,
      opponentSnapshot,
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
      tags: base?.tags ?? [],
    };
  };

  const handleSaveGame = async () => {
    if (!teamId || !activeSeasonId) return;
    if (!gameForm.opponent.trim()) {
      setGameFeedback('Opponent name is required.');
      return;
    }
    if (!gameForm.date.trim()) {
      setGameFeedback('Choose a game date.');
      return;
    }

    setGameSaving(true);
    setGameFeedback(null);
    try {
      const existing = selectedGameId ? games.find((game) => game.id === selectedGameId) : undefined;
      const payload = prepareGamePayload(existing ?? {});
      await upsertSeasonGame(teamId, activeSeasonId, payload);
      setGameFeedback(existing ? 'Game updated.' : 'Game added.');
      if (!existing) {
        resetGameForm();
      }
    } catch (error) {
      console.error('Failed to save game', error);
      setGameFeedback('Unable to save game. Try again.');
    } finally {
      setGameSaving(false);
    }
  };

  const gamesTableData = useMemo(() => sortGames(games), [games]);

  const gameRowProps = useCallback(
    (row: Game) => {
      const baseBg =
        row.site === 'home'
          ? 'green.50'
          : row.site === 'away'
          ? 'orange.50'
          : 'gray.50';
      const hoverBg =
        row.site === 'home'
          ? 'green.100'
          : row.site === 'away'
          ? 'orange.100'
          : 'gray.100';
      return {
        bg: baseBg,
        _hover: { bg: hoverBg },
        transition: 'background-color 0.2s ease',
      };
    },
    []
  );

  const gameColumns: DataTableColumn<Game>[] = [
    {
      header: 'Opponent',
      accessor: (row) => (
        <Stack gap={0}>
          <Text fontWeight="600">{row.opponentName ?? row.opponent ?? 'Opponent TBD'}</Text>
          <Text fontSize="xs" color="text.secondary">
            {formatGameDate(row.date)}
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Site',
      accessor: (row) => (
        <Badge colorScheme={row.site === 'home' ? 'green' : row.site === 'away' ? 'orange' : 'gray'}>
          {gameSiteLabel[(row.site as GameFormState['site']) ?? 'home']}
        </Badge>
      ),
      width: '120px',
    },
    {
      header: 'Kickoff',
      accessor: (row) => (
        <Text fontSize="sm" color="text.secondary">
          {formatGameTime(row.kickoffTime, row.date)}
        </Text>
      ),
      width: '120px',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <HStack gap={2}>
          <Button size="xs" variant="ghost" onClick={() => handleGameSelect(row.id)}>
            {selectedGameId === row.id ? 'Close' : 'Edit'}
          </Button>
          <Button size="xs" onClick={() => navigate(`/scoring/${row.id}`)}>
            Score Game
          </Button>
        </HStack>
      ),
      width: '200px',
    },
  ];

  const opponentLibraryColumns: DataTableColumn<OpponentTeam>[] = [
    {
      header: 'Opponent',
      accessor: (row) => (
        <HStack gap={3} align="center">
          {row.colors?.logoUrl ? (
            <Image
              src={row.colors.logoUrl}
              alt={`${row.name} logo`}
              boxSize="32px"
              objectFit="contain"
              borderRadius="md"
              border="1px solid"
              borderColor="border.subtle"
              bg="white"
              p={1}
            />
          ) : (
            <Box
              boxSize="32px"
              borderRadius="md"
              border="1px dashed"
              borderColor="border.subtle"
              bg="brand.surface"
            />
          )}
          <Stack gap={0}>
            <HStack gap={2} align="center">
              <Text fontWeight="600">{row.name}</Text>
              {selectedOpponent?.id === row.id && (
                <Badge colorScheme="purple" borderRadius="md">
                  Selected
                </Badge>
              )}
            </HStack>
            {row.mascot && (
              <Text fontSize="xs" color="text.secondary">
                {row.mascot}
              </Text>
            )}
            {row.shortName && row.shortName !== row.name && (
              <Text fontSize="xs" color="text.secondary">
                {row.shortName}
              </Text>
            )}
          </Stack>
        </HStack>
      ),
    },
    {
      header: 'Colors',
      accessor: (row) => (
        <HStack gap={1}>
          {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map((key) => {
            const value = row.colors?.[key];
            if (!value) return null;
            return (
              <Box
                key={key}
                w="16px"
                h="16px"
                borderRadius="sm"
                border="1px solid"
                borderColor="border.subtle"
                bg={value}
                title={`${key.replace('Color', '')}: ${value}`}
              />
            );
          })}
        </HStack>
      ),
      width: '140px',
    },
    {
      header: 'Location',
      accessor: (row) => (
        <Text fontSize="sm" color="text.secondary">
          {row.location || '—'}
        </Text>
      ),
      width: '180px',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <HStack gap={2}>
          <Button size="xs" onClick={() => handleUseOpponentForGame(row)}>
            Use
          </Button>
          <Button size="xs" variant="ghost" onClick={() => handleEditOpponent(row)}>
            Edit
          </Button>
          <Button
            size="xs"
            variant="ghost"
            colorScheme="red"
            onClick={() => handleDeleteOpponentEntry(row.id)}
            disabled={opponentSaving}
          >
            Delete
          </Button>
        </HStack>
      ),
      width: '220px',
    },
  ];


  const libraryOpponentColumns: DataTableColumn<Player>[] = [
    {
      header: '#',
      accessor: (row) => (
        <Text fontWeight="600" textAlign="center">
          {typeof row.jerseyNumber === 'number' ? `#${row.jerseyNumber}` : '--'}
        </Text>
      ),
      align: 'center',
      width: '70px',
    },
    {
      header: 'Player',
      accessor: (row) => (
        <Stack gap={0}>
          <Text fontWeight="600">{row.preferredName ?? row.name}</Text>
          <Text fontSize="xs" color="text.secondary">
            {isPlaceholderPlayer(row) ? 'Roster placeholder' : formatGradeLabel(row)}
          </Text>
        </Stack>
      ),
    },
    {
      header: 'Position',
      accessor: (row) => (
        <Text fontSize="sm" color="text.secondary">
          {row.positions?.join(', ') ?? row.position ?? '—'}
        </Text>
      ),
      width: '160px',
    },
    {
      header: 'Ht / Wt',
      accessor: (row) => (
        <Text fontSize="sm" color="text.secondary">
          {row.height || row.weight ? [row.height, row.weight].filter(Boolean).join(' / ') : '—'}
        </Text>
      ),
      width: '160px',
    },
    {
      header: 'Actions',
      accessor: (row) =>
        isPlaceholderPlayer(row) ? (
          <Text fontSize="xs" color="text.secondary">
            Locked
          </Text>
        ) : (
          <HStack gap={2}>
            <Button size="xs" variant="ghost" onClick={() => handleLibraryEditPlayer(row)}>
              Edit
            </Button>
            <Button
              size="xs"
              variant="ghost"
              colorScheme="red"
              onClick={() => handleLibraryDeletePlayer(row.id)}
            >
              Remove
            </Button>
          </HStack>
        ),
      width: '180px',
    },
  ];

  const renderSeasonSelector = () => {
    if (seasonsLoading) {
      return (
        <HStack gap={3}>
          <Spinner size="sm" color="brand.primary" />
          <Text fontSize="sm" color="text.secondary">
            Loading seasons...
          </Text>
        </HStack>
      );
    }

    if (!seasons.length) {
      return (
        <Stack gap={3}>
          <Text color="text.secondary" fontSize="sm">
            No seasons yet. Create your first season to start building the schedule.
          </Text>
          <Button size="sm" onClick={() => setSeasonFormOpen(true)}>
            Add Season
          </Button>
        </Stack>
      );
    }

    return (
      <HStack gap={3} wrap="wrap">
        <Stack gap={1} maxW="220px">
          <Text fontSize="sm" color="text.secondary" fontWeight="600">
            Season
          </Text>
          <chakra.select
            value={activeSeasonId ?? ''}
            onChange={(event) => setActiveSeasonId(event.target.value || undefined)}
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="md"
            px={3}
            py={2}
            bg="bg.surface"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {getSeasonDisplayName(season)}
              </option>
            ))}
          </chakra.select>
        </Stack>
        <Button size="sm" variant="outline" onClick={() => setSeasonFormOpen(true)}>
          Add Season
        </Button>
      </HStack>
    );
  };

  if (teamLoading && !team) {
    return (
      <Center minH="60vh">
        <Spinner color="brand.primary" />
      </Center>
    );
  }

  if (!team && teamError) {
    return (
      <Center minH="60vh">
        <Stack align="center" gap={3}>
          <Text fontWeight="600">Program setup required</Text>
          <Text color="text.secondary">{teamError}</Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack gap={6}>
      <PageHeader
        title="Season Schedule"
        subtitle="Plan regular season, playoff games, and opponent details."
        actions={
          <HStack gap={2}>
            <Button size="sm" variant="outline" onClick={() => resetGameForm()}>
              New Game
            </Button>
            <Button size="sm" onClick={() => navigate('/team')}>
              Manage Team
            </Button>
          </HStack>
        }
        meta={
          <Stack gap={2}>
            {renderSeasonSelector()}
            {seasonsError && (
              <Text fontSize="xs" color="red.500">
                {seasonsError}
              </Text>
            )}
            {seasonFeedback && (
              <Text fontSize="xs" color="brand.primary">
                {seasonFeedback}
              </Text>
            )}
          </Stack>
        }
      />

      {seasonFormOpen && (
      <SectionCard title="Create Season" description="Set up the season basics before adding games.">
        <Stack gap={4}>
          <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
            <Stack gap={1} flex="1">
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Season Year
              </Text>
              <Input
                type="number"
                value={seasonForm.year}
                onChange={(event) => handleSeasonFormChange('year', event.target.value)}
              />
            </Stack>
            <Stack gap={1} flex="1">
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Display Label
              </Text>
              <Input
                value={seasonForm.label}
                onChange={(event) => handleSeasonFormChange('label', event.target.value)}
              />
            </Stack>
            <Stack gap={1} flex="1">
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Level
              </Text>
              <chakra.select
                value={seasonForm.level}
                onChange={(event) =>
                  handleSeasonFormChange('level', event.target.value as TeamLevel)
                }
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                px={3}
                py={2}
                bg="bg.surface"
              >
                {levelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </chakra.select>
            </Stack>
          </Stack>
          <Stack gap={1} maxW={{ base: '100%', md: '250px' }}>
            <Text fontSize="sm" color="text.secondary" fontWeight="600">
              Season Start
            </Text>
            <Input
              type="date"
              value={seasonForm.startDate}
              onChange={(event) => handleSeasonFormChange('startDate', event.target.value)}
            />
          </Stack>
          <HStack justify="flex-end" gap={2}>
              <Button
                variant="ghost"
                onClick={() => {
                  setSeasonFormOpen(false);
                  resetSeasonForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateSeason} disabled={seasonSaving} bg="brand.primary" color="white">
                {seasonSaving ? 'Saving...' : 'Save Season'}
              </Button>
            </HStack>
          </Stack>
        </SectionCard>
      )}

      <SectionCard
        title="Season Games"
        description="Every matchup across the regular season and playoffs lives here."
        actions={
          <Button size="sm" onClick={() => resetGameForm()}>
            Add Game
          </Button>
        }
      >
        <Stack gap={4}>
          {gamesLoading ? (
            <HStack gap={3}>
              <Spinner size="sm" color="brand.primary" />
              <Text fontSize="sm" color="text.secondary">
                Loading schedule...
              </Text>
            </HStack>
          ) : gamesError ? (
            <Text fontSize="sm" color="red.500">
              {gamesError}
            </Text>
          ) : (
            <DataTable
              data={gamesTableData}
              columns={gameColumns}
              keyExtractor={(row) => row.id}
              isStriped={false}
              rowProps={gameRowProps}
              emptyState={
                <Stack gap={3} align="center">
                  <Text fontWeight="600">No games yet</Text>
                  <Text color="text.secondary" fontSize="sm" textAlign="center">
                    Add opponents to build your season schedule.
                  </Text>
                  <Button size="sm" bg="brand.primary" color="white" onClick={() => resetGameForm()}>
                    Create Game
                  </Button>
                </Stack>
              }
            />
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title={selectedGameId ? 'Edit Game' : 'New Game'}
        description="Opponent details, kickoff, and notes."
        actions={
          selectedGameId ? (
            <Badge colorScheme="purple" borderRadius="full" px={3} py={1}>
              Editing {selectedGameId}
            </Badge>
          ) : undefined
        }
      >
        <Stack gap={4}>
          <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
            <Stack gap={2} flex="1">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color="text.secondary" fontWeight="600">
                  Opponent
                </Text>
                {selectedOpponent && (
                  <Badge colorScheme="purple" borderRadius="md">
                    Library
                  </Badge>
                )}
              </HStack>
              <chakra.select
                value={gameForm.opponentTeamId}
                onChange={(event) => handleSelectOpponent(event.target.value)}
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                px={3}
                py={2}
                bg="bg.surface"
                disabled={opponentsLoading && !sortedOpponents.length}
              >
                <option value="">
                  {opponentsLoading ? 'Loading opponents...' : 'Choose saved opponent'}
                </option>
                {sortedOpponents.map((opponent) => (
                  <option key={opponent.id} value={opponent.id}>
                    {opponent.name}
                  </option>
                ))}
              </chakra.select>
              <Input
                placeholder="Opponent name"
                value={gameForm.opponent}
                onChange={(event) => handleGameFormChange('opponent', event.target.value)}
              />
              <HStack
                justify="space-between"
                align={{ base: 'flex-start', md: 'center' }}
                gap={2}
                flexWrap="wrap"
              >
                <HStack gap={3} align="center">
                  {selectedOpponent ? (
                    <>
                      {selectedOpponent.colors?.logoUrl && (
                        <Image
                          src={selectedOpponent.colors.logoUrl}
                          alt={`${selectedOpponent.name} logo`}
                          boxSize="36px"
                          objectFit="contain"
                          borderRadius="md"
                          border="1px solid"
                          borderColor="border.subtle"
                          bg="white"
                          p={1}
                        />
                      )}
                      <Stack gap={0}>
                        {selectedOpponent.location && (
                          <Text fontSize="xs" color="text.secondary">
                            {selectedOpponent.location}
                          </Text>
                        )}
                        <HStack gap={1}>
                          {(['primaryColor', 'secondaryColor', 'accentColor'] as const).map(
                            (key) => {
                              const value = selectedOpponent.colors?.[key];
                              if (!value) return null;
                              return (
                                <Box
                                  key={key}
                                  w="14px"
                                  h="14px"
                                  borderRadius="sm"
                                  border="1px solid"
                                  borderColor="border.subtle"
                                  bg={value}
                                  title={`${key.replace('Color', '')}: ${value}`}
                                />
                              );
                            }
                          )}
                        </HStack>
                      </Stack>
                    </>
                  ) : (
                    <Text fontSize="xs" color="text.secondary">
                      Select a saved opponent or enter a custom name.
                    </Text>
                  )}
                </HStack>
                <HStack gap={2}>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleClearOpponentSelection}
                    disabled={!gameForm.opponentTeamId}
                  >
                    Clear
                  </Button>
                  <Button size="xs" variant="ghost" onClick={openCreateOpponent}>
                    New Opponent
                  </Button>
                </HStack>
              </HStack>
            </Stack>
            <Stack gap={1} maxW={{ base: '100%', md: '200px' }}>
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Date
              </Text>
              <Input
                type="date"
                value={gameForm.date}
                onChange={(event) => handleGameFormChange('date', event.target.value)}
              />
            </Stack>
            <Stack gap={1} maxW={{ base: '100%', md: '160px' }}>
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Kickoff
              </Text>
              <Input
                type="time"
                value={gameForm.time}
                onChange={(event) => handleGameFormChange('time', event.target.value)}
              />
            </Stack>
            <Stack gap={1} maxW={{ base: '100%', md: '180px' }}>
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Site
              </Text>
              <chakra.select
                value={gameForm.site}
                onChange={(event) =>
                  handleGameFormChange('site', event.target.value as GameFormState['site'])
                }
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                px={3}
                py={2}
                bg="bg.surface"
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
                <option value="neutral">Neutral</option>
              </chakra.select>
            </Stack>
          </Stack>

          <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
            <Stack gap={1} flex="1">
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Location
              </Text>
              <Input
                placeholder="Stadium or address"
                value={gameForm.location}
                onChange={(event) => handleGameFormChange('location', event.target.value)}
              />
            </Stack>
            <Stack gap={1} flex="1">
              <Text fontSize="sm" color="text.secondary" fontWeight="600">
                Internal Notes
              </Text>
              <chakra.textarea
                value={gameForm.notes}
                onChange={(event) => handleGameFormChange('notes', event.target.value)}
                minH="96px"
              />
            </Stack>
          </Stack>

          {gameFeedback && (
            <Text fontSize="xs" color={gameFeedback.includes('Unable') ? 'red.500' : 'brand.primary'}>
              {gameFeedback}
            </Text>
          )}

          <HStack justify="flex-end" gap={2}>
            <Button variant="ghost" onClick={resetGameForm}>
              Reset
            </Button>
            <Button bg="brand.primary" color="white" onClick={handleSaveGame} disabled={gameSaving}>
              {gameSaving ? 'Saving...' : 'Save Game'}
            </Button>
          </HStack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Opponent Library"
        description="Store opponent branding once and reuse it across schedules, rosters, and reports."
        actions={
          <HStack gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={refreshOpponents}
              disabled={opponentsLoading}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              bg="brand.primary"
              color="white"
              onClick={() => {
                if (opponentFormOpen) {
                  resetOpponentFormState();
                  setOpponentFormOpen(false);
                } else {
                  openCreateOpponent();
                }
              }}
              disabled={opponentSaving}
            >
              {opponentFormOpen ? 'Close Form' : 'Add Opponent'}
            </Button>
          </HStack>
        }
      >
        <Stack gap={4}>
          {opponentError && (
            <Box
              border="1px solid"
              borderColor="red.400"
              borderRadius="md"
              px={4}
              py={3}
              bg="brand.surface"
            >
              <Text fontSize="sm" color="red.500">
                {opponentError}
              </Text>
            </Box>
          )}
          {opponentsError && (
            <Text fontSize="xs" color="red.500">
              {opponentsError}
            </Text>
          )}
          {opponentFeedback && (
            <Text fontSize="xs" color="brand.primary">
              {opponentFeedback}
            </Text>
          )}
          {opponentsLoading && !sortedOpponents.length ? (
            <HStack gap={3}>
              <Spinner size="sm" color="brand.primary" />
              <Text fontSize="sm" color="text.secondary">
                Loading opponents...
              </Text>
            </HStack>
          ) : (
            <DataTable
              data={sortedOpponents}
              columns={opponentLibraryColumns}
              keyExtractor={(row) => row.id}
              emptyState={
                <Stack gap={3} align="center">
                  <Text fontWeight="600">No opponents yet</Text>
                  <Text fontSize="sm" color="text.secondary" textAlign="center">
                    Save opponent colors and logos here to apply them to games and reports.
                  </Text>
                  <Button size="sm" bg="brand.primary" color="white" onClick={openCreateOpponent}>
                    Add Opponent
                  </Button>
                </Stack>
              }
            />
          )}

          {opponentFormOpen && (
            <Stack
              gap={4}
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="md"
              bg="brand.surface"
              px={4}
              py={4}
            >
              <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
                <Stack gap={2} flex="1">
                  <Text fontSize="sm" color="text.secondary" fontWeight="600">
                    Program Details
                  </Text>
                  <Input
                    value={opponentForm.name}
                    onChange={(event) => handleOpponentFormChange('name', event.target.value)}
                    placeholder="Opponent name"
                  />
                  <HStack gap={2} flexWrap="wrap">
                    <Stack gap={1} flex="1">
                      <Text fontSize="xs" color="text.secondary">
                        Mascot / Nickname
                      </Text>
                      <Input
                        value={opponentForm.mascot}
                        onChange={(event) => handleOpponentFormChange('mascot', event.target.value)}
                        placeholder="e.g. Colts"
                      />
                    </Stack>
                    <Stack gap={1} flex="1">
                      <Text fontSize="xs" color="text.secondary">
                        Short Name
                      </Text>
                      <Input
                        value={opponentForm.shortName}
                        onChange={(event) =>
                          handleOpponentFormChange('shortName', event.target.value)
                        }
                        placeholder="e.g. Northern Cambria"
                      />
                    </Stack>
                  </HStack>
                  <Stack gap={1}>
                    <Text fontSize="xs" color="text.secondary">
                      Location
                    </Text>
                    <Input
                      value={opponentForm.location}
                      onChange={(event) => handleOpponentFormChange('location', event.target.value)}
                      placeholder="City, State"
                    />
                  </Stack>
                </Stack>
                <Stack gap={2} flex="1">
                  <Text fontSize="sm" color="text.secondary" fontWeight="600">
                    Logo
                  </Text>
                  <Box
                    border="1px dashed"
                    borderColor="border.subtle"
                    borderRadius="md"
                    bg="bg.surface"
                    minH="110px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    overflow="hidden"
                  >
                    {opponentForm.logoDataUrl ? (
                      <Image
                        src={opponentForm.logoDataUrl}
                        alt={`${opponentForm.name || 'Opponent'} logo preview`}
                        maxH="96px"
                        objectFit="contain"
                      />
                    ) : (
                      <Text fontSize="xs" color="text.secondary">
                        Upload a transparent PNG or JPG (max 2MB).
                      </Text>
                    )}
                  </Box>
                  <HStack gap={2}>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => opponentLogoInputRef.current?.click()}
                      disabled={opponentSaving}
                    >
                      Upload Logo
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      color="red.500"
                      onClick={handleOpponentLogoRemove}
                      disabled={opponentSaving || !opponentForm.logoDataUrl}
                    >
                      Remove Logo
                    </Button>
                  </HStack>
                  <chakra.input
                    ref={opponentLogoInputRef}
                    type="file"
                    display="none"
                    accept="image/*"
                    onChange={handleOpponentLogoSelect}
                  />
                </Stack>
              </Stack>

              <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                {[
                  { label: 'Primary', field: 'primaryColor' as const },
                  { label: 'Secondary', field: 'secondaryColor' as const },
                  { label: 'Accent', field: 'accentColor' as const },
                ].map((entry) => (
                  <Stack key={entry.field} gap={1} align="center">
                    <Text fontSize="xs" color="text.secondary">
                      {entry.label}
                    </Text>
                    <chakra.input
                      type="color"
                      value={opponentForm[entry.field]}
                      onChange={(event) =>
                        handleOpponentFormChange(entry.field, event.target.value)
                      }
                      border="none"
                      h="48px"
                      w="100%"
                      borderRadius="md"
                      cursor="pointer"
                    />
                  </Stack>
                ))}
              </SimpleGrid>

              <Stack gap={3}>
                <HStack
                  justify="space-between"
                  align={{ base: 'flex-start', md: 'center' }}
                  gap={2}
                  flexWrap="wrap"
                >
                  <Stack gap={0}>
                    <Text fontSize="sm" fontWeight="600">
                      Stored Opponent Roster
                    </Text>
                    <Text fontSize="xs" color="text.secondary">
                      Attach once and reuse for every matchup.
                    </Text>
                  </Stack>
                  <HStack gap={2}>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => {
                        setLibraryImportOpen((prev) => !prev);
                        setLibraryImportMessage(null);
                      }}
                    >
                      {libraryImportOpen ? 'Hide Importer' : 'Paste MaxPreps Roster'}
                    </Button>
                    <Button
                      size="xs"
                      bg="brand.primary"
                      color="white"
                      onClick={openLibraryPlayerForm}
                    >
                      Add Player
                    </Button>
                  </HStack>
                </HStack>

                {libraryImportOpen && (
                  <Stack
                    gap={3}
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="md"
                    bg="brand.surface"
                    px={4}
                    py={4}
                  >
                    <Stack gap={1}>
                      <Text fontWeight="600">Paste roster from MaxPreps.com</Text>
                      <Text fontSize="sm" color="text.secondary">
                        Copy the roster table (Ctrl+C) starting with the header row and paste it here.
                      </Text>
                    </Stack>
                    <chakra.textarea
                      value={libraryImportText}
                      onChange={(event) => {
                        setLibraryImportText(event.target.value);
                        setLibraryImportMessage(null);
                      }}
                      minH="160px"
                      border="1px solid"
                      borderColor="border.subtle"
                      borderRadius="md"
                      px={3}
                      py={2}
                      fontFamily="mono"
                      fontSize="sm"
                      placeholder="Paste opponent roster text here..."
                    />
                    {libraryImportMessage && (
                      <Text
                        fontSize="xs"
                        color={
                          libraryImportMessage.tone === 'error'
                            ? 'red.500'
                            : libraryImportMessage.tone === 'success'
                            ? 'brand.primary'
                            : 'text.secondary'
                        }
                        whiteSpace="pre-wrap"
                      >
                        {libraryImportMessage.text}
                      </Text>
                    )}
                    <HStack justify="flex-end" gap={2}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setLibraryImportOpen(false);
                          setLibraryImportText('');
                          setLibraryImportMessage(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" bg="brand.primary" color="white" onClick={handleLibraryImportRoster}>
                        Import Roster
                      </Button>
                    </HStack>
                  </Stack>
                )}

                {libraryRosterError && (
                  <Box
                    border="1px solid"
                    borderColor="red.400"
                    borderRadius="md"
                    px={4}
                    py={3}
                    bg="brand.surface"
                  >
                    <Text fontSize="sm" color="red.500">
                      {libraryRosterError}
                    </Text>
                  </Box>
                )}
                {libraryRosterFeedback && (
                  <Text fontSize="xs" color="brand.primary">
                    {libraryRosterFeedback}
                  </Text>
                )}

                <DataTable
                  data={libraryRoster}
                  columns={libraryOpponentColumns}
                  keyExtractor={(player) => player.id ?? `${player.name}-${player.jerseyNumber}`}
                  emptyState={
                    <Stack gap={3} align="center">
                      <Text fontWeight="600">No stored roster yet</Text>
                      <Text fontSize="sm" color="text.secondary" textAlign="center">
                        Keep an updated list here to prefill future games automatically.
                      </Text>
                    </Stack>
                  }
                />

                {libraryPlayerFormOpen && (
                  <Stack
                    gap={4}
                    border="1px solid"
                    borderColor="border.subtle"
                    borderRadius="md"
                    bg="brand.surface"
                    px={4}
                    py={4}
                  >
                    <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
                      <Stack gap={1} flex="1">
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Player name
                        </Text>
                        <Input
                          placeholder="Player name"
                          value={libraryPlayerForm.name}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('name', event.target.value)
                          }
                        />
                      </Stack>
                      <Stack gap={1} maxW={{ base: '100%', md: '140px' }}>
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Jersey #
                        </Text>
                        <Input
                          type="number"
                          value={libraryPlayerForm.jerseyNumber}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('jerseyNumber', event.target.value)
                          }
                        />
                      </Stack>
                      <Stack gap={1} flex="1">
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Positions
                        </Text>
                        <Input
                          placeholder="RB, OLB"
                          value={libraryPlayerForm.position}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('position', event.target.value)
                          }
                        />
                      </Stack>
                    </Stack>

                    <Stack direction={{ base: 'column', md: 'row' }} gap={4}>
                      <Stack gap={1} maxW={{ base: '100%', md: '160px' }}>
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Grade / Class
                        </Text>
                        <Input
                          placeholder="Sr. or 2026"
                          value={libraryPlayerForm.grade}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('grade', event.target.value)
                          }
                        />
                      </Stack>
                      <Stack gap={1} maxW={{ base: '100%', md: '160px' }}>
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Height
                        </Text>
                        <Input
                          placeholder="6'2&quot;"
                          value={libraryPlayerForm.height}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('height', event.target.value)
                          }
                        />
                      </Stack>
                      <Stack gap={1} maxW={{ base: '100%', md: '160px' }}>
                        <Text fontSize="sm" color="text.secondary" fontWeight="600">
                          Weight
                        </Text>
                        <Input
                          placeholder="215 lbs"
                          value={libraryPlayerForm.weight}
                          onChange={(event) =>
                            handleLibraryPlayerFormChange('weight', event.target.value)
                          }
                        />
                      </Stack>
                    </Stack>

                    <HStack justify="flex-end" gap={2}>
                      <Button size="sm" variant="ghost" onClick={handleLibraryCancelPlayer}>
                        Cancel
                      </Button>
                      <Button size="sm" bg="brand.primary" color="white" onClick={handleLibrarySavePlayer}>
                        {libraryEditingPlayerId ? 'Update Player' : 'Add Player'}
                      </Button>
                    </HStack>
                  </Stack>
                )}
              </Stack>

              <Stack gap={1}>
                <Text fontSize="xs" color="text.secondary">
                  Notes
                </Text>
                <chakra.textarea
                  value={opponentForm.notes}
                  onChange={(event) => handleOpponentFormChange('notes', event.target.value)}
                  placeholder="Shared tendencies, contact info, or reminders."
                  minH="80px"
                />
              </Stack>

              <HStack justify="flex-end" gap={2}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    resetOpponentFormState();
                    setOpponentFormOpen(false);
                  }}
                  disabled={opponentSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  bg="brand.primary"
                  color="white"
                  onClick={handleSaveOpponent}
                  disabled={opponentSaving}
                >
                  {opponentSaving
                    ? 'Saving...'
                    : editingOpponentId
                    ? 'Update Opponent'
                    : 'Save Opponent'}
                </Button>
              </HStack>
            </Stack>
          )}
        </Stack>
      </SectionCard>

    </Stack>
  );
};

export default GameList;


