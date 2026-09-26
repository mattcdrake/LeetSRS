// Shared popup controls: flat surfaces, consistent sizing, and visible keyboard focus.
export const buttonInteraction =
  'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--current-accent)] disabled:opacity-50 disabled:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';

export const compactOutlineButton = `h-7 px-2.5 rounded-md border border-strong text-xs font-medium text-primary duration-[120ms] hover:bg-secondary ${buttonInteraction}`;

export const compactGhostButton = `h-7 px-2 shrink-0 rounded-md inline-flex items-center gap-1 text-xs text-secondary duration-[120ms] hover:bg-secondary hover:text-primary ${buttonInteraction}`;

// Quiet 32px actions for a card's action bar.
export const textButton = `h-8 px-2 rounded-md flex items-center gap-1.5 duration-[120ms] ${buttonInteraction}`;

export const iconButton = `size-8 rounded-md grid place-items-center text-tertiary duration-[120ms] hover:bg-secondary ${buttonInteraction}`;

export const menuPopover = 'z-[1100] min-w-32 rounded-lg border border-strong bg-surface p-1 shadow-card';

export const menuItem =
  'h-8 px-2 rounded-md flex items-center gap-2 text-xs text-primary cursor-pointer outline-none transition-colors duration-[120ms] data-[focused]:bg-secondary data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';

export const problemRow =
  'flex min-h-12 items-center gap-2.5 -mx-2 px-2 py-1.5 rounded-lg transition-colors duration-[120ms] hover:bg-[color-mix(in_srgb,var(--current-bg-secondary)_70%,transparent)]';
