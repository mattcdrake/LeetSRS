import { Button } from 'react-aria-components';
import { FaGithub } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { compactGhostButton } from '@/popup/styles';
import { RowText, settingsRow } from '../SettingsGroup';

interface AccountRowProps {
  login: string;
  isSigningOut: boolean;
  onSignOut: () => void;
}

export function AccountRow({ login, isSigningOut, onSignOut }: AccountRowProps) {
  const t = useI18n().settings.gistSync;
  return (
    <div className={settingsRow}>
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-primary">
        <FaGithub className="size-3.5" aria-hidden="true" />
      </span>
      <RowText label={<span className="block truncate">{login}</span>} />
      <Button className={compactGhostButton} isDisabled={isSigningOut} onPress={onSignOut}>
        {t.signOut}
      </Button>
    </div>
  );
}
