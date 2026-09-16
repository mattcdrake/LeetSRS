// Shared popup controls: flat surfaces, consistent sizing, and visible keyboard focus.
export const buttonInteraction =
  'cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 disabled:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed';

export const secondaryButton = `min-h-10 px-3 py-2 rounded-lg border border-current bg-primary text-primary text-xs hover:bg-secondary ${buttonInteraction}`;

export function destructiveButton(isConfirming: boolean) {
  return `min-h-10 px-3 py-2 rounded-lg text-xs ${isConfirming ? 'bg-danger text-white hover:opacity-90' : 'text-danger hover:bg-secondary'} ${buttonInteraction}`;
}
