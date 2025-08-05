import { Doughnut } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { useCardStateStatsQuery } from '@/hooks/useBackgroundQueries';
import { State as FsrsState } from 'ts-fsrs';

ChartJS.register(ArcElement, Tooltip, Legend);

export function CardDistributionChart() {
  const { data: cardStateStats } = useCardStateStatsQuery();

  const chartData = {
    labels: ['New', 'Learning', 'Review', 'Relearning'],
    datasets: [
      {
        data: cardStateStats
          ? [
              cardStateStats[FsrsState.New],
              cardStateStats[FsrsState.Learning],
              cardStateStats[FsrsState.Review],
              cardStateStats[FsrsState.Relearning],
            ]
          : [0, 0, 0, 0],
        backgroundColor: ['#3b82f6', '#f59e0b', '#10b981', '#ef4444'],
        borderColor: ['#2563eb', '#d97706', '#059669', '#dc2626'],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
        },
      },
    },
    layout: {
      padding: {
        bottom: 5,
      },
    },
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold">Card Distribution</h3>
      <div style={{ height: '200px' }}>
        <Doughnut data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
