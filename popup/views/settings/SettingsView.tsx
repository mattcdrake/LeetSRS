import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { AboutSection } from './AboutSection';
import { DataSection } from './DataSection';
import { GeneralSettingsSection } from './GeneralSettingsSection';
import { GistSyncSection } from './GistSyncSection';

export function SettingsView({
  highlightGithubSignIn = false,
  highlightGistSetup = false,
}: {
  highlightGithubSignIn?: boolean;
  highlightGistSetup?: boolean;
}) {
  const t = useI18n();
  return (
    <ViewLayout title={t.settings.title}>
      <GistSyncSection highlightSignIn={highlightGithubSignIn} highlightSetup={highlightGistSetup} />
      <GeneralSettingsSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
