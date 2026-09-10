import type {
  EvaluatedPlayer,
  Lineup,
  LineupAnalysis,
  Player,
  PlayerProfile,
} from '../domain/types.js';
import { validateLineup, type LineupValidationIssue } from '../domain/validation.js';
import { deriveFindings } from './findings.js';
import {
  evaluateCreation,
  evaluateInteriorDefense,
  evaluatePerimeterDefense,
  evaluatePlaymaking,
  evaluateRebounding,
  evaluateShooting,
  evaluateSwitchability,
} from './metrics.js';

export type LineupAnalysisIssue =
  | LineupValidationIssue
  | {
      code: 'UNKNOWN_PLAYER';
      message: string;
      playerIds: string[];
    }
  | {
      code: 'MISSING_PROFILE';
      message: string;
      playerIds: string[];
    };

export interface AnalyzeLineupInput {
  playerIds: readonly string[];
  players: readonly Player[];
  profiles: readonly PlayerProfile[];
}

export type AnalyzeLineupResult =
  | { success: true; lineup: Lineup; analysis: LineupAnalysis }
  | { success: false; issues: LineupAnalysisIssue[] };

function resolvePlayers(
  lineup: Lineup,
  players: readonly Player[],
  profiles: readonly PlayerProfile[],
): { players?: EvaluatedPlayer[]; issues: LineupAnalysisIssue[] } {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const profilesById = new Map(profiles.map((profile) => [profile.playerId, profile]));
  const unknownPlayerIds = lineup.playerIds.filter((playerId) => !playersById.has(playerId));
  const missingProfileIds = lineup.playerIds.filter(
    (playerId) => playersById.has(playerId) && !profilesById.has(playerId),
  );
  const issues: LineupAnalysisIssue[] = [];

  if (unknownPlayerIds.length > 0) {
    issues.push({
      code: 'UNKNOWN_PLAYER',
      message: `The roster does not contain: ${unknownPlayerIds.join(', ')}.`,
      playerIds: unknownPlayerIds,
    });
  }

  if (missingProfileIds.length > 0) {
    issues.push({
      code: 'MISSING_PROFILE',
      message: `No basketball profile is available for: ${missingProfileIds.join(', ')}.`,
      playerIds: missingProfileIds,
    });
  }

  if (issues.length > 0) {
    return { issues };
  }

  return {
    issues,
    players: lineup.playerIds.map((playerId) => ({
      player: playersById.get(playerId)!,
      profile: profilesById.get(playerId)!,
    })),
  };
}

export function analyzeLineup(input: AnalyzeLineupInput): AnalyzeLineupResult {
  const validation = validateLineup(input.playerIds);
  if (!validation.valid) {
    return { success: false, issues: validation.issues };
  }

  const resolved = resolvePlayers(validation.lineup, input.players, input.profiles);
  if (!resolved.players) {
    return { success: false, issues: resolved.issues };
  }

  const metrics: Omit<LineupAnalysis, 'findings'> = {
    shooting: evaluateShooting(resolved.players),
    creation: evaluateCreation(resolved.players),
    playmaking: evaluatePlaymaking(resolved.players),
    rebounding: evaluateRebounding(resolved.players),
    perimeterDefense: evaluatePerimeterDefense(resolved.players),
    interiorDefense: evaluateInteriorDefense(resolved.players),
    switchability: evaluateSwitchability(resolved.players),
  };

  return {
    success: true,
    lineup: validation.lineup,
    analysis: {
      ...metrics,
      findings: deriveFindings(resolved.players, metrics),
    },
  };
}
