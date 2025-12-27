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
type SavedReportingIdsByEvent = Record<number, number>;

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
  // Saved visitor counts shown in the UI come from the reporting database.
  const [savedVisitors, setSavedVisitors] = useState<SavedVisitorsByEvent>(() =>
    loadSavedVisitorsFromStorage()
  );

  const [savedReportingIds, setSavedReportingIds] = useState<SavedReportingIdsByEvent>({});
  const [savingFor, setSavingFor] = useState<number | null>(null);

  const [editingFor, setEditingFor] = useState<Record<number, boolean>>({});
  const [deleteConfirmFor, setDeleteConfirmFor] = useState<number | null>(null);
  const [deletingFor, setDeletingFor] = useState<number | null>(null);

  const brand = useMemo(
    () => ({
      ink: "#0f172a",
      inkMuted: "#475569",
      border: "#e5e7eb",
      borderStrong: "#d1d5db",
      surface: "#ffffff",
      surfaceSoft: "#f8fafc",
      brand: "#4f46e5",
      brandHover: "#4338ca",
      ring: "rgba(79, 70, 229, 0.18)",
      danger: "#b91c1c",
      dangerHover: "#991b1b",
      dangerRing: "rgba(185, 28, 28, 0.18)",
    }),
    []
  );

  const [focusVisitorEventId, setFocusVisitorEventId] = useState<number | null>(null);
  const [hoverButton, setHoverButton] = useState<string | null>(null);
  const [pressButton, setPressButton] = useState<string | null>(null);

  const fieldBaseStyle: React.CSSProperties = {
    width: "100%",
    height: "44px",
    borderRadius: "12px",
    border: `1px solid ${brand.border}`,
    background: brand.surface,
    color: brand.ink,
    padding: "0 12px",
    fontSize: "14px",
    outline: "none",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
    transition: "box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
  };

  const focusedStyle: React.CSSProperties = {
    border: `1px solid ${brand.brand}`,
    boxShadow: `0 0 0 3px ${brand.ring}, 0 1px 3px rgba(15, 23, 42, 0.08)`,
  };

  const primaryButtonStyle = (key: string, disabled?: boolean): React.CSSProperties => ({
    height: "44px",
    borderRadius: "12px",
    border: "1px solid transparent",
    background: hoverButton === key ? brand.brandHover : brand.brand,
    color: "#ffffff",
    fontWeight: 400,
    letterSpacing: "0.2px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow:
      hoverButton === key
        ? "0 6px 14px rgba(79, 70, 229, 0.22)"
        : "0 4px 10px rgba(79, 70, 229, 0.18)",
    transform: pressButton === key ? "translateY(1px)" : "none",
    opacity: disabled ? 0.75 : 1,
    transition: "box-shadow 0.15s ease, transform 0.05s ease, background-color 0.15s ease",
  });

  const subtleButtonStyle: React.CSSProperties = {
    height: "44px",
    borderRadius: "12px",
    border: `1px solid ${brand.border}`,
    background: brand.surface,
    color: brand.inkMuted,
    fontWeight: 400,
    letterSpacing: "0.2px",
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
    transition: "box-shadow 0.15s ease, transform 0.05s ease, background-color 0.15s ease",
  };


  const dangerOutlineButtonStyle: React.CSSProperties = {
    ...subtleButtonStyle,
    border: "1px solid rgba(185, 28, 28, 0.25)",
    background: "rgba(185, 28, 28, 0.04)",
    color: brand.danger,
  };

  const dangerButtonStyle = (key: string, disabled?: boolean): React.CSSProperties => ({
    height: "44px",
    borderRadius: "12px",
    border: "1px solid transparent",
    background: hoverButton === key ? brand.dangerHover : brand.danger,
    color: "#ffffff",
    fontWeight: 400,
    letterSpacing: "0.2px",
    cursor: disabled ? "not-allowed" : "pointer",
    boxShadow:
      hoverButton === key
        ? "0 6px 14px rgba(185, 28, 28, 0.22)"
        : "0 4px 10px rgba(185, 28, 28, 0.18)",
    transform: pressButton === key ? "translateY(1px)" : "none",
    opacity: disabled ? 0.75 : 1,
    transition: "box-shadow 0.15s ease, transform 0.05s ease, background-color 0.15s ease",
  });

  const bindButtonInteractions = (key: string) => ({
    onMouseEnter: () => setHoverButton(key),
    onMouseLeave: () => {
      setHoverButton((v) => (v === key ? null : v));
      setPressButton((v) => (v === key ? null : v));
    },
    onMouseDown: () => setPressButton(key),
    onMouseUp: () => setPressButton((v) => (v === key ? null : v)),
    onTouchStart: () => setPressButton(key),
    onTouchEnd: () => setPressButton((v) => (v === key ? null : v)),
  });


  const loadSavedVisitorsFromReporting = useCallback(
    async (
      eventList: MobileEvent[]
    ): Promise<{ counts: SavedVisitorsByEvent; ids: SavedReportingIdsByEvent }> => {
      const eventIds = eventList.map((e) => e.id);
      if (eventIds.length === 0) return { counts: {}, ids: {} };

      const parseVisitor = (row: any): number | null => {
        const v = row?.visitor ?? null;
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

      const parseReportingId = (row: any): number | null => {
        const rid = row?.id ?? row?.reporting_id ?? null;
        const n = Number(rid);
        return Number.isFinite(n) ? n : null;
      };

      // API contract used here (no guessing):
      //   GET /reporting/by-event/{event_id}  -> List[ReportingRead] (newest first)
      // We take the newest entry (index 0) as the currently saved visitor count.
      const counts: SavedVisitorsByEvent = {};
      const ids: SavedReportingIdsByEvent = {};

      for (const id of eventIds) {
        try {
          const res = await apiFetch(`/reporting/by-event/${id}`);
          if (!res.ok) continue;
          const rows = (await res.json()) as any[];
          if (!Array.isArray(rows) || rows.length === 0) continue;

          const latest = rows[0];
          const value = parseVisitor(latest);
          const reportingId = parseReportingId(latest);

          if (value != null) counts[id] = value;
          if (reportingId != null) ids[id] = reportingId;
        } catch {
          // ignore per-event errors
        }
      }

      return { counts, ids };
    },
    []
  );

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/mobile-visitors/events");
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

        const isGottesdienst = ev.categories.some((c) => c.name === "Gottesdienst");
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
      setEditingFor({});
      setDeleteConfirmFor(null);

      const { counts, ids } = await loadSavedVisitorsFromReporting(onlyFutureGottesdienste);

      // IMPORTANT:
      // The label "Aktuell gespeicherte Besucherzahl" must reflect ONLY what exists in the reporting DB.
      // We intentionally do NOT fall back to localStorage here, otherwise deleted backend records would
      // still show stale values.
      setSavedVisitors(counts);
      setSavedReportingIds(ids);
      saveVisitorsToStorage(counts);
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

  const startEditing = (eventId: number) => {
    setError(null);
    const currentSaved = savedVisitors[eventId];
    setVisitorsInput((prev) => ({
      ...prev,
      [eventId]: currentSaved != null ? String(currentSaved) : prev[eventId] ?? "",
    }));
    setEditingFor((prev) => ({ ...prev, [eventId]: true }));
  };

  const cancelEditing = (eventId: number) => {
    setError(null);
    setEditingFor((prev) => {
      if (!prev[eventId]) return prev;
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
    // Keep input blank after cancel to match the original rule (blank unless editing).
    setVisitorsInput((prev) => ({ ...prev, [eventId]: "" }));
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

    const special = specialTitles.length > 0 ? specialTitles.join(", ") : null;

    setSavingFor(eventId);
    setError(null);

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

      const created = await response.json().catch(() => null as any);
      const createdIdRaw = created?.id ?? created?.reporting_id ?? null;
      const createdId = Number(createdIdRaw);

      setSavedVisitors((prev) => {
        const next: SavedVisitorsByEvent = {
          ...prev,
          [eventId]: value,
        };
        saveVisitorsToStorage(next);
        return next;
      });

      if (Number.isFinite(createdId)) {
        setSavedReportingIds((prev) => ({ ...prev, [eventId]: createdId }));
      }

      // Input must be blank after submit.
      setVisitorsInput((prev) => ({ ...prev, [eventId]: "" }));

      // Exit edit mode (if any)
      setEditingFor((prev) => {
        if (!prev[eventId]) return prev;
        const next = { ...prev };
        delete next[eventId];
        return next;
      });

      // Refresh the persisted value from the reporting database (in case the backend
      // normalizes or changes the stored value).
      try {
        const ev = events.find((e) => e.id === eventId);
        if (ev) {
          const refreshed = await loadSavedVisitorsFromReporting([ev]);
          if (refreshed.counts[eventId] != null) {
            setSavedVisitors((prev) => {
              const next = { ...prev, [eventId]: refreshed.counts[eventId] };
              saveVisitorsToStorage(next);
              return next;
            });
            if (refreshed.ids[eventId] != null) {
              setSavedReportingIds((prev) => ({ ...prev, [eventId]: refreshed.ids[eventId] }));
            }
          } else {
            // If the backend has no record anymore, remove any stale local value.
            setSavedVisitors((prev) => {
              if (!(eventId in prev)) return prev;
              const next = { ...prev };
              delete next[eventId];
              saveVisitorsToStorage(next);
              return next;
            });
            setSavedReportingIds((prev) => {
              if (!(eventId in prev)) return prev;
              const next = { ...prev };
              delete next[eventId];
              return next;
            });
          }
        }
      } catch {
        // ignore refresh errors
      }
    } catch (err: any) {
      console.error("Failed to save visitor count", err);
      setError(err?.message || "Besucherzahl konnte nicht gespeichert werden. Bitte erneut versuchen.");
    } finally {
      setSavingFor(null);
    }
  };

  const openDeleteConfirm = (eventId: number) => {
    setError(null);
    setDeleteConfirmFor(eventId);
  };

  const closeDeleteConfirm = () => setDeleteConfirmFor(null);

  const deleteStoredVisitor = useCallback(
    async (eventId: number): Promise<void> => {
      // API contract used here (no guessing):
      //   DELETE /reporting/{reporting_id}
      // Therefore we must determine the latest reporting_id for this event via:
      //   GET /reporting/by-event/{event_id}  -> newest first
      let reportingId: number | null = savedReportingIds[eventId] ?? null;

      if (reportingId == null) {
        const res = await apiFetch(`/reporting/by-event/${eventId}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const rows = (await res.json()) as any[];
        if (!Array.isArray(rows) || rows.length === 0) {
          // Nothing to delete; treat as success.
          return;
        }
        const latest = rows[0];
        const idRaw = latest?.id ?? latest?.reporting_id ?? null;
        const n = Number(idRaw);
        reportingId = Number.isFinite(n) ? n : null;
      }

      if (reportingId == null) {
        throw new Error("Reporting-ID konnte nicht ermittelt werden.");
      }

      const delRes = await apiFetch(`/reporting/${reportingId}`, { method: "DELETE" });
      if (!delRes.ok) {
        const text = await delRes.text();
        throw new Error(text || `HTTP ${delRes.status}`);
      }
    },
    [savedReportingIds]
  );

  const confirmDelete = async () => {
    if (deleteConfirmFor == null) return;
    const eventId = deleteConfirmFor;

    setDeletingFor(eventId);
    setError(null);

    try {
      await deleteStoredVisitor(eventId);

      // Refresh from reporting DB to ensure the UI matches the backend state.
      const ev = events.find((e) => e.id === eventId);
      if (ev) {
        const refreshed = await loadSavedVisitorsFromReporting([ev]);
        setSavedVisitors((prev) => {
          const next = { ...prev };
          if (refreshed.counts[eventId] != null) {
            next[eventId] = refreshed.counts[eventId];
          } else {
            delete next[eventId];
          }
          saveVisitorsToStorage(next);
          return next;
        });
        setSavedReportingIds((prev) => {
          const next = { ...prev };
          if (refreshed.ids[eventId] != null) {
            next[eventId] = refreshed.ids[eventId];
          } else {
            delete next[eventId];
          }
          return next;
        });
      } else {
        setSavedVisitors((prev) => {
          if (!(eventId in prev)) return prev;
          const next = { ...prev };
          delete next[eventId];
          saveVisitorsToStorage(next);
          return next;
        });
        setSavedReportingIds((prev) => {
          if (!(eventId in prev)) return prev;
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
      setVisitorsInput((prev) => ({ ...prev, [eventId]: "" }));
      setEditingFor((prev) => {
        if (!prev[eventId]) return prev;
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
      setDeleteConfirmFor(null);
    } catch (err: any) {
      console.error("Failed to delete visitor count", err);
      setError(
        err?.message ||
          "Besucherzahl konnte nicht gelöscht werden. Bitte erneut versuchen."
      );
    } finally {
      setDeletingFor(null);
    }
  };

  const hasEvents = useMemo(() => events.length > 0, [events]);

  const dayVisitorSummary = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    for (const ev of events) {
      const dateKey = ev.start_date ?? "";
      if (!dateKey) continue;
      const v = savedVisitors[ev.id];
      if (v == null) continue;
      if (!map[dateKey]) map[dateKey] = { total: 0, count: 0 };
      map[dateKey].total += v;
      map[dateKey].count += 1;
    }
    return map;
  }, [events, savedVisitors]);


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
          className={`${lastMonthKey === "" ? "mt-1" : "mt-6"} mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 col-span-full`}
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
          className="mt-3 pl-1 text-[11px] font-medium text-slate-600 col-span-full"
        >
          {formatDateSeparatorLabel(ev.start_date)}
        </div>
      );

      const summary = dayVisitorSummary[dateKey];
      if (summary && summary.count > 1) {
        separators.push(
          <div key={`sum-${dateKey}`} className="mt-2 col-span-full">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                Summe Besucherzahlen
              </div>
              <div className="mt-0.5 text-xs font-medium text-emerald-800">
                {formatDateSeparatorLabel(dateKey)}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <div className="text-3xl font-semibold leading-none text-emerald-900">
                  {summary.total}
                </div>
                <div className="text-xs font-medium text-emerald-800">
                  {summary.count} Events
                </div>
              </div>
            </div>
          </div>
        );
      }

      lastDateKey = dateKey;
    }

    const dateLabel = formatDate(ev.start_date);
    const timeLabel = formatTime(ev.start_time);
    const saved = savedVisitors[ev.id];
    const isEditing = Boolean(editingFor[ev.id]);
    const isSaved = saved != null;

    const gottesdienstCategory =
      ev.categories?.find((c) => c.name === "Gottesdienst") ?? ev.categories?.[0];

    const categorySymbol = (gottesdienstCategory?.symbol ?? "⛪") || "⛪";
    const categoryColor =
      gottesdienstCategory?.color_hex && gottesdienstCategory.color_hex.trim()
        ? gottesdienstCategory.color_hex
        : "#e5e7eb";

    return (
      <React.Fragment key={ev.id}>
        {separators}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col">
          <div className="mb-2 flex items-start gap-2">
            <div
              className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-slate-900 shadow-sm"
              style={{ backgroundColor: categoryColor }}
            >
              {categorySymbol}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-medium text-slate-900">{ev.title}</h2>
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
          <div className="mb-3 h-[70px]">
            {!isSaved || isEditing ? (
              <div className="flex h-full flex-col justify-center gap-1">
                <label className="text-[11px] font-medium text-slate-700">Besucherzahl</label>
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={visitorsInput[ev.id] ?? ""}
                  onChange={(e) => handleChangeVisitor(ev.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleSaveVisitor(ev.id);
                    }
                  }}
                  autoComplete="off"
                  onFocus={() => setFocusVisitorEventId(ev.id)}
                  onBlur={() =>
                    setFocusVisitorEventId((prev) => (prev === ev.id ? null : prev))
                  }
                  style={{
                    ...fieldBaseStyle,
                    ...(focusVisitorEventId === ev.id ? focusedStyle : null),
                  }}
                  placeholder="Zahl eingeben"
                />
              </div>
            ) : (
              <div className="flex h-full flex-col justify-center gap-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                  Aktuell gespeicherte Besucherzahl
                </div>
                <div className="flex h-[44px] items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-4">
                  <div className="text-2xl font-semibold leading-none text-emerald-900">{saved}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">

            

            {!isSaved ? (
              <button
                type="button"
                onClick={() => handleSaveVisitor(ev.id)}
                disabled={savingFor === ev.id}
                {...bindButtonInteractions(`save-${ev.id}`)}
                style={primaryButtonStyle(`save-${ev.id}`, savingFor === ev.id)}
                className="mt-1 inline-flex w-full items-center justify-center"
              >
                {savingFor === ev.id ? "Speichern…" : "Speichern"}
              </button>
            ) : isEditing ? (
              <div className="mt-1 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveVisitor(ev.id)}
                  disabled={savingFor === ev.id}
                  {...bindButtonInteractions(`save-edit-${ev.id}`)}
                  style={{
                    ...primaryButtonStyle(`save-edit-${ev.id}`, savingFor === ev.id),
                    width: "100%",
                    flex: 1,
                  }}
                  className="inline-flex flex-1 items-center justify-center sm:flex-none"
                >
                  {savingFor === ev.id ? "Speichern…" : "Speichern"}
                </button>

                <button
                  type="button"
                  onClick={() => cancelEditing(ev.id)}
                  disabled={savingFor === ev.id}
                  {...bindButtonInteractions(`cancel-${ev.id}`)}
                  style={{
                    ...subtleButtonStyle,
                    width: "100%",
                    flex: 1,
                    transform: pressButton === `cancel-${ev.id}` ? "translateY(1px)" : "none",
                  }}
                  className="inline-flex flex-1 items-center justify-center sm:flex-none"
                >
                  Abbrechen
                </button>
              </div>
            ) : (
              <div className="mt-1 flex w-full gap-2">
                <button
                  type="button"
                  onClick={() => startEditing(ev.id)}
                  {...bindButtonInteractions(`edit-${ev.id}`)}
                  style={{
                    ...subtleButtonStyle,
                    width: "100%",
                    flex: 1,
                    transform: pressButton === `edit-${ev.id}` ? "translateY(1px)" : "none",
                  }}
                  className="inline-flex flex-1 items-center justify-center sm:flex-none"
                >
                  Ändern
                </button>

                <button
                  type="button"
                  onClick={() => openDeleteConfirm(ev.id)}
                  {...bindButtonInteractions(`delete-${ev.id}`)}
                  style={{
                    ...dangerOutlineButtonStyle,
                    width: "100%",
                    flex: 1,
                    transform: pressButton === `delete-${ev.id}` ? "translateY(1px)" : "none",
                  }}
                  className="inline-flex flex-1 items-center justify-center sm:flex-none"
                >
                  Löschen
                </button>
              </div>
            )}
          </div>


{isSaved && isEditing && (
            <div className="mt-2 text-[11px] text-slate-500">
              Aktuell gespeicherte Besucherzahl:{" "}
              <span className="font-medium text-slate-800">{saved}</span>
            </div>
          )}
        </div>
      </React.Fragment>
    );
  });

  return (
    <div className="w-full relative">
      {loading && <p className="mb-2 text-xs text-slate-500">Lade Events…</p>}

      {error && (
        <div
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}

      {!loading && !hasEvents && !error && (
        <p className="text-xs text-slate-500">
          Es sind aktuell keine zukünftigen Gottesdienste mit Startzeit vorhanden.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{groupedList}</div>

      {deleteConfirmFor != null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl">
            <div className="text-base font-semibold text-slate-900">Besucherzahl löschen</div>
            <div className="mt-2 text-sm text-slate-600">
              Möchtest du wirklich die gespeicherte Besucherzahl für dieses Event löschen?
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deletingFor === deleteConfirmFor}
                {...bindButtonInteractions("modal-cancel")}
                style={{
                  ...subtleButtonStyle,
                  transform: pressButton === "modal-cancel" ? "translateY(1px)" : "none",
                }}
                className="inline-flex flex-1 items-center justify-center"
              >
                Abbrechen
              </button>
              <button type="button"
                onClick={() => void confirmDelete()}
                disabled={deletingFor === deleteConfirmFor}
                {...bindButtonInteractions("modal-delete")}
                style={dangerButtonStyle("modal-delete", deletingFor === deleteConfirmFor)}
                className="inline-flex flex-1 items-center justify-center"
              >
                {deletingFor === deleteConfirmFor ? "Löschen…" : "Löschen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileVisitorsPage;