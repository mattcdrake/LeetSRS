import { useState } from 'react';

export function NotesSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-current rounded-lg bg-secondary overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-tertiary transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-semibold text-primary">Notes</span>
        <span className={`text-xs text-secondary transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
          ▶
        </span>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-current">
          <textarea
            className="w-full mt-3 p-2 rounded border border-current bg-tertiary text-primary text-sm resize-none focus:outline-none focus:ring-1 focus:ring-accent"
            placeholder="Add your notes here..."
            rows={4}
          />
          <div className="mt-2 flex justify-end">
            <button className="px-4 py-1.5 rounded text-sm bg-accent text-white hover:opacity-80 transition-opacity">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
