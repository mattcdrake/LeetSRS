import { ViewLayout } from '../../components/ViewLayout';
import { i18n } from '@/shared/i18n';
import { AppearanceSection } from './AppearanceSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';
import { GistSyncSection } from './GistSyncSection';
import { DataSection } from './DataSection';
import { AboutSection } from './AboutSection';

export function SettingsView() {
  return (
    <ViewLayout title={i18n.settings.title}>
      <AppearanceSection />
      <ReviewSettingsSection />
      <GistSyncSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
