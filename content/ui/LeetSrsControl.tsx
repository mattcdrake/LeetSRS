import { type Ref, useEffect, useRef, useState } from 'react';
import { Button, type ButtonProps, Dialog, DialogTrigger, Popover, TooltipTrigger } from 'react-aria-components';
import { watchDocumentTranslations } from '@/content/translations';
import type { Translations } from '@/shared/i18n/index';
import { LeetSRSLogo } from '@/shared/ui/LeetSRSLogo';
import { RatingMenu } from './RatingMenu';
import { Tooltip } from './Tooltip';
import { useSurfaceTheme } from './theme';
import { useRatingSession } from './useRatingSession';

export function LeetSrsControl({ openRequest = 0 }: { openRequest?: number }) {
  const [t, setTranslations] = useState<Translations | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const session = useRatingSession(openRequest);
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
        <Tooltip title={t.app.name} text={t.contentScript.tooltip} />
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
  return (
    <Button
      {...props}
      type="button"
      data-theme={useSurfaceTheme()}
      className="ml-1 grid size-8 cursor-pointer place-items-center rounded-md border-0 bg-host-fill p-0 text-brand hover:bg-host-fill-hover data-focus-visible:outline-2 data-focus-visible:outline-focus data-focus-visible:outline-offset-2"
      aria-label={t.app.name}
    >
      <LeetSRSLogo className="size-4" role="img" />
    </Button>
  );
}
