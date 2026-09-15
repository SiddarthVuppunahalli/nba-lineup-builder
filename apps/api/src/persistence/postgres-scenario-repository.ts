import { randomUUID } from 'node:crypto';

import type { SavedScenario, SavedScenarioSummary } from '@lineup-engine/shared';
import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { savedScenarios, savedScenarioVersions } from './schema.js';
import type { ScenarioRepository, ScenarioWrite } from './scenario-repository.js';

type Database = ReturnType<typeof drizzle>;

export interface PostgresScenarioRepositoryHandle {
  repository: ScenarioRepository;
  close: () => Promise<void>;
}

export function createPostgresScenarioRepository(
  databaseUrl: string,
): PostgresScenarioRepositoryHandle {
  const client = postgres(databaseUrl, { max: 5 });
  const db = drizzle(client);
  return {
    repository: new PostgresScenarioRepository(db),
    close: () => client.end(),
  };
}

class PostgresScenarioRepository implements ScenarioRepository {
  constructor(private readonly db: Database) {}

  async list(ownerKey: string): Promise<SavedScenarioSummary[]> {
    const rows = await this.db
      .select()
      .from(savedScenarios)
      .where(eq(savedScenarios.ownerKey, ownerKey))
      .orderBy(desc(savedScenarios.updatedAt));
    if (rows.length === 0) return [];
    const counts = await this.db
      .select({ scenarioId: savedScenarioVersions.scenarioId, value: count() })
      .from(savedScenarioVersions)
      .where(
        inArray(
          savedScenarioVersions.scenarioId,
          rows.map((row) => row.id),
        ),
      )
      .groupBy(savedScenarioVersions.scenarioId);
    const countById = new Map(counts.map((row) => [row.scenarioId, row.value]));
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      teamId: row.teamId,
      versionCount: countById.get(row.id) ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async get(ownerKey: string, scenarioId: string): Promise<SavedScenario | undefined> {
    const [scenario] = await this.db
      .select()
      .from(savedScenarios)
      .where(and(eq(savedScenarios.id, scenarioId), eq(savedScenarios.ownerKey, ownerKey)))
      .limit(1);
    if (!scenario) return undefined;
    const versions = await this.db
      .select()
      .from(savedScenarioVersions)
      .where(eq(savedScenarioVersions.scenarioId, scenarioId))
      .orderBy(asc(savedScenarioVersions.ordinal));
    return {
      id: scenario.id,
      name: scenario.name,
      teamId: scenario.teamId,
      selectedPlayerIds: scenario.selectedPlayerIds,
      ...(scenario.activeParentClientVersionId
        ? { activeParentClientVersionId: scenario.activeParentClientVersionId }
        : {}),
      versions: versions.map((version) => ({
        clientVersionId: version.clientVersionId,
        ...(version.parentClientVersionId
          ? { parentClientVersionId: version.parentClientVersionId }
          : {}),
        name: version.name,
        source: version.source as SavedScenario['versions'][number]['source'],
        playerIds: version.playerIds,
        ...(version.intent ? { intent: version.intent } : {}),
        ...(version.repair ? { repair: version.repair } : {}),
        analysis: version.analysis,
        dataVersion: version.dataVersion,
        scoringVersion: version.scoringVersion,
        createdAt: version.createdAt,
      })),
      createdAt: scenario.createdAt,
      updatedAt: scenario.updatedAt,
    };
  }

  async save(ownerKey: string, write: ScenarioWrite, scenarioId?: string) {
    const id = scenarioId ?? randomUUID();
    const saved = await this.db.transaction(async (transaction) => {
      const [existing] = scenarioId
        ? await transaction
            .select({ createdAt: savedScenarios.createdAt })
            .from(savedScenarios)
            .where(and(eq(savedScenarios.id, id), eq(savedScenarios.ownerKey, ownerKey)))
            .limit(1)
        : [];
      if (scenarioId && !existing) return undefined;
      const now = new Date().toISOString();
      const row = {
        id,
        ownerKey,
        name: write.name,
        teamId: write.teamId,
        selectedPlayerIds: write.selectedPlayerIds,
        activeParentClientVersionId: write.activeParentClientVersionId ?? null,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      if (existing) {
        await transaction.update(savedScenarios).set(row).where(eq(savedScenarios.id, id));
        await transaction
          .delete(savedScenarioVersions)
          .where(eq(savedScenarioVersions.scenarioId, id));
      } else {
        await transaction.insert(savedScenarios).values(row);
      }
      await transaction.insert(savedScenarioVersions).values(
        write.versions.map((version, ordinal) => ({
          id: randomUUID(),
          scenarioId: id,
          ordinal,
          clientVersionId: version.clientVersionId,
          parentClientVersionId: version.parentClientVersionId ?? null,
          name: version.name,
          source: version.source,
          playerIds: version.playerIds,
          intent: version.intent ?? null,
          repair: version.repair ?? null,
          analysis: version.analysis,
          dataVersion: version.dataVersion,
          scoringVersion: version.scoringVersion,
          createdAt: version.createdAt,
        })),
      );
      return true;
    });
    return saved ? this.get(ownerKey, id) : undefined;
  }
}
