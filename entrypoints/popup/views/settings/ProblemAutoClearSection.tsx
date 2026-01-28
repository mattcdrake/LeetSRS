import { Switch } from 'react-aria-components';
import { useAutoClearLeetcodeQuery, useSetAutoClearLeetcodeMutation } from '@/hooks/useBackgroundQueries';
import { DEFAULT_AUTO_CLEAR_LEETCODE } from '@/shared/settings';
import { i18n } from '@/shared/i18n';

export function ProblemAutoClearSection() {
  const { data: autoClearLeetcode = DEFAULT_AUTO_CLEAR_LEETCODE } = useAutoClearLeetcodeQuery();
  const setAutoClearLeetcodeMutation = useSetAutoClearLeetcodeMutation();

  const toggleLeetcode = () => {
    setAutoClearLeetcodeMutation.mutate(!autoClearLeetcode);
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-2">{i18n.settings.problemAutoClear.title}</h3>
      <p className="text-sm text-tertiary mb-4">{i18n.settings.problemAutoClear.description}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span>{i18n.settings.problemAutoClear.enableAutoReset}</span>
          <Switch
            isSelected={autoClearLeetcode}
            onChange={toggleLeetcode}
            className="group inline-flex touch-none items-center"
          >
            {({ isSelected }) => (
              <span
                className={`relative flex items-center h-6 w-11 cursor-pointer rounded-full transition-colors ${
                  isSelected ? 'bg-accent' : 'bg-tertiary border border-current'
                } group-data-[focus-visible]:ring-2 ring-offset-2 ring-offset-primary`}
              >
                <span
                  className={`block h-5 w-5 mx-0.5 rounded-full bg-white shadow-sm transition-all ${
                    isSelected ? 'translate-x-5' : ''
                  } group-data-[pressed]:scale-95`}
                />
              </span>
            )}
          </Switch>
        </div>
      </div>
    </div>
  );
}
