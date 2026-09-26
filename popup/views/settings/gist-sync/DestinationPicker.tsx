import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from 'react-aria-components';
import { LuExternalLink } from 'react-icons/lu';
import { useI18n } from '@/popup/contexts/I18nContext';
import { gistSyncQueryKeys } from '@/popup/queries/gist-sync';
import { buttonInteraction, compactGhostButton, compactOutlineButton } from '@/popup/styles';
import { background } from '@/shared/background-service';
import type { GistConnectionResult, GistSetup } from '@/shared/gist-sync';
import { SettingsRow } from '../SettingsGroup';
import { SettingsSelect } from '../SettingsSelect';

interface DestinationPickerProps {
  accountId: number;
  gistId: string | null | undefined;
  canListDestinations: boolean;
  isDisabled: boolean;
  isSaving: boolean;
  highlight: boolean;
  onSave: (setup: GistSetup, options: { onSuccess: (result: GistConnectionResult) => void }) => void;
  onClearFeedback: () => void;
}

export function DestinationPicker({
  accountId,
  gistId,
  canListDestinations,
  isDisabled,
  isSaving,
  highlight,
  onSave,
  onClearFeedback,
}: DestinationPickerProps) {
  const t = useI18n().settings.gistSync;
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [highlightDismissed, setHighlightDismissed] = useState(false);
  const destinations = useQuery({
    queryKey: [...gistSyncQueryKeys.all, 'destinations', accountId],
    queryFn: () => background.listGistDestinations(),
    enabled: canListDestinations,
  });
  const destination = selected ?? gistId ?? destinations.data?.find((gist) => gist.suggested)?.id ?? '';
  const edit = (editing: boolean) => {
    setEditing(editing);
    setSelected(null);
    onClearFeedback();
  };

  if (gistId && !editing) {
    const description = destinations.data?.find((gist) => gist.id === gistId)?.description ?? gistId;
    return (
      <SettingsRow
        label={t.destination}
        hint={
          <span className="block truncate" title={description}>
            {description}
          </span>
        }
      >
        <span className="flex shrink-0 items-center">
          <a
            aria-label={t.openGist}
            className={`${compactGhostButton} w-7 justify-center px-0`}
            href={`https://gist.github.com/${encodeURIComponent(gistId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <LuExternalLink className="size-3.5" aria-hidden="true" />
          </a>
          <Button className={compactGhostButton} isDisabled={isDisabled} onPress={() => edit(true)}>
            {t.change}
          </Button>
        </span>
      </SettingsRow>
    );
  }

  const highlighted = highlight && !highlightDismissed && !gistId;
  let hint = null;
  if (destinations.isError) {
    hint = (
      <span role="alert">
        {t.loadBackupsFailed}{' '}
        <Button
          className={`rounded-sm text-accent hover:underline ${buttonInteraction}`}
          onPress={() => void destinations.refetch()}
        >
          {t.retry}
        </Button>
      </span>
    );
  } else if (canListDestinations && destinations.isPending) {
    hint = <span role="status">{t.loadingBackups}</span>;
  } else if (destinations.data?.length === 0) {
    hint = t.noBackups;
  }

  return (
    <div
      className={highlighted ? 'github-gist-highlight m-1.5 rounded-lg border' : ''}
      onAnimationEnd={() => setHighlightDismissed(true)}
    >
      <SettingsSelect
        label={t.destination}
        hint={hint}
        className={`${highlighted ? 'mx-2' : 'mx-3.5'} flex min-h-11 items-center gap-3 py-2`}
        placeholder={t.chooseBackup}
        isDisabled={isDisabled}
        value={destination || null}
        options={[
          { value: 'create', label: t.createNewGist },
          ...(destinations.data ?? []).map((gist) => ({
            value: gist.id,
            label: gist.description,
            detail: (
              <span className="text-tertiary">
                {' · '}
                {t.backupDate(new Date(gist.updatedAt))}
                {gist.suggested && (
                  <span className="ml-1.5 rounded bg-accent-soft px-1 py-px text-[11px] text-accent">
                    {t.previousBackup}
                  </span>
                )}
              </span>
            ),
          })),
        ]}
        onChange={(value) => {
          setHighlightDismissed(true);
          setSelected(value);
        }}
      />
      <div className={`${highlighted ? 'mx-2' : 'mx-3.5'} flex justify-end gap-1 pb-3`}>
        {gistId && (
          <Button className={compactGhostButton} isDisabled={isDisabled} onPress={() => edit(false)}>
            {t.cancel}
          </Button>
        )}
        <Button
          className={compactOutlineButton}
          isDisabled={isDisabled || !destination}
          onPress={() =>
            onSave(destination === 'create' ? { mode: 'create' } : { mode: 'existing', gistId: destination }, {
              onSuccess: (result) => {
                if (result.saved) {
                  setEditing(false);
                  setSelected(null);
                }
              },
            })
          }
        >
          {isSaving ? t.saving : gistId ? t.save : t.connectAndSync}
        </Button>
      </div>
    </div>
  );
}
