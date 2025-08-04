/**
 * Shared styles for consistent UI interactions
 */

/**
 * Bounce effect style - adds shadow elevation and press animation
 * Use with any button that should have tactile feedback
 */
export const bounceEffect =
  'shadow-sm hover:shadow-md active:shadow-none active:translate-y-[1px] transition-all cursor-pointer';

/**
 * Bounce effect for disabled state - prevents effects when disabled
 * Uses data-[disabled] for React Aria Components compatibility
 */
export const bounceEffectDisabled =
  'data-[disabled]:shadow-none data-[disabled]:hover:shadow-none data-[disabled]:active:translate-y-0 data-[disabled]:cursor-not-allowed';

/**
 * Complete bounce button style including disabled states and cursor
 */
export const bounceButton = `${bounceEffect} ${bounceEffectDisabled}`;
