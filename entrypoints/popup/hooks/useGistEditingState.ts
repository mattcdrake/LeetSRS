import { useEffect, useRef, useState } from 'react';
import type { GistSyncConfig } from '@/domain/gist-sync';

type GistViewMode = 'unset' | 'editing' | 'viewing';

export function useGistEditingState(config: GistSyncConfig | undefined) {
  const [viewMode, setViewMode] = useState<GistViewMode>('unset');
  const [formKey, setFormKey] = useState(0);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const connected = !!config?.pat && !!config?.gistId;
  const editing = viewMode === 'editing';

  if (config && viewMode === 'unset') {
    setViewMode(connected ? 'viewing' : 'editing');
  } else if (config && !connected && viewMode === 'viewing') {
    // Without a saved connection, closing the form returns to fresh setup.
    setViewMode('editing');
  }

  useEffect(() => {
    if (wasEditing.current && !editing) editButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  return {
    connected,
    editing,
    formKey,
    editButton,
    startEditing: () => setViewMode('editing'),
    closeEditing: () => {
      setViewMode('viewing');
      setFormKey((key) => key + 1);
    },
  };
}
