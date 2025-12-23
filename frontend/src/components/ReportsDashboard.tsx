import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type VisitorStatsPoint = {
  id?: number;                 // Reporting row id (optional)
  event_id?: number;           // Event id (optional)
  date: string;                // ISO date string from backend (Reporting.event_date)
  title: string;               // Event title snapshot from Reporting
  visitors: number;            // Visitor count
  event_start_time?: string | null;
  vacation?: string | null;
  holiday?: string | null;
  special?: string | null;
};

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

type SummaryStats = {
  totalVisitors: number;
  avgVisitorsPerEntry: number;
  maxVisitors: number;
  entryCount: number;
  trendLabel: string;
  trendPercent: number | null;
  avgVisitorsPerDate: number;
  titleCounts: Record<string, number>;
};

type ChartRow = {
  date: string;
  totalVisitors: number;
  totalTrend?: number;
  // dynamic series keys (event titles) -> numbers; allow string for known 'date'
  [key: string]: number | string | undefined;
};

const ReportsDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState<string | "">("");
  const [endDate, setEndDate] = useState<string | "">("");
  const [state, setState] = useState<ApiState<VisitorStatsPoint[] | unknown>>({
    data: null,
    loading: false,
    error: null,
  });

  // Additional filters for reporting rows
  const [filterVacation, setFilterVacation] = useState<string>("");
  const [filterHoliday, setFilterHoliday] = useState<string>("");
  const [filterSpecial, setFilterSpecial] = useState<string>("");
  const [filterStartTime, setFilterStartTime] = useState<string>("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterQuarter, setFilterQuarter] = useState<string>("");

  // Sorting for raw table
  const [sortColumn, setSortColumn] = useState<"date" | "visitors">("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Inline editing / CRUD state for reporting rows
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<VisitorStatsPoint | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Simple "new reporting row" form (manual entries)
  const [newDate, setNewDate] = useState<string>("");
  const [newStartTime, setNewStartTime] = useState<string>("");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newVisitor, setNewVisitor] = useState<string>("");
  const [newVacation, setNewVacation] = useState<string>("");
  const [newHoliday, setNewHoliday] = useState<string>("");
  const [newSpecial, setNewSpecial] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const loadData = async (opts?: { start?: string; end?: string }) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const params = new URLSearchParams();
      if (opts?.start) params.append("start_date", opts.start);
      if (opts?.end) params.append("end_date", opts.end);

      const query = params.toString();
      const url = query
        ? `/reports/visitors-by-title?${query}`
        : `/reports/visitors-by-title`;

      const response = await apiFetch(url, { method: "GET" });

      // If the backend returns an error status (e.g. 404), handle it gracefully
      if (!response.ok) {
        let message = `Fehler beim Laden der Reports (Status ${response.status})`;

        try {
          const errorBody = await response.json();
          if (errorBody && typeof errorBody === "object" && "detail" in errorBody) {
            message = String((errorBody as any).detail);
          }
        } catch {
          // ignore JSON parse errors here
        }

        throw new Error(message);
      }

      const json = await response.json();

      // Ensure we always store an array or null so that useMemo stays safe
      const dataArray = Array.isArray(json) ? (json as VisitorStatsPoint[]) : [];

      setState({ data: dataArray, loading: false, error: null });
    } catch (err: any) {
      console.error("Failed to load report data", err);
      setState({
        data: null,
        loading: false,
        error: err?.message || "Unbekannter Fehler beim Laden der Reports.",
      });
    }
  };

  // initial load (no filters)
  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilter = () => {
    void loadData({
      start: startDate || undefined,
      end: endDate || undefined,
    });
  };


  const startEditRow = (row: VisitorStatsPoint) => {
    if (!row.id) return;
    setEditingId(row.id);
    setEditDraft({ ...row });
  };

  const cancelEditRow = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const handleEditFieldChange = (field: keyof VisitorStatsPoint, value: string) => {
    if (!editDraft) return;
    setEditDraft({ ...editDraft, [field]: value });
  };

  const saveEditRow = async () => {
    if (!editDraft || !editDraft.id) return;
    const id = editDraft.id;
    setSavingId(id);

    try {
      const payload: any = {
        visitor:
          typeof editDraft.visitors === "number"
            ? editDraft.visitors
            : editDraft.visitors != null
            ? Number(editDraft.visitors)
            : undefined,
        event_title: editDraft.title,
        event_date: editDraft.date ? new Date(editDraft.date).toISOString().slice(0, 10) : undefined,
        event_start_time: editDraft.event_start_time ?? undefined,
        vacation: editDraft.vacation ?? undefined,
        holiday: editDraft.holiday ?? undefined,
        special: editDraft.special ?? undefined,
      };

      const response = await apiFetch(`/reporting/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      // Reload data so the table & chart are refreshed
      await loadData({
        start: startDate || undefined,
        end: endDate || undefined,
      });

      setEditingId(null);
      setEditDraft(null);
    } catch (err: any) {
      console.error("Failed to update reporting row", err);
      alert(
        "Das Reporting konnte nicht aktualisiert werden. Details: " +
          (err?.message || "Unbekannter Fehler")
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateRow = async () => {
    const visitorNum = Number(newVisitor);

    if (!newDate) {
      alert("Bitte ein Datum eingeben.");
      return;
    }
    if (!newTitle.trim()) {
      alert("Bitte einen Titel eingeben.");
      return;
    }
    if (!Number.isFinite(visitorNum) || visitorNum < 0) {
      alert("Bitte eine gültige Besucherzahl eingeben (>= 0).");
      return;
    }

    // For manuell erfasste Zeilen verwenden wir standardmäßig Event-ID 99
    const eventIdNum = 99;

    setCreating(true);
    try {
      const payload: any = {
        event_id: eventIdNum,
        event_title: newTitle.trim(),
        event_date: newDate,
        event_start_time: newStartTime || undefined,
        visitor: visitorNum,
        vacation: newVacation || undefined,
        holiday: newHoliday || undefined,
        special: newSpecial || undefined,
      };

      const response = await apiFetch("/reporting/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      // Clear the form and reload
      setNewDate("");
      setNewStartTime("");
      setNewTitle("");
      setNewVisitor("");
      setNewVacation("");
      setNewHoliday("");
      setNewSpecial("");

      await loadData({
        start: startDate || undefined,
        end: endDate || undefined,
      });
    } catch (err: any) {
      console.error("Failed to create reporting row", err);
      alert(
        "Das Reporting konnte nicht erstellt werden. Details: " +
          (err?.message || "Unbekannter Fehler")
      );
    } finally {
      setCreating(false);
    }
  };


  const handleDeleteRow = async (row: VisitorStatsPoint) => {
    if (!row.id) return;
    if (!window.confirm("Diesen Reporting-Eintrag wirklich löschen?")) return;

    setDeletingId(row.id);
    try {
      const response = await apiFetch(`/reporting/${row.id}`, {
        method: "DELETE",
      });

      if (!response.ok && response.status !== 204) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      await loadData({
        start: startDate || undefined,
        end: endDate || undefined,
      });
    } catch (err: any) {
      console.error("Failed to delete reporting row", err);
      alert(
        "Das Reporting konnte nicht gelöscht werden. Details: " +
          (err?.message || "Unbekannter Fehler")
      );
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSort = (column: "date" | "visitors") => {
    setSortColumn((prevCol) => {
      if (prevCol === column) {
        // toggle direction
        setSortDirection((prevDir) => (prevDir === "asc" ? "desc" : "asc"));
        return prevCol;
      }
      // switch column and reset direction (date newest first, visitors highest first)
      setSortDirection("desc");
      return column;
    });
  };

  // Prepare data for chart and sorted table
  const { chartData, titles, tableRows, summaryStats } = useMemo(() => {
    const raw = Array.isArray(state.data) ? (state.data as VisitorStatsPoint[]) : [];

    // Apply additional filters
    const filtered = raw.filter((point) => {
      // Ferien filter (contains text)
      if (filterVacation) {
        const v = (point.vacation ?? "").toLowerCase();
        if (!v.includes(filterVacation.toLowerCase())) {
          return false;
        }
      }

      // Feiertag filter
      if (filterHoliday) {
        const h = (point.holiday ?? "").toLowerCase();
        if (!h.includes(filterHoliday.toLowerCase())) {
          return false;
        }
      }

      // Special filter
      if (filterSpecial) {
        const s = (point.special ?? "").toLowerCase();
        if (!s.includes(filterSpecial.toLowerCase())) {
          return false;
        }
      }

      // Start time filter (prefix match)
      if (filterStartTime) {
        const t = (point.event_start_time ?? "").toLowerCase();
        if (!t.startsWith(filterStartTime.toLowerCase())) {
          return false;
        }
      }

      // Month / Year / Quarter filter
      if (filterYear || filterMonth || filterQuarter) {
        if (!point.date) {
          return false;
        }
        const parts = point.date.split("-");
        if (parts.length < 2) {
          return false;
        }
        const y = parts[0];
        const m = parts[1];

        if (filterYear && y !== filterYear) {
          return false;
        }
        if (filterMonth) {
          const targetMonth = filterMonth.padStart(2, "0");
          if (m !== targetMonth) {
            return false;
          }
        }
        if (filterQuarter) {
          const monthNum = Number(m);
          const q = monthNum <= 3 ? 1 : monthNum <= 6 ? 2 : monthNum <= 9 ? 3 : 4;
          if (String(q) !== filterQuarter) {
            return false;
          }
        }
      }

      return true;
    });

    // Build chart data from filtered rows
    const titlesSet = new Set<string>();
    const byDate: Record<string, ChartRow> = {};
    const titleCounts: Record<string, number> = {};

    for (const point of filtered) {
      const titleKey = point.title || "(ohne Titel)";
      titlesSet.add(titleKey);
      const key = point.date;
      if (!byDate[key]) {
        byDate[key] = { date: key, totalVisitors: 0 };
      }
      const visitors = point.visitors ?? 0;
      const currentRaw = byDate[key][titleKey];
      const current =
        typeof currentRaw === "number" ? currentRaw : Number(currentRaw) || 0;
      byDate[key][titleKey] = current + visitors;
      byDate[key].totalVisitors += visitors;

      titleCounts[titleKey] = (titleCounts[titleKey] ?? 0) + 1;
    }

    const chartItems = Object.values(byDate).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );

    const dailyTotals = chartItems.map((item) => item.totalVisitors ?? 0);
    const avgVisitorsPerDate =
      dailyTotals.length > 0
        ? dailyTotals.reduce((sum, value) => sum + value, 0) / dailyTotals.length
        : 0;

    // Simple linear trend for totalVisitors across dates
    let chartItemsWithTrend = chartItems;
    if (chartItems.length >= 2) {
      const n = chartItems.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;

      for (let i = 0; i < n; i++) {
        const x = i;
        const y = chartItems[i].totalVisitors ?? 0;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }

      const denominator = n * sumXX - sumX * sumX;
      let slope = 0;
      let intercept = 0;

      if (denominator !== 0) {
        slope = (n * sumXY - sumX * sumY) / denominator;
        intercept = (sumY - slope * sumX) / n;
      }

      chartItemsWithTrend = chartItems.map((item, index) => ({
        ...item,
        totalTrend: intercept + slope * index,
      }));
    }
    // Sorted table rows (newest date/time or by visitors)
    const rowsForTable = [...filtered];
    rowsForTable.sort((a, b) => {
      if (sortColumn === "date") {
        const aKey = `${a.date || ""} ${a.event_start_time || ""}`;
        const bKey = `${b.date || ""} ${b.event_start_time || ""}`;
        if (aKey < bKey) return sortDirection === "asc" ? -1 : 1;
        if (aKey > bKey) return sortDirection === "asc" ? 1 : -1;
        return 0;
      } else {
        const av = a.visitors ?? 0;
        const bv = b.visitors ?? 0;
        if (av < bv) return sortDirection === "asc" ? -1 : 1;
        if (av > bv) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }
    });

    // Summary statistics for KPI cards
    const entryCount = rowsForTable.length;
    let totalVisitors = 0;
    let maxVisitors = 0;

    for (const r of rowsForTable) {
      const v = r.visitors ?? 0;
      totalVisitors += v;
      if (v > maxVisitors) {
        maxVisitors = v;
      }
    }

    let trendLabel = "Zu wenig Daten für Trend";
    let trendPercent: number | null = null;

    const sortedByDate = [...filtered].sort((a, b) => {
      const aKey = `${a.date || ""} ${a.event_start_time || ""}`;
      const bKey = `${b.date || ""} ${b.event_start_time || ""}`;
      if (aKey < bKey) return -1;
      if (aKey > bKey) return 1;
      return 0;
    });

    if (sortedByDate.length >= 6) {
      const lastN = 5;
      const recent = sortedByDate.slice(-lastN);
      const previous = sortedByDate.slice(-2 * lastN, -lastN);

      const avgRecent =
        recent.reduce((sum, r) => sum + (r.visitors ?? 0), 0) / recent.length;
      const avgPrevious =
        previous.length > 0
          ? previous.reduce((sum, r) => sum + (r.visitors ?? 0), 0) / previous.length
          : 0;

      if (avgPrevious > 0) {
        trendPercent = ((avgRecent - avgPrevious) / avgPrevious) * 100;
        if (trendPercent > 5) {
          trendLabel = "steigend gegenüber vorherigen Gottesdiensten";
        } else if (trendPercent < -5) {
          trendLabel = "sinkend gegenüber vorherigen Gottesdiensten";
        } else {
          trendLabel = "weitgehend stabil";
        }
      } else {
        trendLabel = "Trend nicht aussagekräftig";
      }
    }

    const summaryStats: SummaryStats = {
      totalVisitors,
      avgVisitorsPerEntry: entryCount > 0 ? totalVisitors / entryCount : 0,
      maxVisitors,
      entryCount,
      trendLabel,
      trendPercent,
      avgVisitorsPerDate,
      titleCounts,
    };

    return {
      chartData: chartItemsWithTrend,
      titles: Array.from(titlesSet).sort(),
      tableRows: rowsForTable,
      summaryStats,
    };
  }, [
    state.data,
    filterVacation,
    filterHoliday,
    filterSpecial,
    filterStartTime,
    filterMonth,
    filterYear,
    filterQuarter,
    sortColumn,
    sortDirection,
  ]);

  const hasData = chartData.length > 0;

  const lineColors = [
    "#3366CC",
    "#DC3912",
    "#FF9900",
    "#109618",
    "#990099",
    "#0099C6",
    "#DD4477",
    "#66AA00",
    "#B82E2E",
    "#316395",
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "4px" }}>
        Besucherstatistik
      </h1>
      <p style={{ margin: 0, color: "#555", fontSize: "0.9rem" }}>
        Auswertung der Besucherzahlen aus den Veranstaltungen. Die Daten werden
        nach Datum gruppiert, mit einer Linie pro Veranstaltungstitel.
      </p>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-end",
          padding: "12px 16px",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", minWidth: "160px" }}>
          <label
            htmlFor="report-start-date"
            style={{ fontSize: "0.8rem", marginBottom: "4px", color: "#333" }}
          >
            Startdatum
          </label>
          <input
            id="report-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "0.9rem",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: "160px" }}>
          <label
            htmlFor="report-end-date"
            style={{ fontSize: "0.8rem", marginBottom: "4px", color: "#333" }}
          >
            Enddatum
          </label>
          <input
            id="report-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "0.9rem",
            }}
          />
        </div>

        {/* Additional client-side filters */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", minWidth: "140px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Ferien enthält
            </label>
            <input
              type="text"
              value={filterVacation}
              onChange={(e) => setFilterVacation(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
              placeholder="z.B. Herbst"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "140px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Feiertag enthält
            </label>
            <input
              type="text"
              value={filterHoliday}
              onChange={(e) => setFilterHoliday(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
              placeholder="z.B. Reformation"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "140px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Special enthält
            </label>
            <input
              type="text"
              value={filterSpecial}
              onChange={(e) => setFilterSpecial(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
              placeholder="z.B. Lobpreis"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "120px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Startzeit
            </label>
            <input
              type="text"
              value={filterStartTime}
              onChange={(e) => setFilterStartTime(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
              placeholder="HH oder HH:MM"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "100px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Monat
            </label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
            >
              <option value="">Alle</option>
              <option value="1">Januar</option>
              <option value="2">Februar</option>
              <option value="3">März</option>
              <option value="4">April</option>
              <option value="5">Mai</option>
              <option value="6">Juni</option>
              <option value="7">Juli</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Dezember</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "90px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Jahr
            </label>
            <input
              type="text"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
              placeholder="z.B. 2025"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", minWidth: "100px" }}>
            <label style={{ fontSize: "0.75rem", marginBottom: "2px", color: "#333" }}>
              Quartal
            </label>
            <select
              value={filterQuarter}
              onChange={(e) => setFilterQuarter(e.target.value)}
              style={{
                padding: "4px 6px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "0.8rem",
              }}
            >
              <option value="">Alle</option>
              <option value="1">Q1</option>
              <option value="2">Q2</option>
              <option value="3">Q3</option>
              <option value="4">Q4</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleApplyFilter}
          disabled={state.loading}
          style={{
            padding: "8px 16px",
            borderRadius: "4px",
            border: "none",
            fontSize: "0.9rem",
            fontWeight: 500,
            cursor: state.loading ? "default" : "pointer",
            background: state.loading ? "#bbb" : "#4a6cf7",
            color: "#fff",
            marginLeft: "auto",
          }}
        >
          {state.loading ? "Lädt..." : "Filter anwenden"}
        </button>
      </div>

      {/* Content Area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          minHeight: "320px",
        }}
      >
        {state.error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              border: "1px solid #f5c2c7",
              background: "#f8d7da",
              color: "#842029",
              fontSize: "0.85rem",
            }}
          >
            {state.error}
          </div>
        )}

        {!state.error && state.loading && !hasData && (
          <div style={{ fontSize: "0.9rem", color: "#555" }}>Lade Daten…</div>
        )}

        {!state.loading && !state.error && !hasData && (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              border: "1px dashed #ccc",
              textAlign: "center",
              fontSize: "0.9rem",
              color: "#777",
            }}
          >
            Keine Daten für die aktuelle Auswahl vorhanden.
          </div>
        )}

        {hasData && (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              background: "#fff",
              padding: "12px 16px 16px",
              minHeight: "320px",
            }}
          >
            {summaryStats && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 160px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Gesamtbesucher</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      {summaryStats.totalVisitors.toLocaleString("de-DE")}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: "1 1 160px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Ø Besucher pro Eintrag</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      {summaryStats.avgVisitorsPerEntry.toFixed(1)}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: "1 1 160px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>
                      Max. Besucher in einem Eintrag
                    </div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      {summaryStats.maxVisitors.toLocaleString("de-DE")}
                    </div>
                  </div>
                  <div
                    style={{
                      flex: "1 1 160px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Trend (letzte 5)</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      {summaryStats.trendPercent !== null
                        ? `${summaryStats.trendPercent > 0 ? "+" : ""}${summaryStats.trendPercent.toFixed(1)}%`
                        : "–"}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#999" }}>{summaryStats.trendLabel}</div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div
                    style={{
                      flex: "1 1 160px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666" }}>Ø Gesamtbesucher pro Datum</div>
                    <div style={{ fontSize: "1.1rem", fontWeight: 600 }}>
                      {summaryStats.avgVisitorsPerDate.toFixed(1)}
                    </div>
                  </div>

                  <div
                    style={{
                      flex: "2 1 240px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #e0e0e0",
                      background: "#f9fafb",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "4px" }}>
                      Anzahl Einträge je Titel
                    </div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        maxHeight: "96px",
                        overflowY: "auto",
                      }}
                    >
                      {Object.entries(summaryStats.titleCounts).length === 0 ? (
                        <div style={{ fontSize: "0.75rem", color: "#999" }}>Keine Daten</div>
                      ) : (
                        Object.entries(summaryStats.titleCounts)
                          .sort((a, b) => b[1] - a[1])
                          .map(([title, count]) => (
                            <div
                              key={title}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "2px",
                              }}
                            >
                              <span>{title}</span>
                              <span style={{ fontWeight: 600 }}>{count}</span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                margin: "0 0 8px 0",
              }}
            >
              Besucherzahlen pro Datum &amp; Titel
            </h2>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => value}
                    style={{ fontSize: "0.75rem" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    style={{ fontSize: "0.75rem" }}
                    label={{
                      value: "Besucher",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                    }}
                  />
                  <Tooltip
                    formatter={(value: any) => [value, "Besucher"]}
                    labelFormatter={(label) => `Datum: ${label}`}
                  />
                  <Legend />
                  {titles.map((title, index) => (
                    <Line
                      key={title}
                      type="monotone"
                      dataKey={title}
                      name={title}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                      stroke={lineColors[index % lineColors.length]}
                    />
                  ))}
                  <Line
                    key="__totalVisitors"
                    type="monotone"
                    dataKey="totalVisitors"
                    name="Gesamt Besucher (gesamt)"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                    strokeDasharray="4 4"
                  />
                  <Line
                    key="__totalTrend"
                    type="monotone"
                    dataKey="totalTrend"
                    name="Trend Gesamt"
                    dot={false}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    strokeDasharray="1 8"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Optional small raw-data table for debugging / transparency */}
        {hasData && (
          <div
            style={{
              borderRadius: "8px",
              border: "1px solid #e0e0e0",
              background: "#fafafa",
              padding: "12px 16px 16px",
            }}
          >
            <h3
              style={{
                fontSize: "1rem",
                fontWeight: 500,
                margin: "0 0 8px 0",
              }}
            >
              Rohdaten (Tabellarische Ansicht)
            </h3>
            <div style={{ maxHeight: "200px", overflow: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8rem",
                }}
              >
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    background: "#fafafa",
                  }}
                >
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      ID
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Event-ID
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "4px 6px",
                        borderBottom: "1px solid #ddd",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => toggleSort("date")}
                    >
                      Datum{" "}
                      {sortColumn === "date" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Startzeit
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Titel
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "4px 6px",
                        borderBottom: "1px solid #ddd",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      onClick={() => toggleSort("visitors")}
                    >
                      Besucher{" "}
                      {sortColumn === "visitors" && (
                        <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
                      )}
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Ferien
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Feiertag
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Special
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* New manual reporting entry */}
                  <tr>
                    <td
                      style={{
                        padding: "4px 6px",
                        borderBottom: "1px solid #f0f0f0",
                        fontSize: "0.75rem",
                        color: "#999",
                      }}
                    >
                      Neu
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        borderBottom: "1px solid #f0f0f0",
                        fontSize: "0.75rem",
                        color: "#999",
                      }}
                    >
                      99
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <input
                        type="text"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        placeholder="HH:MM oder HH:MM:SS"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Titel"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        borderBottom: "1px solid #f0f0f0",
                        textAlign: "right",
                      }}
                    >
                      <input
                        type="number"
                        value={newVisitor}
                        onChange={(e) => setNewVisitor(e.target.value)}
                        placeholder="Besucher"
                        style={{ width: "100%", fontSize: "0.75rem", textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <input
                        type="text"
                        value={newVacation}
                        onChange={(e) => setNewVacation(e.target.value)}
                        placeholder="Ferien (optional)"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                      <input
                        type="text"
                        value={newHoliday}
                        onChange={(e) => setNewHoliday(e.target.value)}
                        placeholder="Feiertag (optional)"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td style={{ padding: "4px 6px", borderBottom: "1px solid " +
                      " #f0f0f0" }}>
                      <input
                        type="text"
                        value={newSpecial}
                        onChange={(e) => setNewSpecial(e.target.value)}
                        placeholder="Special (optional)"
                        style={{ width: "100%", fontSize: "0.75rem" }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "4px 6px",
                        borderBottom: "1px solid #f0f0f0",
                        textAlign: "right",
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleCreateRow}
                        disabled={creating}
                        style={{
                          fontSize: "0.75rem",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          border: "1px solid #4caf50",
                          background: creating ? "#c8e6c9" : "#e8f5e9",
                          cursor: creating ? "wait" : "pointer",
                        }}
                      >
                        {creating ? "Speichern..." : "Neu anlegen"}
                      </button>
                    </td>
                  </tr>


                  {/* Existing rows */}
                  {tableRows.map((row, idx) => {
                    const isEditing = editingId === row.id;
                    const current = isEditing && editDraft && editDraft.id === row.id ? editDraft : row;

                    return (
                      <tr key={`${row.date}-${row.title}-${idx}`}>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {current.id ?? ""}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {current.event_id ?? ""}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="date"
                              value={current.date}
                              onChange={(e) => handleEditFieldChange("date", e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.date
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={current.event_start_time ?? ""}
                              onChange={(e) =>
                                handleEditFieldChange("event_start_time", e.target.value)
                              }
                              placeholder="HH:MM:SS"
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.event_start_time ?? ""
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={current.title}
                              onChange={(e) => handleEditFieldChange("title", e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.title
                          )}
                        </td>
                        <td
                          style={{
                            padding: "4px 6px",
                            borderBottom: "1px solid #f0f0f0",
                            textAlign: "right",
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="number"
                              value={current.visitors}
                              onChange={(e) =>
                                handleEditFieldChange("visitors", e.target.value)
                              }
                              style={{ width: "100%", fontSize: "0.75rem", textAlign: "right" }}
                            />
                          ) : (
                            current.visitors
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={current.vacation ?? ""}
                              onChange={(e) => handleEditFieldChange("vacation", e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.vacation ?? ""
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={current.holiday ?? ""}
                              onChange={(e) => handleEditFieldChange("holiday", e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.holiday ?? ""
                          )}
                        </td>
                        <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                          {isEditing ? (
                            <input
                              type="text"
                              value={current.special ?? ""}
                              onChange={(e) => handleEditFieldChange("special", e.target.value)}
                              style={{ width: "100%", fontSize: "0.75rem" }}
                            />
                          ) : (
                            current.special ?? ""
                          )}
                        </td>
                        <td
                          style={{
                            padding: "4px 6px",
                            borderBottom: "1px solid #f0f0f0",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={saveEditRow}
                                disabled={savingId === current.id}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  marginRight: "4px",
                                  borderRadius: "4px",
                                  border: "1px solid #1976d2",
                                  background: "#e3f2fd",
                                  cursor: savingId === current.id ? "wait" : "pointer",
                                }}
                              >
                                Speichern
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditRow}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #9e9e9e",
                                  background: "#fafafa",
                                  cursor: "pointer",
                                }}
                              >
                                Abbrechen
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditRow(row)}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  marginRight: "4px",
                                  borderRadius: "4px",
                                  border: "1px solid #1976d2",
                                  background: "#e3f2fd",
                                  cursor: "pointer",
                                }}
                              >
                                Bearbeiten
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row)}
                                disabled={deletingId === current.id}
                                style={{
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  border: "1px solid #d32f2f",
                                  background: "#ffebee",
                                  cursor: deletingId === current.id ? "wait" : "pointer",
                                }}
                              >
                                Löschen
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsDashboard;
