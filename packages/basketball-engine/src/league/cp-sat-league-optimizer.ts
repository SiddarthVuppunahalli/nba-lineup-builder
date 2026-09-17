import type {
  BoolVar,
  CpModel,
  CpSolver,
  IntVar,
  LinearExpr,
  LinearExprLike,
} from 'or-tools-wasm/cp-sat';

import { CREATOR_THRESHOLD, SHOOTER_THRESHOLD } from '../analysis/metrics.js';
import {
  LINEUP_SIZE,
  METRIC_NAMES,
  type LineupIntent,
  type MetricName,
  type MetricPriorities,
  type Player,
  type PlayerProfile,
} from '../domain/types.js';
import { BALANCED_PRIORITIES } from '../generation/generate-lineup.js';

export const LEAGUE_SOLVER_TIME_LIMIT_MS = 10_000;
export const LEAGUE_SOLVER_VERSION = 'or-tools-cp-sat-wasm-0.9.1';

type SolverModule = typeof import('or-tools-wasm/cp-sat');

export interface LeagueSolverProof {
  status: 'optimal' | 'feasible-time-limit' | 'infeasible';
  elapsedMs: number;
  objectiveValue?: number;
  objectiveBound?: number;
  objectiveGap?: number;
  canonicalTieProven: boolean;
  minimumSwapsProven?: boolean;
  incumbentSource?: 'solver' | 'bounded-seed';
}

export type LeagueSolverResult =
  | { kind: 'solution'; playerIds: string[]; proof: LeagueSolverProof }
  | { kind: 'infeasible'; proof: LeagueSolverProof }
  | { kind: 'unavailable'; reason: string };

interface MetricModel {
  score10: IntVar;
  sum10: LinearExpr;
  maximum10?: IntVar;
  second10?: IntVar;
  minimum10?: IntVar;
}

interface BuiltModel {
  model: CpModel;
  selection: BoolVar[];
  sortedPlayers: Player[];
  scoreByMetric: Record<MetricName, IntVar>;
  objective4: IntVar;
  canonicalRanks: IntVar[];
  incomingCount?: IntVar;
}

function toTenths(value: number): number {
  const scaled = Math.round(value * 10);
  if (Math.abs(value * 10 - scaled) > 1e-7) {
    throw new Error(`Profile score ${value} has more precision than box-score-profile-v1.`);
  }
  return scaled;
}

function decimalPlaces(value: number): number {
  const text = value.toString().toLowerCase();
  const [coefficient, exponentText] = text.split('e');
  const exponent = exponentText ? Number(exponentText) : 0;
  const fractionLength = coefficient?.split('.')[1]?.length ?? 0;
  return Math.max(0, fractionLength - exponent);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function integerPriorityWeights(priorities: MetricPriorities): Record<MetricName, number> | null {
  const places = Math.max(...METRIC_NAMES.map((metric) => decimalPlaces(priorities[metric])));
  if (places > 9) return null;
  const scale = 10 ** places;
  const weights = METRIC_NAMES.map((metric) => Math.round(priorities[metric] * scale));
  const divisor = weights.reduce(greatestCommonDivisor, 0);
  const reduced = weights.map((weight) => weight / divisor);
  if (reduced.some((weight) => !Number.isSafeInteger(weight) || weight < 0)) return null;
  return Object.fromEntries(
    METRIC_NAMES.map((metric, index) => [metric, reduced[index]!] as const),
  ) as Record<MetricName, number>;
}

function sum(module: SolverModule, expressions: Iterable<LinearExprLike>): LinearExpr {
  return module.LinearExpr.from(module.LinearExpr.sum(expressions));
}

function weightedSum(
  module: SolverModule,
  expressions: Iterable<LinearExprLike>,
  coefficients: Iterable<number>,
): LinearExpr {
  return module.LinearExpr.from(module.LinearExpr.weightedSum(expressions, coefficients));
}

function addRoundedMetric(
  module: SolverModule,
  model: CpModel,
  name: MetricName,
  numerator: LinearExprLike,
  denominator: number,
): IntVar {
  const raw = model.newIntVar(-2_000_000, 2_000_000, `${name}-raw`);
  model.addEquality(raw, numerator);
  const nonnegative = model.newIntVar(0, 2_000_000, `${name}-nonnegative`);
  model.addMaxEquality(nonnegative, [raw, 0]);
  const clamped = model.newIntVar(0, denominator * 1_000, `${name}-clamped`);
  model.addMinEquality(clamped, [nonnegative, denominator * 1_000]);
  const score10 = model.newIntVar(0, 1_000, `${name}-score10`);
  model.addDivisionEquality(score10, clamped.plus(Math.floor(denominator / 2)), denominator);
  return score10;
}

function addMaximum(
  model: CpModel,
  selection: readonly BoolVar[],
  values: readonly number[],
  name: string,
): IntVar {
  const maximum = model.newIntVar(0, 1_000, `${name}-maximum`);
  model.addMaxEquality(
    maximum,
    selection.map((selected, index) => selected.times(values[index]!)),
  );
  return maximum;
}

function addMinimum(
  model: CpModel,
  selection: readonly BoolVar[],
  values: readonly number[],
  name: string,
): IntVar {
  const minimum = model.newIntVar(0, 1_000, `${name}-minimum`);
  model.addMinEquality(
    minimum,
    selection.map((selected, index) => selected.times(values[index]! - 1_000).plus(1_000)),
  );
  return minimum;
}

function addTopTwo(
  module: SolverModule,
  model: CpModel,
  selection: readonly BoolVar[],
  values: readonly number[],
  name: string,
): { maximum: IntVar; second: IntVar } {
  const first = selection.map((_, index) => model.newBoolVar(`${name}-first-${index}`));
  const second = selection.map((_, index) => model.newBoolVar(`${name}-second-${index}`));
  model.addExactlyOne(first);
  model.addExactlyOne(second);
  for (let index = 0; index < selection.length; index += 1) {
    model.add(first[index]!.le(selection[index]!));
    model.add(second[index]!.le(selection[index]!));
    model.addAtMostOne([first[index]!, second[index]!]);
  }
  const maximum = model.newIntVar(0, 1_000, `${name}-maximum`);
  const secondMaximum = model.newIntVar(0, 1_000, `${name}-second-maximum`);
  model.addEquality(maximum, weightedSum(module, first, values));
  model.addEquality(secondMaximum, weightedSum(module, second, values));
  for (let index = 0; index < selection.length; index += 1) {
    model.add(maximum.ge(selection[index]!.times(values[index]!)));
    model.add(
      secondMaximum.ge(selection[index]!.times(values[index]!).plus(first[index]!.times(-1_000))),
    );
  }
  return { maximum, second: secondMaximum };
}

function addMetricModels(
  module: SolverModule,
  model: CpModel,
  selection: readonly BoolVar[],
  profiles: readonly PlayerProfile[],
): Record<MetricName, MetricModel> {
  const output = {} as Record<MetricName, MetricModel>;
  for (const metric of METRIC_NAMES) {
    const values = profiles.map((profile) => toTenths(profile[metric]));
    const sum10 = weightedSum(module, selection, values);
    const needsMaximum = metric !== 'shooting';
    const needsTopTwo = ['creation', 'playmaking', 'rebounding', 'interiorDefense'].includes(
      metric,
    );
    const needsMinimum = metric === 'perimeterDefense' || metric === 'switchability';
    const topTwo = needsTopTwo ? addTopTwo(module, model, selection, values, metric) : undefined;
    const maximum10 =
      topTwo?.maximum ?? (needsMaximum ? addMaximum(model, selection, values, metric) : undefined);
    output[metric] = {
      score10: model.newIntVar(0, 1_000, `${metric}-score-placeholder`),
      sum10,
      ...(maximum10 ? { maximum10 } : {}),
      ...(topTwo ? { second10: topTwo.second } : {}),
      ...(needsMinimum ? { minimum10: addMinimum(model, selection, values, metric) } : {}),
    };
  }
  return output;
}

function thresholdCount(
  module: SolverModule,
  selection: readonly BoolVar[],
  profiles: readonly PlayerProfile[],
  metric: 'shooting' | 'creation',
  threshold: number,
): LinearExpr {
  return sum(
    module,
    selection.filter((_, index) => profiles[index]![metric] >= threshold),
  );
}

function addScoring(
  module: SolverModule,
  model: CpModel,
  selection: readonly BoolVar[],
  profiles: readonly PlayerProfile[],
): Record<MetricName, IntVar> {
  const metrics = addMetricModels(module, model, selection, profiles);
  const shooterCount = model.newIntVar(0, LINEUP_SIZE, 'shooter-count');
  model.addEquality(
    shooterCount,
    thresholdCount(module, selection, profiles, 'shooting', SHOOTER_THRESHOLD),
  );
  const shootingAdjustment = model.newIntVar(-18, 5, 'shooting-adjustment');
  model.addElement(shooterCount, [-18, -12, -6, 2, 5, 5], shootingAdjustment);

  const creatorCount = model.newIntVar(0, LINEUP_SIZE, 'creator-count');
  model.addEquality(
    creatorCount,
    thresholdCount(module, selection, profiles, 'creation', CREATOR_THRESHOLD),
  );
  const creationAdjustment = model.newIntVar(-10, 4, 'creation-adjustment');
  model.addElement(creatorCount, [-10, 0, 4, 4, 4, 4], creationAdjustment);

  const weakRebounderCount = model.newIntVar(0, LINEUP_SIZE, 'weak-rebounder-count');
  model.addEquality(
    weakRebounderCount,
    sum(
      module,
      selection.filter((_, index) => profiles[index]!.rebounding < 50),
    ),
  );
  const reboundingAdjustment = model.newIntVar(-5, 0, 'rebounding-adjustment');
  model.addElement(weakRebounderCount, [0, 0, 0, -5, -5, -5], reboundingAdjustment);

  const limitedSwitchCount = model.newIntVar(0, LINEUP_SIZE, 'limited-switch-count');
  model.addEquality(
    limitedSwitchCount,
    sum(
      module,
      selection.filter((_, index) => profiles[index]!.switchability < 55),
    ),
  );

  const scores = {
    shooting: addRoundedMetric(
      module,
      model,
      'shooting',
      metrics.shooting.sum10.plus(shootingAdjustment.times(50)),
      5,
    ),
    creation: addRoundedMetric(
      module,
      model,
      'creation',
      metrics.creation
        .maximum10!.times(50)
        .plus(metrics.creation.second10!.times(30))
        .plus(metrics.creation.sum10.times(4))
        .plus(creationAdjustment.times(1_000)),
      100,
    ),
    playmaking: addRoundedMetric(
      module,
      model,
      'playmaking',
      metrics.playmaking.sum10
        .plus(metrics.playmaking.maximum10!.times(3))
        .plus(metrics.playmaking.second10!.times(2)),
      10,
    ),
    rebounding: addRoundedMetric(
      module,
      model,
      'rebounding',
      metrics.rebounding.sum10
        .times(26)
        .plus(metrics.rebounding.maximum10!.plus(metrics.rebounding.second10!).times(35))
        .plus(reboundingAdjustment.times(2_000)),
      200,
    ),
    perimeterDefense: addRoundedMetric(
      module,
      model,
      'perimeterDefense',
      metrics.perimeterDefense.sum10
        .times(12)
        .plus(metrics.perimeterDefense.maximum10!.times(25))
        .plus(metrics.perimeterDefense.minimum10!.times(15)),
      100,
    ),
    interiorDefense: addRoundedMetric(
      module,
      model,
      'interiorDefense',
      metrics.interiorDefense
        .maximum10!.times(55)
        .plus(metrics.interiorDefense.second10!.times(25))
        .plus(metrics.interiorDefense.sum10.times(4)),
      100,
    ),
    switchability: addRoundedMetric(
      module,
      model,
      'switchability',
      metrics.switchability.sum10
        .times(3)
        .plus(metrics.switchability.minimum10!.times(5))
        .plus(limitedSwitchCount.times(-800)),
      20,
    ),
  } satisfies Record<MetricName, IntVar>;

  model.add(shooterCount.ge(0));
  model.add(creatorCount.ge(0));
  return scores;
}

function metricMinimumInTenths(minimum: number): number {
  for (let score10 = 0; score10 <= 1_000; score10 += 1) {
    if (score10 / 10 >= minimum) return score10;
  }
  return 1_001;
}

function addCanonicalRanks(
  module: SolverModule,
  model: CpModel,
  selection: readonly BoolVar[],
): IntVar[] {
  const assignments = selection.map((_, playerIndex) =>
    Array.from({ length: LINEUP_SIZE }, (_, position) =>
      model.newBoolVar(`canonical-${playerIndex}-${position}`),
    ),
  );
  for (let playerIndex = 0; playerIndex < selection.length; playerIndex += 1) {
    model.addEquality(sum(module, assignments[playerIndex]!), selection[playerIndex]!);
  }
  const ranks = Array.from({ length: LINEUP_SIZE }, (_, position) => {
    const column = assignments.map((row) => row[position]!);
    model.addExactlyOne(column);
    const rank = model.newIntVar(0, selection.length - 1, `canonical-rank-${position}`);
    model.addEquality(
      rank,
      weightedSum(
        module,
        column,
        column.map((_, index) => index),
      ),
    );
    return rank;
  });
  for (let index = 0; index < ranks.length - 1; index += 1) {
    model.add(ranks[index]!.lt(ranks[index + 1]!));
  }
  return ranks;
}

function buildModel(
  module: SolverModule,
  players: readonly Player[],
  profiles: readonly PlayerProfile[],
  intent: LineupIntent,
  currentPlayerIds?: readonly string[],
  hintPlayerIds?: readonly string[],
): BuiltModel | null {
  const priorities = METRIC_NAMES.every((metric) => intent.priorities[metric] === 0)
    ? BALANCED_PRIORITIES
    : intent.priorities;
  const weights = integerPriorityWeights(priorities);
  if (!weights) return null;

  const profilesById = new Map(profiles.map((profile) => [profile.playerId, profile]));
  const sortedPlayers = [...players].sort((left, right) => left.id.localeCompare(right.id));
  const sortedProfiles = sortedPlayers.map((player) => profilesById.get(player.id)!);
  const model = new module.CpModel();
  const selection = sortedPlayers.map((player) => model.newBoolVar(`select-${player.id}`));
  model.addEquality(sum(module, selection), LINEUP_SIZE);

  const indexesById = new Map(sortedPlayers.map((player, index) => [player.id, index]));
  for (const id of intent.requiredPlayerIds) model.addEquality(selection[indexesById.get(id)!]!, 1);
  for (const id of intent.excludedPlayerIds) model.addEquality(selection[indexesById.get(id)!]!, 0);
  if (hintPlayerIds) {
    const hints = new Set(hintPlayerIds);
    for (let index = 0; index < selection.length; index += 1) {
      model.addHint(selection[index]!, hints.has(sortedPlayers[index]!.id));
    }
  }

  const scoreByMetric = addScoring(module, model, selection, sortedProfiles);
  model.add(
    thresholdCount(module, selection, sortedProfiles, 'shooting', SHOOTER_THRESHOLD).ge(
      intent.minimumShooters,
    ),
  );
  model.add(
    thresholdCount(module, selection, sortedProfiles, 'creation', CREATOR_THRESHOLD).ge(
      intent.minimumCreators,
    ),
  );
  for (const metric of METRIC_NAMES) {
    const minimum = intent.metricMinimums[metric];
    if (minimum !== undefined) model.add(scoreByMetric[metric].ge(metricMinimumInTenths(minimum)));
  }

  const weightValues = METRIC_NAMES.map((metric) => weights[metric]);
  const weightTotal = weightValues.reduce((total, value) => total + value, 0);
  const weightedScores = weightedSum(
    module,
    METRIC_NAMES.map((metric) => scoreByMetric[metric]),
    weightValues,
  );
  const objective4 = model.newIntVar(0, 1_000_000, 'objective-four-decimals');
  model.addDivisionEquality(
    objective4,
    weightedScores.times(1_000).plus(Math.floor(weightTotal / 2)),
    weightTotal,
  );

  const canonicalRanks: IntVar[] = [];
  let incomingCount: IntVar | undefined;
  if (currentPlayerIds) {
    const current = new Set(currentPlayerIds);
    incomingCount = model.newIntVar(0, LINEUP_SIZE, 'incoming-player-count');
    model.addEquality(
      incomingCount,
      sum(
        module,
        selection.filter((_, index) => !current.has(sortedPlayers[index]!.id)),
      ),
    );
  }

  return {
    model,
    selection,
    sortedPlayers,
    scoreByMetric,
    objective4,
    canonicalRanks,
    ...(incomingCount ? { incomingCount } : {}),
  };
}

function remainingSeconds(startedAt: number, timeLimitMs: number): number {
  return Math.max(0.01, (timeLimitMs - (performance.now() - startedAt)) / 1_000);
}

function configureSolve(startedAt: number, timeLimitMs: number) {
  return {
    maxTimeInSeconds: remainingSeconds(startedAt, timeLimitMs),
    maxDeterministicTime: 2,
    numSearchWorkers: 1,
    randomSeed: 8_203,
  };
}

function gap(value: number, bound: number): number {
  return Number((Math.abs(bound - value) / Math.max(1, Math.abs(value))).toFixed(6));
}

async function solveCanonicalTie(
  module: SolverModule,
  built: BuiltModel,
  solver: CpSolver,
  startedAt: number,
  timeLimitMs: number,
): Promise<boolean> {
  if (remainingSeconds(startedAt, timeLimitMs) <= 0.011) return false;
  if (built.canonicalRanks.length === 0) {
    built.canonicalRanks.push(...addCanonicalRanks(module, built.model, built.selection));
  }
  const base = built.sortedPlayers.length;
  const coefficients = built.canonicalRanks.map(
    (_, index) => base ** (built.canonicalRanks.length - index - 1),
  );
  built.model.minimize(weightedSum(module, built.canonicalRanks, coefficients));
  const status = await solver.solve(built.model, configureSolve(startedAt, timeLimitMs));
  return solver.statusName(status) === 'OPTIMAL';
}

async function loadSolver(): Promise<SolverModule | null> {
  try {
    return await import('or-tools-wasm/cp-sat');
  } catch {
    return null;
  }
}

export async function optimizeLeagueLineup(
  players: readonly Player[],
  profiles: readonly PlayerProfile[],
  intent: LineupIntent,
  options: {
    currentPlayerIds?: readonly string[];
    hintPlayerIds?: readonly string[];
    timeLimitMs?: number;
  } = {},
): Promise<LeagueSolverResult> {
  const module = await loadSolver();
  if (!module) return { kind: 'unavailable', reason: 'CP-SAT could not be loaded.' };
  const built = buildModel(
    module,
    players,
    profiles,
    intent,
    options.currentPlayerIds,
    options.hintPlayerIds,
  );
  if (!built)
    return {
      kind: 'unavailable',
      reason: 'Priority precision exceeds the exact CP-SAT integer model limit.',
    };

  const validationError = await built.model.validate();
  if (validationError)
    return { kind: 'unavailable', reason: `CP-SAT model validation failed: ${validationError}` };

  const timeLimitMs = options.timeLimitMs ?? LEAGUE_SOLVER_TIME_LIMIT_MS;
  const startedAt = performance.now();
  const solver = new module.CpSolver();
  let minimumSwapsProven: boolean | undefined;
  let seededPlayerIds: string[] | undefined;
  let seededObjective: number | undefined;

  if (options.hintPlayerIds) {
    const seedSolver = new module.CpSolver();
    const seedStatus = await seedSolver.solve(built.model, {
      ...configureSolve(startedAt, timeLimitMs),
      maxTimeInSeconds: Math.min(2, remainingSeconds(startedAt, timeLimitMs)),
      maxDeterministicTime: 0.1,
      fixVariablesToTheirHintedValue: true,
      stopAfterFirstSolution: true,
    });
    if (
      seedSolver.statusName(seedStatus) === 'OPTIMAL' ||
      seedSolver.statusName(seedStatus) === 'FEASIBLE'
    ) {
      seededPlayerIds = built.sortedPlayers
        .filter((_, index) => seedSolver.booleanValue(built.selection[index]!))
        .map((player) => player.id);
      seededObjective = seedSolver.value(built.objective4) / 10_000;
    }
  }

  if (built.incomingCount) {
    built.model.minimize(built.incomingCount);
    const swapStatus = await solver.solve(built.model, configureSolve(startedAt, timeLimitMs));
    if (solver.statusName(swapStatus) === 'INFEASIBLE') {
      return {
        kind: 'infeasible',
        proof: {
          status: 'infeasible',
          elapsedMs: Math.round(performance.now() - startedAt),
          canonicalTieProven: false,
          minimumSwapsProven: true,
        },
      };
    }
    if (
      solver.statusName(swapStatus) !== 'OPTIMAL' &&
      solver.statusName(swapStatus) !== 'FEASIBLE'
    ) {
      if (seededPlayerIds) {
        return {
          kind: 'solution',
          playerIds: seededPlayerIds,
          proof: {
            status: 'feasible-time-limit',
            elapsedMs: Math.round(performance.now() - startedAt),
            ...(seededObjective !== undefined
              ? {
                  objectiveValue: seededObjective,
                  objectiveBound: 100,
                  objectiveGap: gap(seededObjective, 100),
                }
              : {}),
            canonicalTieProven: false,
            minimumSwapsProven: false,
            incumbentSource: 'bounded-seed',
          },
        };
      }
      return {
        kind: 'unavailable',
        reason: `CP-SAT returned ${solver.statusName(swapStatus)} before finding a repair: ${solver.solutionInfo()}`,
      };
    }
    minimumSwapsProven = solver.statusName(swapStatus) === 'OPTIMAL';
    if (!minimumSwapsProven) {
      const playerIds = built.sortedPlayers
        .filter((_, index) => solver.booleanValue(built.selection[index]!))
        .map((player) => player.id);
      return {
        kind: 'solution',
        playerIds,
        proof: {
          status: 'feasible-time-limit',
          elapsedMs: Math.round(performance.now() - startedAt),
          canonicalTieProven: false,
          incumbentSource: 'solver',
          minimumSwapsProven: false,
        },
      };
    }
    built.model.addEquality(built.incomingCount, solver.value(built.incomingCount));
  }

  built.model.maximize(built.objective4);
  const objectiveStatus = await solver.solve(built.model, configureSolve(startedAt, timeLimitMs));
  if (solver.statusName(objectiveStatus) === 'INFEASIBLE') {
    return {
      kind: 'infeasible',
      proof: {
        status: 'infeasible',
        elapsedMs: Math.round(performance.now() - startedAt),
        canonicalTieProven: false,
        ...(minimumSwapsProven !== undefined ? { minimumSwapsProven } : {}),
      },
    };
  }
  if (
    solver.statusName(objectiveStatus) !== 'OPTIMAL' &&
    solver.statusName(objectiveStatus) !== 'FEASIBLE'
  ) {
    if (seededPlayerIds) {
      return {
        kind: 'solution',
        playerIds: seededPlayerIds,
        proof: {
          status: 'feasible-time-limit',
          elapsedMs: Math.round(performance.now() - startedAt),
          ...(seededObjective !== undefined
            ? {
                objectiveValue: seededObjective,
                objectiveBound: 100,
                objectiveGap: gap(seededObjective, 100),
              }
            : {}),
          canonicalTieProven: false,
          ...(minimumSwapsProven !== undefined ? { minimumSwapsProven } : {}),
          incumbentSource: 'bounded-seed',
        },
      };
    }
    return {
      kind: 'unavailable',
      reason: `CP-SAT returned ${solver.statusName(objectiveStatus)} before finding a lineup: ${solver.solutionInfo()}`,
    };
  }

  const objectiveValue = solver.objectiveValue() / 10_000;
  const objectiveBound = solver.bestObjectiveBound() / 10_000;
  let playerIds = built.sortedPlayers
    .filter((_, index) => solver.booleanValue(built.selection[index]!))
    .map((player) => player.id);
  let canonicalTieProven = false;
  if (solver.statusName(objectiveStatus) === 'OPTIMAL') {
    built.model.addEquality(built.objective4, solver.value(built.objective4));
    canonicalTieProven = await solveCanonicalTie(module, built, solver, startedAt, timeLimitMs);
    if (canonicalTieProven) {
      playerIds = built.sortedPlayers
        .filter((_, index) => solver.booleanValue(built.selection[index]!))
        .map((player) => player.id);
    }
  }

  const optimal = solver.statusName(objectiveStatus) === 'OPTIMAL' && canonicalTieProven;
  return {
    kind: 'solution',
    playerIds,
    proof: {
      status: optimal ? 'optimal' : 'feasible-time-limit',
      elapsedMs: Math.round(performance.now() - startedAt),
      objectiveValue,
      objectiveBound,
      objectiveGap: gap(objectiveValue, objectiveBound),
      canonicalTieProven,
      incumbentSource: 'solver',
      ...(minimumSwapsProven !== undefined ? { minimumSwapsProven } : {}),
    },
  };
}
