import React, { useMemo, useState } from "react";

type CalendarEvent = {
  id: number;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  preacher?: string | null;
  categories?: { id: number; name: string }[];
  planning_levels?: { id: number; name: string }[];
};

interface CalendarViewProps {
  events: CalendarEvent[];
  onSelectEvent?: (event: CalendarEvent) => void;
}

/**
 * Utility: format a Date to YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Utility: parse an ISO-like date (YYYY-MM-DD) safely.
 * Returns null if invalid.
 */
function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map((p) => parseInt(p, 10));
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/**
 * Build a 6x7 grid (42 cells) starting on Monday, covering the month of `currentMonth`.
 */
function buildCalendarGrid(currentMonth: Date): Date[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-based
  const firstOfMonth = new Date(year, month, 1);

  // JS getDay(): 0 = Sunday, 1 = Monday, ... 6 = Saturday
  // We want Monday as the first column: 0 = Monday, 6 = Sunday
  const jsWeekday = firstOfMonth.getDay();
  const mondayFirstIndex = (jsWeekday + 6) % 7; // convert Sunday=0 to Sunday=6, Monday=0

  // Start date of the grid (Monday of the first week shown)
  const gridStart = new Date(year, month, 1 - mondayFirstIndex);

  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    const dt = new Date(gridStart);
    dt.setDate(gridStart.getDate() + i);
    days.push(dt);
  }
  return days;
}

const CalendarView: React.FC<CalendarViewProps> = ({ events, onSelectEvent }) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const gridDays = useMemo(() => buildCalendarGrid(currentMonth), [currentMonth]);

  // Map events by start_date (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const dt = parseDate(ev.start_date ?? undefined);
      if (!dt) continue;
      const key = formatDateKey(dt);
      const existing = map.get(key) ?? [];
      existing.push(ev);
      map.set(key, existing);
    }
    return map;
  }, [events]);

  const monthLabel = currentMonth.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const goToPreviousMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const currentMonthIndex = currentMonth.getMonth();
  const todayKey = formatDateKey(new Date());

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="m-0 text-lg font-semibold text-slate-900">
            Monthly calendar
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            View filtered events in a monthly grid. Click on a date or event to
            inspect it in the list view.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            ‹ Prev
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="inline-flex items-center justify-center rounded-full border border-brand-500 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Month label */}
      <div className="flex items-center justify-between rounded-xl border border-borderSubtle bg-surface px-4 py-3 shadow-subtle">
        <div className="text-sm font-semibold text-slate-900">{monthLabel}</div>
        <div className="text-xs text-slate-500">
          {events.length} event{events.length === 1 ? "" : "s"} in this view
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-px rounded-t-xl border border-borderSubtle bg-borderSubtle text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="bg-surface px-2 py-1.5 text-center"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-b-xl border border-borderSubtle bg-borderSubtle">
        {gridDays.map((day) => {
          const key = formatDateKey(day);
          const dayEvents = eventsByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === currentMonthIndex;
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={[
                "min-h-[5.5rem] bg-surface px-1.5 pb-1.5 pt-1 text-xs",
                !isCurrentMonth ? "bg-surface-muted text-slate-400" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className={[
                  "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-medium",
                  isToday
                    ? "bg-brand-600 text-white"
                    : isCurrentMonth
                    ? "text-slate-800 hover:bg-slate-100"
                    : "text-slate-400 hover:bg-slate-100",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {day.getDate()}
              </button>

              {dayEvents.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => onSelectEvent && onSelectEvent(ev)}
                      className="block w-full truncate rounded-full bg-brand-50 px-1.5 py-0.5 text-[11px] text-left font-medium text-brand-700 hover:bg-brand-100"
                      title={ev.title}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-slate-400">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarView;
