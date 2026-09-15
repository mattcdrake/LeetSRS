import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { AboutSection } from './AboutSection';
import { AppearanceSection } from './AppearanceSection';
import { DataSection } from './DataSection';
import { EditorResetSection } from './EditorResetSection';
import { GistSyncSection } from './GistSyncSection';
import { LanguageSection } from './LanguageSection';
import { LeetcodeCnSection } from './LeetcodeCnSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';

export function SettingsView() {
  const t = useI18n();
  return (
    <ViewLayout title={t.settings.title}>
      <LanguageSection />
      <AppearanceSection />
      <EditorResetSection />
      <ReviewSettingsSection />
      <GistSyncSection />
      <DataSection />
      <LeetcodeCnSection />
      <AboutSection />
    </ViewLayout>
  );
}
