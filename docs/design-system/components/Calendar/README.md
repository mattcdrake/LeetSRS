# Calendar

The review-load heatmap calendar.

Source: `popup/views/calendar/calendar.css`, `CalendarView.tsx` (react-aria `Calendar`).

- Day: 30px tall, `radius-md`, `small` tabular numerals. Load level 1–4 fills `heat-1`…`heat-4`; level 4 switches the number to `on-brand`.
- Today: semibold with a 12 × 2 underline in `currentColor`. Overdue: a 6px `warning` dot top-right. Selected: a 1.5px `fg` ring. Outside the range: `fg-3` at .45.
- Weekday headers: `caption` weight 400 in `fg-3`.
