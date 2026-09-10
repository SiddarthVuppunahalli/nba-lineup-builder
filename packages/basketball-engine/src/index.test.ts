import { describe, expect, it } from 'vitest';

import { normalizeMetricScore } from './index.js';

describe('normalizeMetricScore', () => {
  it('keeps domain metrics within the documented 0-100 range', () => {
    expect(normalizeMetricScore(86.74)).toBe(86.7);
    expect(normalizeMetricScore(-4)).toBe(0);
    expect(normalizeMetricScore(112)).toBe(100);
  });

  it('rejects values that cannot represent a metric', () => {
    expect(() => normalizeMetricScore(Number.NaN)).toThrow('finite number');
  });
});
