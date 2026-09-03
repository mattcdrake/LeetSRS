import { Button, Label, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { FaChevronDown, FaCircleHalfStroke } from 'react-icons/fa6';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/hooks/queries/settings';
import type { Theme } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function AppearanceSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const setAnimationsEnabled = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ animationsEnabled: isSelected });
  };

  const setBadgeEnabled = (isSelected: boolean) => {
    updateSettingsMutation.mutate({ badgeEnabled: isSelected });
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{t.settings.appearance.title}</h3>
      <div className="space-y-4">
        <Select
          className="flex items-center justify-between"
          value={settings.theme}
          onChange={(key) => updateSettingsMutation.mutate({ theme: key as Theme })}
        >
          <div className="flex items-center gap-2">
            <FaCircleHalfStroke className="text-tertiary" />
            <Label>{t.settings.appearance.theme}</Label>
          </div>
          <Button className="flex items-center gap-2 px-3 py-1.5 rounded bg-tertiary text-primary hover:opacity-80 transition-opacity cursor-pointer">
            <SelectValue />
            <FaChevronDown className="text-xs" />
          </Button>
          <Popover className="bg-secondary text-primary border border-tertiary rounded-lg shadow-lg p-1 min-w-[120px]">
            <ListBox className="outline-none">
              <ListBoxItem
                id="system"
                className="px-3 py-2 rounded cursor-pointer outline-none hover:bg-tertiary focus:bg-tertiary data-[selected]:bg-tertiary"
              >
                {t.settings.appearance.themeSystem}
              </ListBoxItem>
              <ListBoxItem
                id="light"
                className="px-3 py-2 rounded cursor-pointer outline-none hover:bg-tertiary focus:bg-tertiary data-[selected]:bg-tertiary"
              >
                {t.settings.appearance.themeLight}
              </ListBoxItem>
              <ListBoxItem
                id="dark"
                className="px-3 py-2 rounded cursor-pointer outline-none hover:bg-tertiary focus:bg-tertiary data-[selected]:bg-tertiary"
              >
                {t.settings.appearance.themeDark}
              </ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <SettingsSwitch
          label={t.settings.appearance.enableAnimations}
          isSelected={settings.animationsEnabled}
          onChange={setAnimationsEnabled}
        />
        <SettingsSwitch
          label={t.settings.appearance.showBadge}
          isSelected={settings.badgeEnabled}
          onChange={setBadgeEnabled}
        />
      </div>
    </div>
  );
}
