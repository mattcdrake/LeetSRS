import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from 'react-aria-components';
import { FaArrowUpRightFromSquare } from 'react-icons/fa6';
import { useI18n } from '@/popup/contexts/I18nContext';
import { gistSyncQueryKeys } from '@/popup/queries/gist-sync';
import { secondaryButton } from '@/popup/styles';
import { background } from '@/shared/background-service';
import type { GistConnectionResult, GistSetup } from '@/shared/gist-sync';

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
      <div className="space-y-1 pt-2">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="font-medium">{t.destination}</span>
          <a
            aria-label={t.openGist}
            className="inline-flex items-center gap-1.5 text-xs text-accent"
            href={`https://gist.github.com/${encodeURIComponent(gistId)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.open} <FaArrowUpRightFromSquare className="h-2.5 w-2.5" aria-hidden="true" />
          </a>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs text-secondary" title={description}>
            {description}
          </span>
          <Button
            className="shrink-0 rounded px-1 py-1 text-xs text-secondary hover:text-primary cursor-pointer focus-visible:outline-2"
            isDisabled={isDisabled}
            onPress={() => edit(true)}
          >
            {t.change}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 ${highlight && !highlightDismissed && !gistId ? 'github-gist-highlight rounded-lg p-3' : ''}`}
      onAnimationEnd={() => setHighlightDismissed(true)}
      onChange={() => setHighlightDismissed(true)}
    >
      <label className="block text-xs" htmlFor="gist-destination">
        {t.destination}
      </label>
      <select
        id="gist-destination"
        className="w-full min-h-10 px-3 py-2 rounded-lg border border-current bg-primary text-xs"
        value={destination}
        disabled={isDisabled}
        onChange={(event) => setSelected(event.target.value)}
      >
        <option value="">{t.chooseBackup}</option>
        <option value="create">{t.createNewGist}</option>
        {destinations.data?.map((gist) => (
          <option key={gist.id} value={gist.id}>
            {gist.description} — {new Date(gist.updatedAt).toLocaleDateString()}
            {gist.suggested ? ` (${t.previousBackup})` : ''}
          </option>
        ))}
      </select>
      {canListDestinations && destinations.isPending && <p role="status">{t.loadingBackups}</p>}
      {destinations.isError && (
        <p role="alert">
          {t.loadBackupsFailed}{' '}
          <Button className={secondaryButton} onPress={() => void destinations.refetch()}>
            {t.retry}
          </Button>
        </p>
      )}
      <Button
        className={`${secondaryButton} w-full font-medium`}
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
      {gistId && (
        <Button
          className="w-full rounded-lg py-2 text-xs text-secondary hover:bg-secondary cursor-pointer focus-visible:outline-2 disabled:opacity-50"
          isDisabled={isDisabled}
          onPress={() => edit(false)}
        >
          {t.cancel}
        </Button>
      )}
    </div>
  );
}
