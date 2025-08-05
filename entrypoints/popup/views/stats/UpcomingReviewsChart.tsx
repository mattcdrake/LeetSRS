import { Line } from 'react-chartjs-2';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { useNextNDaysStatsQuery } from '@/hooks/useBackgroundQueries';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export function UpcomingReviewsChart() {
  const { data: next14DaysStats } = useNextNDaysStatsQuery(14);

  const chartData = {
    labels:
      next14DaysStats?.map((stat) => {
        // Parse YYYY-MM-DD format explicitly to avoid timezone issues
        const [, month, day] = stat.date.split('-').map(Number);
        return `${month}/${day}`;
      }) || [],
    datasets: [
      {
        label: 'Cards Due',
        data: next14DaysStats?.map((stat) => stat.count) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
  };

  return (
    <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
      <h3 className="text-lg font-semibold mb-4">Upcoming Reviews (Next 14 Days)</h3>
      <div style={{ height: '250px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}
