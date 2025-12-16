import { SeasonStatsExport, PlayerSeasonStats, GameResult, SeasonLeader, PlayerGameStats, GameDetailStats } from './seasonStatsService';

/**
 * Public Site Generator
 * Generates static HTML pages from season data.
 */

// HTML escape utility
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Format date for display
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
};

// Generate CSS styles
const generateStyles = (primaryColor: string, secondaryColor: string): string => `
  :root {
    --primary-color: ${primaryColor};
    --secondary-color: ${secondaryColor};
    --bg-color: #f5f5f5;
    --card-bg: #ffffff;
    --text-primary: #1a1a1a;
    --text-secondary: #666666;
    --border-color: #e0e0e0;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-primary);
    line-height: 1.5;
  }
  
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }
  
  /* Header */
  .team-header {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 40px 20px;
    text-align: center;
    margin-bottom: 30px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  
  .team-header h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 8px;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
  }
  
  .team-record {
    font-size: 2rem;
    font-weight: 600;
    opacity: 0.95;
  }
  
  .team-season {
    font-size: 1rem;
    opacity: 0.85;
    margin-top: 8px;
  }
  
  .team-logo {
    max-width: 120px;
    max-height: 120px;
    margin-bottom: 16px;
    border-radius: 8px;
  }
  
  /* Navigation */
  .nav-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 24px;
    background: var(--card-bg);
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    flex-wrap: wrap;
  }
  
  .nav-tab {
    padding: 10px 20px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
  }
  
  .nav-tab:hover {
    background: var(--bg-color);
  }
  
  .nav-tab.active {
    background: var(--primary-color);
    color: white;
  }
  
  /* Cards */
  .card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  
  .card-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--primary-color);
  }
  
  /* Tables */
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  
  .stats-table th {
    background: var(--primary-color);
    color: white;
    padding: 12px 8px;
    text-align: left;
    font-weight: 600;
    position: sticky;
    top: 0;
  }
  
  .stats-table th:first-child {
    border-radius: 8px 0 0 0;
  }
  
  .stats-table th:last-child {
    border-radius: 0 8px 0 0;
  }
  
  .stats-table td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .stats-table tr:hover {
    background: rgba(0,0,0,0.02);
  }
  
  .stats-table tr:nth-child(even) {
    background: rgba(0,0,0,0.015);
  }
  
  .stats-table .number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  .stats-table .player-name {
    font-weight: 500;
  }
  
  .stats-table .jersey {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }
  
  /* Schedule */
  .schedule-game {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    gap: 16px;
    transition: background-color 0.2s;
  }
  
  .schedule-game.clickable {
    cursor: pointer;
  }
  
  .schedule-game.clickable:hover {
    background-color: var(--bg-color);
  }
  
  .schedule-game:last-child {
    border-bottom: none;
  }
  
  .game-arrow {
    color: var(--text-secondary);
    font-size: 1.2rem;
    font-weight: 600;
  }
  
  .game-date {
    min-width: 80px;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  
  .game-opponent {
    flex: 1;
    font-weight: 500;
  }
  
  .game-site {
    font-size: 0.85rem;
    color: var(--text-secondary);
    min-width: 50px;
  }
  
  .game-result {
    font-weight: 600;
    min-width: 80px;
    text-align: right;
  }
  
  .game-result.win {
    color: #22c55e;
  }
  
  .game-result.loss {
    color: #ef4444;
  }
  
  .game-result.tie {
    color: #f59e0b;
  }
  
  .game-score {
    font-variant-numeric: tabular-nums;
  }
  
  /* Team Leaders */
  .leaders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  
  .leader-card {
    background: var(--bg-color);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .leader-jersey {
    width: 48px;
    height: 48px;
    background: var(--primary-color);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.1rem;
  }
  
  .leader-info {
    flex: 1;
  }
  
  .leader-category {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .leader-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-color);
  }
  
  .leader-name {
    font-weight: 500;
    font-size: 0.95rem;
  }
  
  /* Team Stats Summary */
  .stats-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  
  .stat-box {
    background: var(--bg-color);
    border-radius: 8px;
    padding: 16px;
    text-align: center;
  }
  
  .stat-box-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary-color);
  }
  
  .stat-box-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  /* Roster */
  .roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }
  
  .roster-player {
    background: var(--bg-color);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }
  
  .roster-player:hover {
    border-color: var(--primary-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }
  
  .roster-number {
    width: 40px;
    height: 40px;
    background: var(--primary-color);
    color: white;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
  }
  
  .roster-info {
    flex: 1;
  }
  
  .roster-name {
    font-weight: 500;
  }
  
  .roster-position {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  /* Player Modal */
  .modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }
  
  .modal-overlay.active {
    display: flex;
  }
  
  .modal-content {
    background: var(--card-bg);
    border-radius: 16px;
    max-width: 800px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  }
  
  .modal-header {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 24px;
    border-radius: 16px 16px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .modal-player-info h2 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 4px;
  }
  
  .modal-player-details {
    opacity: 0.9;
    font-size: 0.95rem;
  }
  
  .modal-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }
  
  .modal-close:hover {
    background: rgba(255,255,255,0.3);
  }
  
  .modal-body {
    padding: 24px;
  }
  
  .modal-section {
    margin-bottom: 24px;
  }
  
  .modal-section:last-child {
    margin-bottom: 0;
  }
  
  .modal-section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--primary-color);
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--primary-color);
  }
  
  .season-totals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 12px;
  }
  
  .season-stat-item {
    background: var(--bg-color);
    border-radius: 8px;
    padding: 12px;
    text-align: center;
  }
  
  .season-stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--primary-color);
  }
  
  .season-stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }
  
  .game-log-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  
  .game-log-table th {
    background: var(--bg-color);
    padding: 10px 8px;
    text-align: left;
    font-weight: 600;
    color: var(--text-secondary);
    font-size: 0.75rem;
    text-transform: uppercase;
  }
  
  .game-log-table td {
    padding: 10px 8px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .game-log-table .number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  .game-result-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.75rem;
  }
  
  .game-result-badge.win {
    background: #dcfce7;
    color: #166534;
  }
  
  .game-result-badge.loss {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .game-result-badge.tie {
    background: #fef3c7;
    color: #92400e;
  }
  
  .no-stats {
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding: 20px;
  }
  
  /* Game Modal specific styles */
  .game-modal-header {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .game-modal-score {
    font-size: 2rem;
    font-weight: 700;
    margin: 10px 0;
  }
  
  .game-modal-score .home-score {
    color: var(--primary-color);
  }
  
  .game-modal-score .opp-score {
    color: var(--text-secondary);
  }
  
  .game-modal-result {
    display: inline-block;
    padding: 4px 16px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 10px;
  }
  
  .game-modal-result.win {
    background: #dcfce7;
    color: #166534;
  }
  
  .game-modal-result.loss {
    background: #fee2e2;
    color: #991b1b;
  }
  
  .game-modal-result.tie {
    background: #fef3c7;
    color: #92400e;
  }
  
  .game-team-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
    padding: 16px;
    background: var(--bg-color);
    border-radius: 8px;
  }
  
  .game-team-stat {
    text-align: center;
  }
  
  .game-team-stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--primary-color);
  }
  
  .game-team-stat-label {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
  }
  
  .game-stats-section {
    margin-bottom: 24px;
  }
  
  .game-stats-section h4 {
    font-size: 0.85rem;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .game-player-stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }
  
  .game-player-stats-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--text-secondary);
    font-weight: 500;
    font-size: 0.75rem;
  }
  
  .game-player-stats-table td {
    padding: 6px 8px;
  }
  
  .game-player-stats-table .number {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  .game-player-stats-table tbody tr:nth-child(even) {
    background: var(--bg-color);
  }

  /* Tabs Content */
  .tab-content {
    display: none;
  }
  
  .tab-content.active {
    display: block;
  }
  
  /* Footer */
  .site-footer {
    text-align: center;
    padding: 24px;
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin-top: 40px;
  }
  
  .site-footer a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .team-header h1 {
      font-size: 1.75rem;
    }
    
    .team-record {
      font-size: 1.5rem;
    }
    
    .stats-table {
      font-size: 0.8rem;
    }
    
    .stats-table th,
    .stats-table td {
      padding: 8px 4px;
    }
    
    .container {
      padding: 12px;
    }
  }
  
  /* Stats tabs */
  .stats-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  
  .stats-tab {
    padding: 8px 16px;
    background: var(--bg-color);
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-secondary);
    transition: all 0.2s;
  }
  
  .stats-tab.active {
    background: var(--primary-color);
    color: white;
  }
  
  .stats-section {
    display: none;
  }
  
  .stats-section.active {
    display: block;
  }
  
  /* Print styles */
  @media print {
    .nav-tabs, .stats-tabs {
      display: none;
    }
    
    .tab-content, .stats-section {
      display: block !important;
    }
    
    .card {
      break-inside: avoid;
      box-shadow: none;
      border: 1px solid var(--border-color);
    }
  }
`;

// Generate schedule HTML with clickable games
const generateScheduleHtml = (schedule: GameResult[], hasGameDetails: boolean): string => {
  if (schedule.length === 0) {
    return '<p>No games scheduled.</p>';
  }
  
  return schedule.map(game => `
    <div class="schedule-game ${hasGameDetails && (game.homeScore > 0 || game.oppScore > 0) ? 'clickable' : ''}" 
         ${hasGameDetails && (game.homeScore > 0 || game.oppScore > 0) ? `onclick="showGameModal('${game.gameId}')" role="button" tabindex="0"` : ''}>
      <div class="game-date">${formatDate(game.date)}</div>
      <div class="game-site">${game.site === 'home' ? 'vs' : game.site === 'away' ? '@' : 'N'}</div>
      <div class="game-opponent">${escapeHtml(game.opponent)}</div>
      <div class="game-result ${game.result.toLowerCase()}">
        ${game.homeScore > 0 || game.oppScore > 0 
          ? `<span class="game-score">${game.result} ${game.homeScore}-${game.oppScore}</span>`
          : '--'
        }
      </div>
      ${hasGameDetails && (game.homeScore > 0 || game.oppScore > 0) ? '<div class="game-arrow">›</div>' : ''}
    </div>
  `).join('');
};

// Generate leaders HTML
const generateLeadersHtml = (leaders: SeasonLeader[]): string => {
  if (leaders.length === 0) {
    return '<p>No statistical leaders.</p>';
  }
  
  return `
    <div class="leaders-grid">
      ${leaders.map(leader => `
        <div class="leader-card">
          <div class="leader-jersey">${leader.jerseyNumber ?? '--'}</div>
          <div class="leader-info">
            <div class="leader-category">${escapeHtml(leader.displayLabel)}</div>
            <div class="leader-value">${escapeHtml(leader.displayValue)}</div>
            <div class="leader-name">${escapeHtml(leader.playerName)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// Generate rushing stats table
const generateRushingTable = (players: PlayerSeasonStats[]): string => {
  const rushers = players
    .filter(p => p.rushingAttempts > 0)
    .sort((a, b) => b.rushingYards - a.rushingYards);
  
  if (rushers.length === 0) return '<p>No rushing stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">ATT</th>
            <th class="number">YDS</th>
            <th class="number">AVG</th>
            <th class="number">LNG</th>
            <th class="number">TD</th>
            <th class="number">YDS/G</th>
          </tr>
        </thead>
        <tbody>
          ${rushers.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.rushingAttempts}</td>
              <td class="number">${p.rushingYards}</td>
              <td class="number">${p.rushingYardsPerAttempt.toFixed(1)}</td>
              <td class="number">${p.rushingLong}</td>
              <td class="number">${p.rushingTouchdowns}</td>
              <td class="number">${p.rushingYardsPerGame.toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate passing stats table
const generatePassingTable = (players: PlayerSeasonStats[]): string => {
  const passers = players
    .filter(p => p.passingAttempts > 0)
    .sort((a, b) => b.passingYards - a.passingYards);
  
  if (passers.length === 0) return '<p>No passing stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">CMP</th>
            <th class="number">ATT</th>
            <th class="number">PCT</th>
            <th class="number">YDS</th>
            <th class="number">TD</th>
            <th class="number">INT</th>
            <th class="number">LNG</th>
            <th class="number">RTG</th>
          </tr>
        </thead>
        <tbody>
          ${passers.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.completions}</td>
              <td class="number">${p.passingAttempts}</td>
              <td class="number">${p.completionPercentage.toFixed(1)}%</td>
              <td class="number">${p.passingYards}</td>
              <td class="number">${p.passingTouchdowns}</td>
              <td class="number">${p.interceptions}</td>
              <td class="number">${p.passingLong}</td>
              <td class="number">${p.qbRating.toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate receiving stats table
const generateReceivingTable = (players: PlayerSeasonStats[]): string => {
  const receivers = players
    .filter(p => p.receptions > 0)
    .sort((a, b) => b.receivingYards - a.receivingYards);
  
  if (receivers.length === 0) return '<p>No receiving stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">REC</th>
            <th class="number">YDS</th>
            <th class="number">AVG</th>
            <th class="number">LNG</th>
            <th class="number">TD</th>
            <th class="number">YDS/G</th>
          </tr>
        </thead>
        <tbody>
          ${receivers.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.receptions}</td>
              <td class="number">${p.receivingYards}</td>
              <td class="number">${p.receivingYardsPerCatch.toFixed(1)}</td>
              <td class="number">${p.receivingLong}</td>
              <td class="number">${p.receivingTouchdowns}</td>
              <td class="number">${p.receivingYardsPerGame.toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate defense stats table
const generateDefenseTable = (players: PlayerSeasonStats[]): string => {
  const defenders = players
    .filter(p => p.tackles > 0 || p.sacks > 0 || p.interceptionsDef > 0)
    .sort((a, b) => b.tackles - a.tackles);
  
  if (defenders.length === 0) return '<p>No defensive stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">TCKL</th>
            <th class="number">TFL</th>
            <th class="number">SACK</th>
            <th class="number">INT</th>
            <th class="number">PD</th>
            <th class="number">FF</th>
            <th class="number">FR</th>
          </tr>
        </thead>
        <tbody>
          ${defenders.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.tackles}</td>
              <td class="number">${p.tacklesForLoss}</td>
              <td class="number">${p.sacks}</td>
              <td class="number">${p.interceptionsDef}</td>
              <td class="number">${p.passesDefensed}</td>
              <td class="number">${p.forcedFumbles}</td>
              <td class="number">${p.fumblesRecovered}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate kicking stats table
const generateKickingTable = (players: PlayerSeasonStats[]): string => {
  const kickers = players
    .filter(p => p.fieldGoalAttempts > 0 || p.extraPointAttempts > 0)
    .sort((a, b) => b.fieldGoalsMade - a.fieldGoalsMade);
  
  if (kickers.length === 0) return '<p>No kicking stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">FGM</th>
            <th class="number">FGA</th>
            <th class="number">FG%</th>
            <th class="number">LNG</th>
            <th class="number">XPM</th>
            <th class="number">XPA</th>
            <th class="number">XP%</th>
          </tr>
        </thead>
        <tbody>
          ${kickers.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.fieldGoalsMade}</td>
              <td class="number">${p.fieldGoalAttempts}</td>
              <td class="number">${p.fieldGoalPercentage.toFixed(1)}%</td>
              <td class="number">${p.fieldGoalLong}</td>
              <td class="number">${p.extraPointsMade}</td>
              <td class="number">${p.extraPointAttempts}</td>
              <td class="number">${p.extraPointPercentage.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate returns stats table
const generateReturnsTable = (players: PlayerSeasonStats[]): string => {
  const returners = players
    .filter(p => p.puntReturns > 0 || p.kickoffReturns > 0)
    .sort((a, b) => (b.puntReturnYards + b.kickoffReturnYards) - (a.puntReturnYards + a.kickoffReturnYards));
  
  if (returners.length === 0) return '<p>No return stats.</p>';
  
  return `
    <div style="overflow-x: auto;">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th>
            <th class="number">PR</th>
            <th class="number">PR YDS</th>
            <th class="number">PR AVG</th>
            <th class="number">PR LNG</th>
            <th class="number">KR</th>
            <th class="number">KR YDS</th>
            <th class="number">KR AVG</th>
            <th class="number">KR LNG</th>
          </tr>
        </thead>
        <tbody>
          ${returners.map(p => `
            <tr>
              <td class="player-name">
                <span class="jersey">#${p.jerseyNumber ?? '--'}</span>
                ${escapeHtml(p.name)}
              </td>
              <td class="number">${p.puntReturns}</td>
              <td class="number">${p.puntReturnYards}</td>
              <td class="number">${p.puntReturnAverage.toFixed(1)}</td>
              <td class="number">${p.puntReturnLong}</td>
              <td class="number">${p.kickoffReturns}</td>
              <td class="number">${p.kickoffReturnYards}</td>
              <td class="number">${p.kickoffReturnAverage.toFixed(1)}</td>
              <td class="number">${p.kickoffReturnLong}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

// Generate roster HTML with clickable players
const generateRosterHtml = (
  roster: SeasonStatsExport['roster'],
  playerStats: PlayerSeasonStats[],
  playerGameStats: Record<string, PlayerGameStats[]>
): string => {
  const sorted = [...roster].sort((a, b) => (a.jerseyNumber ?? 999) - (b.jerseyNumber ?? 999));
  
  // Create a map for quick player stats lookup
  const statsMap = new Map<string, PlayerSeasonStats>();
  playerStats.forEach(p => statsMap.set(p.playerId, p));
  
  return `
    <div class="roster-grid">
      ${sorted.map(p => `
        <div class="roster-player" onclick="showPlayerModal('${p.id}')" role="button" tabindex="0">
          <div class="roster-number">${p.jerseyNumber ?? '--'}</div>
          <div class="roster-info">
            <div class="roster-name">${escapeHtml(p.name)}</div>
            <div class="roster-position">${escapeHtml(p.position || '')}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
};

// Generate player modal HTML
const generatePlayerModal = (
  player: SeasonStatsExport['roster'][0],
  stats: PlayerSeasonStats | undefined,
  gameStats: PlayerGameStats[]
): string => {
  const hasOffensiveStats = stats && (stats.rushingAttempts > 0 || stats.passingAttempts > 0 || stats.receptions > 0);
  const hasDefensiveStats = stats && (stats.tackles > 0 || stats.sacks > 0 || stats.interceptionsDef > 0);
  const hasAnyStats = hasOffensiveStats || hasDefensiveStats;
  
  return `
    <div id="modal-${player.id}" class="modal-overlay" onclick="closePlayerModal(event, '${player.id}')">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div class="modal-player-info">
            <h2>#${player.jerseyNumber ?? '--'} ${escapeHtml(player.name)}</h2>
            <div class="modal-player-details">
              ${player.position ? `${escapeHtml(player.position)}` : ''}
              ${player.classYear ? ` • Class of ${player.classYear}` : ''}
              ${stats ? ` • ${stats.gamesPlayed} Games Played` : ''}
            </div>
          </div>
          <button class="modal-close" onclick="hidePlayerModal('${player.id}')">&times;</button>
        </div>
        <div class="modal-body">
          ${!hasAnyStats ? '<p class="no-stats">No statistics recorded for this player.</p>' : ''}
          
          ${hasOffensiveStats ? `
            <div class="modal-section">
              <h3 class="modal-section-title">Season Totals - Offense</h3>
              <div class="season-totals-grid">
                ${stats!.rushingAttempts > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.rushingYards}</div>
                    <div class="season-stat-label">Rush Yds</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.rushingAttempts}</div>
                    <div class="season-stat-label">Rush Att</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.rushingTouchdowns}</div>
                    <div class="season-stat-label">Rush TD</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.rushingYardsPerAttempt.toFixed(1)}</div>
                    <div class="season-stat-label">Yds/Att</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.rushingLong}</div>
                    <div class="season-stat-label">Long</div>
                  </div>
                ` : ''}
                ${stats!.passingAttempts > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.passingYards}</div>
                    <div class="season-stat-label">Pass Yds</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.completions}/${stats!.passingAttempts}</div>
                    <div class="season-stat-label">Comp/Att</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.passingTouchdowns}</div>
                    <div class="season-stat-label">Pass TD</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.completionPercentage.toFixed(0)}%</div>
                    <div class="season-stat-label">Comp %</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.qbRating.toFixed(1)}</div>
                    <div class="season-stat-label">Rating</div>
                  </div>
                ` : ''}
                ${stats!.receptions > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.receivingYards}</div>
                    <div class="season-stat-label">Rec Yds</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.receptions}</div>
                    <div class="season-stat-label">Rec</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.receivingTouchdowns}</div>
                    <div class="season-stat-label">Rec TD</div>
                  </div>
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.receivingYardsPerCatch.toFixed(1)}</div>
                    <div class="season-stat-label">Yds/Rec</div>
                  </div>
                ` : ''}
                <div class="season-stat-item">
                  <div class="season-stat-value">${stats!.totalPoints}</div>
                  <div class="season-stat-label">Points</div>
                </div>
              </div>
            </div>
          ` : ''}
          
          ${hasDefensiveStats ? `
            <div class="modal-section">
              <h3 class="modal-section-title">Season Totals - Defense</h3>
              <div class="season-totals-grid">
                <div class="season-stat-item">
                  <div class="season-stat-value">${stats!.tackles}</div>
                  <div class="season-stat-label">Tackles</div>
                </div>
                ${stats!.tacklesForLoss > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.tacklesForLoss}</div>
                    <div class="season-stat-label">TFL</div>
                  </div>
                ` : ''}
                ${stats!.sacks > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.sacks}</div>
                    <div class="season-stat-label">Sacks</div>
                  </div>
                ` : ''}
                ${stats!.interceptionsDef > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.interceptionsDef}</div>
                    <div class="season-stat-label">INT</div>
                  </div>
                ` : ''}
                ${stats!.passesDefensed > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.passesDefensed}</div>
                    <div class="season-stat-label">PD</div>
                  </div>
                ` : ''}
                ${stats!.forcedFumbles > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.forcedFumbles}</div>
                    <div class="season-stat-label">FF</div>
                  </div>
                ` : ''}
                ${stats!.fumblesRecovered > 0 ? `
                  <div class="season-stat-item">
                    <div class="season-stat-value">${stats!.fumblesRecovered}</div>
                    <div class="season-stat-label">FR</div>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${gameStats.length > 0 ? `
            <div class="modal-section">
              <h3 class="modal-section-title">Game Log</h3>
              <div style="overflow-x: auto;">
                <table class="game-log-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opponent</th>
                      <th></th>
                      ${hasOffensiveStats && stats!.rushingAttempts > 0 ? '<th class="number">Rush</th><th class="number">Yds</th><th class="number">TD</th>' : ''}
                      ${hasOffensiveStats && stats!.receptions > 0 ? '<th class="number">Rec</th><th class="number">Yds</th><th class="number">TD</th>' : ''}
                      ${hasDefensiveStats ? '<th class="number">Tkl</th><th class="number">Sck</th>' : ''}
                      <th class="number">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${gameStats.map(g => `
                      <tr>
                        <td>${formatDate(g.date)}</td>
                        <td>${escapeHtml(g.opponent)}</td>
                        <td><span class="game-result-badge ${g.result.toLowerCase()}">${g.result}</span></td>
                        ${hasOffensiveStats && stats!.rushingAttempts > 0 ? `
                          <td class="number">${g.rushingAttempts}</td>
                          <td class="number">${g.rushingYards}</td>
                          <td class="number">${g.rushingTouchdowns}</td>
                        ` : ''}
                        ${hasOffensiveStats && stats!.receptions > 0 ? `
                          <td class="number">${g.receptions}</td>
                          <td class="number">${g.receivingYards}</td>
                          <td class="number">${g.receivingTouchdowns}</td>
                        ` : ''}
                        ${hasDefensiveStats ? `
                          <td class="number">${g.tackles}</td>
                          <td class="number">${g.sacks}</td>
                        ` : ''}
                        <td class="number">${g.totalPoints}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

// Generate all player modals
const generateAllPlayerModals = (data: SeasonStatsExport): string => {
  const statsMap = new Map<string, PlayerSeasonStats>();
  data.playerStats.forEach(p => statsMap.set(p.playerId, p));
  
  return data.roster.map(player => 
    generatePlayerModal(
      player,
      statsMap.get(player.id),
      data.playerGameStats[player.id] || []
    )
  ).join('');
};

// Generate a single game modal
const generateGameModal = (game: GameDetailStats, teamName: string): string => {
  const { teamStats } = game;
  
  return `
    <div id="game-modal-${game.gameId}" class="modal-overlay" onclick="closeGameModal(event, '${game.gameId}')">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <button class="modal-close" onclick="hideGameModal('${game.gameId}')">&times;</button>
        </div>
        <div class="modal-body">
          <div class="game-modal-header">
            <div class="game-modal-result ${game.result.toLowerCase()}">${game.result === 'W' ? 'WIN' : game.result === 'L' ? 'LOSS' : 'TIE'}</div>
            <h2>${game.site === 'home' ? 'vs' : '@'} ${escapeHtml(game.opponent)}</h2>
            <div class="game-modal-score">
              <span class="home-score">${game.homeScore}</span>
              <span> - </span>
              <span class="opp-score">${game.oppScore}</span>
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem;">${formatDate(game.date)}</div>
          </div>
          
          <!-- Team Stats Summary -->
          <div class="modal-section">
            <h3 class="modal-section-title">Team Stats</h3>
            <div class="game-team-stats">
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.totalOffenseYards}</div>
                <div class="game-team-stat-label">Total Yards</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.rushingYards}</div>
                <div class="game-team-stat-label">Rush Yards</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.passingYards}</div>
                <div class="game-team-stat-label">Pass Yards</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.firstDowns}</div>
                <div class="game-team-stat-label">First Downs</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.turnovers}</div>
                <div class="game-team-stat-label">Turnovers</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.penalties}-${teamStats.penaltyYards}</div>
                <div class="game-team-stat-label">Penalties</div>
              </div>
            </div>
            
            <h4 style="margin-top: 16px; margin-bottom: 8px; font-size: 0.85rem; color: var(--text-secondary);">Defense</h4>
            <div class="game-team-stats">
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.defenseYardsAllowed}</div>
                <div class="game-team-stat-label">Yds Allowed</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.defenseRushingYardsAllowed}</div>
                <div class="game-team-stat-label">Rush Yds Allowed</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.defensePassingYardsAllowed}</div>
                <div class="game-team-stat-label">Pass Yds Allowed</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.sacks}</div>
                <div class="game-team-stat-label">Sacks</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.tacklesForLoss}</div>
                <div class="game-team-stat-label">TFL</div>
              </div>
              <div class="game-team-stat">
                <div class="game-team-stat-value">${teamStats.interceptions}</div>
                <div class="game-team-stat-label">INT</div>
              </div>
            </div>
          </div>
          
          <!-- Offense Section -->
          <div class="modal-section">
            <h3 class="modal-section-title">Offense</h3>
            
            ${game.rushing.length > 0 ? `
              <div class="game-stats-section">
                <h4>Rushing</h4>
                <div style="overflow-x: auto;">
                  <table class="game-player-stats-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th class="number">ATT</th>
                        <th class="number">YDS</th>
                        <th class="number">TD</th>
                        <th class="number">LNG</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${game.rushing.map(p => `
                        <tr>
                          <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                          <td class="number">${p.attempts}</td>
                          <td class="number">${p.yards}</td>
                          <td class="number">${p.touchdowns}</td>
                          <td class="number">${p.long}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
            
            ${game.passing.length > 0 ? `
              <div class="game-stats-section">
                <h4>Passing</h4>
                <div style="overflow-x: auto;">
                  <table class="game-player-stats-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th class="number">C/A</th>
                        <th class="number">YDS</th>
                        <th class="number">TD</th>
                        <th class="number">INT</th>
                        <th class="number">LNG</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${game.passing.map(p => `
                        <tr>
                          <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                          <td class="number">${p.completions}/${p.attempts}</td>
                          <td class="number">${p.yards}</td>
                          <td class="number">${p.touchdowns}</td>
                          <td class="number">${p.interceptions}</td>
                          <td class="number">${p.long}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
            
            ${game.receiving.length > 0 ? `
              <div class="game-stats-section">
                <h4>Receiving</h4>
                <div style="overflow-x: auto;">
                  <table class="game-player-stats-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th class="number">REC</th>
                        <th class="number">YDS</th>
                        <th class="number">TD</th>
                        <th class="number">LNG</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${game.receiving.map(p => `
                        <tr>
                          <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                          <td class="number">${p.receptions}</td>
                          <td class="number">${p.yards}</td>
                          <td class="number">${p.touchdowns}</td>
                          <td class="number">${p.long}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
            
            ${game.scoring.length > 0 ? `
              <div class="game-stats-section">
                <h4>Scoring</h4>
                <div style="overflow-x: auto;">
                  <table class="game-player-stats-table">
                    <thead>
                      <tr>
                        <th>Player</th>
                        <th class="number">TD</th>
                        <th class="number">2PT</th>
                        <th class="number">FG</th>
                        <th class="number">XP</th>
                        <th class="number">PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${game.scoring.map(p => `
                        <tr>
                          <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                          <td class="number">${p.touchdowns}</td>
                          <td class="number">${p.twoPointConversions}</td>
                          <td class="number">${p.fieldGoals}</td>
                          <td class="number">${p.extraPoints}</td>
                          <td class="number">${p.totalPoints}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          </div>
          
          <!-- Defense Section -->
          ${game.defense.length > 0 ? `
            <div class="modal-section">
              <h3 class="modal-section-title">Defense</h3>
              <div style="overflow-x: auto;">
                <table class="game-player-stats-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th class="number">TKL</th>
                      <th class="number">TFL</th>
                      <th class="number">SCK</th>
                      <th class="number">INT</th>
                      <th class="number">PD</th>
                      <th class="number">FF</th>
                      <th class="number">FR</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${game.defense.map(p => `
                      <tr>
                        <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                        <td class="number">${p.tackles}</td>
                        <td class="number">${p.tacklesForLoss}</td>
                        <td class="number">${p.sacks}</td>
                        <td class="number">${p.interceptions}</td>
                        <td class="number">${p.passesDefensed}</td>
                        <td class="number">${p.forcedFumbles}</td>
                        <td class="number">${p.fumblesRecovered}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
          
          <!-- Kicking Section -->
          ${game.kicking.length > 0 ? `
            <div class="modal-section">
              <h3 class="modal-section-title">Kicking</h3>
              <div style="overflow-x: auto;">
                <table class="game-player-stats-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th class="number">FG</th>
                      <th class="number">XP</th>
                      <th class="number">KO</th>
                      <th class="number">KO YDS</th>
                      <th class="number">PUNT</th>
                      <th class="number">P YDS</th>
                      <th class="number">P LNG</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${game.kicking.map(p => `
                      <tr>
                        <td>#${p.jerseyNumber ?? '--'} ${escapeHtml(p.name)}</td>
                        <td class="number">${p.fgMade}/${p.fgAttempts}</td>
                        <td class="number">${p.xpMade}/${p.xpAttempts}</td>
                        <td class="number">${p.kickoffs}</td>
                        <td class="number">${p.kickoffYards}</td>
                        <td class="number">${p.punts}</td>
                        <td class="number">${p.puntYards}</td>
                        <td class="number">${p.puntLong}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
};

// Generate all game modals
const generateAllGameModals = (data: SeasonStatsExport): string => {
  return Object.values(data.gameDetails)
    .map(game => generateGameModal(game, data.teamName))
    .join('');
};

/**
 * Generate complete HTML page
 */
export const generatePublicSiteHtml = (data: SeasonStatsExport): string => {
  const primaryColor = data.branding?.primaryColor || '#1a365d';
  const secondaryColor = data.branding?.secondaryColor || '#2b6cb0';
  
  const teamDisplay = data.mascot 
    ? `${data.teamName} ${data.mascot}`
    : data.teamName;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(teamDisplay)} - ${data.season.year} ${data.season.label} Stats</title>
  <meta name="description" content="Football statistics for ${escapeHtml(teamDisplay)} ${data.season.year} ${data.season.label} season. Record: ${data.record.display}">
  <style>${generateStyles(primaryColor, secondaryColor)}</style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <header class="team-header">
      ${data.branding?.logoUrl ? `<img src="${data.branding.logoUrl}" alt="${escapeHtml(data.teamName)} logo" class="team-logo">` : ''}
      <h1>${escapeHtml(teamDisplay)}</h1>
      <div class="team-record">${data.record.display}</div>
      <div class="team-season">${data.season.year} ${escapeHtml(data.season.label)} (${data.season.level})</div>
    </header>
    
    <!-- Navigation -->
    <nav class="nav-tabs">
      <button class="nav-tab active" onclick="showTab('schedule')">Schedule</button>
      <button class="nav-tab" onclick="showTab('leaders')">Team Leaders</button>
      <button class="nav-tab" onclick="showTab('stats')">Stats</button>
      <button class="nav-tab" onclick="showTab('roster')">Roster</button>
    </nav>
    
    <!-- Schedule Tab -->
    <div id="tab-schedule" class="tab-content active">
      <div class="card">
        <h2 class="card-title">Schedule & Results</h2>
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 12px;">Click a completed game to view detailed stats</p>
        ${generateScheduleHtml(data.schedule, Object.keys(data.gameDetails).length > 0)}
      </div>
      
      <div class="card">
        <h2 class="card-title">Team Stats</h2>
        <div class="stats-summary">
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.pointsFor}</div>
            <div class="stat-box-label">Points For</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.pointsAgainst}</div>
            <div class="stat-box-label">Points Against</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.totalOffensiveYards}</div>
            <div class="stat-box-label">Total Yards</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.rushingYards}</div>
            <div class="stat-box-label">Rushing Yards</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.passingYards}</div>
            <div class="stat-box-label">Passing Yards</div>
          </div>
          <div class="stat-box">
            <div class="stat-box-value">${data.teamStats.yardsPerGame.toFixed(1)}</div>
            <div class="stat-box-label">Yards/Game</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Team Leaders Tab -->
    <div id="tab-leaders" class="tab-content">
      <div class="card">
        <h2 class="card-title">Offensive Leaders</h2>
        ${generateLeadersHtml(data.leaders.offense)}
      </div>
      
      <div class="card">
        <h2 class="card-title">Defensive Leaders</h2>
        ${generateLeadersHtml(data.leaders.defense)}
      </div>
      
      ${data.leaders.specialTeams.length > 0 ? `
        <div class="card">
          <h2 class="card-title">Special Teams Leaders</h2>
          ${generateLeadersHtml(data.leaders.specialTeams)}
        </div>
      ` : ''}
    </div>
    
    <!-- Stats Tab -->
    <div id="tab-stats" class="tab-content">
      <div class="card">
        <h2 class="card-title">Player Statistics</h2>
        
        <div class="stats-tabs">
          <button class="stats-tab active" onclick="showStatsSection('rushing')">Rushing</button>
          <button class="stats-tab" onclick="showStatsSection('passing')">Passing</button>
          <button class="stats-tab" onclick="showStatsSection('receiving')">Receiving</button>
          <button class="stats-tab" onclick="showStatsSection('defense')">Defense</button>
          <button class="stats-tab" onclick="showStatsSection('kicking')">Kicking</button>
          <button class="stats-tab" onclick="showStatsSection('returns')">Returns</button>
        </div>
        
        <div id="stats-rushing" class="stats-section active">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Rushing</h3>
          ${generateRushingTable(data.playerStats)}
        </div>
        
        <div id="stats-passing" class="stats-section">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Passing</h3>
          ${generatePassingTable(data.playerStats)}
        </div>
        
        <div id="stats-receiving" class="stats-section">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Receiving</h3>
          ${generateReceivingTable(data.playerStats)}
        </div>
        
        <div id="stats-defense" class="stats-section">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Defense</h3>
          ${generateDefenseTable(data.playerStats)}
        </div>
        
        <div id="stats-kicking" class="stats-section">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Kicking</h3>
          ${generateKickingTable(data.playerStats)}
        </div>
        
        <div id="stats-returns" class="stats-section">
          <h3 style="margin-bottom: 12px; color: var(--text-secondary);">Returns</h3>
          ${generateReturnsTable(data.playerStats)}
        </div>
      </div>
    </div>
    
    <!-- Roster Tab -->
    <div id="tab-roster" class="tab-content">
      <div class="card">
        <h2 class="card-title">Roster</h2>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 16px;">Click a player to view detailed stats</p>
        ${generateRosterHtml(data.roster, data.playerStats, data.playerGameStats)}
      </div>
    </div>
    
    <!-- Player Modals -->
    ${generateAllPlayerModals(data)}
    
    <!-- Game Modals -->
    ${generateAllGameModals(data)}
    
    <!-- Footer -->
    <footer class="site-footer">
      <p>Generated on ${data.generatedAt.toLocaleDateString()}</p>
      <p>Powered by PL Stats</p>
    </footer>
  </div>
  
  <script>
    function showTab(tabId) {
      // Hide all tabs
      document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
      });
      document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Show selected tab
      document.getElementById('tab-' + tabId).classList.add('active');
      event.target.classList.add('active');
    }
    
    function showStatsSection(sectionId) {
      // Hide all sections
      document.querySelectorAll('.stats-section').forEach(section => {
        section.classList.remove('active');
      });
      document.querySelectorAll('.stats-tab').forEach(btn => {
        btn.classList.remove('active');
      });
      
      // Show selected section
      document.getElementById('stats-' + sectionId).classList.add('active');
      event.target.classList.add('active');
    }
    
    // Player modal functions
    function showPlayerModal(playerId) {
      const modal = document.getElementById('modal-' + playerId);
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    
    function hidePlayerModal(playerId) {
      const modal = document.getElementById('modal-' + playerId);
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    
    function closePlayerModal(event, playerId) {
      // Close if clicking on the overlay (not the modal content)
      if (event.target.classList.contains('modal-overlay')) {
        hidePlayerModal(playerId);
      }
    }
    
    // Game modal functions
    function showGameModal(gameId) {
      const modal = document.getElementById('game-modal-' + gameId);
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }
    
    function hideGameModal(gameId) {
      const modal = document.getElementById('game-modal-' + gameId);
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
    
    function closeGameModal(event, gameId) {
      if (event.target.classList.contains('modal-overlay')) {
        hideGameModal(gameId);
      }
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal-overlay.active');
        if (activeModal) {
          activeModal.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });
    
    // Make roster player cards keyboard accessible
    document.querySelectorAll('.roster-player').forEach(function(card) {
      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });
    
    // Make schedule games keyboard accessible
    document.querySelectorAll('.schedule-game.clickable').forEach(function(game) {
      game.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          game.click();
        }
      });
    });
  </script>
</body>
</html>`;
};

/**
 * Download HTML as file
 */
export const downloadPublicSiteHtml = (data: SeasonStatsExport): void => {
  const html = generatePublicSiteHtml(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.teamName.toLowerCase().replace(/\s+/g, '-')}-${data.season.year}-stats.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Open HTML in new window for preview
 */
export const previewPublicSite = (data: SeasonStatsExport): void => {
  const html = generatePublicSiteHtml(data);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

export { };
