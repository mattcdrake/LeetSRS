import { Doughnut } from 'react-chartjs-2';
import { ArcElement, Chart as ChartJS, Legend, Tooltip } from 'chart.js';
import { useCardStateStatsQuery } from '@/hooks/useBackgroundQueries';
import { State as FsrsState } from 'ts-fsrs';
import { useI18n } from '../../contexts/I18nContext';

ChartJS.register(ArcElement, Tooltip, Legend);

export function CardDistributionChart() {
  const t = useI18n();
  const { data: cardStateStats } = useCardStateStatsQuery();

  const chartData = {
    labels: [t.states.new, t.states.learning, t.states.review, t.states.relearning],
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
      <h3 className="text-lg font-semibold">{t.charts.cardDistribution}</h3>
      <div style={{ height: '200px' }}>
        <Doughnut data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
