import { ViewLayout } from '../../components/ViewLayout';
import { i18n } from '@/shared/i18n';
import { AppearanceSection } from './AppearanceSection';
import { ProblemAutoClearSection } from './ProblemAutoClearSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';
import { GistSyncSection } from './GistSyncSection';
import { DataSection } from './DataSection';
import { AboutSection } from './AboutSection';

export function SettingsView() {
  return (
    <ViewLayout title={i18n.settings.title}>
      <AppearanceSection />
      <ProblemAutoClearSection />
      <ReviewSettingsSection />
      <GistSyncSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
