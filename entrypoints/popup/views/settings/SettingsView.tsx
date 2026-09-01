import { ViewLayout } from '../../components/ViewLayout';
import { useI18n } from '../../contexts/I18nContext';
import { AboutSection } from './AboutSection';
import { AppearanceSection } from './AppearanceSection';
import { DataSection } from './DataSection';
import { GistSyncSection } from './GistSyncSection';
import { LanguageSection } from './LanguageSection';
import { LeetcodeCnSection } from './LeetcodeCnSection';
import { ProblemAutoClearSection } from './ProblemAutoClearSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';

export function SettingsView() {
  const t = useI18n();
  return (
    <ViewLayout title={t.settings.title}>
      <LanguageSection />
      <AppearanceSection />
      <ProblemAutoClearSection />
      <ReviewSettingsSection />
      <GistSyncSection />
      <DataSection />
      <LeetcodeCnSection />
      <AboutSection />
    </ViewLayout>
  );
}
