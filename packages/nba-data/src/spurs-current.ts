import { NBA_CURRENT_SOURCE, NBA_CURRENT_TEAM_POOLS } from './current-league.js';

export const SPURS_CURRENT_SOURCE = NBA_CURRENT_SOURCE;

export const SPURS_CURRENT_POOL = NBA_CURRENT_TEAM_POOLS.find(
  (pool) => pool.team.abbreviation === 'SAS',
)!;
