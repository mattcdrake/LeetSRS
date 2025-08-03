import { describe, it, expect } from 'vitest';
import { interleaveArrays } from '../utils';

describe('interleaveArrays', () => {
  it('should handle empty arrays', () => {
    expect(interleaveArrays([], [])).toEqual([]);
    expect(interleaveArrays([1, 2], [])).toEqual([1, 2]);
    expect(interleaveArrays([], [3, 4])).toEqual([3, 4]);
  });

  it('should interleave equal length arrays evenly', () => {
    const primary = [1, 2, 3];
    const secondary = [4, 5, 6];
    const result = interleaveArrays(primary, secondary);

    expect(result).toEqual([4, 1, 5, 2, 6, 3]);
  });

  it('should handle primary array longer than secondary', () => {
    const primary = [1, 2, 3, 4, 5, 6];
    const secondary = [7, 8];
    const result = interleaveArrays(primary, secondary);

    // Secondary items should be distributed evenly
    expect(result).toEqual([7, 1, 2, 3, 8, 4, 5, 6]);
  });

  it('should handle secondary array longer than primary', () => {
    const primary = [1, 2];
    const secondary = [3, 4, 5, 6, 7, 8];
    const result = interleaveArrays(primary, secondary);

    // Primary items should be distributed evenly
    expect(result).toEqual([3, 1, 4, 5, 6, 2, 7, 8]);
  });

  it('should handle single element arrays', () => {
    expect(interleaveArrays([1], [2])).toEqual([2, 1]);
    expect(interleaveArrays([1], [])).toEqual([1]);
    expect(interleaveArrays([], [2])).toEqual([2]);
  });

  it('should maintain order within each array', () => {
    const primary = [1, 2, 3, 4];
    const secondary = [5, 6];
    const result = interleaveArrays(primary, secondary);

    // Extract primary elements
    const primaryResult = result.filter((x) => x <= 4);
    expect(primaryResult).toEqual([1, 2, 3, 4]);

    // Extract secondary elements
    const secondaryResult = result.filter((x) => x > 4);
    expect(secondaryResult).toEqual([5, 6]);
  });

  it('should handle large differences in array sizes', () => {
    const primary = [1];
    const secondary = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const result = interleaveArrays(primary, secondary);

    // With 1 primary and 10 secondary items, primary item appears early
    // because secondary progress advances faster
    const primaryIndex = result.indexOf(1);
    expect(primaryIndex).toBeLessThanOrEqual(1);
  });

  it('should work with complex objects', () => {
    const primary = [{ id: 1 }, { id: 2 }];
    const secondary = [{ id: 3 }, { id: 4 }, { id: 5 }];
    const result = interleaveArrays(primary, secondary);

    expect(result.length).toBe(5);
    expect(result).toContainEqual({ id: 1 });
    expect(result).toContainEqual({ id: 2 });
    expect(result).toContainEqual({ id: 3 });
    expect(result).toContainEqual({ id: 4 });
    expect(result).toContainEqual({ id: 5 });
  });

  it('should distribute evenly for 3:1 ratio', () => {
    const primary = [1, 2, 3, 4, 5, 6];
    const secondary = [7, 8];
    const result = interleaveArrays(primary, secondary);

    const sevenIndex = result.indexOf(7);
    const eightIndex = result.indexOf(8);

    // 7 should appear in first third, 8 in last third
    expect(sevenIndex).toBeLessThan(3);
    expect(eightIndex).toBeGreaterThan(3);
  });

  it('should handle very long arrays efficiently', () => {
    const primary = Array.from({ length: 100 }, (_, i) => i);
    const secondary = Array.from({ length: 50 }, (_, i) => i + 100);
    const result = interleaveArrays(primary, secondary);

    expect(result.length).toBe(150);

    // Check that secondary items are distributed throughout
    const firstQuarter = result.slice(0, 37);
    const secondQuarter = result.slice(37, 75);
    const thirdQuarter = result.slice(75, 112);
    const fourthQuarter = result.slice(112, 150);

    const countSecondary = (arr: number[]) => arr.filter((x) => x >= 100).length;

    // Each quarter should have roughly equal secondary items
    expect(countSecondary(firstQuarter)).toBeGreaterThan(10);
    expect(countSecondary(secondQuarter)).toBeGreaterThan(10);
    expect(countSecondary(thirdQuarter)).toBeGreaterThan(10);
    expect(countSecondary(fourthQuarter)).toBeGreaterThan(10);
  });
});
