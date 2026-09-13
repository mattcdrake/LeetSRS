import { type CSSProperties, type Ref, useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps, Dialog, DialogTrigger, Popover, TooltipTrigger } from 'react-aria-components';
import { addCurrentProblem, rateCurrentProblem } from '@/content/rating-actions';
import type { Translations } from '@/i18n';
import { watchDocumentTranslations } from '@/infrastructure/storage/translations';
import { RatingMenu } from './RatingMenu';
import { Tooltip } from './Tooltip';
import { LEETSRS_BUTTON_COLOR, THEME_COLORS, useDarkMode } from './theme';

export function LeetSrsControl() {
  const [t, setTranslations] = useState<Translations | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpen = useRef(false);

  useEffect(() => watchDocumentTranslations(setTranslations), []);

  useEffect(() => {
    // React Aria's restore-focus guard only checks document.activeElement,
    // which points to the shadow host after the focused menu is removed.
    if (wasMenuOpen.current && !menuOpen) buttonRef.current?.focus();
    wasMenuOpen.current = menuOpen;
  }, [menuOpen]);

  if (!t) return null;

  return (
    <DialogTrigger isOpen={menuOpen} onOpenChange={setMenuOpen}>
      <TooltipTrigger delay={300} closeDelay={0} isDisabled={menuOpen}>
        <LeetSrsButton t={t} ref={buttonRef} />
        <Tooltip text={t.app.name} />
      </TooltipTrigger>
      <Popover placement="bottom end" offset={8} className="z-50">
        <Dialog aria-label={t.app.name}>
          <RatingMenu
            t={t}
            onRate={rateCurrentProblem}
            onAddWithoutRating={addCurrentProblem}
            onSelect={() => setMenuOpen(false)}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

export function LeetSrsButton({ t, ...props }: { t: Translations; ref?: Ref<HTMLButtonElement> } & ButtonProps) {
  const colors = useDarkMode() ? THEME_COLORS.dark : THEME_COLORS.light;
  return (
    <Button
      {...props}
      type="button"
      className="flex cursor-pointer rounded-sm border-0 bg-(--button-bg) p-2 hover:bg-(--button-hover) data-focus-visible:outline-2 data-focus-visible:outline-solid data-focus-visible:outline-current data-focus-visible:outline-offset-2"
      aria-label={t.app.name}
      style={
        {
          color: LEETSRS_BUTTON_COLOR,
          '--button-bg': colors.bgToolbarButton,
          '--button-hover': colors.bgAddButtonHover,
        } as CSSProperties & Record<`--${string}`, string>
      }
    >
      <svg
        aria-hidden="true"
        focusable="false"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="1em"
        height="1em"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4"
        role="img"
      >
        <path d="M9 4.55a8 8 0 0 1 6 14.9m0 -4.45v5h5" />
        <path d="M5.63 7.16l0 .01" />
        <path d="M4.06 11l0 .01" />
        <path d="M4.63 15.1l0 .01" />
        <path d="M7.16 18.37l0 .01" />
        <path d="M11 19.94l0 .01" />
      </svg>
    </Button>
  );
}
