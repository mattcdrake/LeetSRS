import { LEETSRS_BUTTON_COLOR } from './constants';

export function createButton(options: {
  className?: string;
  style?: string;
  innerHTML?: string;
  onClick?: () => void;
}): HTMLButtonElement {
  const button = document.createElement('button');

  if (options.className) {
    button.className = options.className;
  }

  if (options.style) {
    button.style.cssText = options.style;
  }

  if (options.innerHTML) {
    button.innerHTML = options.innerHTML;
  }

  if (options.onClick) {
    button.addEventListener('click', options.onClick);
  }

  return button;
}

export function createLeetSrsButton(onClick: () => void): HTMLDivElement {
  const buttonWrapper = document.createElement('div');
  buttonWrapper.className = 'relative flex';

  const innerWrapper = document.createElement('div');
  innerWrapper.className = 'relative flex overflow-hidden rounded bg-fill-tertiary dark:bg-fill-tertiary';

  const groupWrapper = document.createElement('div');
  groupWrapper.className =
    'group flex flex-none items-center justify-center hover:bg-fill-quaternary dark:hover:bg-fill-quaternary';

  const clickableDiv = document.createElement('div');
  clickableDiv.className = 'flex cursor-pointer p-2';
  clickableDiv.setAttribute('data-state', 'closed');
  clickableDiv.setAttribute('title', 'LeetSRS');
  clickableDiv.setAttribute('aria-label', 'LeetSRS');

  // Use inline style for the LeetSRS button color
  clickableDiv.style.color = LEETSRS_BUTTON_COLOR;

  clickableDiv.innerHTML = `
    <div class="relative text-[16px] leading-[normal] before:block before:h-4 before:w-4">
      <svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="absolute left-1/2 top-1/2 h-[1em] -translate-x-1/2 -translate-y-1/2 align-[-0.125em]" role="img">
        <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
        <path d="M5.63 7.16l0 .01" />
        <path d="M4.06 11l0 .01" />
        <path d="M4.63 15.1l0 .01" />
        <path d="M7.16 18.37l0 .01" />
        <path d="M11 19.94l0 .01" />
      </svg>
    </div>
  `;

  clickableDiv.addEventListener('click', onClick);

  groupWrapper.appendChild(clickableDiv);
  innerWrapper.appendChild(groupWrapper);
  buttonWrapper.appendChild(innerWrapper);

  return buttonWrapper;
}
