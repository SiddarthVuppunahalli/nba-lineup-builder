import type {
  LineupAnalysisResponse,
  LineupIntentDto,
  ScenarioRepairSnapshotDto,
  SessionVersionSourceDto,
} from '@lineup-engine/shared';

export type SessionVersionSource = SessionVersionSourceDto;

export interface SessionLineupVersion {
  id: string;
  teamId: string;
  name: string;
  playerIds: [string, string, string, string, string];
  source: SessionVersionSource;
  parentVersionId?: string;
  analysis: LineupAnalysisResponse;
  intent?: LineupIntentDto;
  repair?: ScenarioRepairSnapshotDto;
  dataVersion?: string;
  scoringVersion?: string;
  createdAt?: string;
}

export interface SessionVersionDraft {
  name: string;
  playerIds: readonly string[];
  source: SessionVersionSource;
  analysis: LineupAnalysisResponse;
  intent?: LineupIntentDto;
  repair?: ScenarioRepairSnapshotDto;
}
