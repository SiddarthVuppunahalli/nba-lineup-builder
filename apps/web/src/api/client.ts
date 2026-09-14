import {
  apiErrorResponseSchema,
  analyzeLineupRequestSchema,
  comparedLineupsResponseSchema,
  compareLineupsRequestSchema,
  healthResponseSchema,
  generateLineupRequestSchema,
  generatedLineupResponseSchema,
  intentInterpreterStatusResponseSchema,
  interpretedIntentResponseSchema,
  interpretIntentRequestSchema,
  lineupAnalysisResponseSchema,
  repairLineupRequestSchema,
  repairedLineupResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type AnalyzeLineupRequest,
  type ComparedLineupsResponse,
  type CompareLineupsRequest,
  type HealthResponse,
  type GenerateLineupRequest,
  type GeneratedLineupResponse,
  type IntentInterpreterStatusResponse,
  type InterpretedIntentResponse,
  type InterpretIntentRequest,
  type LineupAnalysisResponse,
  type RepairLineupRequest,
  type RepairedLineupResponse,
  type RosterResponse,
  type TeamsResponse,
} from '@lineup-engine/shared';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  const body: unknown = await response.json();

  if (!response.ok) {
    const parsedError = apiErrorResponseSchema.safeParse(body);
    throw new ApiClientError(
      parsedError.success ? parsedError.data.error.message : 'The API request failed.',
      response.status,
      parsedError.success ? parsedError.data.error.code : 'UNKNOWN_API_ERROR',
      parsedError.success ? (parsedError.data.error.details ?? []) : [],
    );
  }

  return body;
}

export async function fetchHealth(): Promise<HealthResponse> {
  return healthResponseSchema.parse(await requestJson('/api/health'));
}

export async function fetchTeams(): Promise<TeamsResponse> {
  return teamsResponseSchema.parse(await requestJson('/api/teams'));
}

export async function fetchRoster(teamId: string): Promise<RosterResponse> {
  return rosterResponseSchema.parse(
    await requestJson(`/api/teams/${encodeURIComponent(teamId)}/players`),
  );
}

export async function fetchIntentInterpreterStatus(): Promise<IntentInterpreterStatusResponse> {
  return intentInterpreterStatusResponseSchema.parse(await requestJson('/api/intents/status'));
}

export async function postIntentInterpretation(
  request: InterpretIntentRequest,
): Promise<InterpretedIntentResponse> {
  const validatedRequest = interpretIntentRequestSchema.parse(request);
  return interpretedIntentResponseSchema.parse(
    await requestJson('/api/intents/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    }),
  );
}

export async function postLineupAnalysis(
  request: AnalyzeLineupRequest,
): Promise<LineupAnalysisResponse> {
  const validatedRequest = analyzeLineupRequestSchema.parse(request);

  return lineupAnalysisResponseSchema.parse(
    await requestJson('/api/lineups/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    }),
  );
}

export async function postLineupGeneration(
  request: GenerateLineupRequest,
): Promise<GeneratedLineupResponse> {
  const validatedRequest = generateLineupRequestSchema.parse(request);

  return generatedLineupResponseSchema.parse(
    await requestJson('/api/lineups/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    }),
  );
}

export async function postLineupRepair(
  request: RepairLineupRequest,
): Promise<RepairedLineupResponse> {
  const validatedRequest = repairLineupRequestSchema.parse(request);

  return repairedLineupResponseSchema.parse(
    await requestJson('/api/lineups/repair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    }),
  );
}

export async function postLineupComparison(
  request: CompareLineupsRequest,
): Promise<ComparedLineupsResponse> {
  const validatedRequest = compareLineupsRequestSchema.parse(request);

  return comparedLineupsResponseSchema.parse(
    await requestJson('/api/lineups/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validatedRequest),
    }),
  );
}
