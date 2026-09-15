import type {
  LineupAnalysisResponse,
  LineupIntentDto,
  ScenarioRepairSnapshotDto,
} from '@lineup-engine/shared';
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const savedScenarios = pgTable(
  'saved_scenarios',
  {
    id: uuid('id').primaryKey(),
    ownerKey: varchar('owner_key', { length: 64 }).notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    teamId: varchar('team_id', { length: 100 }).notNull(),
    selectedPlayerIds: jsonb('selected_player_ids').$type<string[]>().notNull(),
    activeParentClientVersionId: varchar('active_parent_client_version_id', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [index('saved_scenarios_owner_updated_idx').on(table.ownerKey, table.updatedAt)],
);

export const savedScenarioVersions = pgTable(
  'saved_scenario_versions',
  {
    id: uuid('id').primaryKey(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => savedScenarios.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    clientVersionId: varchar('client_version_id', { length: 100 }).notNull(),
    parentClientVersionId: varchar('parent_client_version_id', { length: 100 }),
    name: varchar('name', { length: 40 }).notNull(),
    source: varchar('source', { length: 20 }).notNull(),
    playerIds: jsonb('player_ids').$type<[string, string, string, string, string]>().notNull(),
    intent: jsonb('intent').$type<LineupIntentDto | null>(),
    repair: jsonb('repair').$type<ScenarioRepairSnapshotDto | null>(),
    analysis: jsonb('analysis').$type<LineupAnalysisResponse>().notNull(),
    dataVersion: varchar('data_version', { length: 160 }).notNull(),
    scoringVersion: varchar('scoring_version', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    uniqueIndex('saved_scenario_versions_client_id_idx').on(
      table.scenarioId,
      table.clientVersionId,
    ),
    index('saved_scenario_versions_scenario_ordinal_idx').on(table.scenarioId, table.ordinal),
  ],
);
