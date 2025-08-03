import { useTodayStatsQuery } from '@/hooks/useBackgroundQueries';
import { Rating } from 'ts-fsrs';

export function TodayStats({ style }: { style?: React.CSSProperties }) {
  const { data: stats, isLoading, error, refetch } = useTodayStatsQuery();

  if (isLoading) {
    return (
      <div style={style}>
        <h3>Today&apos;s Stats</h3>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={style}>
        <h3>Today&apos;s Stats</h3>
        <p style={{ color: '#f44336' }}>Error loading stats: {error.message}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={style}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0 }}>Today&apos;s Stats</h3>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#444',
              color: '#fff',
              border: '1px solid #555',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>
        <p style={{ color: '#666' }}>No reviews today</p>
      </div>
    );
  }

  const getGradeLabel = (grade: Rating): string => {
    switch (grade) {
      case Rating.Again:
        return 'Again';
      case Rating.Hard:
        return 'Hard';
      case Rating.Good:
        return 'Good';
      case Rating.Easy:
        return 'Easy';
      default:
        return 'Unknown';
    }
  };

  const getGradeColor = (grade: Rating): string => {
    switch (grade) {
      case Rating.Again:
        return '#f44336';
      case Rating.Hard:
        return '#ff9800';
      case Rating.Good:
        return '#4caf50';
      case Rating.Easy:
        return '#2196f3';
      default:
        return '#666';
    }
  };

  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0 }}>Today&apos;s Stats ({stats.date})</h3>
        <button
          onClick={() => refetch()}
          disabled={isLoading}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: '#444',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>🔥 Streak:</span>
          <span style={{ fontWeight: 'bold', color: stats.streak > 1 ? '#ff9800' : '#666' }}>
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>📊 Total Reviews:</span>
          <span style={{ fontWeight: 'bold' }}>{stats.totalReviews}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>🆕 New Cards:</span>
          <span>{stats.newCards}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>🔄 Reviewed Cards:</span>
          <span>{stats.reviewedCards}</span>
        </div>
      </div>

      <div>
        <h4 style={{ marginBottom: '8px' }}>Grade Breakdown</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {([Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const).map((grade) => {
            const count = stats.gradeBreakdown[grade];
            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;

            return (
              <div key={grade} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '50px', fontSize: '12px' }}>{getGradeLabel(grade)}:</span>
                <div
                  style={{
                    flex: 1,
                    height: '20px',
                    backgroundColor: '#333',
                    borderRadius: '4px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${percentage}%`,
                      height: '100%',
                      backgroundColor: getGradeColor(grade),
                      transition: 'width 0.3s ease',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '11px',
                      color: '#fff',
                      textShadow: '0 0 2px rgba(0,0,0,0.5)',
                    }}
                  >
                    {count} {percentage > 0 && `(${percentage.toFixed(0)}%)`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
