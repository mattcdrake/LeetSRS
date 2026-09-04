import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { FaChevronDown, FaGlobe } from 'react-icons/fa6';
import { useSettingsQuery, useUpdateSettingsMutation } from '@/hooks/queries/settings';
import type { Language } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';

const LANGUAGE_OPTIONS: Array<{
  code: Language;
  name: string;
  nativeName: string;
}> = [
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
];

export function LanguageSection() {
  const t = useI18n();
  const { data: settings } = useSettingsQuery();
  const updateSettingsMutation = useUpdateSettingsMutation();

  const selectedOption = LANGUAGE_OPTIONS.find((opt) => opt.code === settings.language);

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{t.settings.language.title}</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaGlobe className="text-tertiary" />
          <span>{t.settings.language.label}</span>
        </div>
        <Select
          value={settings.language}
          onChange={(key) => updateSettingsMutation.mutate({ language: key as Language })}
          aria-label={t.settings.language.label}
        >
          <Button className="flex items-center gap-2 px-3 py-1.5 rounded bg-tertiary text-primary hover:opacity-80 transition-opacity cursor-pointer">
            <SelectValue>{selectedOption?.nativeName ?? settings.language}</SelectValue>
            <FaChevronDown className="text-xs" />
          </Button>
          <Popover className="bg-secondary text-primary border border-tertiary rounded-lg shadow-lg p-1 min-w-[120px]">
            <ListBox className="outline-none">
              {LANGUAGE_OPTIONS.map((option) => (
                <ListBoxItem
                  key={option.code}
                  id={option.code}
                  className="px-3 py-2 rounded cursor-pointer outline-none text-primary hover:bg-tertiary focus:bg-tertiary data-[selected]:bg-tertiary"
                >
                  {option.nativeName}
                </ListBoxItem>
              ))}
            </ListBox>
          </Popover>
        </Select>
      </div>
    </div>
  );
}
