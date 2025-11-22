import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./context/ProgramContext', () => {
  const actual = jest.requireActual('./context/ProgramContext');
  return {
    ...actual,
    ProgramProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useProgram: () => ({
      team: {
        id: 'team-1',
        name: 'Test Team',
        isMyTeam: true,
        createdAt: null as any,
        updatedAt: null as any,
      },
      teamLoading: false,
      teamError: null,
      seasons: [],
      seasonsLoading: false,
      seasonsError: null,
      opponents: [],
      opponentsLoading: false,
      opponentsError: null,
      activeSeasonId: undefined,
      setActiveSeasonId: jest.fn(),
      activeSeason: undefined,
      branding: { primaryColor: '#000000', secondaryColor: '#ffffff' },
      refreshTeam: jest.fn(),
      refreshSeasons: jest.fn(),
      refreshOpponents: jest.fn(),
    }),
  };
});

jest.mock('./components/GameList', () => () => <div>Schedule</div>);

it('renders schedule view shell', () => {
  render(<App />);
  expect(screen.getByText(/schedule/i)).toBeInTheDocument();
});
