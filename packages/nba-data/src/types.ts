import type { Player, PlayerProfile, Team } from '@lineup-engine/basketball-engine';

export interface RawSeasonPlayer {
  teamAbbreviation: string;
  name: string;
  position: string;
  games: number;
  minutesPerGame: number;
  threePointPct: number;
  threePointAttemptsPerGame: number;
  trueShootingPct: number;
  usagePct: number;
  assistPct: number;
  turnoverPct: number;
  reboundsPerGame: number;
  defensiveReboundPct: number;
  stealPct: number;
  blockPct: number;
  defensiveBoxPlusMinus: number;
}

export interface SnapshotSource {
  id: string;
  label: string;
  url: string;
  season: string;
  snapshotDate: string;
  methodologyVersion: string;
  sourceUrls?: readonly string[];
  retrievalDate?: string;
  rosterDate?: string;
  statisticsSeason?: string;
  minimumProfileMinutes?: number;
  reconciliationVersion?: string;
}

export interface LineupPool {
  team: Team;
  mode: 'team' | 'league';
  source: SnapshotSource;
  isDemo: boolean;
  searchStrategy: 'exhaustive' | 'bounded';
  players: readonly Player[];
  profiles: readonly PlayerProfile[];
  teamAbbreviations: ReadonlyMap<string, string>;
  profileUnavailableReasons?: ReadonlyMap<string, string>;
}
