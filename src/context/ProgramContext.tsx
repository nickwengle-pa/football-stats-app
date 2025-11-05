import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Team, Season, TeamBranding, OpponentTeam } from '../models';
import { listTeams, listSeasons, listOpponents } from '../services/dbService';

const fallbackBranding: TeamBranding = {
  primaryColor: '#0B3D91',
  secondaryColor: '#C60C30',
  accentColor: '#F8C537',
};

interface ProgramContextValue {
  team: Team | null;
  teamLoading: boolean;
  teamError: string | null;
  seasons: Season[];
  seasonsLoading: boolean;
  seasonsError: string | null;
  opponents: OpponentTeam[];
  opponentsLoading: boolean;
  opponentsError: string | null;
  activeSeasonId?: string;
  setActiveSeasonId: (seasonId?: string) => void;
  activeSeason?: Season;
  branding: TeamBranding;
  refreshTeam: () => Promise<void>;
  refreshSeasons: () => Promise<void>;
  refreshOpponents: () => Promise<void>;
}

const ProgramContext = createContext<ProgramContextValue | undefined>(undefined);

export const ProgramProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [teamLoading, setTeamLoading] = useState<boolean>(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState<boolean>(false);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);

  const [opponents, setOpponents] = useState<OpponentTeam[]>([]);
  const [opponentsLoading, setOpponentsLoading] = useState<boolean>(false);
  const [opponentsError, setOpponentsError] = useState<string | null>(null);

  const [activeSeasonId, setActiveSeasonIdState] = useState<string | undefined>(undefined);

  const loadSeasons = useCallback(
    async (targetTeam?: Team | null) => {
      const teamToLoad = targetTeam ?? team;
      if (!teamToLoad) {
        setSeasons([]);
        setActiveSeasonIdState(undefined);
        return;
      }

      setSeasonsLoading(true);
      setSeasonsError(null);
      try {
        const seasonRecords = await listSeasons(teamToLoad.id);
        setSeasons(seasonRecords);
        if (seasonRecords.length > 0) {
          const preferred = teamToLoad.currentSeasonId ?? seasonRecords[0].id;
          setActiveSeasonIdState((prev) => prev ?? preferred);
        } else {
          setActiveSeasonIdState(undefined);
        }
      } catch (error) {
        console.error('Failed to load seasons', error);
        setSeasonsError('Unable to load seasons.');
        setSeasons([]);
        setActiveSeasonIdState(undefined);
      } finally {
        setSeasonsLoading(false);
      }
    },
    [team]
  );

  const loadOpponents = useCallback(
    async (targetTeam?: Team | null) => {
      const teamToLoad = targetTeam ?? team;
      if (!teamToLoad) {
        setOpponents([]);
        return;
      }

      setOpponentsLoading(true);
      setOpponentsError(null);
      try {
        const opponentRecords = await listOpponents(teamToLoad.id);
        setOpponents(opponentRecords);
      } catch (error) {
        console.error('Failed to load opponents', error);
        setOpponentsError('Unable to load opponents.');
        setOpponents([]);
      } finally {
        setOpponentsLoading(false);
      }
    },
    [team]
  );

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const teams = await listTeams();
      const myTeam = teams.find((t) => t.isMyTeam) ?? teams[0] ?? null;
      setTeam(myTeam);
      if (!myTeam) {
        setTeamError('No team found. Create a team document to get started.');
      }
      await loadSeasons(myTeam);
      await loadOpponents(myTeam);
    } catch (error) {
      console.error('Failed to load team', error);
      setTeamError('Unable to load team information.');
      setTeam(null);
      setSeasons([]);
      setOpponents([]);
      setActiveSeasonIdState(undefined);
    } finally {
      setTeamLoading(false);
    }
  }, [loadSeasons, loadOpponents]);

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (team) {
      loadSeasons(team);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  useEffect(() => {
    if (team) {
      loadOpponents(team);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  const branding = useMemo<TeamBranding>(
    () => team?.defaultColors ?? fallbackBranding,
    [team]
  );

  const activeSeason = useMemo(
    () => seasons.find((season) => season.id === activeSeasonId),
    [seasons, activeSeasonId]
  );

  const setActiveSeasonId = useCallback((seasonId?: string) => {
    setActiveSeasonIdState(seasonId);
  }, []);

  const refreshSeasons = useCallback(() => loadSeasons(), [loadSeasons]);
  const refreshOpponents = useCallback(() => loadOpponents(), [loadOpponents]);

  const value = useMemo<ProgramContextValue>(
    () => ({
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
      activeSeason,
      branding,
      refreshTeam: loadTeam,
      refreshSeasons,
      refreshOpponents,
    }),
    [
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
      activeSeason,
      branding,
      loadTeam,
      refreshSeasons,
      refreshOpponents,
    ]
  );

  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
};

export const useProgram = (): ProgramContextValue => {
  const context = useContext(ProgramContext);
  if (!context) {
    throw new Error('useProgram must be used within a ProgramProvider');
  }
  return context;
};
