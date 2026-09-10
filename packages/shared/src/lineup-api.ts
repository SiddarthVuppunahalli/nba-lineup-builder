import { z } from 'zod';

const normalizedScoreSchema = z.number().min(0).max(100);

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
  kind: z.enum(['player-score', 'rule-adjustment']),
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
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
