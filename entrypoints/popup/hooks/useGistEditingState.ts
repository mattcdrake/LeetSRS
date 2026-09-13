import { useEffect, useRef, useState } from 'react';
import type { GistSyncConfig } from '@/domain/gist-sync';

type GistViewMode = 'unset' | 'editing' | 'viewing' | 'saved';

export function useGistEditingState(config: GistSyncConfig | undefined) {
  const [viewMode, setViewMode] = useState<GistViewMode>('unset');
  const [formKey, setFormKey] = useState(0);
  const editButton = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const connected = !!config?.pat && !!config?.gistId;
  const editing = viewMode === 'editing';

  if (config && viewMode === 'unset') {
    setViewMode(connected ? 'viewing' : 'editing');
  } else if (viewMode === 'saved' && connected) {
    setViewMode('viewing');
  } else if (config && !connected && viewMode === 'viewing') {
    // Without a saved connection, closing the form returns to fresh setup.
    setViewMode('editing');
  }

  useEffect(() => {
    if (wasEditing.current && !editing && connected) {
      editButton.current?.focus();
      wasEditing.current = false;
    } else if (editing) wasEditing.current = true;
  }, [editing, connected]);

  return {
    connected,
    editing,
    formKey,
    editButton,
    startEditing: () => setViewMode('editing'),
    finishSaving: () => setViewMode('saved'),
    closeEditing: () => {
      setViewMode('viewing');
      setFormKey((key) => key + 1);
    },
  };
}
