import { useEffect, useRef, useState } from 'react';
import { watchDocumentTranslations } from '@/content/translations';
import type { Translations } from '@/shared/i18n/index';
import { LeetSRSLogo } from '@/shared/ui/LeetSRSLogo';
import { useSurfaceTheme } from './theme';

const TOAST_DURATION_MS = 4000;
const FADE_DURATION_MS = 200;

// Shows the toast once the document's language is known.
export function LocalizedToast({
  message,
  onDismiss,
}: {
  message: (t: Translations) => string;
  onDismiss: () => void;
}) {
  const [t, setTranslations] = useState<Translations | null>(null);
  useEffect(() => watchDocumentTranslations(setTranslations, onDismiss), [onDismiss]);
  return t && <Toast message={message(t)} onDismiss={onDismiss} />;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const remaining = useRef(TOAST_DURATION_MS);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // The countdown pauses while the pointer is over the toast.
  useEffect(() => {
    if (leaving) {
      const timeout = window.setTimeout(onDismiss, FADE_DURATION_MS);
      return () => window.clearTimeout(timeout);
    }
    if (hovered) return;
    const started = Date.now();
    const timeout = window.setTimeout(() => setLeaving(true), remaining.current);
    return () => {
      window.clearTimeout(timeout);
      remaining.current -= Date.now() - started;
    };
  }, [hovered, leaving, onDismiss]);

  return (
    <div
      role="status"
      data-theme={useSurfaceTheme()}
      className="fixed right-4 bottom-4 z-9999 flex items-center gap-2.5 rounded-[10px] bg-surface py-2.5 pr-4 pl-3 text-[13px] leading-[1.35] text-fg shadow-(--ls-shadow) transition-opacity ease-out motion-reduce:transition-none"
      style={{ opacity: entered && !leaving ? 1 : 0, transitionDuration: `${FADE_DURATION_MS}ms` }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <LeetSRSLogo className="size-4 shrink-0 text-brand" />
      <span>{message}</span>
    </div>
  );
}
