import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./utils/toast', () => ({ toaster: { Toaster: () => null }, showSuccessToast: jest.fn(), showErrorToast: jest.fn(), showInfoToast: jest.fn(), showWarningToast: jest.fn() }));

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

jest.mock('@chakra-ui/react', () => {
  const React = require('react');
  const createPrimitive = (tag: any) => (props: any) => React.createElement(tag, props, props?.children);
  return {
    __esModule: true,
    Box: createPrimitive('div'),
    Center: createPrimitive('div'),
    Spinner: () => React.createElement('div', null, 'spinner'),
    Text: createPrimitive('p'),
    Stack: createPrimitive('div'),
    ChakraProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('./components/layout/AppShell', () => ({ AppShell: ({ children }: any) => <div>{children}</div> }));
jest.mock('./components/GameList', () => () => <div>Schedule</div>);
jest.mock('./components/ScoringScreen', () => () => <div>Scoring</div>);
jest.mock('./components/ReportsScreen', () => () => <div>Reports</div>);
jest.mock('./components/PlayerStatsScreen', () => () => <div>PlayerStats</div>);
jest.mock('./components/TeamManager', () => () => <div>TeamManager</div>);
jest.mock('./firebase', () => ({ ensureAuth: () => Promise.resolve(), db: {}, auth: {}, storage: {} }));

describe('App shell', () => {
  it('renders schedule view shell', () => {
    render(<App />);
    expect(screen.getByText(/schedule/i)).toBeInTheDocument();
  });
});
