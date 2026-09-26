// Shared popup controls: flat surfaces, consistent sizing, and visible keyboard focus.
// 24px controls around 16px icons plus a 2px gap leave 10px between icons and labels.
export const rowActionSpacing = 'gap-0.5 [&>a]:w-6 [&>button]:w-6 [&>span]:px-1';

export const buttonInteraction =
  'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 disabled:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';

export const secondaryButton = `min-h-10 px-3 py-2 rounded-lg border border-current bg-primary text-primary text-xs hover:bg-secondary ${buttonInteraction}`;

export function destructiveButton(isConfirming: boolean) {
  return `min-h-10 px-3 py-2 rounded-lg text-xs ${isConfirming ? 'bg-danger text-white hover:opacity-90' : 'text-danger hover:bg-secondary'} ${buttonInteraction}`;
}

export const compactOutlineButton = `h-7 px-2.5 rounded-md border border-strong text-xs font-medium text-primary duration-[120ms] hover:bg-secondary ${buttonInteraction}`;

export const menuPopover = 'z-[1100] min-w-32 rounded-lg border border-strong bg-surface p-1 shadow-card';

export const menuItem =
  'h-8 px-2 rounded-md flex items-center gap-2 text-xs text-primary cursor-pointer outline-none transition-colors duration-[120ms] data-[focused]:bg-secondary data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';
