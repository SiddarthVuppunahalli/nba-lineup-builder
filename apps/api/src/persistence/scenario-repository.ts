import type { SavedScenario, SavedScenarioSummary } from '@lineup-engine/shared';

export type ScenarioWrite = Omit<SavedScenario, 'id' | 'createdAt' | 'updatedAt'>;

export interface ScenarioRepository {
  list(ownerKey: string): Promise<SavedScenarioSummary[]>;
  get(ownerKey: string, scenarioId: string): Promise<SavedScenario | undefined>;
  save(
    ownerKey: string,
    scenario: ScenarioWrite,
    scenarioId?: string,
  ): Promise<SavedScenario | undefined>;
}
