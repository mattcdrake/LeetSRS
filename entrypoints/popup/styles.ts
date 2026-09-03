// Reusable popup interaction styles.
export const bounceEffect =
  'shadow-sm hover:shadow-md active:shadow-none active:translate-y-[1px] transition-all cursor-pointer';

export const bounceEffectDisabled =
  'data-[disabled]:shadow-none data-[disabled]:hover:shadow-none data-[disabled]:active:translate-y-0 data-[disabled]:cursor-not-allowed';

export const bounceButton = `${bounceEffect} ${bounceEffectDisabled}`;
