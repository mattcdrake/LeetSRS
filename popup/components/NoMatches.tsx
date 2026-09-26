import { LuSearch } from 'react-icons/lu';
import { buttonInteraction } from '@/popup/styles';

interface NoMatchesProps {
  title: string;
  hint: string;
  clearLabel: string;
  onClear: () => void;
}

// Shown when search or filters hide every item, with a way to reset them.
export function NoMatches({ title, hint, clearLabel, onClear }: NoMatchesProps) {
  return (
    <div className="px-6 pt-10 pb-2 text-center">
      <div className="mx-auto size-9 rounded-full bg-secondary grid place-items-center text-tertiary">
        <LuSearch aria-hidden="true" className="size-4" strokeWidth={2} />
      </div>
      <p className="mt-3 text-[13px] font-medium">{title}</p>
      <p className="mt-1 text-xs text-tertiary">{hint}</p>
      <button
        type="button"
        className={`mt-4 h-8 px-3 rounded-lg border border-strong text-xs text-secondary duration-[120ms] hover:bg-secondary ${buttonInteraction}`}
        onClick={onClear}
      >
        {clearLabel}
      </button>
    </div>
  );
}
