import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Stack,
  SimpleGrid,
  Box,
  Text,
  HStack,
  Button,
  Spinner,
  VStack,
  chakra,
  Image,
} from '@chakra-ui/react';
import { v4 as uuidv4 } from 'uuid';
import {
  getSeasonRoster,
  upsertRosterPlayer,
  deleteRosterPlayer,
  updateSeasonCoaches,
  importRosterBatch,
  updateTeamBranding,
} from '../services/dbService';
import { PageHeader, SectionCard, DataTable, DataTableColumn } from './ui';
import { Player, Coach } from '../models';
import { playerSchema, coachSchema } from '../validation/schemas';
import { useProgram } from '../context/ProgramContext';
import { showSuccessToast, showErrorToast, showInfoToast } from '../utils/toast';
type PlayerFormState = {
  name: string;
  jerseyNumber: string;
  position: string;
  classYear: string;
};
type CoachFormState = {
  name: string;
  role: string;
};
const defaultPlayerForm: PlayerFormState = {
  name: '',
  jerseyNumber: '',
  position: '',
  classYear: '',
};
const defaultCoachForm: CoachFormState = {
  name: '',
  role: '',
};
const playerFormSchema = playerSchema.extend({
  jerseyNumber: playerSchema.shape.jerseyNumber.optional(),
});
const coachFormSchema = coachSchema.extend({
  role: coachSchema.shape.role.optional(),
});
const TEAM_PLAYER_ID = 'team-placeholder-player';
const TEAM_PLAYER_NUMBER = 100;
const TEAM_PLAYER_NAME = 'TEAM';
const NEW_PLAYER_ID = 'new-player-row';
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB limit for logo uploads
const sortRoster = (players: Player[]) =>
  [...players].sort((a, b) => {
    const aSentinel =
      a.id === TEAM_PLAYER_ID ||
      a.jerseyNumber === TEAM_PLAYER_NUMBER ||
      a.name.toUpperCase?.() === TEAM_PLAYER_NAME;
    const bSentinel =
      b.id === TEAM_PLAYER_ID ||
      b.jerseyNumber === TEAM_PLAYER_NUMBER ||
      b.name.toUpperCase?.() === TEAM_PLAYER_NAME;
    if (aSentinel && !bSentinel) return 1;
    if (!aSentinel && bSentinel) return -1;
    const aNumber = typeof a.jerseyNumber === 'number' ? a.jerseyNumber : Infinity;
    const bNumber = typeof b.jerseyNumber === 'number' ? b.jerseyNumber : Infinity;
    if (aNumber !== bNumber) return aNumber - bNumber;
    return (a.preferredName ?? a.name).localeCompare(b.preferredName ?? b.name);
  });
type ParsedRosterResult = {
  players: Player[];
  issues: string[];
};
const formatClassYear = (value?: number) => {
  if (!value) return '--';
  if (value > 2000) return value.toString();
  return `20${value.toString().padStart(2, '0')}`;
};
const TeamManager: React.FC = () => {
  const {
    team,
    teamLoading,
    teamError,
    seasons,
    seasonsLoading,
    activeSeasonId,
    activeSeason,
    setActiveSeasonId,
    refreshTeam,
    refreshSeasons,
  } = useProgram();
  const teamId = team?.id ?? null;
  const [roster, setRoster] = useState<Player[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterFeedback, setRosterFeedback] = useState<string | null>(null);
  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerForm, setPlayerForm] = useState<PlayerFormState>(defaultPlayerForm);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [coachFormOpen, setCoachFormOpen] = useState(false);
  const [coachSaving, setCoachSaving] = useState(false);
  const [coachForm, setCoachForm] = useState<CoachFormState>(defaultCoachForm);
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
  const [coachFeedback, setCoachFeedback] = useState<string | null>(null);
  const [colorForm, setColorForm] = useState({
    primaryColor: '#0B3D91',
    secondaryColor: '#C60C30',
    accentColor: '',
  });
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [brandingFeedback, setBrandingFeedback] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const colorDirty = useMemo(() => {
    const defaultPrimary = team?.defaultColors?.primaryColor ?? '#0B3D91';
    const defaultSecondary = team?.defaultColors?.secondaryColor ?? '#C60C30';
    const defaultAccent = team?.defaultColors?.accentColor ?? '';
    return (
      colorForm.primaryColor !== defaultPrimary ||
      colorForm.secondaryColor !== defaultSecondary ||
      (colorForm.accentColor || '') !== (defaultAccent || '')
    );
  }, [
    team?.defaultColors?.primaryColor,
    team?.defaultColors?.secondaryColor,
    team?.defaultColors?.accentColor,
    colorForm.primaryColor,
    colorForm.secondaryColor,
    colorForm.accentColor,
  ]);
  const hasBrandingChanges = colorDirty || logoDirty;
  const [importerOpen, setImporterOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importingRoster, setImportingRoster] = useState(false);
  const [importerMessage, setImporterMessage] = useState<
    { tone: 'info' | 'error' | 'success'; text: string } | null
  >(null);
  const loadRoster = useCallback(async () => {
    if (!teamId || !activeSeasonId) {
      setRoster([]);
      return;
    }
    setRosterLoading(true);
    setRosterError(null);
    try {
      const players = await getSeasonRoster(teamId, activeSeasonId);
      let finalPlayers = players;
      const hasPlaceholder = players.some(
        (player) =>
          player.id === TEAM_PLAYER_ID ||
          (player.jerseyNumber === TEAM_PLAYER_NUMBER &&
            player.name?.toUpperCase() === TEAM_PLAYER_NAME)
      );
      if (!hasPlaceholder) {
        const placeholder: Player = {
          id: TEAM_PLAYER_ID,
          name: TEAM_PLAYER_NAME,
          preferredName: TEAM_PLAYER_NAME,
          jerseyNumber: TEAM_PLAYER_NUMBER,
          stats: {},
          metadata: { placeholder: true },
        };
        try {
          await upsertRosterPlayer(teamId, activeSeasonId, placeholder);
          finalPlayers = [...players, placeholder];
        } catch (placeholderError) {
          console.error('Failed to ensure TEAM placeholder', placeholderError);
          finalPlayers = [...players];
        }
      }
      setRoster(sortRoster(finalPlayers));
    } catch (error) {
      console.error('Failed to load roster', error);
      setRosterError('Unable to load roster for the selected season.');
    } finally {
      setRosterLoading(false);
    }
  }, [teamId, activeSeasonId]);
  useEffect(() => {
    loadRoster();
  }, [loadRoster]);
  useEffect(() => {
    if (team?.defaultColors) {
      setColorForm({
        primaryColor: team.defaultColors.primaryColor ?? '#0B3D91',
        secondaryColor: team.defaultColors.secondaryColor ?? '#C60C30',
        accentColor: team.defaultColors.accentColor ?? '',
      });
      setLogoPreview(team.defaultColors.logoUrl ?? null);
      setLogoDirty(false);
    }
  }, [team?.defaultColors]);
  const coaches: Coach[] = useMemo(
    () => activeSeason?.coaches ?? [],
    [activeSeason?.coaches]
  );
  const deletableCount = useMemo(
    () =>
      roster.filter(
        (player) => player.id !== TEAM_PLAYER_ID && player.jerseyNumber !== TEAM_PLAYER_NUMBER
      ).length,
    [roster]
  );
  const tableData = useMemo(() => {
    if (editingPlayerId === NEW_PLAYER_ID) {
      return [
        {
          id: NEW_PLAYER_ID,
          name: '',
          preferredName: '',
          stats: {},
        } as Player,
        ...roster,
      ];
    }
    return roster;
  }, [editingPlayerId, roster]);
  const isEditingPlayer = editingPlayerId !== null;
  const resetPlayerForm = useCallback(() => {
    setPlayerForm(defaultPlayerForm);
    setEditingPlayerId(null);
  }, []);
  const openCreatePlayer = useCallback(() => {
    setRosterError(null);
    setRosterFeedback(null);
    setPlayerForm(defaultPlayerForm);
    setEditingPlayerId(NEW_PLAYER_ID);
  }, []);
  const openEditPlayer = useCallback((player: Player) => {
    if (player.id === TEAM_PLAYER_ID || player.jerseyNumber === TEAM_PLAYER_NUMBER) {
      return;
    }
    setRosterError(null);
    setRosterFeedback(null);
    setPlayerForm({
      name: player.preferredName ?? player.name,
      jerseyNumber: player.jerseyNumber !== undefined ? String(player.jerseyNumber) : '',
      position: player.positions?.[0] ?? player.position ?? '',
      classYear: player.classYear ? String(player.classYear) : '',
    });
    setEditingPlayerId(player.id);
  }, []);
  const handlePlayerFormChange = useCallback((field: keyof PlayerFormState, value: string) => {
    setPlayerForm((prev) => ({ ...prev, [field]: value }));
  }, []);
  const handleCancelEdit = useCallback(() => {
    resetPlayerForm();
  }, [resetPlayerForm]);
  const handleSavePlayer = useCallback(async () => {
    if (!teamId || !activeSeasonId) return;
    setRosterError(null);
    const parsed = playerFormSchema.safeParse({
      name: playerForm.name.trim(),
      jerseyNumber: playerForm.jerseyNumber.trim() || undefined,
      position: playerForm.position.trim() || undefined,
      classYear: playerForm.classYear.trim() || undefined,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Please fix player details.';
      setRosterError(message);
      return;
    }
    const { name, jerseyNumber, position, classYear } = parsed.data;
    const duplicateNumber = typeof jerseyNumber === 'number'
      ? roster.some(
          (player) =>
            player.id !== editingPlayerId &&
            player.jerseyNumber === jerseyNumber
        )
      : false;
    if (duplicateNumber) {
      setRosterError(`Jersey number ${jerseyNumber} is already assigned.`);
      return;
    }
    const positions = position
      ? position
          .split(/[,/]/)
          .map((part) => part.trim())
          .filter(Boolean)
      : undefined;
    const existingPlayer =
      editingPlayerId && editingPlayerId !== NEW_PLAYER_ID
        ? roster.find((player) => player.id === editingPlayerId)
        : undefined;
    setPlayerSaving(true);
    try {
      const baseId =
        editingPlayerId && editingPlayerId !== NEW_PLAYER_ID ? editingPlayerId : uuidv4();
      const payload: Player = {
        ...(existingPlayer ?? { id: baseId, stats: {} }),
        id: baseId,
        name,
        preferredName: name,
        jerseyNumber,
        position: positions?.[0],
        positions,
        classYear: classYear ?? undefined,
      };
      await upsertRosterPlayer(teamId, activeSeasonId, payload);
      await loadRoster();
      resetPlayerForm();
      setRosterFeedback('Player saved.');
    } catch (error) {
      console.error('Failed to save player', error);
      setRosterError('Unable to save player. Please try again.');
    } finally {
      setPlayerSaving(false);
    }
  }, [teamId, activeSeasonId, playerForm, editingPlayerId, roster, loadRoster, resetPlayerForm]);
  const handleDeletePlayer = useCallback(async (playerId: string) => {
    if (!teamId || !activeSeasonId) return;
    if (playerId === TEAM_PLAYER_ID) {
      setRosterError('The TEAM placeholder cannot be removed.');
      return;
    }
    const target = roster.find((player) => player.id === playerId);
    if (target?.jerseyNumber === TEAM_PLAYER_NUMBER) {
      setRosterError('The TEAM placeholder cannot be removed.');
      return;
    }
    try {
      await deleteRosterPlayer(teamId, activeSeasonId, playerId);
      await loadRoster();
      if (editingPlayerId === playerId) {
        resetPlayerForm();
      }
    } catch (error) {
      console.error('Failed to delete player', error);
      setRosterError('Unable to delete player. Please try again.');
    }
  }, [teamId, activeSeasonId, roster, loadRoster, editingPlayerId, resetPlayerForm]);
  const handleDeleteAllPlayers = useCallback(async () => {
    if (!teamId || !activeSeasonId) return;
    const deletable = roster.filter(
      (player) => player.id !== TEAM_PLAYER_ID && player.jerseyNumber !== TEAM_PLAYER_NUMBER
    );
    if (deletable.length === 0) {
      setRosterFeedback('No players to remove.');
      return;
    }
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Delete ${deletable.length} ${deletable.length === 1 ? 'player' : 'players'}? The TEAM placeholder will remain.`
      );
      if (!confirmed) {
        return;
      }
    }
    setRosterLoading(true);
    setRosterError(null);
    setRosterFeedback(null);
    try {
      await Promise.all(
        deletable.map((player) => deleteRosterPlayer(teamId, activeSeasonId, player.id))
      );
      await loadRoster();
      setRosterFeedback('Roster cleared. TEAM placeholder remains.');
      resetPlayerForm();
    } catch (error) {
      console.error('Failed to clear roster', error);
      setRosterError('Unable to clear roster. Please try again.');
    } finally {
      setRosterLoading(false);
    }
  }, [teamId, activeSeasonId, roster, loadRoster, resetPlayerForm]);
  const resetCoachForm = useCallback(() => {
    setCoachForm(defaultCoachForm);
    setEditingCoachId(null);
  }, []);
  const openCreateCoach = useCallback(() => {
    resetCoachForm();
    setCoachFeedback(null);
    setCoachFormOpen(true);
  }, [resetCoachForm]);
  const openEditCoach = useCallback((coach: Coach) => {
    setCoachForm({ name: coach.name, role: coach.role });
    setEditingCoachId(coach.id);
    setCoachFeedback(null);
    setCoachFormOpen(true);
  }, []);
  const handleCoachFormChange = (field: keyof CoachFormState, value: string) => {
    setCoachForm((prev) => ({ ...prev, [field]: value }));
  };
  const handleSaveCoach = useCallback(async () => {
    if (!teamId || !activeSeasonId) return;
    setCoachFeedback(null);
    const parsed = coachFormSchema.safeParse({
      name: coachForm.name.trim(),
      role: coachForm.role.trim() || undefined,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Please fix coach details.';
      setCoachFeedback(message);
      return;
    }
    const { name, role } = parsed.data;
    const resolvedRole = role?.trim();
    setCoachSaving(true);
    try {
      const next = [...coaches];
      if (editingCoachId) {
        const index = next.findIndex((coach) => coach.id === editingCoachId);
        if (index >= 0) {
          next[index] = {
            ...next[index],
            name,
            role: resolvedRole || next[index].role || 'assistant',
          };
        }
      } else {
        next.push({
          id: uuidv4(),
          name,
          role: resolvedRole || 'assistant',
        });
      }
      await updateSeasonCoaches(teamId, activeSeasonId, next);
      await refreshSeasons();
      setCoachFormOpen(false);
      resetCoachForm();
      setCoachFeedback('Coach saved successfully.');
    } catch (error) {
      console.error('Failed to save coach', error);
      setCoachFeedback('Unable to save coach. Please try again.');
    } finally {
      setCoachSaving(false);
    }
  }, [teamId, activeSeasonId, coachForm, coaches, editingCoachId, refreshSeasons, resetCoachForm]);
  const handleDeleteCoach = useCallback(async (coachId: string) => {
    if (!teamId || !activeSeasonId) return;
    setCoachSaving(true);
    setCoachFeedback(null);
    try {
      const filtered = coaches.filter((coach) => coach.id !== coachId);
      await updateSeasonCoaches(teamId, activeSeasonId, filtered);
      await refreshSeasons();
      setCoachFeedback('Coach removed.');
    } catch (error) {
      console.error('Failed to delete coach', error);
      setCoachFeedback('Unable to delete coach. Please try again.');
    } finally {
      setCoachSaving(false);
    }
  }, [teamId, activeSeasonId, coaches, refreshSeasons]);
  const parseMaxPrepsRoster = useCallback(
    (raw: string): ParsedRosterResult => {
      if (!raw) {
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
        if (normalized === '-' || normalized === '') return true;
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
        console.warn('[MaxPreps Import] ', message);
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
  const handleImportFromMaxPreps = useCallback(async () => {
    if (!teamId || !activeSeasonId) return;
    const raw = importText.trim();
    if (!raw) {
      setImporterMessage({
        tone: 'error',
        text: 'Paste the roster text from MaxPreps before importing.',
      });
      return;
    }
    setImporterMessage(null);
    setRosterError(null);
    setRosterFeedback(null);
    resetPlayerForm();
    setImportingRoster(true);
    try {
      const { players: parsedPlayers, issues: parserIssues } = parseMaxPrepsRoster(raw);
      const issues = [...parserIssues];
      const existingNumbers = new Set<number>();
      roster.forEach((player) => {
        if (typeof player.jerseyNumber === 'number') {
          existingNumbers.add(player.jerseyNumber);
        }
      });
      const importablePlayers: Player[] = [];
      parsedPlayers.forEach((player) => {
        if (typeof player.jerseyNumber === 'number') {
          if (existingNumbers.has(player.jerseyNumber)) {
            issues.push(
              `Skipped ${player.name}: jersey #${player.jerseyNumber} is already assigned.`
            );
            return;
          }
          existingNumbers.add(player.jerseyNumber);
        }
        importablePlayers.push(player);
      });
      if (!importablePlayers.length) {
        const errorLines = [
          'No players were imported from the pasted roster.',
          ...(issues.length
            ? issues.slice(0, 5).map((issue) => `- ${issue}`)
            : ['Make sure you include the header row and at least one player.']),
        ];
        if (issues.length > 5) {
          errorLines.push(`- and ${issues.length - 5} more issues.`);
        }
        setImporterMessage({
          tone: 'error',
          text: errorLines.join('\n'),
        });
        return;
      }
      await importRosterBatch(teamId, activeSeasonId, importablePlayers);
      await loadRoster();
      setImportText('');
      const summaryLines = [
        `${importablePlayers.length} ${importablePlayers.length === 1 ? 'player was' : 'players were'} imported from MaxPreps.`,
      ];
      if (issues.length) {
        summaryLines.push(
          `${issues.length} ${issues.length === 1 ? 'entry was' : 'entries were'} skipped or adjusted:`
        );
        issues.slice(0, 5).forEach((issue) => summaryLines.push(`- ${issue}`));
        if (issues.length > 5) {
          summaryLines.push(`- and ${issues.length - 5} more.`);
        }
      }
      const summaryMessage = summaryLines.join('\n');
      setImporterMessage({
        tone: issues.length ? 'info' : 'success',
        text: summaryMessage,
      });
      setRosterFeedback(summaryMessage);
    } catch (error) {
      console.error('Failed to import roster', error);
      setImporterMessage({
        tone: 'error',
        text: 'Unable to import roster from MaxPreps. Please check the pasted text and try again.',
      });
    } finally {
      setImportingRoster(false);
    }
  }, [teamId, activeSeasonId, importText, parseMaxPrepsRoster, roster, loadRoster, resetPlayerForm]);
  const rosterColumns: DataTableColumn<Player>[] = useMemo(
    () => [
      {
        header: 'Player',
        accessor: (row) => {
          const isEditingRow = editingPlayerId === row.id;
          if (isEditingRow) {
            return (
              <Stack gap={2}>
                <chakra.input
                  value={playerForm.name}
                  onChange={(event) => handlePlayerFormChange('name', event.target.value)}
                  placeholder="Player name"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="md"
                  px={3}
                  py={2}
                  autoFocus
                />
                <chakra.input
                  value={playerForm.position}
                  onChange={(event) => handlePlayerFormChange('position', event.target.value)}
                  placeholder="Primary position(s)"
                  border="1px solid"
                  borderColor="border.subtle"
                  borderRadius="md"
                  px={3}
                  py={2}
                />
              </Stack>
            );
          }
          return (
            <Stack gap={0}>
              <Text fontWeight="600">{row.preferredName ?? row.name}</Text>
              {(row.position || row.positions?.length) && (
                <Text fontSize="xs" color="brand.secondary">
                  {row.positions?.length ? row.positions.join(', ') : row.position}
                </Text>
              )}
            </Stack>
          );
        },
      },
      {
        header: '#',
        accessor: (row) => {
          const isEditingRow = editingPlayerId === row.id;
          if (isEditingRow) {
            return (
              <chakra.input
                value={playerForm.jerseyNumber}
                onChange={(event) => handlePlayerFormChange('jerseyNumber', event.target.value)}
                placeholder="##"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                px={3}
                py={2}
                textAlign="center"
                maxW="80px"
              />
            );
          }
          return row.jerseyNumber !== undefined ? row.jerseyNumber : '--';
        },
        align: 'center',
        width: '90px',
      },
      {
        header: 'Class',
        accessor: (row) => {
          const isEditingRow = editingPlayerId === row.id;
          if (isEditingRow) {
            return (
              <chakra.input
                value={playerForm.classYear}
                onChange={(event) => handlePlayerFormChange('classYear', event.target.value)}
                placeholder="2026"
                border="1px solid"
                borderColor="border.subtle"
                borderRadius="md"
                px={3}
                py={2}
                maxW="120px"
              />
            );
          }
          return formatClassYear(row.classYear);
        },
        align: 'center',
        width: '120px',
      },
      {
        header: 'Actions',
        accessor: (row) => {
          const isEditingRow = editingPlayerId === row.id;
          if (isEditingRow) {
            return (
              <HStack justify="flex-end" gap={2}>
                <Button
                  size="xs"
                  bg="brand.primary"
                  color="white"
                  onClick={handleSavePlayer}
                  disabled={playerSaving}
                >
                  {playerSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={handleCancelEdit}
                  disabled={playerSaving}
                >
                  Cancel
                </Button>
              </HStack>
            );
          }
          return (
            <HStack justify="flex-end" gap={2}>
              <Button
                size="xs"
                variant="ghost"
                color="brand.primary"
                onClick={() => openEditPlayer(row)}
                disabled={row.id === TEAM_PLAYER_ID || row.jerseyNumber === TEAM_PLAYER_NUMBER}
                title={
                  row.id === TEAM_PLAYER_ID || row.jerseyNumber === TEAM_PLAYER_NUMBER
                    ? 'The TEAM placeholder cannot be edited.'
                    : undefined
                }
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="ghost"
                color="red.500"
                onClick={() => handleDeletePlayer(row.id)}
                disabled={
                  playerSaving ||
                  row.id === TEAM_PLAYER_ID ||
                  row.jerseyNumber === TEAM_PLAYER_NUMBER
                }
                title={
                  row.id === TEAM_PLAYER_ID || row.jerseyNumber === TEAM_PLAYER_NUMBER
                    ? 'The TEAM placeholder cannot be removed.'
                    : undefined
                }
              >
                Remove
              </Button>
            </HStack>
          );
        },
        align: 'right',
        width: '200px',
      },
    ],
    [
      editingPlayerId,
      playerForm,
      playerSaving,
      handlePlayerFormChange,
      handleSavePlayer,
      handleCancelEdit,
      openEditPlayer,
      handleDeletePlayer,
    ]
  );
  const swatches = useMemo(
    () =>
      [
        { label: 'Primary', value: colorForm.primaryColor },
        { label: 'Secondary', value: colorForm.secondaryColor },
        { label: 'Accent', value: colorForm.accentColor },
      ].filter((entry) => entry.value),
    [colorForm]
  );
  const handleColorChange = useCallback(
    (field: keyof typeof colorForm, value: string) => {
      setColorForm((prev) => ({ ...prev, [field]: value }));
      setBrandingFeedback(null);
      setBrandingError(null);
    },
    []
  );
  const handleLogoSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setBrandingFeedback(null);
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setBrandingError('Logo must be an image file (PNG, JPG, SVG).');
        event.target.value = '';
        return;
      }
      if (file.size > MAX_LOGO_SIZE) {
        setBrandingError('Logo must be smaller than 2 MB.');
        event.target.value = '';
        return;
      }
      setBrandingError(null);
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : null;
        setLogoPreview(result);
        setLogoDirty(true);
      };
      reader.onerror = () => {
        setBrandingError('Unable to read the selected file. Try again.');
      };
      reader.readAsDataURL(file);
      event.target.value = '';
    },
    []
  );
  const handleRemoveLogo = useCallback(() => {
    setBrandingFeedback(null);
    setBrandingError(null);
    setLogoPreview(null);
    setLogoDirty(true);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  }, []);
  const handleSaveBranding = useCallback(async () => {
    if (!teamId) return;
    if (!logoDirty && !colorDirty) {
      setBrandingFeedback('Branding is already up to date.');
      setBrandingError(null);
      return;
    }
    setBrandingSaving(true);
    setBrandingFeedback(null);
    setBrandingError(null);
    try {
      let nextLogoUrl = team?.defaultColors?.logoUrl ?? null;
      if (logoDirty) {
        nextLogoUrl = logoPreview;
      }
      await updateTeamBranding(teamId, {
        primaryColor: colorForm.primaryColor || '#0B3D91',
        secondaryColor: colorForm.secondaryColor || '#C60C30',
        accentColor: colorForm.accentColor || undefined,
        logoUrl: nextLogoUrl ?? undefined,
      });
      await refreshTeam();
      setLogoDirty(false);
      if (!nextLogoUrl) {
        setLogoPreview(null);
      } else {
        setLogoPreview(nextLogoUrl);
      }
      setBrandingFeedback('Branding updated successfully.');
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to update branding', error);
      setBrandingError('Unable to update branding. Please try again.');
    } finally {
      setBrandingSaving(false);
    }
  }, [teamId, team?.defaultColors?.logoUrl, logoDirty, colorDirty, logoPreview, colorForm, refreshTeam]);
  if (teamLoading || seasonsLoading) {
    return (
      <Stack align="center" justify="center" minH="60vh" gap={3}>
        <Spinner size="lg" color="brand.primary" />
        <Text color="brand.secondary">Loading team data...</Text>
      </Stack>
    );
  }
  if (teamError && !team) {
    return (
      <SectionCard title="Team Manager">
        <Text color="brand.secondary">{teamError}</Text>
      </SectionCard>
    );
  }
  if (!team || seasons.length === 0 || !activeSeasonId) {
    return (
      <SectionCard title="Team Manager">
        <Stack gap={3} align="center">
          <Text fontWeight="600">Season setup required</Text>
          <Text color="brand.secondary" textAlign="center">
            Create a season for your program to manage coaches and rosters.
          </Text>
          <Button size="sm" variant="outline" borderColor="brand.primary" color="brand.primary" disabled>
            Add Season
          </Button>
        </Stack>
      </SectionCard>
    );
  }
  const headerLogo = logoPreview ?? team.defaultColors?.logoUrl ?? null;
  return (
    <Stack gap={6}>
      <PageHeader
        title="Team Manager"
        media={
          headerLogo ? (
            <Image
              src={headerLogo}
              alt={`${team.name} logo`}
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
        subtitle={`${team.name}${activeSeason ? ` - ${activeSeason.label ?? activeSeason.year}` : ''}`}
        actions={
          seasons.length > 0 ? (
            <HStack gap={2} align="center">
              <Text fontSize="sm" color="brand.secondary">
                Season
              </Text>
              <chakra.select
                value={activeSeasonId}
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
                    {season.label ?? season.year}
                  </option>
                ))}
              </chakra.select>
            </HStack>
          ) : undefined
        }
      />
      <SectionCard
        title="Program Overview"
        description="Core identity for uniforms, scoreboards, and public reports."
      >
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <VStack
            align="flex-start"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="lg"
            p={4}
            bg="bg.surface"
          >
            <Text fontSize="sm" color="brand.secondary">
              Team
            </Text>
            <Text fontWeight="600">{team.name}</Text>
            {team.mascot && (
              <Text fontSize="sm" color="brand.secondary">
                Mascot: {team.mascot}
              </Text>
            )}
            <Stack w="100%" mt={3} gap={2}>
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" color="brand.secondary">
                  Coaches
                </Text>
                <Button size="xs" variant="outline" borderColor="brand.primary" color="brand.primary" onClick={openCreateCoach}>
                  Add Coach
                </Button>
              </HStack>
              {coachFeedback && (
                <Text fontSize="xs" color="brand.secondary">
                  {coachFeedback}
                </Text>
              )}
              {coaches.length === 0 ? (
                <Text fontSize="sm" color="brand.secondary">
                  No coaches recorded yet. Add your staff to appear on rosters and printable reports.
                </Text>
              ) : (
                <Stack gap={2} w="100%">
                  {coaches.map((coach) => {
                    const isActive = coachFormOpen && editingCoachId === coach.id;
                    return (
                      <HStack
                        key={coach.id}
                        justify="space-between"
                        border="1px solid"
                        borderColor="border.subtle"
                        borderRadius="md"
                        px={3}
                        py={2}
                        tabIndex={0}
                        transition="border-color 0.2s ease"
                        _hover={{
                          borderColor: 'brand.primary',
                          '& .coach-actions': {
                            opacity: 1,
                            transform: 'translateX(0)',
                            pointerEvents: 'auto',
                          },
                        }}
                        _focusWithin={{
                          borderColor: 'brand.primary',
                          '& .coach-actions': {
                            opacity: 1,
                            transform: 'translateX(0)',
                            pointerEvents: 'auto',
                          },
                        }}
                      >
                        <Box>
                          <Text fontWeight="600">{coach.name}</Text>
                          <Text fontSize="xs" color="brand.secondary">
                            {coach.role}
                          </Text>
                        </Box>
                        <HStack
                          gap={2}
                          className="coach-actions"
                          opacity={isActive ? 1 : 0}
                          transform={isActive ? 'translateX(0)' : 'translateX(12px)'}
                          pointerEvents={isActive ? 'auto' : 'none'}
                          transition="all 0.2s ease"
                        >
                          <Button
                            size="xs"
                            variant="ghost"
                            color="brand.primary"
                            onClick={() => openEditCoach(coach)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            color="red.500"
                            onClick={() => handleDeleteCoach(coach.id)}
                            disabled={coachSaving}
                          >
                            Remove
                          </Button>
                        </HStack>
                      </HStack>
                    );
                  })}
                </Stack>
              )}
              {coachFormOpen && (
                <Stack gap={3} border="1px solid" borderColor="border.subtle" borderRadius="md" p={3}>
                  <Text fontWeight="600">{editingCoachId ? 'Edit Coach' : 'Add Coach'}</Text>
                  <Stack gap={1}>
                    <Text fontSize="sm" color="brand.secondary">
                      Name *
                    </Text>
                    <chakra.input
                      value={coachForm.name}
                      onChange={(event) => handleCoachFormChange('name', event.target.value)}
                      placeholder="Coach Name"
                      border="1px solid"
                      borderColor="border.subtle"
                      borderRadius="md"
                      px={3}
                      py={2}
                    />
                  </Stack>
                  <Stack gap={1}>
                    <Text fontSize="sm" color="brand.secondary">
                      Role
                    </Text>
                    <chakra.input
                      value={coachForm.role}
                      onChange={(event) => handleCoachFormChange('role', event.target.value)}
                      placeholder="Head Coach / Coordinator"
                      border="1px solid"
                      borderColor="border.subtle"
                      borderRadius="md"
                      px={3}
                      py={2}
                    />
                  </Stack>
                  <HStack justify="flex-end" gap={2}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCoachFormOpen(false);
                        resetCoachForm();
                        setCoachFeedback(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      bg="brand.primary"
                      color="white"
                      onClick={handleSaveCoach}
                      disabled={coachSaving}
                    >
                      {coachSaving ? 'Saving...' : 'Save Coach'}
                    </Button>
                  </HStack>
                </Stack>
              )}
            </Stack>
          </VStack>
          <VStack
            align="flex-start"
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="lg"
            p={4}
            bg="bg.surface"
            w="100%"
            transition="border-color 0.2s ease"
            _hover={{
              borderColor: 'brand.primary',
              '& .branding-actions': {
                opacity: 1,
                transform: 'translateY(0)',
                pointerEvents: 'auto',
              },
            }}
            _focusWithin={{
              borderColor: 'brand.primary',
              '& .branding-actions': {
                opacity: 1,
                transform: 'translateY(0)',
                pointerEvents: 'auto',
              },
            }}
          >
            <Text fontSize="sm" color="brand.secondary">
              Logo & Colors
            </Text>
            <Stack
              direction={{ base: 'column', md: 'row' }}
              gap={4}
              w="100%"
              align={{ base: 'stretch', md: 'center' }}
            >
              <Box
                w={{ base: '100%', md: '140px' }}
                h="140px"
                border="1px dashed"
                borderColor="border.subtle"
                borderRadius="lg"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg="brand.surface"
              >
                {logoPreview ? (
                  <Image
                    src={logoPreview}
                    alt="Team logo preview"
                    objectFit="contain"
                    maxW="100%"
                    maxH="100%"
                  />
                ) : (
                  <Stack gap={1} align="center">
                    <Text fontSize="xs" color="brand.secondary" textAlign="center">
                      No logo uploaded
                    </Text>
                    <Text fontSize="xs" color="brand.secondary" textAlign="center">
                      Recommended: transparent PNG
                    </Text>
                  </Stack>
                )}
              </Box>
              <Stack gap={2} flex="1">
                <HStack gap={2} flexWrap="wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    borderColor="brand.primary"
                    color="brand.primary"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={brandingSaving}
                  >
                    Upload Logo
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    color="red.500"
                    onClick={handleRemoveLogo}
                    disabled={brandingSaving || !(logoPreview || team?.defaultColors?.logoUrl)}
                  >
                    Remove Logo
                  </Button>
                </HStack>
                {brandingError && (
                  <Text fontSize="xs" color="red.500">
                    {brandingError}
                  </Text>
                )}
                {brandingFeedback && (
                  <Text fontSize="xs" color="brand.primary">
                    {brandingFeedback}
                  </Text>
                )}
              </Stack>
            </Stack>
            <chakra.input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              display="none"
              onChange={handleLogoSelect}
            />
            <SimpleGrid columns={{ base: 1, md: 3 }} gap={3} w="100%" mt={4}>
              <Stack gap={1} align="center">
                <Text fontSize="xs" color="brand.secondary">
                  Primary
                </Text>
                <chakra.input
                  type="color"
                  value={colorForm.primaryColor}
                  onChange={(event) => handleColorChange('primaryColor', event.target.value)}
                  border="none"
                  h="48px"
                  w="100%"
                  borderRadius="md"
                  cursor="pointer"
                />
              </Stack>
              <Stack gap={1} align="center">
                <Text fontSize="xs" color="brand.secondary">
                  Secondary
                </Text>
                <chakra.input
                  type="color"
                  value={colorForm.secondaryColor}
                  onChange={(event) => handleColorChange('secondaryColor', event.target.value)}
                  border="none"
                  h="48px"
                  w="100%"
                  borderRadius="md"
                  cursor="pointer"
                />
              </Stack>
              <Stack gap={1} align="center">
                <Text fontSize="xs" color="brand.secondary">
                  Accent
                </Text>
                <chakra.input
                  type="color"
                  value={colorForm.accentColor || '#F8C537'}
                  onChange={(event) => handleColorChange('accentColor', event.target.value)}
                  border="none"
                  h="48px"
                  w="100%"
                  borderRadius="md"
                  cursor="pointer"
                />
              </Stack>
            </SimpleGrid>
            {swatches.length > 0 && (
              <HStack gap={3} mt={3}>
                {swatches.map((entry) => (
                  <VStack key={entry.label} gap={1}>
                    <Box
                      w="40px"
                      h="24px"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="border.subtle"
                      bg={entry.value}
                    />
                    <Text fontSize="xs" color="brand.secondary">
                      {entry.label}
                    </Text>
                  </VStack>
                ))}
              </HStack>
            )}
            <HStack
              justify="flex-end"
              w="100%"
              mt={2}
              className="branding-actions"
              opacity={brandingSaving || hasBrandingChanges ? 1 : 0}
              transform={brandingSaving || hasBrandingChanges ? 'translateY(0)' : 'translateY(6px)'}
              pointerEvents={brandingSaving || hasBrandingChanges ? 'auto' : 'none'}
              transition="all 0.2s ease"
            >
              <Button
                size="sm"
                bg="brand.primary"
                color="white"
                onClick={handleSaveBranding}
                disabled={brandingSaving || !hasBrandingChanges}
              >
                {brandingSaving ? 'Saving...' : 'Save Branding'}
              </Button>
            </HStack>
          </VStack>
        </SimpleGrid>
      </SectionCard>
      <SectionCard
        title="Roster"
        description="Assign jersey numbers, track class years, and sync with MaxPreps imports."
        actions={
          <HStack gap={2}>
            <Button
              size="sm"
              variant="outline"
              borderColor="brand.primary"
              color="brand.primary"
              onClick={() => {
                setImporterOpen((prev) => !prev);
                setImporterMessage(null);
                setRosterError(null);
                setRosterFeedback(null);
              }}
            >
              {importerOpen ? 'Hide Importer' : 'Paste MaxPreps Roster'}
            </Button>
            <Button
              size="sm"
              bg="brand.primary"
              color="white"
              onClick={openCreatePlayer}
              disabled={isEditingPlayer && editingPlayerId !== NEW_PLAYER_ID}
              title={
                isEditingPlayer && editingPlayerId !== NEW_PLAYER_ID
                  ? 'Finish editing the current player before adding another.'
                  : undefined
              }
            >
              Add Player
            </Button>
            <Button
              size="sm"
              variant="ghost"
              color="red.500"
              onClick={handleDeleteAllPlayers}
              disabled={deletableCount === 0 || rosterLoading || playerSaving || isEditingPlayer}
              title={
                deletableCount === 0
                  ? 'No players to delete.'
                  : isEditingPlayer
                  ? 'Finish the current edit before clearing the roster.'
                  : undefined
              }
            >
              Delete All Players
            </Button>
          </HStack>
        }
      >
        {importerOpen && (
          <Stack
            gap={3}
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="md"
            p={4}
            bg="bg.surface"
          >
            <Stack gap={1}>
              <Text fontWeight="600">Paste roster from MaxPreps.com</Text>
              <Text fontSize="sm" color="brand.secondary">
                Copy the roster table from MaxPreps (Ctrl+C) and paste it here. We'll read everything after the column
                header row and add each player automatically.
              </Text>
            </Stack>
            <chakra.textarea
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImporterMessage(null);
                setRosterError(null);
                setRosterFeedback(null);
              }}
              minH="200px"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="md"
              px={3}
              py={2}
              fontFamily="mono"
              fontSize="sm"
              placeholder="Paste your roster text here..."
            />
            {importerMessage && (
              <Text
                fontSize="xs"
                color={
                  importerMessage.tone === 'error'
                    ? 'red.500'
                    : importerMessage.tone === 'success'
                    ? 'brand.primary'
                    : 'brand.secondary'
                }
                whiteSpace="pre-wrap"
              >
                {importerMessage.text}
              </Text>
            )}
            <HStack justify="flex-end" gap={2}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImporterOpen(false);
                  setImportText('');
                  setImporterMessage(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                bg="brand.primary"
                color="white"
                onClick={async () => {
                  await handleImportFromMaxPreps();
                }}
                disabled={importingRoster}
              >
                {importingRoster ? 'Importing...' : 'Import Players'}
              </Button>
            </HStack>
          </Stack>
        )}
        {rosterError && (
          <Box
            border="1px solid"
            borderColor="red.400"
            borderRadius="md"
            px={4}
            py={3}
            mb={4}
            bg="brand.surface"
          >
            <Text color="red.600" fontSize="sm">
              {rosterError}
            </Text>
          </Box>
        )}
        {rosterFeedback && (
          <Text fontSize="xs" color="brand.primary" mb={2} whiteSpace="pre-wrap">
            {rosterFeedback}
          </Text>
        )}
        {rosterLoading ? (
          <HStack gap={3}>
            <Spinner size="sm" color="brand.primary" />
            <Text fontSize="sm" color="brand.secondary">
              Loading roster...
            </Text>
          </HStack>
        ) : (
          <DataTable
            data={tableData}
            columns={rosterColumns}
            keyExtractor={(player) => player.id}
            emptyState={
              <Stack gap={3} align="center">
                <Text fontWeight="600">No players yet</Text>
                <Text fontSize="sm" color="brand.secondary" textAlign="center">
                  Import from MaxPreps or add players manually to build the game-day depth chart.
                </Text>
                <Button
                  size="sm"
                  bg="brand.primary"
                  color="white"
                  onClick={openCreatePlayer}
                  disabled={isEditingPlayer && editingPlayerId !== NEW_PLAYER_ID}
                >
                  Add Player
                </Button>
              </Stack>
            }
          />
        )}
      </SectionCard>
    </Stack>
  );
};
export default TeamManager;
