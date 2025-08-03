export function StatsBar() {
  const stats = {
    reviews: 10,
    new: 3,
    again: 12,
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex items-center gap-1">
        <span className="font-semibold text-info">{stats.reviews}</span>
        <span className="text-secondary">reviews</span>
      </span>
      <span className="text-tertiary">•</span>
      <span className="flex items-center gap-1">
        <span className="font-semibold text-accent">{stats.new}</span>
        <span className="text-secondary">new</span>
      </span>
      <span className="text-tertiary">•</span>
      <span className="flex items-center gap-1">
        <span className="font-semibold text-danger">{stats.again}</span>
        <span className="text-secondary">again</span>
      </span>
    </div>
  );
}
