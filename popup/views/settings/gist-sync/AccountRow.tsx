import { Button } from 'react-aria-components';
import { FaGithub } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';

interface AccountRowProps {
  login: string;
  isSigningOut: boolean;
  onSignOut: () => void;
}

export function AccountRow({ login, isSigningOut, onSignOut }: AccountRowProps) {
  const t = useI18n().settings.gistSync;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 text-xs text-secondary">
        <FaGithub className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{login}</span>
      </p>
      <Button
        className="shrink-0 rounded-lg px-2 py-2 text-xs font-medium text-danger hover:bg-secondary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
        isDisabled={isSigningOut}
        onPress={onSignOut}
      >
        {t.signOut}
      </Button>
    </div>
  );
}
