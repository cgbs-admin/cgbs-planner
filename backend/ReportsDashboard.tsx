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
  date: string;   // ISO date string from backend (Reporting.event_date)
  title: string;  // Event title snapshot from Reporting
  visitors: number;
  id?: number;
  event_id?: number;
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

const ReportsDashboard: React.FC = () => {
  const [startDate, setStartDate] = useState<string | "">("");
  const [endDate, setEndDate] = useState<string | "">("");
  const [state, setState] = useState<ApiState<VisitorStatsPoint[] | unknown>>({
    data: null,
    loading: false,
    error: null,
  });

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

  // Prepare data for chart: pivot by date, one line per title
  const { chartData, titles } = useMemo(() => {
    const raw = Array.isArray(state.data) ? state.data : [];

    const titlesSet = new Set<string>();
    const byDate: Record<string, Record<string, number> & { date: string }> = {};

    for (const point of raw) {
      titlesSet.add(point.title);
      const key = point.date;
      if (!byDate[key]) {
        byDate[key] = { date: key };
      }
      const current = byDate[key][point.title] || 0;
      byDate[key][point.title] = current + (point.visitors ?? 0);
    }

    const items = Object.values(byDate).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    );

    return {
      chartData: items,
      titles: Array.from(titlesSet).sort(),
    };
  }, [state.data]);

  const hasData = chartData.length > 0;

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
                  {titles.map((title) => (
                    <Line
                      key={title}
                      type="monotone"
                      dataKey={title}
                      name={title}
                      dot={false}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ))}
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
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      ID
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Event-ID
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Datum
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Startzeit
                    </th>
                    <th style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Titel
                    </th>
                    <th style={{ textAlign: "right", padding: "4px 6px", borderBottom: "1px solid #ddd" }}>
                      Besucher
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
                  {(Array.isArray(state.data) ? state.data : []).map((row, idx) => (
                    <tr key={row.id ?? `${row.date}-${row.title}-${idx}`}>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.id ?? "-"}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.event_id ?? "-"}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.date}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.event_start_time ?? "-"}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.title}
                      </td>
                      <td
                        style={{
                          padding: "4px 6px",
                          borderBottom: "1px solid #f0f0f0",
                          textAlign: "right",
                        }}
                      >
                        {row.visitors}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.vacation ?? "-"}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.holiday ?? "-"}
                      </td>
                      <td style={{ padding: "4px 6px", borderBottom: "1px solid #f0f0f0" }}>
                        {row.special ?? "-"}
                      </td>
                    </tr>
                  ))}
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
