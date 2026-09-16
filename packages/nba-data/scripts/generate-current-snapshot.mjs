import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';

import {
  normalizeName,
  requireUnambiguousCandidate,
  selectSeasonRow,
} from './reconcile-current-sources.mjs';

const packageRoot = resolve(import.meta.dirname, '..');
const rawRoot = resolve(packageRoot, 'raw', 'current-2026-09-15');
const outputPath = resolve(packageRoot, 'src', 'current-league.generated.ts');

const rosterRows = readJson('nba-rosters.json');
const perGameRows = readJson('bref-per-game.json');
const advancedRows = readJson('bref-advanced.json');
const reconciliation = readJson('reconciliation.json');
const manifest = readJson('manifest.json');

function readJson(name) {
  return JSON.parse(readFileSync(resolve(rawRoot, name), 'utf8'));
}

function number(row, key) {
  const value = Number(row[key]);
  if (!Number.isFinite(value)) throw new Error(`Missing ${key} for ${row.name_display}.`);
  return value;
}

const perGameByName = new Map();
for (const row of perGameRows) {
  const key = normalizeName(row.name_display);
  const existing = perGameByName.get(key) ?? [];
  if (!existing.includes(row.playerKey)) existing.push(row.playerKey);
  perGameByName.set(key, existing);
}

const overrides = new Map(reconciliation.nameOverrides.map((item) => [item.nbaPlayerId, item]));
const confirmedNoSample = new Map(
  reconciliation.confirmedNoSample.map((item) => [item.nbaPlayerId, item.reason]),
);
const displayNames = new Map(
  reconciliation.displayNameOverrides.map((item) => [item.nbaPlayerId, item]),
);
const reconciled = [];
const unmatchedVeterans = [];
for (const roster of rosterRows) {
  const sourceName = `${roster.firstName} ${roster.lastName}`.trim();
  const name = displayNames.get(roster.nbaPlayerId)?.displayName ?? sourceName;
  const override = overrides.get(roster.nbaPlayerId);
  const candidateKeys = override
    ? [override.brefPlayerKey]
    : (perGameByName.get(normalizeName(sourceName)) ?? []);
  const playerKey = requireUnambiguousCandidate(name, candidateKeys);
  const perGame = playerKey ? selectSeasonRow(perGameRows, playerKey) : undefined;
  const advanced = playerKey ? selectSeasonRow(advancedRows, playerKey) : undefined;
  if (Boolean(perGame) !== Boolean(advanced)) {
    throw new Error(`Incomplete source join for ${name} (${playerKey}).`);
  }
  if (perGame && advanced && perGame.selection !== advanced.selection) {
    throw new Error(`Mismatched row selection for ${name}.`);
  }
  if (!perGame && roster.fromYear <= 2025 && !confirmedNoSample.has(roster.nbaPlayerId)) {
    unmatchedVeterans.push(`${roster.nbaPlayerId}:${name}`);
  }
  reconciled.push({ roster, name, playerKey, perGame, advanced, override });
}

if (unmatchedVeterans.length) {
  throw new Error(`Unreconciled veteran roster identities:\n${unmatchedVeterans.join('\n')}`);
}

const usedOverrideIds = new Set(reconciled.filter((item) => item.override).map((item) => item.roster.nbaPlayerId));
for (const id of overrides.keys()) {
  if (!usedOverrideIds.has(id)) throw new Error(`Unused reconciliation override ${id}.`);
}
for (const id of displayNames.keys()) {
  if (!reconciled.some((item) => item.roster.nbaPlayerId === id)) {
    throw new Error(`Unused display-name override ${id}.`);
  }
}

const teams = [...new Map(rosterRows.map((row) => [row.teamId, {
  nbaTeamId: row.teamId,
  city: row.teamCity,
  name: row.teamName,
  abbreviation: row.teamAbbreviation,
}])).values()].sort((a, b) => a.abbreviation.localeCompare(b.abbreviation));

if (teams.length !== 30) throw new Error(`Expected 30 teams, received ${teams.length}.`);
if (new Set(rosterRows.map((row) => row.nbaPlayerId)).size !== rosterRows.length) {
  throw new Error('Duplicate NBA player IDs or duplicate team membership detected.');
}

const players = reconciled.map(({ roster, name, playerKey, perGame, advanced, override }) => {
  let stats;
  if (perGame && advanced) {
    stats = {
      playerKey,
      sourceName: perGame.row.name_display,
      sourceTeam: perGame.row.team_name_abbr,
      rowSelection: perGame.selection,
      games: number(perGame.row, 'games'),
      minutesPerGame: number(perGame.row, 'mp_per_g'),
      position: advanced.row.pos,
      threePointPct: perGame.row.fg3_pct === '' ? 0 : number(perGame.row, 'fg3_pct'),
      threePointAttemptsPerGame: number(perGame.row, 'fg3a_per_g'),
      trueShootingPct: number(advanced.row, 'ts_pct'),
      usagePct: number(advanced.row, 'usg_pct'),
      assistPct: number(advanced.row, 'ast_pct'),
      turnoverPct: number(advanced.row, 'tov_pct'),
      reboundsPerGame: number(perGame.row, 'trb_per_g'),
      defensiveReboundPct: number(advanced.row, 'drb_pct'),
      stealPct: number(advanced.row, 'stl_pct'),
      blockPct: number(advanced.row, 'blk_pct'),
      defensiveBoxPlusMinus: number(advanced.row, 'dbpm'),
    };
  }
  return {
    nbaPlayerId: roster.nbaPlayerId,
    teamNbaId: roster.teamId,
    name,
    position: roster.position,
    fromYear: roster.fromYear,
    ...(stats ? { stats } : {}),
    ...(!stats && confirmedNoSample.has(roster.nbaPlayerId)
      ? { noSampleReason: confirmedNoSample.get(roster.nbaPlayerId) }
      : {}),
    reconciliation: override ? override.reason : stats ? 'normalized-name' : 'no-2025-26-row',
  };
});

const aggregateCount = players.filter((player) => player.stats?.rowSelection === 'season-total').length;
const perTeam = teams.map((team) => {
  const roster = players.filter((player) => player.teamNbaId === team.nbaTeamId);
  const eligible = roster.filter(
    (player) => player.stats && player.stats.games * player.stats.minutesPerGame >= 400,
  );
  return {
    abbreviation: team.abbreviation,
    roster: roster.length,
    eligible: eligible.length,
    unavailable: roster.length - eligible.length,
  };
});
const unformattedContent = `// Generated by scripts/generate-current-snapshot.mjs. Do not edit by hand.\n` +
  `export const CURRENT_SOURCE_MANIFEST = ${JSON.stringify(manifest, null, 2)} as const;\n\n` +
  `export const CURRENT_TEAMS = ${JSON.stringify(teams, null, 2)} as const;\n\n` +
  `export const CURRENT_PLAYERS = ${JSON.stringify(players, null, 2)} as const;\n\n` +
  `export const CURRENT_GENERATION_COUNTS = ${JSON.stringify({
    teams: teams.length,
    rosterIdentities: players.length,
    statisticalRows: players.filter((player) => player.stats).length,
    eligibleProfiles: players.filter(
      (player) => player.stats && player.stats.games * player.stats.minutesPerGame >= 400,
    ).length,
    unavailableProfiles: players.filter(
      (player) => !player.stats || player.stats.games * player.stats.minutesPerGame < 400,
    ).length,
    seasonTotalRows: aggregateCount,
    perTeam,
  }, null, 2)} as const;\n`;
const content = await format(unformattedContent, {
  ...(await resolveConfig(outputPath)),
  filepath: outputPath,
});

if (process.argv.includes('--check')) {
  const existing = readFileSync(outputPath, 'utf8');
  if (existing !== content) {
    throw new Error('Generated current snapshot is stale. Run the snapshot generator.');
  }
} else {
  writeFileSync(outputPath, content);
}
process.stdout.write(
  `${JSON.stringify({ teams: teams.length, players: players.length, aggregateCount }, null, 2)}\n`,
);
