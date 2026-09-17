import { type CSSProperties, type Ref, useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps, Dialog, DialogTrigger, Popover, TooltipTrigger } from 'react-aria-components';
import { watchDocumentTranslations } from '@/content/translations';
import type { Translations } from '@/shared/i18n/index';
import { LeetSRSLogo } from '@/shared/ui/LeetSRSLogo';
import { RatingMenu } from './RatingMenu';
import { Tooltip } from './Tooltip';
import { LEETSRS_BUTTON_COLOR, THEME_COLORS, useDarkMode } from './theme';
import { useRatingSession } from './useRatingSession';

export function LeetSrsControl({ openRequest = 0 }: { openRequest?: number }) {
  const [t, setTranslations] = useState<Translations | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useRatingSession(openRequest);
  const { saved, busy, error, dismiss } = session;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpen = useRef(false);

  useEffect(() => watchDocumentTranslations(setTranslations), []);

  useEffect(() => {
    // React Aria's restore-focus guard only checks document.activeElement,
    // which points to the shadow host after the focused menu is removed.
    if (wasMenuOpen.current && !menuOpen) buttonRef.current?.focus();
    wasMenuOpen.current = menuOpen;
  }, [menuOpen]);

  useEffect(() => {
    if (openRequest > 0) setMenuOpen(true);
  }, [openRequest]);

  useEffect(() => {
    if (!menuOpen || !saved || busy || error) return;
    const timeout = setTimeout(() => {
      setMenuOpen(false);
      dismiss();
    }, 5000);
    return () => clearTimeout(timeout);
  }, [menuOpen, saved, busy, error, dismiss]);

  if (!t) return null;

  return (
    <DialogTrigger
      isOpen={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) session.dismiss();
      }}
    >
      <TooltipTrigger delay={300} closeDelay={0} isDisabled={menuOpen}>
        <LeetSrsButton t={t} ref={buttonRef} />
        <Tooltip text={t.app.name} />
      </TooltipTrigger>
      <Popover placement="bottom end" offset={8} className="z-50">
        <Dialog aria-label={t.app.name}>
          <RatingMenu key={openRequest} t={t} session={session} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function LeetSrsButton({ t, ...props }: { t: Translations; ref?: Ref<HTMLButtonElement> } & ButtonProps) {
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
      <LeetSRSLogo className="size-4" role="img" />
    </Button>
  );
}
