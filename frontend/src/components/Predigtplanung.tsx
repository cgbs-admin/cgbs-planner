import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";

interface Category {
  id: number;
  name: string;
  symbol?: string | null;
  color_hex?: string | null;
}

interface PlanningLevel {
  id: number;
  name: string;
}

interface EventItem {
  id: number;
  parent_id?: number | null;

  title: string;
  start_date?: string | null;
  end_date?: string | null;
  link_id?: number | null;

  sermon_title?: string | null;
  preacher?: string | null;

  categories?: Category[];
  planning_levels?: PlanningLevel[];
}

type PredigtplanungProps = {
  onCreateEvent?: () => void;
  onOpenEventById?: (id: number) => void;
};

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDDMMYYYY(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return iso;
  return `${dd}.${mm}.${yyyy}`;
}

function monthKey(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length < 2) return "";
  return `${parts[0]}-${parts[1]}`;
}

function monthLabelFromKey(key: string): string {
  const [yyyy, mm] = key.split("-");
  const m = Number(mm);
  const names = [
    "Januar",
    "Februar",
    "März",
    "April",
    "Mai",
    "Juni",
    "Juli",
    "August",
    "September",
    "Oktober",
    "November",
    "Dezember",
  ];
  if (!yyyy || !mm || Number.isNaN(m) || m < 1 || m > 12) return key;
  return `${names[m - 1]} ${yyyy}`;
}

function stripPredigtreihePrefix(title: string): string {
  return title.replace(/^\s*Predigtreihe\s*[:\-]\s*/i, "").trim();
}

function hasCategory(ev: EventItem, categoryName: string): boolean {
  const cats = ev.categories ?? [];
  return cats.some((c) => c.name === categoryName);
}

function pickCategory(ev: EventItem, preferredName?: string): Category | null {
  const cats = ev.categories ?? [];
  if (preferredName) {
    const found = cats.find((c) => c.name === preferredName);
    if (found) return found;
  }
  return cats.length > 0 ? cats[0] : null;
}

// Ported logic from your App.tsx: readable text on category background.
function getReadableTextColor(bgColor: string): string {
  const hex = (bgColor || "").replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6) return "#0f172a";

  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);

  // Relative luminance
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.58 ? "#0f172a" : "#ffffff";
}

function buildCategoryPillStyle(colorHex?: string | null): React.CSSProperties {
  const bg = colorHex || "#f1f5f9";
  return {
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.10)",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    backgroundColor: bg,
    color: getReadableTextColor(bg),
    // Subtle 3D effect (matching App.tsx event/category look)
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)",
    backgroundImage:
      "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0))",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    whiteSpace: "nowrap",
    maxWidth: "100%",
  };
}

const Predigtplanung: React.FC<PredigtplanungProps> = ({ onCreateEvent, onOpenEventById }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => todayIso(), []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await apiFetch("/events");
      if (!res.ok) throw new Error("Failed to load events");

      const data: EventItem[] = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err?.message ?? "Events konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, []);

  const openEvent = (id: number) => {
    if (onOpenEventById) {
      onOpenEventById(id);
      return;
    }
    window.dispatchEvent(new CustomEvent("open-event", { detail: id }));
  };

  const openCreateWizard = () => {
    if (onCreateEvent) {
      onCreateEvent();
      return;
    }
    window.dispatchEvent(new CustomEvent("open-create-event-wizard"));
  };

  const findPredigtreihe = (ev: EventItem): EventItem | null => {
    if (!ev.link_id) return null;
    const linked = events.find((e) => e.id === ev.link_id);
    if (!linked) return null;
    return hasCategory(linked, "Predigtreihe") ? linked : null;
  };

  const findGastpredigerChildren = (ev: EventItem): EventItem[] => {
    return events.filter((e) => e.parent_id === ev.id && hasCategory(e, "Gastprediger"));
  };

  const filtered = useMemo(() => {
    return events
      .filter((ev) => {
        const sd = ev.start_date ?? "";
        const ed = ev.end_date ?? "";
        if (!sd && !ed) return false;
        if (sd && sd < today && (!ed || ed < today)) return false;

        const pls = ev.planning_levels ?? [];
        if (!pls.some((p) => p.name === "Predigtplanung")) return false;

        if (hasCategory(ev, "Predigtreihe")) return false;
        if (hasCategory(ev, "Gastprediger")) return false;

        return true;
      })
      .sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  }, [events, today]);

  const rowsWithSeparators = useMemo(() => {
    const out: Array<
      | { kind: "separator"; monthKey: string; label: string }
      | { kind: "datespacer"; key: string }
      | { kind: "event"; ev: EventItem }
    > = [];

    let lastMonth = "";
    let lastDate = "";

    for (const ev of filtered) {
      const dateKey = ev.start_date ?? "";
      const mk = monthKey(dateKey);

      if (mk && mk !== lastMonth) {
        out.push({ kind: "separator", monthKey: mk, label: monthLabelFromKey(mk) });
        lastMonth = mk;
        lastDate = "";
      }

      if (lastDate && dateKey && dateKey !== lastDate) {
        out.push({ kind: "datespacer", key: `sp-${lastDate}-${dateKey}` });
      }

      lastDate = dateKey;
      out.push({ kind: "event", ev });
    }

    return out;
  }, [filtered]);

  if (loading) {
    return <div style={{ padding: 12, color: "#475569" }}>Lade Predigtplanung…</div>;
  }

  if (error) {
    return <div style={{ padding: 12, color: "#b91c1c" }}>{error}</div>;
  }

  const newButtonStyle: React.CSSProperties = {
    borderRadius: 999,
    border: "none",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    background: "linear-gradient(180deg, #4f46e5 0%, #4338ca 100%)",
    color: "#ffffff",
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.08)",
    backgroundImage:
      "linear-gradient(to bottom, rgba(255,255,255,0.12), rgba(255,255,255,0))",
    display: "inline-flex",
    alignItems: "center",
    whiteSpace: "nowrap",
  };

  const thStyle: React.CSSProperties = {
    textAlign: "center",
    fontSize: 12,
    fontWeight: 600,
    padding: "10px",
    borderBottom: "1px solid rgba(15,23,42,0.1)",
    color: "#475569",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: 10,
    fontSize: 11,
    color: "#0f172a",
    verticalAlign: "middle",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    textAlign: "center",
  };

  const separatorRowStyle: React.CSSProperties = {
    background: "rgba(99, 102, 241, 0.06)",
  };

  const separatorCellStyle: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 11,
    fontWeight: 700,
    color: "#4338ca",
    borderBottom: "1px solid rgba(15,23,42,0.06)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textAlign: "left",
  };

  const spacerCellStyle: React.CSSProperties = {
    height: 12,
    padding: 0,
    borderBottom: "none",
    background: "rgba(15,23,42,0.02)",
  };

  const centerWrap: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 13,
    lineHeight: "13px",
  };

  return (
    <div>
      <table
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: 14,
          borderCollapse: "separate",
          borderSpacing: 0,
          boxShadow: "0 10px 26px rgba(15,23,42,0.06)",
          overflow: "hidden",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Startdatum</th>
            <th style={thStyle}>Titel</th>
            <th style={thStyle}>Predigtreihe</th>
            <th style={thStyle}>Predigttitel</th>
            <th style={thStyle}>Prediger</th>
          </tr>
        </thead>

        <tbody>
          {rowsWithSeparators.map((row, idx) => {
            if (row.kind === "separator") {
              return (
                <tr key={`sep-${row.monthKey}-${idx}`} style={separatorRowStyle}>
                  <td colSpan={6} style={separatorCellStyle}>
                    {row.label}
                  </td>
                </tr>
              );
            }

            if (row.kind === "datespacer") {
              return (
                <tr key={`ds-${row.key}-${idx}`}>
                  <td colSpan={6} style={spacerCellStyle} />
                </tr>
              );
            }

            const ev = row.ev;

            const evCat = pickCategory(ev);
            const titleStyle = buildCategoryPillStyle(evCat?.color_hex);
            const titleIcon = evCat?.symbol || "";

            const predigtreihe = findPredigtreihe(ev);
            const predigtreiheCat = predigtreihe ? pickCategory(predigtreihe, "Predigtreihe") : null;
            const predigtreiheStyle = buildCategoryPillStyle(predigtreiheCat?.color_hex);
            const predigtreiheIcon = predigtreiheCat?.symbol || "";

            const predigtreiheTitle = predigtreihe ? stripPredigtreihePrefix(predigtreihe.title) : "";

            const gastpredigerChildren = findGastpredigerChildren(ev);

            return (
              <tr key={ev.id}>
                <td style={{ ...tdStyle, width: 70, color: "#64748b" }}>{ev.id}</td>

                <td style={{ ...tdStyle, width: 120 }}>{formatDateDDMMYYYY(ev.start_date || "")}</td>

                <td style={tdStyle}>
                  <div style={centerWrap}>
                    <button type="button" style={titleStyle} onClick={() => openEvent(ev.id)} title={ev.title}>
                      {titleIcon ? <span style={iconStyle}>{titleIcon}</span> : null}
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 280,
                          display: "inline-block",
                        }}
                      >
                        {ev.title}
                      </span>
                    </button>
                  </div>
                </td>

                <td style={{ ...tdStyle, width: 240 }}>
                  <div style={centerWrap}>
                    {predigtreihe ? (
                      <button
                        type="button"
                        style={predigtreiheStyle}
                        onClick={() => openEvent(predigtreihe.id)}
                        title={predigtreihe.title}
                      >
                        {predigtreiheIcon ? <span style={iconStyle}>{predigtreiheIcon}</span> : null}
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 240,
                            display: "inline-block",
                          }}
                        >
                          {predigtreiheTitle}
                        </span>
                      </button>
                    ) : (
                      <button type="button" style={newButtonStyle} onClick={openCreateWizard}>
                        Neu
                      </button>
                    )}
                  </div>
                </td>

                <td style={{ ...tdStyle, width: 240 }}>{ev.sermon_title || ""}</td>

                <td style={{ ...tdStyle, width: 260 }}>
                  {gastpredigerChildren.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {gastpredigerChildren.map((child) => {
                        const ccat = pickCategory(child, "Gastprediger") || pickCategory(child);
                        const childStyle = buildCategoryPillStyle(ccat?.color_hex);
                        const childIcon = ccat?.symbol || "";
                        return (
                          <button
                            key={child.id}
                            type="button"
                            style={childStyle}
                            onClick={() => openEvent(child.id)}
                            title={child.title}
                          >
                            {childIcon ? <span style={iconStyle}>{childIcon}</span> : null}
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: 220,
                                display: "inline-block",
                              }}
                            >
                              {child.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    ev.preacher || ""
                  )}
                </td>
              </tr>
            );
          })}

          {rowsWithSeparators.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 12, color: "#64748b", fontSize: 11, textAlign: "center" }}>
                Keine passenden Events gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Predigtplanung;
