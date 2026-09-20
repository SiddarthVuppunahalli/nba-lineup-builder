import { z } from 'zod';

const normalizedScoreSchema = z.number().min(0).max(100);

export const metricNameSchema = z.enum([
  'shooting',
  'creation',
  'playmaking',
  'rebounding',
  'perimeterDefense',
  'interiorDefense',
  'switchability',
]);

const metricRecordShape = {
  shooting: z.number().min(0).max(1),
  creation: z.number().min(0).max(1),
  playmaking: z.number().min(0).max(1),
  rebounding: z.number().min(0).max(1),
  perimeterDefense: z.number().min(0).max(1),
  interiorDefense: z.number().min(0).max(1),
  switchability: z.number().min(0).max(1),
};

export const teamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  abbreviation: z.string().min(1),
  mode: z.enum(['team', 'league']).default('team'),
  season: z.string().min(1).default('Demo'),
  sourceLabel: z.string().min(1).default('Seeded fictional demo ratings'),
  sourceUrl: z.string().url().optional(),
  snapshotDate: z.string().min(1).default('unknown'),
  isDemo: z.boolean().default(true),
  searchStrategy: z.enum(['exhaustive', 'solver']).default('exhaustive'),
  rosterPlayerCount: z.number().int().nonnegative().optional(),
  profiledPlayerCount: z.number().int().nonnegative().optional(),
  defaultMinimumShooters: z.number().int().min(0).max(5).optional(),
  defaultMinimumCreators: z.number().int().min(0).max(5).optional(),
  scoringVersion: z.string().min(1).optional(),
  scoringLabel: z.string().min(1).optional(),
});

export const playerProfileSchema = z.object({
  shooting: normalizedScoreSchema,
  creation: normalizedScoreSchema,
  playmaking: normalizedScoreSchema,
  rebounding: normalizedScoreSchema,
  perimeterDefense: normalizedScoreSchema,
  interiorDefense: normalizedScoreSchema,
  switchability: normalizedScoreSchema,
});

export const rosterPlayerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  teamId: z.string().min(1),
  teamAbbreviation: z.string().min(1).default('MCM'),
  position: z.string().min(1),
  profileStatus: z.enum(['available', 'unavailable']).optional(),
  profileReason: z.string().min(1).optional(),
  profile: playerProfileSchema.optional(),
});

export const teamsResponseSchema = z.object({
  teams: z.array(teamSchema),
});

export const rosterResponseSchema = z.object({
  team: teamSchema,
  players: z.array(rosterPlayerSchema),
});

export const metricEvidenceSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['player-score', 'weighted-component', 'rule-adjustment']),
  label: z.string().min(1),
  value: z.number(),
  description: z.string().min(1),
  playerId: z.string().min(1).optional(),
});

export const metricScoreSchema = z.object({
  score: normalizedScoreSchema,
  evidence: z.array(metricEvidenceSchema),
});

export const lineupFindingSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'spacing',
    'creation',
    'playmaking',
    'rebounding',
    'perimeter-defense',
    'interior-defense',
    'switchability',
    'role-overlap',
    'constraint',
  ]),
  severity: z.enum(['strength', 'info', 'concern']),
  title: z.string().min(1),
  description: z.string().min(1),
  affectedPlayerIds: z.array(z.string()).optional(),
  evidence: z.array(metricEvidenceSchema).optional(),
});

export const lineupAnalysisSchema = z.object({
  shooting: metricScoreSchema,
  creation: metricScoreSchema,
  playmaking: metricScoreSchema,
  rebounding: metricScoreSchema,
  perimeterDefense: metricScoreSchema,
  interiorDefense: metricScoreSchema,
  switchability: metricScoreSchema,
  findings: z.array(lineupFindingSchema),
});

export const analyzeLineupRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  playerIds: z.array(z.string().trim().min(1)).max(20),
});

export const lineupAnalysisResponseSchema = z.object({
  lineup: z.object({
    playerIds: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  }),
  analysis: lineupAnalysisSchema,
});

export const lineupIntentSchema = z.object({
  priorities: z.object(metricRecordShape),
  minimumShooters: z.number().int().min(0).max(5),
  minimumCreators: z.number().int().min(0).max(5),
  metricMinimums: z
    .object({
      shooting: normalizedScoreSchema.optional(),
      creation: normalizedScoreSchema.optional(),
      playmaking: normalizedScoreSchema.optional(),
      rebounding: normalizedScoreSchema.optional(),
      perimeterDefense: normalizedScoreSchema.optional(),
      interiorDefense: normalizedScoreSchema.optional(),
      switchability: normalizedScoreSchema.optional(),
    })
    .default({}),
  requiredPlayerIds: z.array(z.string().trim().min(1)).max(5),
  excludedPlayerIds: z.array(z.string().trim().min(1)).max(20),
});

export const generateLineupRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  intent: lineupIntentSchema,
});

export const constraintResultSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['minimum-shooters', 'minimum-creators', 'metric-minimum']),
  label: z.string().min(1),
  satisfied: z.boolean(),
  actual: z.number(),
  required: z.number(),
  description: z.string().min(1),
  metric: metricNameSchema.optional(),
});

export const generatedLineupCandidateSchema = z.object({
  lineup: z.object({
    playerIds: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  }),
  analysis: lineupAnalysisSchema,
  objectiveScore: normalizedScoreSchema,
  constraints: z.array(constraintResultSchema),
});

export const lineupSearchMetadataSchema = z.object({
  strategy: z.enum(['exhaustive', 'cp-sat', 'bounded-shortlist']),
  eligiblePlayerCount: z.number().int().nonnegative(),
  searchedPlayerCount: z.number().int().nonnegative(),
  combinationLimit: z.number().int().positive(),
  exhausted: z.boolean(),
  optimalityGuaranteed: z.boolean(),
  solverStatus: z.enum(['optimal', 'feasible-time-limit', 'infeasible', 'fallback']).optional(),
  solverVersion: z.string().min(1).optional(),
  timeLimitMs: z.number().int().positive().optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
  objectiveValue: z.number().min(0).max(100).optional(),
  objectiveBound: z.number().min(0).max(100).optional(),
  objectiveGap: z.number().nonnegative().optional(),
  canonicalTieProven: z.boolean().optional(),
  minimumSwapsProven: z.boolean().optional(),
  incumbentSource: z.enum(['solver', 'bounded-seed']).optional(),
  fallbackReason: z.string().min(1).optional(),
});

export const generatedLineupResponseSchema = z.object({
  winner: generatedLineupCandidateSchema,
  alternatives: z.array(generatedLineupCandidateSchema).max(2),
  appliedPriorities: z.object(metricRecordShape),
  usedBalancedDefault: z.boolean(),
  evaluatedCandidateCount: z.number().int().nonnegative(),
  validCandidateCount: z.number().int().positive(),
  search: lineupSearchMetadataSchema.optional(),
});

export const repairLineupRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  currentPlayerIds: z.array(z.string().trim().min(1)).max(20),
  intent: lineupIntentSchema,
});

export const interpretIntentRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  text: z.string().trim().min(3).max(500),
});

export const intentInterpreterStatusResponseSchema = z.object({
  available: z.boolean(),
});

export const interpretedIntentResponseSchema = z.object({
  status: z.enum(['ready', 'needs_clarification']),
  intent: lineupIntentSchema,
  summary: z.string().min(1),
  assumptions: z.array(z.string().min(1)).max(10),
  questions: z.array(z.string().min(1)).max(5),
  provider: z.string().min(1),
  model: z.string().min(1),
});

export const metricComparisonSchema = z.object({
  metric: metricNameSchema,
  before: normalizedScoreSchema,
  after: normalizedScoreSchema,
  delta: z.number().min(-100).max(100),
});

export const lineupComparisonSchema = z.object({
  metrics: z.array(metricComparisonSchema).length(7),
  largestGain: metricComparisonSchema.optional(),
  largestTradeoff: metricComparisonSchema.optional(),
});

export const repairedLineupResponseSchema = z.object({
  repair: z.object({
    before: generatedLineupCandidateSchema,
    after: generatedLineupCandidateSchema,
    swapCount: z.number().int().min(0).max(5),
    removedPlayerIds: z.array(z.string()).max(5),
    addedPlayerIds: z.array(z.string()).max(5),
    comparison: lineupComparisonSchema,
  }),
  appliedPriorities: z.object(metricRecordShape),
  usedBalancedDefault: z.boolean(),
  evaluatedCandidateCount: z.number().int().nonnegative(),
  validCandidateCount: z.number().int().positive(),
  search: lineupSearchMetadataSchema.optional(),
});

export const compareLineupsRequestSchema = z.object({
  teamId: z.string().trim().min(1),
  beforePlayerIds: z.array(z.string().trim().min(1)).max(20),
  afterPlayerIds: z.array(z.string().trim().min(1)).max(20),
  intent: lineupIntentSchema.extend({
    requiredPlayerIds: z.array(z.never()).length(0),
    excludedPlayerIds: z.array(z.never()).length(0),
  }),
});

export const comparedLineupsResponseSchema = z.object({
  comparison: z.object({
    before: generatedLineupCandidateSchema,
    after: generatedLineupCandidateSchema,
    removedPlayerIds: z.array(z.string()).max(5),
    addedPlayerIds: z.array(z.string()).max(5),
    retainedPlayerIds: z.array(z.string()).max(5),
    comparison: lineupComparisonSchema,
  }),
  usedBalancedDefault: z.boolean(),
});

export const sessionVersionSourceSchema = z.enum(['manual', 'generated', 'repaired']);

export const scenarioRepairSnapshotSchema = z.object({
  startingPlayerIds: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  removedPlayerIds: z.array(z.string()).max(5),
  addedPlayerIds: z.array(z.string()).max(5),
  swapCount: z.number().int().min(0).max(5),
});

export const scenarioVersionInputSchema = z.object({
  clientVersionId: z.string().trim().min(1).max(100),
  parentClientVersionId: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(40),
  source: sessionVersionSourceSchema,
  playerIds: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  intent: lineupIntentSchema.optional(),
  repair: scenarioRepairSnapshotSchema.optional(),
});

export const saveScenarioRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  teamId: z.string().trim().min(1),
  selectedPlayerIds: z.array(z.string().trim().min(1)).max(5),
  activeParentClientVersionId: z.string().trim().min(1).max(100).optional(),
  versions: z.array(scenarioVersionInputSchema).min(1).max(100),
});

export const savedScenarioVersionSchema = scenarioVersionInputSchema.extend({
  analysis: lineupAnalysisResponseSchema,
  dataVersion: z.string().min(1),
  scoringVersion: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const savedScenarioSchema = saveScenarioRequestSchema.omit({ versions: true }).extend({
  id: z.uuid(),
  versions: z.array(savedScenarioVersionSchema).min(1).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const savedScenarioSummarySchema = savedScenarioSchema
  .omit({ versions: true, selectedPlayerIds: true, activeParentClientVersionId: true })
  .extend({ versionCount: z.number().int().positive() });

export const persistenceStatusResponseSchema = z.object({ available: z.boolean() });
export const savedScenariosResponseSchema = z.object({
  scenarios: z.array(savedScenarioSummarySchema),
});

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.array(z.unknown()).optional(),
  }),
});

export type TeamDto = z.infer<typeof teamSchema>;
export type PlayerProfileDto = z.infer<typeof playerProfileSchema>;
export type RosterPlayerDto = z.infer<typeof rosterPlayerSchema>;
export type TeamsResponse = z.infer<typeof teamsResponseSchema>;
export type RosterResponse = z.infer<typeof rosterResponseSchema>;
export type MetricEvidenceDto = z.infer<typeof metricEvidenceSchema>;
export type MetricScoreDto = z.infer<typeof metricScoreSchema>;
export type LineupFindingDto = z.infer<typeof lineupFindingSchema>;
export type LineupAnalysisDto = z.infer<typeof lineupAnalysisSchema>;
export type AnalyzeLineupRequest = z.infer<typeof analyzeLineupRequestSchema>;
export type LineupAnalysisResponse = z.infer<typeof lineupAnalysisResponseSchema>;
export type LineupIntentDto = z.infer<typeof lineupIntentSchema>;
export type GenerateLineupRequest = z.infer<typeof generateLineupRequestSchema>;
export type ConstraintResultDto = z.infer<typeof constraintResultSchema>;
export type GeneratedLineupCandidateDto = z.infer<typeof generatedLineupCandidateSchema>;
export type LineupSearchMetadataDto = z.infer<typeof lineupSearchMetadataSchema>;
export type GeneratedLineupResponse = z.infer<typeof generatedLineupResponseSchema>;
export type RepairLineupRequest = z.infer<typeof repairLineupRequestSchema>;
export type InterpretIntentRequest = z.infer<typeof interpretIntentRequestSchema>;
export type IntentInterpreterStatusResponse = z.infer<typeof intentInterpreterStatusResponseSchema>;
export type InterpretedIntentResponse = z.infer<typeof interpretedIntentResponseSchema>;
export type MetricComparisonDto = z.infer<typeof metricComparisonSchema>;
export type LineupComparisonDto = z.infer<typeof lineupComparisonSchema>;
export type RepairedLineupResponse = z.infer<typeof repairedLineupResponseSchema>;
export type CompareLineupsRequest = z.infer<typeof compareLineupsRequestSchema>;
export type ComparedLineupsResponse = z.infer<typeof comparedLineupsResponseSchema>;
export type SessionVersionSourceDto = z.infer<typeof sessionVersionSourceSchema>;
export type ScenarioRepairSnapshotDto = z.infer<typeof scenarioRepairSnapshotSchema>;
export type ScenarioVersionInput = z.infer<typeof scenarioVersionInputSchema>;
export type SaveScenarioRequest = z.infer<typeof saveScenarioRequestSchema>;
export type SavedScenarioVersion = z.infer<typeof savedScenarioVersionSchema>;
export type SavedScenario = z.infer<typeof savedScenarioSchema>;
export type SavedScenarioSummary = z.infer<typeof savedScenarioSummarySchema>;
export type PersistenceStatusResponse = z.infer<typeof persistenceStatusResponseSchema>;
export type SavedScenariosResponse = z.infer<typeof savedScenariosResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
