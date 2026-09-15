import { randomUUID } from 'node:crypto';

import type { SavedScenario } from '@lineup-engine/shared';

import type { ScenarioRepository, ScenarioWrite } from './scenario-repository.js';

interface OwnedScenario {
  ownerKey: string;
  scenario: SavedScenario;
}

export class MemoryScenarioRepository implements ScenarioRepository {
  private readonly scenarios = new Map<string, OwnedScenario>();

  async list(ownerKey: string) {
    return [...this.scenarios.values()]
      .filter((entry) => entry.ownerKey === ownerKey)
      .map(({ scenario }) => ({
        id: scenario.id,
        name: scenario.name,
        teamId: scenario.teamId,
        versionCount: scenario.versions.length,
        createdAt: scenario.createdAt,
        updatedAt: scenario.updatedAt,
      }))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(ownerKey: string, scenarioId: string) {
    const entry = this.scenarios.get(scenarioId);
    return entry?.ownerKey === ownerKey ? structuredClone(entry.scenario) : undefined;
  }

  async save(ownerKey: string, write: ScenarioWrite, scenarioId?: string) {
    const existing = scenarioId ? this.scenarios.get(scenarioId) : undefined;
    if (scenarioId && (!existing || existing.ownerKey !== ownerKey)) return undefined;

    const now = new Date().toISOString();
    const scenario: SavedScenario = {
      ...structuredClone(write),
      id: scenarioId ?? randomUUID(),
      createdAt: existing?.scenario.createdAt ?? now,
      updatedAt: now,
    };
    this.scenarios.set(scenario.id, { ownerKey, scenario });
    return structuredClone(scenario);
  }
}
