export const LINEUP_SIZE = 5;

export type MetricName =
  | 'shooting'
  | 'creation'
  | 'playmaking'
  | 'rebounding'
  | 'perimeterDefense'
  | 'interiorDefense'
  | 'switchability';

export interface Player {
  id: string;
  name: string;
  teamId: string;
  position: string;
}

export interface PlayerProfile {
  playerId: string;
  shooting: number;
  creation: number;
  playmaking: number;
  rebounding: number;
  perimeterDefense: number;
  interiorDefense: number;
  switchability: number;
  metadata?: {
    sourceSeason?: string;
  };
}

export type LineupPlayerIds = [string, string, string, string, string];

export interface Lineup {
  playerIds: LineupPlayerIds;
}

export interface MetricEvidence {
  id: string;
  kind: 'player-score' | 'rule-adjustment';
  label: string;
  value: number;
  description: string;
  playerId?: string;
}

export interface MetricScore {
  score: number;
  evidence: MetricEvidence[];
}

export type FindingType =
  | 'spacing'
  | 'creation'
  | 'playmaking'
  | 'rebounding'
  | 'perimeter-defense'
  | 'interior-defense'
  | 'switchability'
  | 'role-overlap'
  | 'constraint';

export interface LineupFinding {
  id: string;
  type: FindingType;
  severity: 'strength' | 'info' | 'concern';
  title: string;
  description: string;
  affectedPlayerIds?: string[];
  evidence?: MetricEvidence[];
}

export interface LineupAnalysis {
  shooting: MetricScore;
  creation: MetricScore;
  playmaking: MetricScore;
  rebounding: MetricScore;
  perimeterDefense: MetricScore;
  interiorDefense: MetricScore;
  switchability: MetricScore;
  findings: LineupFinding[];
}

export interface Team {
  id: string;
  name: string;
  abbreviation: string;
}

export interface EvaluatedPlayer {
  player: Player;
  profile: PlayerProfile;
}
