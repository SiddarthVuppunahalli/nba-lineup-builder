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
  position: z.string().min(1),
  profile: playerProfileSchema,
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
  requiredPlayerIds: z.array(z.string().trim().min(1)).max(20),
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

export const generatedLineupResponseSchema = z.object({
  winner: generatedLineupCandidateSchema,
  alternatives: z.array(generatedLineupCandidateSchema).max(2),
  appliedPriorities: z.object(metricRecordShape),
  usedBalancedDefault: z.boolean(),
  evaluatedCandidateCount: z.number().int().nonnegative(),
  validCandidateCount: z.number().int().positive(),
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
export type GeneratedLineupResponse = z.infer<typeof generatedLineupResponseSchema>;
export type RepairLineupRequest = z.infer<typeof repairLineupRequestSchema>;
export type InterpretIntentRequest = z.infer<typeof interpretIntentRequestSchema>;
export type IntentInterpreterStatusResponse = z.infer<typeof intentInterpreterStatusResponseSchema>;
export type InterpretedIntentResponse = z.infer<typeof interpretedIntentResponseSchema>;
export type MetricComparisonDto = z.infer<typeof metricComparisonSchema>;
export type LineupComparisonDto = z.infer<typeof lineupComparisonSchema>;
export type RepairedLineupResponse = z.infer<typeof repairedLineupResponseSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
