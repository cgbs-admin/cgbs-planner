import React, { useEffect, useMemo, useState } from "react";
import Login from "./components/Login";
import {
  apiFetch,
  getAuthToken,
  loadAuthTokenFromStorage,
  setAuthToken,
} from "./api";
import AddEventForm from "./components/AddEventForm";
import { CategoryManagement } from "./components/Categories";
import { PlanningLevelsPanel } from "./components/PlanningLevels";
import AppLayout from "./components/AppLayout";
import ReportsDashboard from "./components/ReportsDashboard";
import MobileVisitorsPage from "./components/MobileVisitorsPage";

type Category = {
  id: number;
  name: string;
  symbol?: string | null;
  color_hex?: string | null;
};

type PlanningLevel = {
  id: number;
  name: string;
};

type Event = {
  id: number;
  title: string;
  description?: string | null;
  parent_id: number | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  preacher?: string | null;
  sermon_title?: string | null;
  remarks?: string | null;
  internal_notes?: string | null;
  clarification?: string | null;
  link?: string | null;
  categories?: Category[];
  planning_levels?: PlanningLevel[];
};

type ActiveView = "events" | "categories" | "planningLevels" | "reports" | "mobileVisitors";
type FormMode = "create" | "edit" | "duplicate";

const App: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [planningLevels, setPlanningLevels] = useState<PlanningLevel[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ActiveView>("events");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Filters
  const [textFilter, setTextFilter] = useState("");
  const [preacherFilter, setPreacherFilter] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState<number | "">("");
  const [planningLevelFilterId, setPlanningLevelFilterId] = useState<number | "">(
    ""
  );
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Event form / selection
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [formMode,
 setFormMode] = useState<FormMode>("create");
  const [eventBeingEdited, setEventBeingEdited] = useState<Event | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  // Collapsing
  const [collapsedEventIds, setCollapsedEventIds] = useState<number[]>([]);

  // --- Authentication bootstrap ---
  useEffect(() => {
    loadAuthTokenFromStorage();
    const token = getAuthToken();
    setIsAuthenticated(!!token);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // Load data after login
    void reloadAll();
  };

  const handleLogout = () => {
    setAuthToken(null);
    setIsAuthenticated(false);
    setEvents([]);
    setCategories([]);
    setPlanningLevels([]);
  };

  // --- Data loading helpers ---

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/events");
      if (!res.ok) {
        throw new Error(`Failed to load events: ${res.status}`);
      }
      const data: Event[] = await res.json();
      setEvents(data);
    } catch (err: any) {
      console.error("Error loading events", err);
      setError(err?.message ?? "Failed to load events.");
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await apiFetch("/categories");
      if (!res.ok) {
        throw new Error(`Failed to load categories: ${res.status}`);
      }
      const data: Category[] = await res.json();
      setCategories(data);
    } catch (err) {
      console.error("Error loading categories", err);
    }
  };

  const loadPlanningLevels = async () => {
    try {
      const res = await apiFetch("/planning-levels");
      if (!res.ok) {
        throw new Error(`Failed to load planning levels: ${res.status}`);
      }
      const data: PlanningLevel[] = await res.json();
      setPlanningLevels(data);
    } catch (err) {
      console.error("Error loading planning levels", err);
    }
  };

  const reloadAll = async () => {
    await Promise.all([loadEvents(), loadCategories(), loadPlanningLevels()]);
  };

  useEffect(() => {
    if (isAuthenticated) {
      void reloadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const deleteEvent = async (id: number) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this event and its sub-events?"
    );
    if (!confirmDelete) return;

    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`Failed to delete event: ${res.status}`);
      }
      await loadEvents();
    } catch (err: any) {
      console.error("Error deleting event", err);
      setError(err?.message ?? "Failed to delete event.");
    } finally {
      setLoading(false);
    }
  };

  // --- Filtering logic (tree-aware) ---

  const filtersActive =
    textFilter.trim() ||
    preacherFilter.trim() ||
    categoryFilterId !== "" ||
    planningLevelFilterId !== "" ||
    startDateFilter ||
    endDateFilter;

  const matchesFilters = (event: Event): boolean => {
    // Date range: compare on start_date (string ISO)
    if (
      startDateFilter &&
      (!event.start_date || event.start_date < startDateFilter)
    ) {
      return false;
    }

    if (endDateFilter && (!event.start_date || event.start_date > endDateFilter)) {
      return false;
    }

    // Category filter
    if (categoryFilterId !== "") {
      const cid = Number(categoryFilterId);
      const hasCategory =
        event.categories && event.categories.some((c) => c.id === cid);
      if (!hasCategory) {
        return false;
      }
    }

    // Planning level filter
    if (planningLevelFilterId !== "") {
      const pid = Number(planningLevelFilterId);
      const hasPL =
        event.planning_levels &&
        event.planning_levels.some((p) => p.id === pid);
      if (!hasPL) {
        return false;
      }
    }

    // Preacher filter (substring, case-insensitive)
    if (preacherFilter.trim()) {
      const needle = preacherFilter.trim().toLowerCase();
      const preacher = (event.preacher ?? "").toLowerCase();
      if (!preacher.includes(needle)) {
        return false;
      }
    }

    // Text filter: title, sermon_title, remarks, description
    if (textFilter.trim()) {
      const needle = textFilter.trim().toLowerCase();
      const corpus =
        (event.title ?? "") +
        " " +
        (event.sermon_title ?? "") +
        " " +
        (event.remarks ?? "") +
        " " +
        (event.description ?? "");
      if (!corpus.toLowerCase().includes(needle)) {
        return false;
      }
    }

    return true;
  };

  const filteredEvents: Event[] = useMemo(() => {
    if (!filtersActive) {
      return events.slice();
    }

    if (events.length === 0) {
      return [];
    }

    const idToEvent = new Map<number, Event>(events.map((e) => [e.id, e]));
    const childrenByParent = new Map<number, Event[]>();

    events.forEach((e) => {
      if (e.parent_id != null) {
        const list = childrenByParent.get(e.parent_id) ?? [];
        list.push(e);
        childrenByParent.set(e.parent_id, list);
      }
    });

    const matchingIds = new Set<number>();
    events.forEach((ev) => {
      if (matchesFilters(ev)) {
        matchingIds.add(ev.id);
      }
    });

    const visibleIds = new Set<number>();

    const addAncestors = (id: number) => {
      let current = idToEvent.get(id);
      while (current && current.parent_id != null) {
        const pid = current.parent_id;
        if (!visibleIds.has(pid)) {
          visibleIds.add(pid);
        }
        current = idToEvent.get(pid);
      }
    };

    const addDescendants = (id: number) => {
      const stack: number[] = [id];
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const children = childrenByParent.get(currentId) ?? [];
        children.forEach((child) => {
          if (!visibleIds.has(child.id)) {
            visibleIds.add(child.id);
            stack.push(child.id);
          }
        });
      }
    };

    matchingIds.forEach((id) => {
      visibleIds.add(id);
      addAncestors(id);
      addDescendants(id);
    });

    return events.filter((e) => visibleIds.has(e.id));
  }, [
    events,
    filtersActive,
    textFilter,
    preacherFilter,
    categoryFilterId,
    planningLevelFilterId,
    startDateFilter,
    endDateFilter,
  ]);

  // Sorted list for stable rendering
  const sortedFilteredEvents = useMemo(() => {
    const copy = filteredEvents.slice();
    copy.sort((a, b) => {
      const aDate = a.start_date ?? "";
      const bDate = b.start_date ?? "";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;

      const aTime = a.start_time ?? "";
      const bTime = b.start_time ?? "";
      if (aTime !== bTime) return aTime < bTime ? -1 : 1;

      return a.id - b.id;
    });
    return copy;
  }, [filteredEvents]);

  // Parent preselection: editing event takes priority, otherwise Add sub-event
  const initialParentIdForForm =
    eventBeingEdited && eventBeingEdited.parent_id != null
      ? eventBeingEdited.parent_id
      : selectedParentId;

  const toggleCollapse = (eventId: number) => {
    setCollapsedEventIds((prev) =>
      prev.includes(eventId)
        ? prev.filter((id) => id !== eventId)
        : [...prev, eventId]
    );
  };

  const formatDisplayDate = (event: Event): string => {
    const { start_date, end_date } = event;
    if (!start_date && !end_date) {
      return "";
    }

    const formatOne = (value: string | null | undefined): string => {
      if (!value) return "";
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return value;
      return dt.toLocaleDateString(undefined, {
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    };

    const startLabel = formatOne(event.start_date ?? undefined);
    const endLabel = formatOne(event.end_date ?? undefined);

    if (startLabel && endLabel && endLabel !== startLabel) {
      return `${startLabel} → ${endLabel}`;
    }

    return startLabel || endLabel || "";
  };

  const formatTimeRange = (event: Event): string => {
    const { start_time, end_time } = event;
    if (!start_time && !end_time) return "";
    if (start_time && end_time && start_time !== end_time) {
      return `${start_time} → ${end_time}`;
    }
    return start_time || end_time || "";
  };

  const getMonthLabel = (event: Event): string | null => {
    if (!event.start_date) return null;
    const dt = new Date(event.start_date);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  };

  const handleCreateEventFromNav = () => {
    setFormMode("create");
    setEventBeingEdited(null);
    setSelectedParentId(null);
    setIsEventFormOpen(true);
  };

  const openCreateEvent = () => {
    setFormMode("create");
    setEventBeingEdited(null);
    setSelectedParentId(null);
    setIsEventFormOpen(true);
  };

  const openEditEvent = (event: Event) => {
    setFormMode("edit");
    setEventBeingEdited(event);
    setSelectedParentId(event.parent_id);
    setIsEventFormOpen(true);
  };

  const openDuplicateEvent = (event: Event) => {
    setFormMode("duplicate");
    setEventBeingEdited(event);
    setSelectedParentId(event.parent_id);
    setIsEventFormOpen(true);
  };

  const openCreateSubEvent = (parent: Event) => {
    setFormMode("create");
    setEventBeingEdited(null);
    setSelectedParentId(parent.id);
    setIsEventFormOpen(true);
  };

  const handleFormClosed = () => {
    setIsEventFormOpen(false);
    setEventBeingEdited(null);
    setFormMode("create");
    setSelectedParentId(null);
  };

  const renderEventNode = (event: Event, depth: number = 0): JSX.Element => {
    const children = sortedFilteredEvents.filter(
      (e) => e.parent_id === event.id
    );
    const isCollapsed = collapsedEventIds.includes(event.id);
    const isChild = depth > 0;

    const dateLabel = formatDisplayDate(event);
    const timeLabel = formatTimeRange(event);

    const marginLeft = depth * 1.5; // rem

    return (
      <React.Fragment key={event.id}>
        <li className="mb-1.5" style={{ marginLeft: `${marginLeft}rem` }}>
          <div
            className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/40"
            onClick={() => openEditEvent(event)}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                {children.length > 0 && (
                  <button
                    type="button"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-slate-500 hover:bg-slate-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(event.id);
                    }}
                  >
                    {isCollapsed ? "►" : "▾"}
                  </button>
                )}
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  {event.title}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {dateLabel && <span>{dateLabel}</span>}
                {timeLabel && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{timeLabel}</span>
                  </>
                )}
                {event.planning_levels && event.planning_levels.length > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>
                      {event.planning_levels.map((pl) => pl.name).join(", ")}
                    </span>
                  </>
                )}
              </div>

              {event.categories && event.categories.length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {event.categories.map((cat) => (
                    <span
                      key={cat.id}
                      className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-900"
                      style={{
                        backgroundColor: cat.color_hex || "#eef2ff",
                      }}
                    >
                      {cat.symbol && (
                        <span className="text-xs">{cat.symbol}</span>
                      )}
                      <span className="truncate">{cat.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-shrink-0 flex-wrap items-center gap-1">
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditEvent(event);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                onClick={(e) => {
                  e.stopPropagation();
                  openDuplicateEvent(event);
                }}
              >
                Duplicate
              </button>
              <button
                type="button"
                className="rounded-full border border-indigo-600 bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
                onClick={(e) => {
                  e.stopPropagation();
                  openCreateSubEvent(event);
                }}
              >
                Add sub-event
              </button>
              <button
                type="button"
                className="rounded-full border border-red-600 bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-700"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteEvent(event.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </li>

        {!isCollapsed &&
          children.map((child) => renderEventNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  const renderEventsWithMonths = (): JSX.Element[] => {
    const roots = sortedFilteredEvents.filter((e) => e.parent_id == null);

    let lastMonthLabel: string | null = null;
    const items: JSX.Element[] = [];

    roots.forEach((event) => {
      const monthLabel = getMonthLabel(event);
      if (monthLabel && monthLabel !== lastMonthLabel) {
        lastMonthLabel = monthLabel;
        items.push(
          <li key={`month-${monthLabel}`} className="mt-5 mb-2">
            <div className="border-b border-slate-200 pb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {monthLabel}
            </div>
          </li>
        );
      }
      items.push(renderEventNode(event, 0));
    });

    return items;
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppLayout
      activeView={activeView}
      onChangeView={setActiveView}
      onLogout={handleLogout}
      onCreateEvent={handleCreateEventFromNav}  
  >
      {activeView === "events" && (
        <>
          {/* Create button */}
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              className="inline-flex items-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
              onClick={openCreateEvent}
            >
              + Create event
            </button>
          </div>

          {/* Filters */}
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

          {/* Header row */}
  <div className="mb-2 flex items-center justify-between">
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
      <p className="mt-1 text-[11px] text-slate-500">
        Combine filters for text, dates, categories, planning levels
        and preacher. Matching parents reveal children and vice versa.
      </p>
    </div>

    <div className="flex items-center gap-3">
      {/* Clear all button only when expanded */}
      {filtersExpanded && Boolean(filtersActive) && (
        <button
          type="button"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          onClick={() => {
            setTextFilter("");
            setPreacherFilter("");
            setCategoryFilterId("");
            setPlanningLevelFilterId("");
            setStartDateFilter("");
            setEndDateFilter("");
          }}
        >
          Clear all
        </button>
      )}

      {/* Expand/Collapse toggle */}
      <button
        type="button"
        className="text-xs font-medium text-slate-700 hover:text-slate-900"
        onClick={() => setFiltersExpanded((prev) => !prev)}
      >
        {filtersExpanded ? "Hide filters" : "Show filters"}
      </button>
    </div>
  </div>

  {/* Filter fields only visible when expanded */}
  {filtersExpanded && (
    <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

      {/* TEXT SEARCH */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Text search
        </label>
        <input
          type="text"
          value={textFilter}
          onChange={(e) => setTextFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          placeholder="Search in title, sermon, remarks..."
        />
      </div>

      {/* PREACHER */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Preacher
        </label>
        <input
          type="text"
          value={preacherFilter}
          onChange={(e) => setPreacherFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
          placeholder="Filter by preacher"
        />
      </div>

      {/* START DATE FROM */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Start date from
        </label>
        <input
          type="date"
          value={startDateFilter}
          onChange={(e) => setStartDateFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      {/* START DATE TO */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Start date to
        </label>
        <input
          type="date"
          value={endDateFilter}
          onChange={(e) => setEndDateFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        />
      </div>

      {/* CATEGORY */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Category
        </label>
        <select
          value={categoryFilterId}
          onChange={(e) => setCategoryFilterId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* PLANNING LEVEL */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-slate-700">
          Planning level
        </label>
        <select
          value={planningLevelFilterId}
          onChange={(e) => setPlanningLevelFilterId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
        >
          <option value="">All planning levels</option>
          {planningLevels.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

    </div>
  )}
</div>


          {/* Event form modal */}
          {isEventFormOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-3"
              onClick={handleFormClosed}
            >
              <div
                className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6"
                onClick={(e) => e.stopPropagation()}
              >
<AddEventForm
  mode={formMode}
  eventToEdit={eventBeingEdited}
  onCancelEdit={handleFormClosed}
  onCreated={async () => {
    await loadEvents();
    handleFormClosed();
  }}
  parentOptions={events}
  categoryOptions={categories}
  planningLevelOptions={planningLevels}
  initialParentId={initialParentIdForForm}
  allEvents={events}
  onOpenEditFromRelated={(eventId) => {
    const target = events.find((e) => e.id === eventId);
    if (target) {
      setFormMode("edit");
      setEventBeingEdited(target);
      setSelectedParentId(target.parent_id);
    }
  }}
/>

              </div>
            </div>
          )}

          {/* Status messages */}
          {loading && (
            <p className="text-xs text-slate-500">Loading events…</p>
          )}
          {error && <p className="text-xs text-red-600">Error: {error}</p>}

          {!loading && !error && sortedFilteredEvents.length === 0 && (
            <p className="text-xs text-slate-500">
              {filtersActive
                ? "No events match the current filters."
                : "No events yet. Create some using the button above."}
            </p>
          )}

          {!loading && !error && sortedFilteredEvents.length > 0 && (
            <ul className="mt-2 list-none space-y-0">
              {renderEventsWithMonths()}
            </ul>
          )}
        </>
      )}

      {activeView === "categories" && <CategoryManagement />}

      {activeView === "planningLevels" && <PlanningLevelsPanel />}

      {activeView === "reports" && <ReportsDashboard />}
    </AppLayout>
  );
};

export default App;
