import { FaGlobe, FaChevronDown } from 'react-icons/fa6';
import { Select, SelectValue, Button, Popover, ListBox, ListBoxItem } from 'react-aria-components';
import { useLanguageQuery, useSetLanguageMutation } from '@/hooks/useBackgroundQueries';
import { LANGUAGE_OPTIONS } from '@/shared/i18n';
import { useI18n } from '../../contexts/I18nContext';
import { DEFAULT_LANGUAGE, FEATURE_FLAGS, type Language } from '@/shared/settings';

export function LanguageSection() {
  const t = useI18n();
  const { data: language = DEFAULT_LANGUAGE } = useLanguageQuery();
  const setLanguageMutation = useSetLanguageMutation();

  if (!FEATURE_FLAGS.languageSelection) {
    return null;
  }

  const selectedOption = LANGUAGE_OPTIONS.find((opt) => opt.code === language);

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">{t.settings.language.title}</h3>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaGlobe className="text-tertiary" />
          <span>{t.settings.language.label}</span>
        </div>
        <Select
          selectedKey={language}
          onSelectionChange={(key) => setLanguageMutation.mutate(key as Language)}
          aria-label={t.settings.language.label}
        >
          <Button className="flex items-center gap-2 px-3 py-1.5 rounded bg-tertiary text-primary hover:opacity-80 transition-opacity cursor-pointer">
            <SelectValue>{selectedOption?.nativeName ?? language}</SelectValue>
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
