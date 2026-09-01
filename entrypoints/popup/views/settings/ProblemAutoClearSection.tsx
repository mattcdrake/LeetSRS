import {
  useResetEditorOnEveryProblemQuery,
  useSetResetEditorOnEveryProblemMutation,
} from '@/hooks/useBackgroundQueries';
import { DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM } from '@/shared/settings';
import { useI18n } from '../../contexts/I18nContext';
import { SettingsSwitch } from './SettingsSwitch';

export function ProblemAutoClearSection() {
  const t = useI18n();
  const { data: resetEditorOnEveryProblem = DEFAULT_RESET_EDITOR_ON_EVERY_PROBLEM } =
    useResetEditorOnEveryProblemQuery();
  const setResetEditorOnEveryProblemMutation = useSetResetEditorOnEveryProblemMutation();

  const setResetEditorOnEveryProblem = (isSelected: boolean) => {
    setResetEditorOnEveryProblemMutation.mutate(isSelected);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{t.settings.problemAutoClear.title}</h3>
      <p className="text-sm text-tertiary mb-4">{t.settings.problemAutoClear.description}</p>
      <div className="space-y-3">
        <SettingsSwitch
          label={t.settings.problemAutoClear.resetEditorOnEveryProblem}
          isSelected={resetEditorOnEveryProblem}
          onChange={setResetEditorOnEveryProblem}
        />
      </div>
    </div>
  );
}
