import {
  apiErrorResponseSchema,
  analyzeLineupRequestSchema,
  healthResponseSchema,
  lineupAnalysisResponseSchema,
  rosterResponseSchema,
  teamsResponseSchema,
  type AnalyzeLineupRequest,
  type HealthResponse,
  type LineupAnalysisResponse,
  type RosterResponse,
  type TeamsResponse,
} from '@lineup-engine/shared';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
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
