import type { Player, Team } from '@lineup-engine/basketball-engine';

import { derivePlayerProfile } from './normalize-profile.js';
import type { LineupPool, RawSeasonPlayer, SnapshotSource } from './types.js';

const SPURS: Team = {
  id: 'nba-2026-27-sas',
  name: 'San Antonio Spurs',
  abbreviation: 'SAS',
};

export const SPURS_CURRENT_SOURCE: SnapshotSource = {
  id: 'nba-roster-2026-09-14-bref-2025-26-v1',
  label: 'Current Spurs roster with completed 2025–26 profiles',
  url: 'https://www.nba.com/team/1610612759',
  season: '2026–27 roster · 2025–26 stats',
  snapshotDate: '2026-09-14',
  methodologyVersion: 'box-score-profile-v1',
};

const CURRENT_ROSTER = [
  ["Ja'Kobi Gillespie", 'PG'],
  ['Maliq Brown', 'PF'],
  ['Jordan McLaughlin', 'PG'],
  ['Victor Wembanyama', 'C'],
  ['Dylan Harper', 'SG'],
  ['Keldon Johnson', 'SF'],
  ["De'Aaron Fox", 'PG'],
  ['Taelon Peter', 'SG'],
  ['Stephon Castle', 'PG'],
  ['Luke Kornet', 'C'],
  ['Tarris Reed Jr.', 'C'],
  ['Carter Bryant', 'PF'],
  ['Jayden Quaintance', 'PF'],
  ['Tobias Harris', 'PF'],
  ['Devin Vassell', 'SG'],
  ['David Jones García', 'SF'],
  ['Julian Champagnie', 'SF'],
  ['Harrison Barnes', 'PF'],
] as const;

const RAW_2025_26: readonly RawSeasonPlayer[] = [
  raw(
    'Jordan McLaughlin',
    'PG',
    44,
    6.4,
    0.425,
    0.9,
    0.542,
    14.5,
    17.2,
    15.5,
    0.7,
    9.3,
    3.4,
    0.6,
    2.5,
  ),
  raw(
    'Victor Wembanyama',
    'C',
    64,
    29.2,
    0.349,
    5.5,
    0.626,
    32.4,
    17.6,
    10.8,
    11.5,
    33.9,
    1.7,
    9.4,
    4.2,
  ),
  raw(
    'Dylan Harper',
    'SG',
    69,
    22.6,
    0.343,
    2.6,
    0.574,
    21.8,
    24.7,
    12.3,
    3.4,
    12.1,
    1.7,
    1.4,
    1.1,
  ),
  raw('Keldon Johnson', 'SF', 82, 23.3, 0.363, 3.3, 0.613, 21, 8.5, 7.4, 5.4, 16.6, 1.2, 0.5, -0.3),
  raw("De'Aaron Fox", 'PG', 72, 31, 0.332, 5.5, 0.578, 24.9, 29.6, 12.4, 3.8, 10.7, 1.9, 0.8, 0.6),
  raw(
    'Taelon Peter',
    'SG',
    38,
    12.9,
    0.328,
    3.3,
    0.518,
    16.6,
    11.2,
    14.1,
    1.6,
    11.1,
    2.5,
    0.7,
    -0.4,
    'IND',
  ),
  raw('Stephon Castle', 'PG', 68, 30, 0.332, 3.6, 0.575, 24.9, 34.5, 18, 5.3, 13.5, 1.8, 0.8, 0.9),
  raw('Luke Kornet', 'C', 68, 21, 0, 0, 0.689, 10.3, 11.3, 8, 6.1, 17, 1.1, 4, 2.1),
  raw(
    'Carter Bryant',
    'PF',
    71,
    11.5,
    0.335,
    2.2,
    0.526,
    16.3,
    7.5,
    10.4,
    2.5,
    17.9,
    0.9,
    2.5,
    0.2,
  ),
  raw(
    'Tobias Harris',
    'PF',
    63,
    27.7,
    0.368,
    3.5,
    0.574,
    18.8,
    12.5,
    8,
    5.1,
    16.9,
    1.6,
    1.5,
    0.8,
    'DET',
  ),
  raw('Devin Vassell', 'SG', 67, 30.5, 0.384, 6.4, 0.574, 18, 11, 6.9, 4, 11.8, 1.3, 1.1, 0.3),
  raw(
    'David Jones García',
    'SF',
    11,
    6.2,
    0.6,
    0.5,
    0.579,
    20.2,
    37.2,
    15.3,
    1.2,
    13.8,
    4.2,
    1.3,
    3.8,
  ),
  raw(
    'Julian Champagnie',
    'SF',
    82,
    27.6,
    0.381,
    6.2,
    0.609,
    15.2,
    7.3,
    8.4,
    5.8,
    18.4,
    1.3,
    1.5,
    0.8,
  ),
  raw(
    'Harrison Barnes',
    'PF',
    77,
    25.8,
    0.388,
    4.6,
    0.608,
    14.6,
    9.7,
    8.8,
    2.8,
    7.9,
    1.2,
    0.5,
    0.1,
  ),
];

function raw(
  name: string,
  position: string,
  games: number,
  minutesPerGame: number,
  threePointPct: number,
  threePointAttemptsPerGame: number,
  trueShootingPct: number,
  usagePct: number,
  assistPct: number,
  turnoverPct: number,
  reboundsPerGame: number,
  defensiveReboundPct: number,
  stealPct: number,
  blockPct: number,
  defensiveBoxPlusMinus: number,
  teamAbbreviation = 'SAS',
): RawSeasonPlayer {
  return {
    teamAbbreviation,
    name,
    position,
    games,
    minutesPerGame,
    threePointPct,
    threePointAttemptsPerGame,
    trueShootingPct,
    usagePct,
    assistPct,
    turnoverPct,
    reboundsPerGame,
    defensiveReboundPct,
    stealPct,
    blockPct,
    defensiveBoxPlusMinus,
  };
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const players: Player[] = CURRENT_ROSTER.map(([name, position]) => ({
  id: `nba-2026-27-sas-${slug(name)}`,
  name,
  position,
  teamId: SPURS.id,
}));
const playerIdByName = new Map(players.map((player) => [player.name, player.id]));
const MINIMUM_PROFILE_MINUTES = 400;
const eligibleRawRows = RAW_2025_26.filter(
  (row) => row.games * row.minutesPerGame >= MINIMUM_PROFILE_MINUTES,
);
const profiles = eligibleRawRows.map((row) =>
  derivePlayerProfile(playerIdByName.get(row.name)!, row, {
    sourceSeason: '2025-26',
    sourceId: 'basketball-reference-2025-26-v1',
    methodologyVersion: SPURS_CURRENT_SOURCE.methodologyVersion,
  }),
);
const rawByName = new Map(RAW_2025_26.map((row) => [row.name, row]));
const profileUnavailableReasons = new Map(
  players
    .filter((player) => !profiles.some((profile) => profile.playerId === player.id))
    .map((player) => {
      const rawRow = rawByName.get(player.name);
      return [
        player.id,
        rawRow
          ? `The 2025–26 sample was ${Math.round(rawRow.games * rawRow.minutesPerGame)} minutes, below the ${MINIMUM_PROFILE_MINUTES}-minute minimum.`
          : 'No completed 2025–26 NBA regular-season profile is available.',
      ] as const;
    }),
);

export const SPURS_CURRENT_POOL: LineupPool = {
  team: SPURS,
  mode: 'team',
  source: SPURS_CURRENT_SOURCE,
  isDemo: false,
  searchStrategy: 'exhaustive',
  players,
  profiles,
  teamAbbreviations: new Map([[SPURS.id, SPURS.abbreviation]]),
  profileUnavailableReasons,
};
