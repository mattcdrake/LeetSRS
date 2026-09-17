import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import type { IconType } from 'react-icons';
import { FaChevronDown, FaCircleHalfStroke, FaGlobe } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/popup/queries/settings';
import type { LeetcodeDomain } from '@/shared/models';
import type { Language, Theme } from '@/shared/settings';
import { LeetcodeCnSection } from './LeetcodeCnSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';

interface SettingsSelectProps<Value extends string> {
  label: string;
  icon: IconType;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
}

function SettingsSelect<Value extends string>({
  label,
  icon: Icon,
  options,
  value,
  onChange,
}: SettingsSelectProps<Value>) {
  return (
    <Select
      className="flex min-h-10 items-center justify-between gap-3"
      value={value}
      onChange={(key) => {
        const option = options.find((option) => option.value === key);
        if (option) onChange(option.value);
      }}
    >
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="w-4 h-4 shrink-0 text-secondary" />
        <Label>{label}</Label>
      </div>
      <Button className="flex shrink-0 min-h-10 items-center gap-2 px-3 py-2 rounded-lg border border-current bg-primary text-primary hover:bg-secondary cursor-pointer">
        <SelectValue />
        <FaChevronDown aria-hidden="true" className="text-xs" />
      </Button>
      <Popover className="bg-primary text-primary border border-current rounded-lg shadow-lg p-1 min-w-[120px]">
        <ListBox className="outline-none">
          {options.map((option) => (
            <ListBoxItem
              key={option.value}
              id={option.value}
              className="px-3 py-2 rounded cursor-pointer outline-none text-primary hover:bg-secondary focus:bg-secondary data-[selected]:bg-secondary"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

export function GeneralSettingsSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  return (
    <>
      <ReviewSettingsSection />
      <section
        aria-labelledby="display-heading"
        className="mb-3 pt-3 border-t border-current space-y-1 text-xs text-primary"
      >
        <h3 id="display-heading" className="text-sm font-medium">
          {t.settings.groups.display}
        </h3>
        <SettingsSelect<Language>
          label={t.settings.language.label}
          icon={FaGlobe}
          options={[
            { value: 'en', label: 'English' },
            { value: 'zh-CN', label: '简体中文' },
          ]}
          value={settings.language}
          onChange={(language) => updateSettingsMutation.mutate({ language })}
        />
        <SettingsSelect<Theme>
          label={t.settings.appearance.theme}
          icon={FaCircleHalfStroke}
          options={[
            { value: 'system', label: t.settings.appearance.themeSystem },
            { value: 'light', label: t.settings.appearance.themeLight },
            { value: 'dark', label: t.settings.appearance.themeDark },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettingsMutation.mutate({ theme })}
        />
      </section>
      <section
        aria-labelledby="leetcode-heading"
        className="mb-3 pt-3 border-t border-current space-y-1 text-xs text-primary"
      >
        <h3 id="leetcode-heading" className="text-sm font-medium">
          {t.settings.groups.leetcode}
        </h3>
        <SettingsSelect<LeetcodeDomain>
          label={t.settings.preferredLeetcodeSite}
          icon={FaGlobe}
          options={[
            { value: 'leetcode.com', label: 'leetcode.com' },
            { value: 'leetcode.cn', label: 'leetcode.cn' },
          ]}
          value={settings.preferredLeetcodeSite}
          onChange={(preferredLeetcodeSite) => updateSettingsMutation.mutate({ preferredLeetcodeSite })}
        />
        <LeetcodeCnSection />
      </section>
    </>
  );
}
