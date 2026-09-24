import { useState } from 'react';
import { Button } from 'react-aria-components';
import { FaGithub } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';

interface SignedOutProps {
  signingIn: boolean;
  highlight: boolean;
  isCancelDisabled: boolean;
  isSignInDisabled: boolean;
  onSignIn: () => void;
  onCancel: () => void;
}

export function SignedOut({
  signingIn,
  highlight,
  isCancelDisabled,
  isSignInDisabled,
  onSignIn,
  onCancel,
}: SignedOutProps) {
  const t = useI18n().settings.gistSync;
  const [highlightDismissed, setHighlightDismissed] = useState(false);

  return (
    <div className="space-y-3">
      {signingIn ? (
        <div className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-current bg-primary px-3">
          <span role="status" className="flex items-center gap-2.5 text-xs text-secondary">
            <span
              aria-hidden="true"
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            {t.signingIn}
          </span>
          <Button
            className="rounded-lg px-2 py-2 text-xs font-medium text-secondary hover:text-primary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
            isDisabled={isCancelDisabled}
            onPress={onCancel}
          >
            {t.cancel}
          </Button>
        </div>
      ) : (
        <Button
          className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-current bg-primary px-3 py-2 text-xs text-primary cursor-pointer hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${highlight && !highlightDismissed ? 'github-sign-in-highlight' : ''}`}
          onAnimationEnd={() => setHighlightDismissed(true)}
          isDisabled={isSignInDisabled}
          onPress={() => {
            setHighlightDismissed(true);
            onSignIn();
          }}
        >
          <FaGithub className="h-4 w-4" aria-hidden="true" />
          {t.signIn}
        </Button>
      )}
    </div>
  );
}
