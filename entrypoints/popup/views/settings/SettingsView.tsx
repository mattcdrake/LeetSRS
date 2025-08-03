import { useTheme } from '../../contexts/ThemeContext';

export function SettingsView() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <span className="text-sm text-secondary">Configure your preferences</span>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
        <h3 className="text-lg font-semibold mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <label htmlFor="theme-toggle">Theme</label>
          <button
            id="theme-toggle"
            onClick={toggleTheme}
            className="px-4 py-2 rounded-md transition-all hover:opacity-80 bg-accent text-white"
          >
            {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
        <h3 className="text-lg font-semibold mb-4">Review Settings</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="daily-review-goal">Daily Review Goal</label>
            <input
              id="daily-review-goal"
              type="number"
              placeholder="10"
              className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="new-cards-per-day">New Cards Per Day</label>
            <input
              id="new-cards-per-day"
              type="number"
              placeholder="5"
              className="w-20 px-2 py-1 rounded border bg-tertiary text-primary border-current"
            />
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="review-order">Review Order</label>
            <select id="review-order" className="px-2 py-1 rounded border bg-tertiary text-primary border-current">
              <option>Random</option>
              <option>Due Date</option>
              <option>Difficulty</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
        <h3 className="text-lg font-semibold mb-4">Notifications</h3>
        <div className="space-y-3">
          <div className="flex items-center">
            <input type="checkbox" id="enable-reminders" className="mr-2" />
            <label htmlFor="enable-reminders">Enable Daily Reminders</label>
          </div>
          <div className="flex items-center justify-between">
            <label htmlFor="reminder-time">Reminder Time</label>
            <input
              id="reminder-time"
              type="time"
              className="px-2 py-1 rounded border bg-tertiary text-primary border-current"
            />
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-secondary text-primary">
        <h3 className="text-lg font-semibold mb-4">Data</h3>
        <div className="space-y-2">
          <button className="w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary">
            Export Data
          </button>
          <button className="w-full px-4 py-2 rounded transition-opacity hover:opacity-80 bg-tertiary text-primary">
            Import Data
          </button>
          <button className="w-full px-4 py-2 rounded transition-opacity hover:opacity-80 text-white bg-danger">
            Reset All Data
          </button>
        </div>
      </div>

      <div className="text-center text-sm text-tertiary">
        <p>Version 1.0.0</p>
      </div>
    </div>
  );
}
