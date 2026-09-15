import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { AboutSection } from './AboutSection';
import { DataSection } from './DataSection';
import { GeneralSettingsSection } from './GeneralSettingsSection';
import { GistSyncSection } from './GistSyncSection';

export function SettingsView() {
  const t = useI18n();
  return (
    <ViewLayout title={t.settings.title}>
      <GeneralSettingsSection />
      <GistSyncSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
