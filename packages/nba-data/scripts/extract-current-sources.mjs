import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const packageRoot = resolve(import.meta.dirname, '..');
const outputRoot = resolve(packageRoot, 'raw', 'current-2026-09-15');

function decodeHtml(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&nbsp;', ' ')
    .trim();
}

function tableRows(html, tableId) {
  const tableMatch = html.match(new RegExp(`<table[^>]+id="${tableId}"[\\s\\S]*?<\\/table>`));
  if (!tableMatch) throw new Error(`Could not find table ${tableId}.`);
  const rows = [];
  for (const rowMatch of tableMatch[0].matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)<\/tr>/g)) {
    const cells = {};
    let playerKey;
    for (const cellMatch of rowMatch[1].matchAll(/<(?:th|td)([^>]*)>([\s\S]*?)<\/(?:th|td)>/g)) {
      const stat = cellMatch[1].match(/data-stat="([^"]+)"/)?.[1];
      if (!stat) continue;
      cells[stat] = decodeHtml(cellMatch[2]);
      playerKey ??= cellMatch[1].match(/data-append-csv="([^"]+)"/)?.[1];
    }
    if (playerKey && cells.name_display) rows.push({ playerKey, ...cells });
  }
  return rows;
}

function nbaRosterRows(html) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) throw new Error('Could not find the NBA roster payload.');
  const payload = JSON.parse(match[1]);
  return payload.props.pageProps.players
    .filter((row) => row.HISTORIC === false && row.ROSTER_STATUS === 1)
    .map((row) => ({
      nbaPlayerId: row.PERSON_ID,
      firstName: row.PLAYER_FIRST_NAME,
      lastName: row.PLAYER_LAST_NAME,
      playerSlug: row.PLAYER_SLUG,
      teamId: row.TEAM_ID,
      teamCity: row.TEAM_CITY,
      teamName: row.TEAM_NAME,
      teamAbbreviation: row.TEAM_ABBREVIATION,
      position: row.POSITION,
      rosterStatus: row.ROSTER_STATUS,
      supplementalStatus: row.SUPPLEMENTAL_STATUS,
      fromYear: Number(row.FROM_YEAR),
      toYear: Number(row.TO_YEAR),
    }))
    .sort(
      (a, b) =>
        a.teamAbbreviation.localeCompare(b.teamAbbreviation) ||
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName) ||
        a.nbaPlayerId - b.nbaPlayerId,
    );
}

function writeJson(name, value) {
  writeFileSync(resolve(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(outputRoot, { recursive: true });
const rosterHtml = readFileSync(resolve(packageRoot, 'raw-rosters.html'), 'utf8');
const perGameHtml = readFileSync(resolve(packageRoot, 'raw-per-game.html'), 'utf8');
const advancedHtml = readFileSync(resolve(packageRoot, 'raw-advanced.html'), 'utf8');

writeJson('nba-rosters.json', nbaRosterRows(rosterHtml));
writeJson('bref-per-game.json', tableRows(perGameHtml, 'per_game_stats'));
writeJson('bref-advanced.json', tableRows(advancedHtml, 'advanced'));
writeJson('manifest.json', {
  retrievalDate: '2026-09-15',
  rosterDate: '2026-09-15',
  statisticsSeason: '2025-26',
  sources: [
    {
      name: 'nba-rosters',
      url: 'https://www.nba.com/players',
      sha256: createHash('sha256').update(rosterHtml).digest('hex'),
    },
    {
      name: 'basketball-reference-per-game',
      url: 'https://www.basketball-reference.com/leagues/NBA_2026_per_game.html',
      sha256: createHash('sha256').update(perGameHtml).digest('hex'),
    },
    {
      name: 'basketball-reference-advanced',
      url: 'https://www.basketball-reference.com/leagues/NBA_2026_advanced.html',
      sha256: createHash('sha256').update(advancedHtml).digest('hex'),
    },
  ],
});
