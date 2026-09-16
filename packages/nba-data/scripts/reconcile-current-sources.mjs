export function normalizeName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

export function requireUnambiguousCandidate(name, candidateKeys) {
  if (candidateKeys.length > 1) {
    throw new Error(`Ambiguous join for ${name}: ${candidateKeys.join(', ')}.`);
  }
  return candidateKeys[0];
}

export function selectSeasonRow(rows, playerKey) {
  const matches = rows.filter((row) => row.playerKey === playerKey);
  if (!matches.length) return undefined;
  const totalRows = matches.filter((row) => /^(?:TOT|[2-9]TM)$/.test(row.team_name_abbr));
  if (totalRows.length > 1) throw new Error(`Ambiguous total rows for ${playerKey}.`);
  if (totalRows.length === 1) return { row: totalRows[0], selection: 'season-total' };
  if (matches.length > 1) throw new Error(`No season-total row for multi-team player ${playerKey}.`);
  return { row: matches[0], selection: 'single-team' };
}

