import React, { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";

type Category = {
  id: number;
  name: string;
  symbol?: string | null;
  color_hex?: string | null;
};

type MobileEvent = {
  id: number;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  categories?: Category[];
  besucherzahl?: number | null;
};

type VisitorsByEvent = Record<number, string>;
type SavedVisitorsByEvent = Record<number, number>;

type ReportingRow = {
  id?: number;
  event_id?: number | string;
  eventId?: number | string;
  event_date?: string | null;
  eventDate?: string | null;
  event_start_time?: string | null;
  eventStartTime?: string | null;
  event_title?: string | null;
  eventTitle?: string | null;
  visitor?: number | string | null;
  visitors?: number | string | null;
  besucher?: number | string | null;
  visitor_count?: number | string | null;
  count?: number | string | null;
  value?: number | string | null;
  created_at?: string | null;
  timestamp?: string | null;
};

const LOCAL_STORAGE_KEY = "mobileVisitors.savedVisitors";

function formatDate(dateString?: string | null): string {
  if (!dateString) return "";
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return dateString;
  return dt.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(timeString?: string | null): string {
  if (!timeString) return "";
  return timeString;
}

function formatMonthLabel(dateString?: string | null): string {
  if (!dateString) return "";
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return dateString ?? "";
  return dt.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function formatDateSeparatorLabel(dateString?: string | null): string {
  if (!dateString) return "";
  const dt = new Date(dateString);
  if (Number.isNaN(dt.getTime())) return dateString ?? "";
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parseYmd(dateString?: string | null): Date | null {
  if (!dateString) return null;
  const [y, m, d] = dateString.split("-");
  if (!y || !m || !d) return null;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function loadSavedVisitorsFromStorage(): SavedVisitorsByEvent {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const result: SavedVisitorsByEvent = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const id = Number(key);
      if (Number.isFinite(id) && typeof value === "number") {
        result[id] = value;
      }
    });
    return result;
  } catch {
    return {};
  }
}

function saveVisitorsToStorage(saved: SavedVisitorsByEvent): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Record<string, number> = {};
    Object.entries(saved).forEach(([id, value]) => {
      payload[id] = value;
    });
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

const MobileVisitorsPage: React.FC = () => {
  const [allEvents, setAllEvents] = useState<MobileEvent[]>([]);
  const [events, setEvents] = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [visitorsInput, setVisitorsInput] = useState<VisitorsByEvent>({});
  // Keep last known values as a fallback, but the UI label should reflect
  // values coming from the reporting database.
  const [savedVisitors, setSavedVisitors] = useState<SavedVisitorsByEvent>(() =>
    loadSavedVisitorsFromStorage()
  );
  const [savingFor, setSavingFor] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  
const loadSavedVisitorsFromReporting = useCallback(
  async (eventList: MobileEvent[]): Promise<SavedVisitorsByEvent> => {
    const eventIds = eventList.map((e) => e.id);
    if (eventIds.length === 0) return {};

    const normalizeRows = (json: any): ReportingRow[] | null => {
      if (Array.isArray(json)) return json as ReportingRow[];
      if (json && Array.isArray(json.items)) return json.items as ReportingRow[];
      if (json && Array.isArray(json.data)) return json.data as ReportingRow[];
      if (json && Array.isArray(json.results)) return json.results as ReportingRow[];
      return null;
    };

    const getEventId = (row: ReportingRow): number | null => {
      // Root cause fix: reporting rows are mapped strictly by event_id.
      const raw = (row.event_id ?? row.eventId) as any;
      const id = Number(raw);
      return Number.isFinite(id) ? id : null;
    };

    const getVisitorValue = (row: ReportingRow): number | null => {
      const v =
        row.visitor ??
        row.visitors ??
        row.besucher ??
        row.visitor_count ??
        (row as any).visitors_count ??
        row.count ??
        row.value ??
        null;

      if (v == null) return null;

      if (typeof v === "string") {
        const cleaned = v.trim().replace(/[^0-9,.-]/g, "");
        const normalized = cleaned.includes(".")
          ? cleaned.replace(/,/g, "")
          : cleaned.replace(",", ".");
        const n = Number(normalized);
        return Number.isFinite(n) ? n : null;
      }

      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const pickLatest = (rows: ReportingRow[]): ReportingRow => {
      const parseTs = (r: ReportingRow): number => {
        const ts =
          (r as any).updated_at ??
          (r as any).created_at ??
          (r as any).timestamp ??
          (r as any).ts ??
          "";
        const dt = ts ? new Date(String(ts)) : null;
        const t = dt && !Number.isNaN(dt.getTime()) ? dt.getTime() : -1;
        return t;
      };

      const parseId = (r: ReportingRow): number => {
        const n = Number((r as any).id);
        return Number.isFinite(n) ? n : -1;
      };

      return [...rows]
        .sort((a, b) => {
          // Prefer rows that actually contain a visitor count
          const aHas = getVisitorValue(a) != null ? 1 : 0;
          const bHas = getVisitorValue(b) != null ? 1 : 0;
          if (aHas !== bHas) return aHas - bHas;

          const aTs = parseTs(a);
          const bTs = parseTs(b);
          if (aTs !== bTs) return aTs - bTs;

          const aId = parseId(a);
          const bId = parseId(b);
          if (aId !== bId) return aId - bId;

          return 0;
        })
        .slice(-1)[0];
    };

    const buildMapFromRows = (rows: ReportingRow[]): SavedVisitorsByEvent => {
      const byEvent: Record<number, ReportingRow[]> = {};
      rows.forEach((row) => {
        const id = getEventId(row);
        if (id == null) return;
        if (!eventIds.includes(id)) return;
        if (!byEvent[id]) byEvent[id] = [];
        byEvent[id].push(row);
      });

      const result: SavedVisitorsByEvent = {};
      Object.entries(byEvent).forEach(([idStr, list]) => {
        const id = Number(idStr);
        const latest = pickLatest(list);
        const value = getVisitorValue(latest);
        if (value != null) result[id] = value;
      });
      return result;
    };

    // Preferred: fetch the collection once and map by event_id.
    // Try a few likely reporting endpoints (some deployments use a trailing slash).
    const candidates = ["/reporting", "/reporting/"];
    for (const path of candidates) {
      try {
        const r = await apiFetch(path);
        if (!r.ok) continue;
        const json = await r.json();

        const rows = normalizeRows(json);
        if (rows && rows.length > 0) {
          const mapped = buildMapFromRows(rows);
          if (Object.keys(mapped).length > 0) return mapped;
        }
      } catch {
        // ignore and try next candidate
      }
    }

    // Fallback: fetch per-event (covers APIs that support filtering by query param).
    const result: SavedVisitorsByEvent = {};
    for (const id of eventIds) {
      const paths = [
        `/reporting?event_id=${encodeURIComponent(String(id))}`,
        `/reporting/?event_id=${encodeURIComponent(String(id))}`,
        `/reporting?eventId=${encodeURIComponent(String(id))}`,
        `/reporting/?eventId=${encodeURIComponent(String(id))}`,
        `/reporting/event/${encodeURIComponent(String(id))}`,
        `/reporting/event/${encodeURIComponent(String(id))}/`,
        `/reporting/latest?event_id=${encodeURIComponent(String(id))}`,
        `/reporting/latest/${encodeURIComponent(String(id))}`,
      ];

      for (const path of paths) {
        try {
          const r = await apiFetch(path);
          if (!r.ok) continue;
          const json = await r.json();
          const rows = normalizeRows(json);
          if (rows && rows.length > 0) {
            const latest = pickLatest(rows);
            const value = getVisitorValue(latest);
            if (value != null) {
              result[id] = value;
              break;
            }
          } else if (json && typeof json === "object") {
            const value = getVisitorValue(json as ReportingRow);
            if (value != null) {
              result[id] = value;
              break;
            }
          }
        } catch {
          // ignore and try next
        }
      }
    }

    return result;
  },
  []
);

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/events");
      if (!res.ok) {
        throw new Error(`Failed to load events: ${res.status}`);
      }
      const data: MobileEvent[] = await res.json();

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayStr = `${yyyy}-${mm}-${dd}`;

        const onlyFutureGottesdienste = data.filter((ev) => {
          if (!ev.start_date || !ev.start_time) return false;
          if (!ev.categories || ev.categories.length === 0) return false;

          const isEntfaellt = ev.categories.some((c) => c.name === "Entfällt");
          if (isEntfaellt) return false;

          const isGottesdienst = ev.categories.some(
            (c) => c.name === "Gottesdienst"
          );
          if (!isGottesdienst) return false;

          return ev.start_date >= todayStr;
        });

        onlyFutureGottesdienste.sort((a, b) => {
          const aDate = a.start_date ?? "";
          const bDate = b.start_date ?? "";
          if (aDate !== bDate) return aDate < bDate ? -1 : 1;

          const aTime = a.start_time ?? "";
          const bTime = b.start_time ?? "";
          if (aTime !== bTime) return aTime < bTime ? -1 : 1;

          return a.id - b.id;
        });

      setAllEvents(data);
      setEvents(onlyFutureGottesdienste);

      // Input must always be blank on refresh.
      setVisitorsInput({});

      const eventIds = onlyFutureGottesdienste.map((ev) => ev.id);
      const fromReporting = await loadSavedVisitorsFromReporting(onlyFutureGottesdienste);

      // Fallbacks (only used if reporting does not return a value):
      // 1) previous localStorage values for the same event
      // 2) besucherzahl on event if present
      const stored = loadSavedVisitorsFromStorage();
      const fallback: SavedVisitorsByEvent = {};
      eventIds.forEach((id) => {
        if (fromReporting[id] != null) return;
        if (stored[id] != null) {
          fallback[id] = stored[id];
          return;
        }
        const ev = onlyFutureGottesdienste.find((e) => e.id === id);
        if (ev?.besucherzahl != null) fallback[id] = ev.besucherzahl;
      });

      const merged: SavedVisitorsByEvent = { ...fallback, ...fromReporting };
      setSavedVisitors(merged);
      saveVisitorsToStorage(merged);
    } catch (err: any) {
      console.error("Error loading mobile events", err);
      setError(err?.message ?? "Events konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [loadSavedVisitorsFromReporting]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const handleChangeVisitor = (eventId: number, value: string) => {
    setVisitorsInput((prev) => ({
      ...prev,
      [eventId]: value,
    }));
  };

  const handleSaveVisitor = async (eventId: number) => {
    const raw = (visitorsInput[eventId] ?? "").trim();
    if (!raw) {
      setError("Bitte eine Besucherzahl eingeben.");
      return;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setError("Besucherzahl muss eine positive Zahl sein.");
      return;
    }

    const currentEvent = allEvents.find((ev) => ev.id === eventId);
    if (!currentEvent || !currentEvent.start_date) {
      setError("Zu diesem Event konnten keine Details gefunden werden.");
      return;
    }

    const currentDate = currentEvent.start_date;
    const currentTime = currentEvent.start_time ?? null;

    let vacation: string | null = null;
    let holiday: string | null = null;
    const specialTitles: string[] = [];

    const currentDt = parseYmd(currentDate);

    allEvents.forEach((ev) => {
      if (!ev.categories || ev.categories.length === 0) return;
      const names = ev.categories.map((c) => c.name);

      // Ferien: multi-day, check if currentDate is between start_date and end_date (inclusive)
      if (names.includes("Ferien")) {
        const start = parseYmd(ev.start_date ?? undefined);
        const end = parseYmd(ev.end_date ?? ev.start_date ?? undefined);
        if (currentDt && start && end && start <= currentDt && currentDt <= end) {
          if (!vacation) {
            vacation = ev.title;
          }
        }
      }

      // Feiertag: same date
      if (names.includes("Feiertag")) {
        if (ev.start_date === currentDate) {
          if (!holiday) {
            holiday = ev.title;
          }
        }
      }

      // Special events: same date AND same time
      const hasSpecialCategory = names.some((n) =>
        ["Lobpreisabend", "Special", "Kindersegnung", "Taufe"].includes(n)
      );
      // Ignore the current Gottesdienst event itself; we only want parallel special events
      if (hasSpecialCategory && ev.id !== currentEvent.id && ev.start_date === currentDate) {
        const evTime = ev.start_time ?? null;
        if (currentTime && evTime === currentTime) {
          if (!specialTitles.includes(ev.title)) {
            specialTitles.push(ev.title);
          }
        }
      }
    });

    const special =
      specialTitles.length > 0 ? specialTitles.join(", ") : null;

    setSavingFor(eventId);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: any = {
        event_id: eventId,
        visitor: value,
      };
      if (vacation) body.vacation = vacation;
      if (holiday) body.holiday = holiday;
      if (special) body.special = special;

      const response = await apiFetch("/reporting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      await response.json();

      setSavedVisitors((prev) => {
        const next: SavedVisitorsByEvent = {
          ...prev,
          [eventId]: value,
        };
        saveVisitorsToStorage(next);
        return next;
      });

      // Input must be blank after submit.
      setVisitorsInput((prev) => ({ ...prev, [eventId]: "" }));

      // Refresh the persisted value from the reporting database (in case the backend
      // normalizes or changes the stored value).
      try {
        const ev = events.find((e) => e.id === eventId);
        if (ev) {
          const refreshed = await loadSavedVisitorsFromReporting([ev]);
          if (refreshed[eventId] != null) {
            setSavedVisitors((prev) => {
              const next = { ...prev, [eventId]: refreshed[eventId] };
              saveVisitorsToStorage(next);
              return next;
            });
          }
        }
      } catch {
        // ignore refresh errors
      }

      setSuccessMessage("Besucherzahl erfolgreich gespeichert.");
    } catch (err: any) {
      console.error("Failed to save visitor count", err);
      setError(
        err?.message ||
          "Besucherzahl konnte nicht gespeichert werden. Bitte erneut versuchen."
      );
    } finally {
      setSavingFor(null);
    }
  };

  const hasEvents = useMemo(() => events.length > 0, [events]);

  let lastMonthKey = "";
  let lastDateKey = "";

  const groupedList = events.map((ev) => {
    const dateKey = ev.start_date ?? "";
    const monthKey = dateKey.substring(0, 7);

    const separators: React.ReactElement[] = [];

    if (monthKey && monthKey !== lastMonthKey) {
      separators.push(
        <div
          key={`month-${monthKey}`}
          className={`${lastMonthKey === "" ? "mt-1" : "mt-4"} mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}
        >
          <div className="h-px flex-1 bg-slate-300" />
          <div>{formatMonthLabel(ev.start_date)}</div>
          <div className="h-px flex-1 bg-slate-300" />
        </div>
      );
      lastMonthKey = monthKey;
      lastDateKey = "";
    }

    if (dateKey && dateKey !== lastDateKey) {
      separators.push(
        <div
          key={`date-${dateKey}`}
          className="mb-2 pl-1 text-[11px] font-medium text-slate-600"
        >
          {formatDateSeparatorLabel(ev.start_date)}
        </div>
      );
      lastDateKey = dateKey;
    }

    const dateLabel = formatDate(ev.start_date);
    const timeLabel = formatTime(ev.start_time);
    const saved = savedVisitors[ev.id];

    const gottesdienstCategory =
      ev.categories?.find((c) => c.name === "Gottesdienst") ??
      ev.categories?.[0];

    const categorySymbol =
      (gottesdienstCategory?.symbol ?? "⛪") || "⛪";
    const categoryColor =
      gottesdienstCategory?.color_hex &&
      gottesdienstCategory.color_hex.trim()
        ? gottesdienstCategory.color_hex
        : "#e5e7eb";

    return (
      <React.Fragment key={ev.id}>
        {separators}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-start gap-2">
            <div
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-900 shadow-sm"
              style={{ backgroundColor: categoryColor }}
            >
              {categorySymbol}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900">
                {ev.title}
              </h2>
              <div className="mt-0.5 text-xs text-slate-600">
                <span>{dateLabel}</span>
                {timeLabel && (
                  <>
                    <span className="mx-1 text-slate-300">•</span>
                    <span>{timeLabel} Uhr</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-700">
                Besucherzahl
              </label>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={visitorsInput[ev.id] ?? ""}
                onChange={(e) => handleChangeVisitor(ev.id, e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Zahl eingeben"
              />
            </div>
            <button
              type="button"
              onClick={() => handleSaveVisitor(ev.id)}
              disabled={savingFor === ev.id}
              className="mt-1 inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-75 sm:mt-0 sm:ml-2"
            >
              {savingFor === ev.id ? "Speichern…" : "Speichern"}
            </button>
          </div>

          {saved != null && (
            <div className="mt-2 text-[11px] text-slate-500">
              Aktuell gespeicherte Besucherzahl:{" "}
              <span className="font-semibold text-slate-800">{saved}</span>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 px-3 py-3">
      <div className="mx-auto max-w-md">
        {loading && (
          <p className="mb-2 text-xs text-slate-500">Lade Events…</p>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            {successMessage}
          </div>
        )}

        {!loading && !hasEvents && !error && (
          <p className="text-xs text-slate-500">
            Es sind aktuell keine zukünftigen Gottesdienste mit Startzeit vorhanden.
          </p>
        )}

        <div className="space-y-2">{groupedList}</div>
      </div>
    </div>
  );
};

export default MobileVisitorsPage;
