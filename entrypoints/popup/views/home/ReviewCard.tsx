export function ReviewCard() {
  return (
    <div className="border border-current rounded-lg bg-secondary p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-accent">#1</span>
        <span className="text-xs px-2 py-1 rounded bg-accent text-white">Easy</span>
      </div>

      <div className="flex-1 flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-primary">Two Sum</h3>
        <p className="text-sm text-secondary">
          Given an array of integers nums and an integer target, return indices of the two numbers such that they add up
          to target.
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        <button className="px-3 py-1.5 rounded text-sm bg-danger text-white hover:opacity-80 transition-opacity">
          Again
        </button>
        <button className="px-3 py-1.5 rounded text-sm bg-tertiary text-primary hover:opacity-80 transition-opacity">
          Hard
        </button>
        <button className="px-3 py-1.5 rounded text-sm bg-tertiary text-primary hover:opacity-80 transition-opacity">
          Good
        </button>
        <button className="px-3 py-1.5 rounded text-sm bg-accent text-white hover:opacity-80 transition-opacity">
          Easy
        </button>
      </div>
    </div>
  );
}
