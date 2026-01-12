import { useState, useEffect } from 'react';
import { Button, TextField, Label, Input } from 'react-aria-components';
import { FaGithub, FaCheck, FaXmark, FaArrowsRotate, FaCloudArrowUp, FaCloudArrowDown } from 'react-icons/fa6';
import { bounceButton } from '@/shared/styles';
import {
  useGistSyncConfigQuery,
  useGistSyncStatusQuery,
  useSetGistSyncConfigMutation,
  useTriggerGistSyncMutation,
  useCreateNewGistMutation,
  useValidatePatMutation,
  useValidateGistIdMutation,
} from '@/hooks/useBackgroundQueries';
import { i18n } from '@/shared/i18n';

// Simple toggle component without React Aria's hidden input
function SimpleToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-tertiary border border-current'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function GistSyncSection() {
  const { data: config } = useGistSyncConfigQuery();
  const { data: status } = useGistSyncStatusQuery();

  const setConfigMutation = useSetGistSyncConfigMutation();
  const triggerSyncMutation = useTriggerGistSyncMutation();
  const createGistMutation = useCreateNewGistMutation();
  const validatePatMutation = useValidatePatMutation();
  const validateGistMutation = useValidateGistIdMutation();

  const [pat, setPat] = useState('');
  const [gistId, setGistId] = useState('');
  const [patValidation, setPatValidation] = useState<{ valid: boolean; username?: string } | null>(null);
  const [gistValidation, setGistValidation] = useState<{ valid: boolean } | null>(null);

  // Local state for immediate toggle feedback
  const [localEnabled, setLocalEnabled] = useState(false);

  // Sync local state with stored config
  useEffect(() => {
    if (config) {
      setPat(config.pat || '');
      setGistId(config.gistId || '');
      setLocalEnabled(config.enabled ?? false);
      if (config.pat) {
        setPatValidation({ valid: true });
      }
      if (config.gistId) {
        setGistValidation({ valid: true });
      }
    }
  }, [config]);

  const handleValidatePat = async () => {
    setPatValidation(null);
    const result = await validatePatMutation.mutateAsync(pat);
    setPatValidation(result);
    if (result.valid) {
      await setConfigMutation.mutateAsync({ pat });
    }
  };

  const handleValidateGist = async () => {
    setGistValidation(null);
    const result = await validateGistMutation.mutateAsync({ gistId, pat });
    setGistValidation(result);
    if (result.valid) {
      await setConfigMutation.mutateAsync({ gistId });
    }
  };

  const handleCreateGist = async () => {
    try {
      const result = await createGistMutation.mutateAsync();
      setGistId(result.gistId);
      setGistValidation({ valid: true });
    } catch (error) {
      console.error('Failed to create gist:', error);
      alert(i18n.settings.gistSync.createGistFailed);
    }
  };

  const handleToggleSync = async () => {
    const newValue = !localEnabled;

    if (newValue) {
      // Enabling sync - validate requirements
      if (!pat || !patValidation?.valid) {
        alert(i18n.settings.gistSync.patRequired);
        return;
      }
      if (!gistId || !gistValidation?.valid) {
        alert(i18n.settings.gistSync.gistRequired);
        return;
      }
    }

    // Update local state immediately for instant feedback
    setLocalEnabled(newValue);
    await setConfigMutation.mutateAsync({ enabled: newValue });

    // Sync immediately when enabling
    if (newValue) {
      await triggerSyncMutation.mutateAsync();
    }
  };

  const handleSyncNow = async () => {
    await triggerSyncMutation.mutateAsync();
  };

  const formatLastSync = () => {
    if (!status?.lastSyncTime) return i18n.settings.gistSync.lastSyncNever;
    const date = new Date(status.lastSyncTime);
    return date.toLocaleString();
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <FaGithub />
        {i18n.settings.gistSync.title}
      </h3>
      <p className="text-sm text-tertiary mb-4">{i18n.settings.gistSync.description}</p>

      <div className="space-y-4">
        {/* PAT Input */}
        <TextField className="flex flex-col gap-1">
          <Label className="text-sm">{i18n.settings.gistSync.patLabel}</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={pat}
              onChange={(e) => {
                setPat(e.target.value);
                setPatValidation(null);
              }}
              placeholder={i18n.settings.gistSync.patPlaceholder}
              className="flex-1 px-2 py-1 rounded border bg-tertiary text-primary border-current text-sm"
            />
            <Button
              onPress={handleValidatePat}
              isDisabled={!pat || validatePatMutation.isPending}
              className={`px-3 py-1 rounded bg-accent text-white text-sm disabled:opacity-50 ${bounceButton}`}
            >
              {validatePatMutation.isPending ? i18n.settings.gistSync.validating : i18n.settings.gistSync.validatePat}
            </Button>
          </div>
          {patValidation && (
            <div
              className={`text-sm flex items-center gap-1 ${patValidation.valid ? 'text-green-500' : 'text-red-500'}`}
            >
              {patValidation.valid ? <FaCheck /> : <FaXmark />}
              {patValidation.valid
                ? `${i18n.settings.gistSync.patValid}${patValidation.username ? ` (${patValidation.username})` : ''}`
                : i18n.settings.gistSync.patInvalid}
            </div>
          )}
          <div className="text-xs text-tertiary">
            {i18n.settings.gistSync.patHelpText}{' '}
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=LeetSRS"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              {i18n.settings.gistSync.patHelpLink}
            </a>
          </div>
        </TextField>

        {/* Gist Selection - only show after PAT is validated */}
        {patValidation?.valid && (
          <div className="space-y-2">
            <Label className="text-sm">{i18n.settings.gistSync.gistIdLabel}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={gistId}
                onChange={(e) => {
                  setGistId(e.target.value);
                  setGistValidation(null);
                }}
                placeholder={i18n.settings.gistSync.gistIdPlaceholder}
                className="flex-1 px-2 py-1 rounded border bg-tertiary text-primary border-current text-sm"
              />
              <Button
                onPress={handleValidateGist}
                isDisabled={!gistId || validateGistMutation.isPending}
                className={`px-3 py-1 rounded bg-accent text-white text-sm disabled:opacity-50 ${bounceButton}`}
              >
                {i18n.settings.gistSync.validateGist}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onPress={handleCreateGist}
                isDisabled={createGistMutation.isPending}
                className={`flex-1 px-3 py-2 rounded bg-tertiary text-primary text-sm disabled:opacity-50 ${bounceButton}`}
              >
                {createGistMutation.isPending ? i18n.settings.gistSync.creating : i18n.settings.gistSync.createNewGist}
              </Button>
            </div>
            {gistValidation && (
              <div
                className={`text-sm flex items-center gap-1 ${gistValidation.valid ? 'text-green-500' : 'text-red-500'}`}
              >
                {gistValidation.valid ? <FaCheck /> : <FaXmark />}
                {gistValidation.valid ? i18n.settings.gistSync.gistValid : i18n.settings.gistSync.gistInvalid}
              </div>
            )}
          </div>
        )}

        {/* Sync controls - only show after PAT and Gist are validated */}
        {patValidation?.valid && gistValidation?.valid && (
          <div className="space-y-4 pt-2 border-t border-tertiary">
            {/* Enable Automatic Sync Toggle */}
            <div className="flex items-center justify-between">
              <span>{i18n.settings.gistSync.enableSync}</span>
              <SimpleToggle enabled={localEnabled} onToggle={handleToggleSync} />
            </div>

            {/* Sync Status */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-tertiary">{i18n.settings.gistSync.lastSync}:</span>
              <span className="flex items-center gap-1">
                {status?.lastSyncDirection === 'push' && <FaCloudArrowUp className="text-accent" />}
                {status?.lastSyncDirection === 'pull' && <FaCloudArrowDown className="text-accent" />}
                {formatLastSync()}
              </span>
            </div>

            {/* Manual Sync Button */}
            <Button
              onPress={handleSyncNow}
              isDisabled={triggerSyncMutation.isPending || status?.syncInProgress}
              className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 bg-accent text-white disabled:opacity-50 ${bounceButton}`}
            >
              <FaArrowsRotate className={triggerSyncMutation.isPending ? 'animate-spin' : ''} />
              {triggerSyncMutation.isPending ? i18n.settings.gistSync.syncing : i18n.settings.gistSync.syncNow}
            </Button>

            {status?.lastError && (
              <div className="text-sm text-red-500">
                {i18n.settings.gistSync.syncFailed}: {status.lastError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
