export const LINEUP_SIZE = 5;

export type MetricName =
  | 'shooting'
  | 'creation'
  | 'playmaking'
  | 'rebounding'
  | 'perimeterDefense'
  | 'interiorDefense'
  | 'switchability';

export const METRIC_NAMES: readonly MetricName[] = [
  'shooting',
  'creation',
  'playmaking',
  'rebounding',
  'perimeterDefense',
  'interiorDefense',
  'switchability',
];

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
    sourceId?: string;
    methodologyVersion?: string;
  };
}

export type LineupPlayerIds = [string, string, string, string, string];

export interface Lineup {
  playerIds: LineupPlayerIds;
}

export interface MetricEvidence {
  id: string;
  kind: 'player-score' | 'weighted-component' | 'rule-adjustment';
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

export type MetricPriorities = Record<MetricName, number>;

export interface LineupIntent {
  priorities: MetricPriorities;
  minimumShooters: number;
  minimumCreators: number;
  metricMinimums: { [Metric in MetricName]?: number | undefined };
  requiredPlayerIds: readonly string[];
  excludedPlayerIds: readonly string[];
}

export type ConstraintKind = 'minimum-shooters' | 'minimum-creators' | 'metric-minimum';

export interface ConstraintResult {
  id: string;
  kind: ConstraintKind;
  label: string;
  satisfied: boolean;
  actual: number;
  required: number;
  description: string;
  metric?: MetricName;
}

export interface GeneratedLineupCandidate {
  lineup: Lineup;
  analysis: LineupAnalysis;
  objectiveScore: number;
  constraints: ConstraintResult[];
}

export interface MetricComparison {
  metric: MetricName;
  before: number;
  after: number;
  delta: number;
}

export interface LineupComparison {
  metrics: MetricComparison[];
  largestGain?: MetricComparison;
  largestTradeoff?: MetricComparison;
}

export interface ComparedLineups {
  before: GeneratedLineupCandidate;
  after: GeneratedLineupCandidate;
  removedPlayerIds: string[];
  addedPlayerIds: string[];
  retainedPlayerIds: string[];
  comparison: LineupComparison;
}

export interface RepairedLineup {
  before: GeneratedLineupCandidate;
  after: GeneratedLineupCandidate;
  swapCount: number;
  removedPlayerIds: string[];
  addedPlayerIds: string[];
  comparison: LineupComparison;
}
