/**
 * Keeps a derived basketball metric on the engine's documented 0-100 scale.
 * More meaningful metric rules arrive with the Phase 2 domain model.
 */
export function normalizeMetricScore(score: number): number {
  if (!Number.isFinite(score)) {
    throw new TypeError('Metric score must be a finite number.');
  }

  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}
