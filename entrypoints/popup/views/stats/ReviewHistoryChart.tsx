import { Bar } from 'react-chartjs-2';
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import { useLastNDaysStatsQuery } from '@/hooks/useBackgroundQueries';
import { Rating } from 'ts-fsrs';
import { useI18n } from '../../contexts/I18nContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export function ReviewHistoryChart() {
  const t = useI18n();
  const { data: last30DaysStats } = useLastNDaysStatsQuery(30);

  const chartData = {
    labels:
      last30DaysStats?.map((stat) => {
        // Parse YYYY-MM-DD format explicitly to avoid timezone issues
        const [, month, day] = stat.date.split('-').map(Number);
        return `${month}/${day}`;
      }) || [],
    datasets: [
      {
        label: t.ratings.again,
        data: last30DaysStats?.map((stat) => stat.gradeBreakdown[Rating.Again]) || [],
        backgroundColor: '#ef4444',
      },
      {
        label: t.ratings.hard,
        data: last30DaysStats?.map((stat) => stat.gradeBreakdown[Rating.Hard]) || [],
        backgroundColor: '#f59e0b',
      },
      {
        label: t.ratings.good,
        data: last30DaysStats?.map((stat) => stat.gradeBreakdown[Rating.Good]) || [],
        backgroundColor: '#10b981',
      },
      {
        label: t.ratings.easy,
        data: last30DaysStats?.map((stat) => stat.gradeBreakdown[Rating.Easy]) || [],
        backgroundColor: '#3b82f6',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        stacked: true,
        ticks: {
          maxRotation: 45,
          minRotation: 45,
        },
      },
      y: {
        stacked: true,
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          padding: 10,
        },
        title: {
          padding: 0,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    layout: {
      padding: {
        top: 5,
      },
    },
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold">{t.charts.reviewHistory}</h3>
      <div style={{ height: '250px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
