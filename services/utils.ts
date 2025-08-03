export function interleaveArrays<T>(primary: T[], secondary: T[]): T[] {
  const result: T[] = [];
  const primaryLen = primary.length;
  const secondaryLen = secondary.length;
  const totalLen = primaryLen + secondaryLen;

  if (totalLen === 0) return result;

  let primaryIndex = 0;
  let secondaryIndex = 0;

  // Distribute items evenly by comparing progress ratios
  for (let i = 0; i < totalLen; i++) {
    const primaryProgress = primaryLen > 0 ? primaryIndex / primaryLen : 1;
    const secondaryProgress = secondaryLen > 0 ? secondaryIndex / secondaryLen : 1;

    // Add from whichever array is further behind proportionally
    if (secondaryIndex < secondaryLen && (primaryIndex >= primaryLen || secondaryProgress <= primaryProgress)) {
      result.push(secondary[secondaryIndex++]);
    } else if (primaryIndex < primaryLen) {
      result.push(primary[primaryIndex++]);
    }
  }

  return result;
}
