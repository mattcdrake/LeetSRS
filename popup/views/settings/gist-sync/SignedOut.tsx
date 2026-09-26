import { type ReactNode, useState } from 'react';
import { Button } from 'react-aria-components';
import { FaGithub } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { buttonInteraction, compactGhostButton } from '@/popup/styles';
import { settingsCard } from '../SettingsGroup';

interface SignedOutProps {
  signingIn: boolean;
  highlight: boolean;
  isCancelDisabled: boolean;
  isSignInDisabled: boolean;
  notices: ReactNode;
  onSignIn: () => void;
  onCancel: () => void;
}

export function SignedOut({
  signingIn,
  highlight,
  isCancelDisabled,
  isSignInDisabled,
  notices,
  onSignIn,
  onCancel,
}: SignedOutProps) {
  const t = useI18n().settings.gistSync;
  const [highlightDismissed, setHighlightDismissed] = useState(false);

  return (
    <div className={`${settingsCard} p-3.5`}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
          <FaGithub className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-5 text-primary">{t.title}</p>
          <p className="mt-0.5 text-xs leading-[18px] text-secondary">{t.pitch}</p>
        </div>
      </div>
      {notices && <div className="mt-3 space-y-1.5">{notices}</div>}
      {signingIn ? (
        <div className="mt-3 flex h-9 items-center justify-between gap-3 rounded-lg bg-secondary pl-3 pr-1">
          <span role="status" className="flex items-center gap-2 text-xs text-secondary">
            <span
              aria-hidden="true"
              className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--current-text-tertiary)] border-t-transparent"
            />
            {t.signingIn}
          </span>
          <Button className={compactGhostButton} isDisabled={isCancelDisabled} onPress={onCancel}>
            {t.cancel}
          </Button>
        </div>
      ) : (
        <Button
          className={`mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-strong bg-surface text-xs font-medium text-primary duration-[120ms] hover:bg-secondary ${buttonInteraction} ${highlight && !highlightDismissed ? 'github-sign-in-highlight' : ''}`}
          onAnimationEnd={() => setHighlightDismissed(true)}
          isDisabled={isSignInDisabled}
          onPress={() => {
            setHighlightDismissed(true);
            onSignIn();
          }}
        >
          <FaGithub className="size-4" aria-hidden="true" />
          {t.signIn}
        </Button>
      )}
    </div>
  );
}
