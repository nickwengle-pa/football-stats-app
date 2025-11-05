# Project Direction

This app is evolving into a full-season high school football tracker. The current focus is stabilizing the data layer so the upcoming UI refresh has predictable sources of truth.

## Data Model Overview

- **Team**: identity, branding, coaches, and season linkage. isMyTeam distinguishes the primary program from opponents.
- **Season**: scoped under a team; tracks year, level, optional playoff bracket, and created/updated timestamps.
- **Roster Player**: stored inside 	eams/{teamId}/seasons/{seasonId}/roster, keeps import metadata (manual, MaxPreps CSV) and editable player details.
- **Game**: scoped under 	eams/{teamId}/seasons/{seasonId}/games; includes NFHS-aligned rules, roster snapshots, and play history. Legacy /games documents still load for backward compatibility.
- **Play**: enriched structure that supports quarter/clock context, tackle credit configuration, and multi-player participation.

## Firestore Layout

`
/teams/{teamId}
  seasons/{seasonId}
    roster/{playerId}
    games/{gameId}
      plays (embedded array for now)
`

- Rosters import via importRosterBatch, or stepwise with upsertRosterPlayer.
- Games save through upsertSeasonGame; legacy saveGame will auto-route when seasonId and myTeamId are provided.
- Season and team helpers accept pre-generated UUIDs so the client controls document IDs (no hidden randomness).

## Seeding Checklist (10-game regular season + playoffs)

1. **Create program team** - generate a UUID, populate branding/colors, and set isMyTeam: true.
2. **Add 2025 season** - call upsertSeason with level, start/end dates, and playoff notes.
3. **Import "My Team" roster** - prefer MaxPreps CSV, transform to Player objects, then call importRosterBatch. Manually adjust jersey/positions as needed.
4. **Register opponent teams** - create Team docs with isMyTeam: false; attach logos/colors when available.
5. **Link opponent rosters** - reuse MaxPreps imports or create manual stubs for core players, keeping imports editable.
6. **Seed schedule** - for each opponent, call upsertSeasonGame with kickoff info, site, NFHS defaults (quarterLengthMinutes: 12, standard scoring, tackle mode), and attach cached roster snapshots.
7. **Playoff bracket** - extend the schedule with isPlayoff: true and playoffRound labels (Quarterfinal, Semifinal, Championship) once the regular season is set.

## Migration Notes

- Existing /games documents still load via getGames/subscribeToGame, but newly created games should include seasonId and myTeamId so they persist under the season hierarchy.
- When migrating historical games, read from the legacy collection, enrich with roster snapshots, and write back using upsertSeasonGame to avoid data loss.
- Player stats logic tolerates missing playerId; new UI pathways should send primaryPlayerId to keep aggregates accurate.

## UI System Update

- ProgramProvider bootstraps the active team, seasons, and Chakra theme so every page inherits the right branding.
- Shared primitives (PageHeader, SectionCard, DataTable) drive the schedule, scoring, and reports experiences.
- The schedule screen now supports real-time Firestore updates and an inline create-game flow.
- The Team Manager screen delivers program overview, coach listing, and roster table scaffolding, pulling roster data per season.
- Live Scoring and Reports leverage the same design system for consistent navigation, feedback, and exports.

## Upcoming UI Work

1. Finish roster and coach CRUD (MaxPreps import, manual add/edit, delete) inside Team Manager.
2. Add roster-aware quick actions in Live Scoring (player selection, drive state, defensive stat mode).
3. Layer in richer reports (drive summaries, player stat tables, CSV export) and connect them to schedule filters.
4. Introduce toast/notification UX for key actions (imports, scheduling, scoring) using the Chakra feedback pattern.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### 
pm start

Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser. The page will reload if you make edits and you will see lint errors in the console.

### 
pm test

Launches the test runner in the interactive watch mode. See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### 
pm run build

Builds the app for production to the uild folder. It correctly bundles React in production mode and optimizes the build for the best performance. The build is minified and the filenames include hashes.

### 
pm run eject

**Note: this is a one-way operation. Once you eject, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can eject at any time. This command will remove the single build dependency from your project and copy all configuration files so you have full control. You never have to use eject, but it’s available when you need it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).