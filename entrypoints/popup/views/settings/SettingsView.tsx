import { Button } from 'react-aria-components';
import { ViewLayout } from '../../components/ViewLayout';
import { bounceButton } from '@/shared/styles';
import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { i18n } from '@/shared/i18n';
import { AppearanceSection } from './AppearanceSection';
import { ProblemAutoClearSection } from './ProblemAutoClearSection';
import { ReviewSettingsSection } from './ReviewSettingsSection';
import { GistSyncSection } from './GistSyncSection';
import { DataSection } from './DataSection';
import { AboutSection } from './AboutSection';

function HotkeysSection() {
  const [openPopupShortcut, setOpenPopupShortcut] = useState('');

  useEffect(() => {
    const loadShortcuts = async () => {
      try {
        const commands = await browser.commands.getAll();
        const openPopupCommand = commands.find((command) => command.name === 'open-popup');
        setOpenPopupShortcut(openPopupCommand?.shortcut ?? '');
      } catch (error) {
        console.error('Failed to load shortcuts:', error);
        setOpenPopupShortcut('');
      }
    };

    loadShortcuts();
  }, []);

  const handleManageShortcuts = async () => {
    try {
      await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } catch (error) {
      console.error('Failed to open shortcuts page:', error);
    }
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{i18n.settings.hotkeys.title}</h3>
      <p className="text-sm text-tertiary mb-4">{i18n.settings.hotkeys.description}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span>{i18n.settings.hotkeys.openPopupLabel}</span>
          <span className="text-sm text-tertiary">
            {i18n.settings.hotkeys.currentShortcutLabel}:{' '}
            {openPopupShortcut || i18n.settings.hotkeys.notSet}
          </span>
        </div>
        <Button
          onPress={handleManageShortcuts}
          className={`w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary ${bounceButton}`}
        >
          {i18n.settings.hotkeys.manageShortcuts}
        </Button>
      </div>
    </div>
  );
}

export function SettingsView() {
  return (
    <ViewLayout title={i18n.settings.title}>
      <AppearanceSection />
      <ProblemAutoClearSection />
      <HotkeysSection />
      <ReviewSettingsSection />
      <GistSyncSection />
      <DataSection />
      <AboutSection />
    </ViewLayout>
  );
}
