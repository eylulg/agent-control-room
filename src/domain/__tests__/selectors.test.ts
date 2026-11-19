import { describe, expect, it } from 'vitest';
import { throughput } from '../selectors';

describe('throughput', () => {
  it('counts completions per bucket, including the bucket edges', () => {
    expect(throughput([5, 10, 15, 16, 35, 40], 40, 10, 4)).toEqual([2, 2, 0, 2]);
  });

  it('drops completions outside the window', () => {
    expect(throughput([0, -5, 41], 40, 10, 4)).toEqual([0, 0, 0, 0]);
  });
});
