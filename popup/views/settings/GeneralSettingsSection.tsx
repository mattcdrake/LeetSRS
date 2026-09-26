import { useI18n } from '@/popup/contexts/I18nContext';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import type { LeetcodeDomain } from '@/shared/leetcode-domain';
import type { Language, Theme } from '@/shared/settings';
import { LeetcodeCnSection } from './LeetcodeCnSection';
import { SettingsCard, SettingsSection } from './SettingsGroup';
import { SettingsSelect } from './SettingsSelect';

export function GeneralSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  return (
    <SettingsSection id="general-heading" title={t.settings.groups.general}>
      <SettingsCard>
        <SettingsSelect<Language>
          label={t.settings.language.label}
          options={[
            { value: 'en', label: 'English' },
            { value: 'zh-CN', label: '简体中文' },
          ]}
          value={settings.language}
          onChange={(language) => updateSettingsMutation.mutate({ language })}
        />
        <SettingsSelect<Theme>
          label={t.settings.appearance.theme}
          options={[
            { value: 'system', label: t.settings.appearance.themeSystem },
            { value: 'light', label: t.settings.appearance.themeLight },
            { value: 'dark', label: t.settings.appearance.themeDark },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettingsMutation.mutate({ theme })}
        />
        <SettingsSelect<LeetcodeDomain>
          label={t.settings.preferredLeetcodeSite}
          options={[
            { value: 'leetcode.com', label: 'leetcode.com' },
            { value: 'leetcode.cn', label: 'leetcode.cn' },
          ]}
          value={settings.preferredLeetcodeSite}
          onChange={(preferredLeetcodeSite) => updateSettingsMutation.mutate({ preferredLeetcodeSite })}
        />
        <LeetcodeCnSection />
      </SettingsCard>
    </SettingsSection>
  );
}
