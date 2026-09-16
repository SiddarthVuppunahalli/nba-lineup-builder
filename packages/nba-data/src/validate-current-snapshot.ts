import type { LineupPool, SnapshotSource } from './types.js';

export function validateCurrentSnapshot(
  pools: readonly LineupPool[],
  source: SnapshotSource,
  expectedRosterIdentities: number,
): void {
  const requiredProvenance = [
    source.id,
    source.label,
    source.url,
    source.snapshotDate,
    source.retrievalDate,
    source.rosterDate,
    source.statisticsSeason,
    source.methodologyVersion,
    source.reconciliationVersion,
  ];
  if (requiredProvenance.some((value) => !value) || (source.sourceUrls?.length ?? 0) < 3) {
    throw new Error('Current snapshot provenance is incomplete.');
  }
  if (pools.length !== 30)
    throw new Error(`Expected 30 current team pools, received ${pools.length}.`);

  const membership = new Map<string, number>();
  const profileIds = new Set<string>();
  let rosterCount = 0;
  for (const pool of pools) {
    if (pool.source !== source || pool.mode !== 'team' || pool.searchStrategy !== 'exhaustive') {
      throw new Error(`Current team pool ${pool.team.id} has invalid source or search metadata.`);
    }
    const localIds = new Set<string>();
    const localProfileIds = new Set(pool.profiles.map((profile) => profile.playerId));
    for (const profile of pool.profiles) {
      if (profileIds.has(profile.playerId))
        throw new Error(`Duplicate profile ${profile.playerId}.`);
      profileIds.add(profile.playerId);
    }
    for (const player of pool.players) {
      rosterCount += 1;
      if (localIds.has(player.id)) throw new Error(`Duplicate roster ID ${player.id}.`);
      localIds.add(player.id);
      membership.set(player.id, (membership.get(player.id) ?? 0) + 1);
      const profiled = localProfileIds.has(player.id);
      const unavailable = Boolean(pool.profileUnavailableReasons?.get(player.id));
      if (profiled === unavailable) {
        throw new Error(`Roster identity ${player.id} is not uniquely accounted for.`);
      }
    }
    for (const profileId of localProfileIds) {
      if (!localIds.has(profileId))
        throw new Error(`Profile ${profileId} is outside its team roster.`);
    }
  }
  if (rosterCount !== expectedRosterIdentities) {
    throw new Error(
      `Expected ${expectedRosterIdentities} current roster identities, received ${rosterCount}.`,
    );
  }
  for (const [playerId, count] of membership) {
    if (count !== 1) throw new Error(`Roster identity ${playerId} belongs to ${count} teams.`);
  }
}
