import type { Player, PlayerProfile, Team } from '@lineup-engine/basketball-engine';

import {
  CURRENT_GENERATION_COUNTS,
  CURRENT_PLAYERS,
  CURRENT_SOURCE_MANIFEST,
  CURRENT_TEAMS,
} from './current-league.generated.js';
import { derivePlayerProfile } from './normalize-profile.js';
import type { LineupPool, RawSeasonPlayer, SnapshotSource } from './types.js';
import { validateCurrentSnapshot } from './validate-current-snapshot.js';

export const CURRENT_ROSTER_DATE = CURRENT_SOURCE_MANIFEST.rosterDate;
export const CURRENT_RETRIEVAL_DATE = CURRENT_SOURCE_MANIFEST.retrievalDate;
export const CURRENT_STATS_SEASON = CURRENT_SOURCE_MANIFEST.statisticsSeason;
export const MINIMUM_PROFILE_MINUTES = 400;
export const CURRENT_RECONCILIATION_VERSION = 'nba-bref-name-reconciliation-v1';

export const NBA_CURRENT_SOURCE: SnapshotSource = {
  id: 'nba-rosters-2026-09-15-bref-2025-26-v1',
  label: 'Current NBA rosters with completed 2025–26 profiles',
  url: 'https://www.nba.com/players',
  sourceUrls: CURRENT_SOURCE_MANIFEST.sources.map((source) => source.url),
  season: '2026–27 rosters · 2025–26 stats',
  snapshotDate: CURRENT_ROSTER_DATE,
  retrievalDate: CURRENT_RETRIEVAL_DATE,
  rosterDate: CURRENT_ROSTER_DATE,
  statisticsSeason: CURRENT_STATS_SEASON,
  methodologyVersion: 'box-score-profile-v1',
  minimumProfileMinutes: MINIMUM_PROFILE_MINUTES,
  reconciliationVersion: CURRENT_RECONCILIATION_VERSION,
};

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const teams: Team[] = CURRENT_TEAMS.map((team) => ({
  id: `nba-2026-27-${team.abbreviation.toLowerCase()}`,
  name: `${team.city} ${team.name}`,
  abbreviation: team.abbreviation,
}));
const teamByNbaId = new Map(CURRENT_TEAMS.map((team, index) => [team.nbaTeamId, teams[index]!]));

const players: Player[] = CURRENT_PLAYERS.map((row) => {
  const team = teamByNbaId.get(row.teamNbaId);
  if (!team) throw new Error(`Current player ${row.nbaPlayerId} has no team.`);
  return {
    id: `${team.id}-${slug(row.name)}`,
    name: row.name,
    position: row.position ?? 'N/A',
    teamId: team.id,
  };
});
const rowByPlayerId = new Map(players.map((player, index) => [player.id, CURRENT_PLAYERS[index]!]));

const profiles: PlayerProfile[] = players.flatMap((player) => {
  const row = rowByPlayerId.get(player.id)!;
  if (!('stats' in row)) return [];
  const minutes = row.stats.games * row.stats.minutesPerGame;
  if (minutes < MINIMUM_PROFILE_MINUTES) return [];
  const raw: RawSeasonPlayer = {
    teamAbbreviation: row.stats.sourceTeam,
    name: row.stats.sourceName,
    position: row.stats.position,
    games: row.stats.games,
    minutesPerGame: row.stats.minutesPerGame,
    threePointPct: row.stats.threePointPct,
    threePointAttemptsPerGame: row.stats.threePointAttemptsPerGame,
    trueShootingPct: row.stats.trueShootingPct,
    usagePct: row.stats.usagePct,
    assistPct: row.stats.assistPct,
    turnoverPct: row.stats.turnoverPct,
    reboundsPerGame: row.stats.reboundsPerGame,
    defensiveReboundPct: row.stats.defensiveReboundPct,
    stealPct: row.stats.stealPct,
    blockPct: row.stats.blockPct,
    defensiveBoxPlusMinus: row.stats.defensiveBoxPlusMinus,
  };
  return [
    derivePlayerProfile(player.id, raw, {
      sourceSeason: CURRENT_STATS_SEASON,
      sourceId: 'basketball-reference-2025-26-v1',
      methodologyVersion: NBA_CURRENT_SOURCE.methodologyVersion,
    }),
  ];
});

const profileIds = new Set(profiles.map((profile) => profile.playerId));
const profileUnavailableReasons = new Map(
  players
    .filter((player) => !profileIds.has(player.id))
    .map((player) => {
      const row = rowByPlayerId.get(player.id)!;
      if (!('stats' in row)) {
        return [
          player.id,
          'noSampleReason' in row
            ? row.noSampleReason
            : 'No completed 2025–26 NBA regular-season profile is available.',
        ] as const;
      }
      const minutes = Math.round(row.stats.games * row.stats.minutesPerGame);
      return [
        player.id,
        `The 2025–26 sample was ${minutes} minutes, below the ${MINIMUM_PROFILE_MINUTES}-minute minimum.`,
      ] as const;
    }),
);

const teamAbbreviations = new Map(teams.map((team) => [team.id, team.abbreviation]));

export const NBA_CURRENT_TEAM_POOLS: readonly LineupPool[] = teams.map((team) => {
  const roster = players.filter((player) => player.teamId === team.id);
  const rosterIds = new Set(roster.map((player) => player.id));
  return {
    team,
    mode: 'team',
    source: NBA_CURRENT_SOURCE,
    isDemo: false,
    searchStrategy: 'exhaustive',
    players: roster,
    profiles: profiles.filter((profile) => rosterIds.has(profile.playerId)),
    teamAbbreviations,
    profileUnavailableReasons,
  };
});

validateCurrentSnapshot(
  NBA_CURRENT_TEAM_POOLS,
  NBA_CURRENT_SOURCE,
  CURRENT_GENERATION_COUNTS.rosterIdentities,
);

const CURRENT_LEAGUE_TEAM: Team = {
  id: 'nba-current-league-2026-09-15',
  name: 'Current NBA league',
  abbreviation: 'NBA',
};

export const NBA_CURRENT_LEAGUE_POOL: LineupPool = {
  team: CURRENT_LEAGUE_TEAM,
  mode: 'league',
  source: NBA_CURRENT_SOURCE,
  isDemo: false,
  searchStrategy: 'bounded',
  players,
  profiles,
  teamAbbreviations,
  profileUnavailableReasons,
};
