export type SessionVersionSource = 'manual' | 'generated' | 'repaired';

export interface SessionLineupVersion {
  id: string;
  teamId: string;
  name: string;
  playerIds: [string, string, string, string, string];
  source: SessionVersionSource;
  parentVersionId?: string;
}
