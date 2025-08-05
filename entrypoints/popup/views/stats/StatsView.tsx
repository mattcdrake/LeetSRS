import { ViewLayout } from '../../components/ViewLayout';

export function StatsView() {
  return (
    <ViewLayout>
      <div className="stats-view">
        <div className="view-header">
          <h1>Statistics</h1>
          <span className="subtitle">Your progress overview</span>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Total Reviews</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Cards Learned</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">0%</div>
            <div className="stat-label">Success Rate</div>
          </div>

          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">Day Streak</div>
          </div>
        </div>

        <div className="chart-placeholder">
          <h3>Weekly Activity</h3>
          <p>Chart will appear here</p>
        </div>

        <div className="chart-placeholder">
          <h3>Difficulty Distribution</h3>
          <p>Chart will appear here</p>
        </div>
      </div>
    </ViewLayout>
  );
}
