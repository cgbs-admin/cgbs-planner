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
import Predigtplanung from "./components/Predigtplanung";
import UsersPage from "./components/UsersPage";

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
  in_klaerung?: boolean | null;
  link?: string | null;
  attachments?: string | null;
  mail?: string | null;
  pco_id?: string | number | null;
  categories?: Category[];
  planning_levels?: PlanningLevel[];
};

type EventForEdit = Omit<Event, "in_klaerung"> & { in_klaerung: boolean };

// UI-only augmentation for rendering special “occurrence” rows (e.g., multi-day start/end).
type UiEvent = Event & {
  __ui_key?: string;
  __day_key?: string;
  __occurrence?: "start" | "end";
  __title_override?: string;
  __base?: Event;
};

type ActiveView = "events" | "categories" | "planningLevels" | "reports" | "mobileVisitors" | "predigtplanung" | "users";
type FormMode = "create" | "edit" | "duplicate";

const App: React.FC = () => {

  // UI sizing: keep category pills and multi-day bars visually consistent.
  const CATEGORY_PILL_HEIGHT_PX = 22;
  const [events, setEvents] = useState<Event[]>([]);

  // Never show placeholder event (id 99) anywhere in the UI.
  const eventsForUi = useMemo(() => events.filter((e) => e.id !== 99), [events]);
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
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [eventBeingEdited, setEventBeingEdited] = useState<Event | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<number | null>(null);

  // Collapsing
  const [collapsedEventIds, setCollapsedEventIds] = useState<number[]>([]);
  const [collapseInitialized, setCollapseInitialized] = useState(false);

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

  // --- Color helpers (for category badges) ---
  const getReadableTextColor = (hex: string | null | undefined): string => {
    const h = (hex ?? "").trim();
    const m = /^#?([0-9a-fA-F]{6})$/.exec(h);
    if (!m) return "#111827"; // slate-900
    const v = m[1];
    const r = parseInt(v.slice(0, 2), 16) / 255;
    const g = parseInt(v.slice(2, 4), 16) / 255;
    const b = parseInt(v.slice(4, 6), 16) / 255;
    // Relative luminance (sRGB)
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.55 ? "#111827" : "#ffffff";
  };

  const getCategoryColorForEvent = (ev: Event): string => {
    // Primary color for the multi-day bar: prefer the first category's configured color_hex.
    const first = (ev.categories ?? [])[0] ?? null;
    const byId =
      first?.id != null ? categories.find((c) => c.id === first.id) ?? null : null;
    const byName =
      first?.name
        ? categories.find(
            (c) =>
              (c.name ?? "").trim().toLowerCase() ===
              (first.name ?? "").trim().toLowerCase()
          ) ?? null
        : null;

    return (
      (byId?.color_hex ?? byName?.color_hex ?? first?.color_hex ?? "").trim() ||
      "#cbd5e1" // slate-300 fallback
    );
  };


  // --- Category helpers ---
  const normalizeCatName = (s: string): string =>
    (s ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const hasCategoryByName = (ev: Event, wanted: string): boolean => {
    const w = normalizeCatName(wanted);
    if (!w) return false;
    return (ev.categories ?? []).some((c) => normalizeCatName(c.name ?? "") === w);
  };

  const resolveCategoryByName = (ev: Event, wanted: string): Category | null => {
    const w = normalizeCatName(wanted);
    if (!w) return null;
    return (
      categories.find((c) => normalizeCatName(c.name ?? "") === w) ??
      (ev.categories ?? []).find((c) => normalizeCatName(c.name ?? "") === w) ??
      null
    );
  };

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
    const source = eventsForUi;

    if (!filtersActive) {
      return source.slice();
    }

    if (source.length === 0) {
      return [];
    }

    const idToEvent = new Map<number, Event>(source.map((e) => [e.id, e]));
    const childrenByParent = new Map<number, Event[]>();

    source.forEach((e) => {
      if (e.parent_id != null) {
        const list = childrenByParent.get(e.parent_id) ?? [];
        list.push(e);
        childrenByParent.set(e.parent_id, list);
      }
    });

    const matchingIds = new Set<number>();
    source.forEach((ev) => {
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

    return source.filter((e) => visibleIds.has(e.id));
  }, [
    eventsForUi,
    filtersActive,
    textFilter,
    preacherFilter,
    categoryFilterId,
    planningLevelFilterId,
    startDateFilter,
    endDateFilter,
  ]);

  // Expand multi-day root events into two UI rows (start + end) and then sort for stable rendering.
  // This allows multi-day events to appear on both days when there are parallel events.
  const sortedFilteredEvents = useMemo<UiEvent[]>(() => {
    const isGottesdienstEvent = (ev: Event): boolean =>
      ev.categories?.some((c) => c.name === "Gottesdienst") ?? false;

    const expanded: UiEvent[] = [];
    for (const ev of filteredEvents) {
      const start = (ev.start_date ?? "").trim();
      const end = (ev.end_date ?? "").trim();

      // Only duplicate ROOT events (no parent) that truly span multiple days.
      if (ev.parent_id == null && start && end && start !== end) {
        expanded.push({
          ...ev,
          __ui_key: `${ev.id}-start`,
          __day_key: start,
          __occurrence: "start",
          __title_override: `Beginn ${ev.title}`,
          __base: ev,
        });
        expanded.push({
          ...ev,
          __ui_key: `${ev.id}-end`,
          __day_key: end,
          __occurrence: "end",
          __title_override: `${ev.title} Ende`,
          __base: ev,
        });
        continue;
      }

      expanded.push({
        ...ev,
        __ui_key: `${ev.id}`,
        __day_key: (ev.start_date ?? ev.end_date ?? "").trim(),
        __base: ev,
      });
    }

    const getDateKey = (ev: UiEvent): string =>
      (ev.__day_key ?? (ev.start_date ?? ev.end_date ?? "")).trim();

    const getTitleForSort = (ev: UiEvent): string =>
      ((ev.__title_override ?? ev.title) ?? "").trim();

    expanded.sort((a, b) => {
      // IMPORTANT: day grouping in the UI is based on start_date OR (if missing) end_date.
      // For UI occurrences we use the explicit __day_key to stay consistent with grouping.
      const aDate = getDateKey(a);
      const bDate = getDateKey(b);
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;

      // Additional rule: within the same day, Gottesdienst events should always be at the bottom.
      const aIsGottesdienst = isGottesdienstEvent(a);
      const bIsGottesdienst = isGottesdienstEvent(b);
      if (aIsGottesdienst !== bIsGottesdienst) return aIsGottesdienst ? 1 : -1;

      // Within the same day: events without a start time should always come first.
      const aTime = (a.start_time ?? "").trim();
      const bTime = (b.start_time ?? "").trim();
      const aHasTime = aTime.length > 0;
      const bHasTime = bTime.length > 0;
      if (aHasTime !== bHasTime) return aHasTime ? 1 : -1;
      if (aHasTime && bHasTime && aTime !== bTime) return aTime < bTime ? -1 : 1;

      // After time ordering, sort alphabetically by title (case-insensitive), then stable tie-breakers.
      const aTitle = getTitleForSort(a);
      const bTitle = getTitleForSort(b);
      const titleCmp = aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
      if (titleCmp !== 0) return titleCmp;

      // Keep the base ID stable, then prefer "start" before "end" for the same event.
      const idCmp = a.id - b.id;
      if (idCmp !== 0) return idCmp;
      const aOcc = a.__occurrence ?? "";
      const bOcc = b.__occurrence ?? "";
      if (aOcc !== bOcc) return aOcc === "start" ? -1 : 1;
      return 0;
    });

    return expanded;
  }, [filteredEvents]);

  // Multi-day ROOT events (used for rendering the parallel-day bars).
  // We intentionally use the unexpanded filteredEvents so we do not duplicate by UI occurrences.
  const multiDayRootEvents = useMemo<Event[]>(() => {
    const roots = filteredEvents.filter((e) => e.parent_id == null);
    const spans = roots.filter((e) => {
      const s = (e.start_date ?? "").trim();
      const ed = (e.end_date ?? "").trim();
      return s && ed && s !== ed;
    });

    spans.sort((a, b) => {
      const aS = (a.start_date ?? "").trim();
      const bS = (b.start_date ?? "").trim();
      if (aS !== bS) return aS < bS ? -1 : 1;
      return a.id - b.id;
    });

    return spans;
  }, [filteredEvents]);


  // Parent -> children map built from the full dataset (not only the visible rows).
  // This prevents link inconsistencies when filters/collapse hide child rows.
  const childrenByParentId = useMemo(() => {
    const map = new Map<number, Event[]>();
    for (const ev of events) {
      if (ev.parent_id == null) continue;
      const arr = map.get(ev.parent_id) ?? [];
      arr.push(ev);
      map.set(ev.parent_id, arr);
    }
    return map;
  }, [events]);

  // Warning propagation: an event is considered "in Klärung" if it is marked itself
  // OR any of its descendants is marked. This enables consistent visual indicators
  // through all hierarchy levels (grandparent -> parent -> child).
  const warningByEventId = useMemo(() => {
    const byId = new Map<number, Event>();
    for (const ev of events) byId.set(ev.id, ev);

    const memo = new Map<number, boolean>();
    const dfs = (id: number, visiting: Set<number>): boolean => {
      const cached = memo.get(id);
      if (cached !== undefined) return cached;
      if (visiting.has(id)) return false; // defensive: avoid cycles
      visiting.add(id);

      const ev = byId.get(id);
      let warn = ev?.in_klaerung === true;

      const kids = childrenByParentId.get(id) ?? [];
      for (const k of kids) {
        if (dfs(k.id, visiting)) {
          warn = true;
          break;
        }
      }

      visiting.delete(id);
      memo.set(id, warn);
      return warn;
    };

    // Materialize to a stable map for simple lookups in render.
    const result = new Map<number, boolean>();
    for (const ev of events) {
      result.set(ev.id, dfs(ev.id, new Set<number>()));
    }
    return result;
  }, [events, childrenByParentId]);

  const getDirectChildrenInUiOrder = (parentId: number): Event[] => {
    const isGottesdienstEvent = (ev: Event): boolean =>
      ev.categories?.some((c) => c.name === "Gottesdienst") ?? false;

    const kids = (childrenByParentId.get(parentId) ?? []).slice();
    kids.sort((a, b) => {
      const aDate = a.start_date ?? a.end_date ?? "";
      const bDate = b.start_date ?? b.end_date ?? "";
      if (aDate !== bDate) return aDate < bDate ? -1 : 1;

      // Same rule as the main list: Gottesdienst always at the bottom within the same day.
      const aIsGottesdienst = isGottesdienstEvent(a);
      const bIsGottesdienst = isGottesdienstEvent(b);
      if (aIsGottesdienst !== bIsGottesdienst) return aIsGottesdienst ? 1 : -1;

      // Same rule as the main list: untimed items first within the day.
      const aTime = (a.start_time ?? "").trim();
      const bTime = (b.start_time ?? "").trim();
      const aHasTime = aTime.length > 0;
      const bHasTime = bTime.length > 0;
      if (aHasTime !== bHasTime) return aHasTime ? 1 : -1;
      if (aHasTime && bHasTime && aTime !== bTime) return aTime < bTime ? -1 : 1;

      // Button ordering rule: after time ordering, sort alphabetically by title.
      // Keep a stable tie-breaker by id.
      const aTitle = (a.title ?? "").trim();
      const bTitle = (b.title ?? "").trim();
      const titleCmp = aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
      if (titleCmp !== 0) return titleCmp;

      return a.id - b.id;
    });
    return kids;
  };

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

  // Default: collapse all parent events (events that have children),
  // except Gottesdienst events without start time (these should be expanded).
  useEffect(() => {
    if (collapseInitialized) return;
    if (eventsForUi.length === 0) return;

    const parentsWithChildren = new Set<number>();
    eventsForUi.forEach((ev) => {
      if (ev.parent_id != null) {
        parentsWithChildren.add(ev.parent_id);
      }
    });

    const defaultCollapsed: number[] = [];
    parentsWithChildren.forEach((parentId) => {
      const parent = eventsForUi.find((e) => e.id === parentId);
      if (!parent) return;

      const isGottesdienst =
        parent.categories?.some((c) => c.name === "Gottesdienst") ?? false;

      const shouldBeExpanded = isGottesdienst && !parent.start_time;
      if (!shouldBeExpanded) {
        defaultCollapsed.push(parentId);
      }
    });

    setCollapsedEventIds(defaultCollapsed);
    setCollapseInitialized(true);
  }, [eventsForUi, collapseInitialized]);


  const formatDisplayDate = (event: Event): string => {
    const ui = event as UiEvent;
    const { start_date, end_date } = event;
    const dayKey = (ui.__day_key ?? "").trim();
    const occurrence = ui.__occurrence;
    if (!start_date && !end_date && !dayKey) {
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

    // For UI occurrences (multi-day start/end rows):
    // - "start" should show the full range (start → end), so the user can immediately see the span.
    // - "end" keeps showing the single end day.
    if (occurrence && dayKey) {
      if (occurrence === "start") {
        const startLabel = formatOne(start_date ?? dayKey);
        const endLabel = formatOne(end_date ?? undefined);
        if (startLabel && endLabel && startLabel !== endLabel) {
          return `${startLabel} → ${endLabel}`;
        }
        return startLabel || formatOne(dayKey);
      }
      return formatOne(dayKey);
    }

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


  const getFirstHttpsUrl = (value: string | null | undefined): string | null => {
    const raw = (value ?? "").trim();
    if (!raw) return null;
    const m = raw.match(/https:\/\/[^\s)\]]+/i);
    return m ? m[0] : null;
  };

  const getMonthLabel = (event: Event): string | null => {
    const ui = event as UiEvent;
    const raw = (ui.__day_key ?? event.start_date ?? event.end_date ?? "").trim();
    if (!raw) return null;
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  };

  const getDayLabel = (
    event: Event
  ): { key: string | null; label: string | null } => {
    const ui = event as UiEvent;
    const raw = (ui.__day_key ?? event.start_date ?? event.end_date ?? null) as any;
    if (!raw) return { key: null, label: null };
    const dt = new Date(raw);
    if (Number.isNaN(dt.getTime())) return { key: raw, label: raw };
    const key = raw;
    const label = dt.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return { key, label };
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
    const base = ((event as UiEvent).__base ?? event) as Event;
    setFormMode("edit");
    setEventBeingEdited(base);
    setSelectedParentId(base.parent_id);
    setIsEventFormOpen(true);
  };

  const openDuplicateEvent = (event: Event) => {
    const base = ((event as UiEvent).__base ?? event) as Event;
    setFormMode("duplicate");
    setEventBeingEdited(base);
    setSelectedParentId(base.parent_id);
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


const getLinkedEventForCategory = (
  cat: Category,
  contextEvent?: Event
): Event | null => {
  const raw = (cat?.name ?? "").trim();
  if (!raw) return null;

  const normalize = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip diacritics
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const name = normalize(raw);

  const compact = (s: string) => s.replace(/[^a-z0-9]/g, "");
  const nameCompact = compact(name);

  const isBasePredigtLink =
    name === "predigtreihe" ||
    name === "gastprediger" ||
    nameCompact === "predigtreihe" ||
    nameCompact === "gastprediger";

  // --- Parent -> Child resolution (highest priority) ---
  // If this row is a parent event and any of its children carries the clicked category,
  // we must open that child (not the parent, and not any title-based match).
  //
  // This is essential for labels like "Predigtreihe" / "Gastprediger" where the parent row
  // may have the category as well, but the user expects to jump to the actual child entry.
  if (contextEvent && contextEvent.parent_id == null) {
    const children = eventsForUi.filter((e) => e.parent_id === contextEvent.id);
    if (children.length > 0) {
      const childHasCategory = (child: Event) =>
        (child.categories ?? []).some((c) => {
          if (c.id === cat.id) return true;
          // Fallback for cases where ids differ but the category label matches.
          const childCatName = normalize(c.name ?? "");
          const childCatCompact = compact(childCatName);
          return (
            !!childCatName &&
            (childCatName === name ||
              (!!childCatCompact && childCatCompact === nameCompact) ||
              // For base linkage labels like "Gastprediger" / "Predigtreihe", the actual
              // child category may carry additional details (e.g. "Gastprediger: Max ...").
              // In that case, accept a prefix match.
              (isBasePredigtLink && childCatName.startsWith(name)) ||
              (isBasePredigtLink && !!childCatCompact && childCatCompact.startsWith(nameCompact)))
          );
        });

      const matchingChildren = children.filter(childHasCategory);
      if (matchingChildren.length === 1) {
        return matchingChildren[0];
      }

      // If multiple children match, we cannot know which one the user intends.
      // In this case, do NOT fall back to opening the parent.
      if (matchingChildren.length > 1) {
        return null;
      }
    }
  }

  // 0) Special handling for generic linkage categories where a parent may share the same label.
  //    For "Predigtreihe" / "Gastprediger", we must prefer opening the *child event* that carries
  //    the clicked category over opening any event whose title happens to match the category.
  //
  //    Root cause: in some datasets, the parent event title equals the category label, and/or
  //    children may use a different category id despite having the same name. Therefore:
  //    - detect these categories by substring match (not only exact)
  //    - match children by category id OR normalized category name
  //    - do not fall back to title-based matches for these categories
  if (contextEvent) {
    const isGenericLinkCategory =
      name.includes("predigtreihe") ||
      name.includes("gastprediger") ||
      nameCompact.includes("predigtreihe") ||
      nameCompact.includes("gastprediger");

    if (isGenericLinkCategory) {
      const catId = cat?.id;
      const catNameNorm = name;
      const catNameCompact = nameCompact;

      const childHasSameCategory = (child: Event) =>
        (child.categories ?? []).some((c) => {
          if (c.id === catId) return true;
          const childCatName = normalize(c.name ?? "");
          const childCatCompact = compact(childCatName);
          return (
            !!childCatName &&
            (childCatName === catNameNorm ||
              (!!childCatCompact && childCatCompact === catNameCompact) ||
              (isBasePredigtLink && childCatName.startsWith(catNameNorm)) ||
              (isBasePredigtLink &&
                !!childCatCompact &&
                childCatCompact.startsWith(catNameCompact)))
          );
        });

      // If this row is already a child event, open the child itself.
      if (contextEvent.parent_id != null) {
        return contextEvent;
      }

      // If this row is a parent, open the child that has the same category assigned as the clicked pill.
      // Use the same order as the UI list so the behavior is stable.
      const childrenInUiOrder = sortedFilteredEvents.filter(
        (e) => e.parent_id === contextEvent.id
      );

      const matchingChildren = childrenInUiOrder.filter(childHasSameCategory);

      // Important: for these generic categories, do NOT fall back to title-based matches,
      // otherwise we would reopen the parent event again.
      return matchingChildren[0] ?? null;
    }
  }

  // 1) Exact title match (case/diacritics-insensitive).
  const exact = eventsForUi.find((e) => normalize(e.title ?? "") === name);
  if (exact) return exact;

  // 2) If the category contains an event id (e.g. "#123", "Event 123"), open that event.
  //    Prefer ids that are explicitly marked with # or "event".
  const explicitIdMatch = raw.match(/(?:#|\bevent\b)\s*(\d{1,9})\b/i);
  const genericIdMatch = raw.match(/\b(\d{1,9})\b/);
  const idMatch = explicitIdMatch ?? genericIdMatch;
  if (idMatch) {
    const id = Number(idMatch[1]);
    if (Number.isFinite(id)) {
      const byId = eventsForUi.find((e) => e.id === id);
      if (byId) return byId;
    }
  }

  // 3) Flexible match: if the category is a prefix/suffix/substring of an event title (or vice versa).
  //    Only return a match if it is unambiguous (exactly one event).
  const fuzzyMatches = eventsForUi.filter((e) => {
    const t = normalize(e.title ?? "");
    if (!t) return false;
    return t.includes(name) || name.includes(t);
  });

  if (fuzzyMatches.length === 1) return fuzzyMatches[0];

  // 5) If the current event has children, and the category matches exactly one child, open that child.
  if (contextEvent) {
    const children = eventsForUi.filter((e) => e.parent_id === contextEvent.id);
    const childMatches = children.filter((c) => {
      const t = normalize(c.title ?? "");
      if (!t) return false;
      return t.includes(name) || name.includes(t);
    });
    if (childMatches.length === 1) return childMatches[0];
  }

  return null;
};

  const renderEventNode = (
    event: Event,
    depth: number = 0,
    dayContext?: { dayKey: string | null; multiDaySpans: Event[] }
  ): React.ReactElement => {
    const ui = event as UiEvent;
    const base = (ui.__base ?? event) as Event;
    const occurrence = ui.__occurrence;
    // Do not duplicate full subtrees on the "end" occurrence row.
    const suppressChildren = occurrence === "end";

    const children = suppressChildren ? [] : childrenByParentId.get(base.id) ?? [];
    const isCollapsed = collapsedEventIds.includes(base.id);
    const isChild = depth > 0;

    // UX decision: category pills on *any* event row that is a parent (has direct children)
    // have been inconsistent due to filtering/ambiguity. Therefore, for parent rows we
    // do not render the parent's own category pills and instead render explicit child-link pills.
    // This makes the click target directly connected to the child item.
    const directChildrenForLinks = suppressChildren ? [] : getDirectChildrenInUiOrder(base.id);
    const showChildLinksInsteadOfParentCategories = directChildrenForLinks.length > 0;

    const isInKlaerung = base.in_klaerung === true;

    const hasChildInKlaerung =
      showChildLinksInsteadOfParentCategories &&
      directChildrenForLinks.some((c) => c.in_klaerung === true);

    // Grandparent indicator: if any direct child has a direct child that is marked as "in Klärung",
    // show the same warning symbol on this grandparent row.
    const hasGrandChildInKlaerung = directChildrenForLinks.some((child) => {
      const grandChildren = getDirectChildrenInUiOrder(child.id);
      return grandChildren.some((gc) => gc.in_klaerung === true);
    });

    const titleHasWarning = isInKlaerung || hasChildInKlaerung || hasGrandChildInKlaerung;

    // Root items (non-child events) should have extra spacing above.
    // Use padding-top (8px) as requested.
    const rootSpacingClass = isChild ? "" : " pt-2";

    const dateLabel = formatDisplayDate(event);
    const timeLabel = formatTimeRange(base);

    // --- Special category handling: "Entfällt" ---
    const isEntfaellt = hasCategoryByName(base, "Entfällt");
    const entfaelltCategory: Category | null = isEntfaellt
      ? resolveCategoryByName(base, "Entfällt")
      : null;

    // Prefix title for "Entfällt" events.
    const rawTitleToDisplay = (ui.__title_override ?? base.title) ?? "";
    const titleToDisplay = isEntfaellt
      ? rawTitleToDisplay.trim().toLowerCase().startsWith("entfällt:")
        ? rawTitleToDisplay
        : `Entfällt: ${rawTitleToDisplay}`
      : rawTitleToDisplay;

    // The "Gottesdienst" badge before the title must ONLY appear for events that
    // actually have the category assigned.
    const isGottesdienst =
      (base.categories ?? []).some((c) => (c.name ?? "").toLowerCase() === "gottesdienst") ??
      false;

    // Badge style should come from the categories table (symbol + color_hex).
    // Fallback safely to the event's category object (if present) and lastly to defaults.
    const gottesdienstCategory: Category | null = isGottesdienst
      ? categories.find((c) => (c.name ?? "").toLowerCase() === "gottesdienst") ??
        (base.categories ?? []).find((c) => (c.name ?? "").toLowerCase() === "gottesdienst") ??
        null
      : null;

    const marginLeft = depth * 1.5; // rem

    return (
      <React.Fragment key={ui.__ui_key ?? `${base.id}`}>
        <li className={`mb-3${rootSpacingClass}`} style={{ marginLeft: `${marginLeft}rem` }}>
          <div className="flex items-stretch gap-2">
            <div
              className="relative flex flex-1 min-w-0 cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:border-indigo-200 hover:bg-indigo-50/40"
              onClick={() => openEditEvent(base)}
            >
            {(() => {
              const isPredigtreihe =
                (base.categories ?? []).some(
                  (c) => (c.name ?? "").trim().toLowerCase() === "predigtreihe"
                ) ?? false;
              const predigtHref = isPredigtreihe ? getFirstHttpsUrl(base.attachments) : null;

              const isGastprediger =
                (base.categories ?? []).some(
                  (c) => (c.name ?? "").trim().toLowerCase() === "gastprediger"
                ) ?? false;
              const gastpredigerMail = isGastprediger ? (base.mail ?? "").trim() : "";
              const gastpredigerMailto = gastpredigerMail ? `mailto:${gastpredigerMail}` : null;

const isKollekte =
                (base.categories ?? []).some(
                  (c) => (c.name ?? "").trim().toLowerCase() === "kollekte"
                ) ?? false;
              const kollekteHref = isKollekte ? getFirstHttpsUrl(base.attachments) : null;


              // PCO icon should be shown for ALL "Gottesdienst" events with a pco_id,
              // regardless of whether they have a start time.
              const isGottesdienstAny =
                (base.categories ?? []).some(
                  (c) => (c.name ?? "").trim().toLowerCase() === "gottesdienst"
                ) ?? false;

              // The folder icon next to it is still only for "Gottesdienst" events without start time.
              const isGottesdienstNoTime = isGottesdienstAny && !((base.start_time ?? "").trim());

              const rawId = base.pco_id;
              const id = rawId == null ? "" : String(rawId).trim();
              const pcoHref =
                isGottesdienstAny && id
                  ? `https://services.planningcenteronline.com/plans/${encodeURIComponent(id)}`
                  : null;

              const gottesdienstAttachmentHref =
                isGottesdienstNoTime ? getFirstHttpsUrl(base.attachments) : null;

              // Render a single top-right icon rail so icons never overlap.
              if (!predigtHref && !gastpredigerMailto && !kollekteHref && !pcoHref && !gottesdienstAttachmentHref)
                return null;

              return (
                <div className="absolute right-2 top-2 inline-flex items-center gap-2">
                  {predigtHref && (
                    <a
                      data-predigt-attachment="true"
                      href={predigtHref}
                      target="_blank"
                      rel="noreferrer"
                      title="Dokument öffnen"
                      aria-label="Dokument öffnen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M14 2H7C5.89543 2 5 2.89543 5 4V20C5 21.1046 5.89543 22 7 22H17C18.1046 22 19 21.1046 19 20V7L14 2Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14 2V7H19"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 13H15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 17H15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </a>
                  )}

                  {gastpredigerMailto && (
                    <a
                      data-gastprediger-mailto="true"
                      href={gastpredigerMailto}
                      title="E-Mail schreiben"
                      aria-label="E-Mail schreiben"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M3 7L12 13L21 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  )}

                  {kollekteHref && (
                    <a
                      data-kollekte-attachment="true"
                      href={kollekteHref}
                      target="_blank"
                      rel="noreferrer"
                      title="Bild öffnen"
                      aria-label="Bild öffnen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="14"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <path
                          d="M7 15L10 12L13 15L16 11L20 15"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        <circle cx="9" cy="9" r="1.5" fill="currentColor" />
                      </svg>
                    </a>
                  )}

{pcoHref && (
                    <a
                      data-pco-plan="true"
                      href={pcoHref}
                      target="_blank"
                      rel="noreferrer"
                      title="Planning Center Plan öffnen"
                      aria-label="Planning Center Plan öffnen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: "#6aae3b", color: "#ffffff" }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <circle cx="6" cy="7" r="1.5" fill="currentColor" />
                        <rect x="10" y="5.5" width="10" height="3" rx="1.2" fill="currentColor" />
                        <circle cx="6" cy="12" r="1.5" fill="currentColor" />
                        <rect x="10" y="10.5" width="10" height="3" rx="1.2" fill="currentColor" />
                        <circle cx="6" cy="17" r="1.5" fill="currentColor" />
                        <rect x="10" y="15.5" width="10" height="3" rx="1.2" fill="currentColor" />
                      </svg>
                    </a>
                  )}

                  {gottesdienstAttachmentHref && (
                    <a
                      data-godi-attachment="true"
                      href={gottesdienstAttachmentHref}
                      target="_blank"
                      rel="noreferrer"
                      title="Ordner öffnen"
                      aria-label="Ordner öffnen"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M3 7C3 5.89543 3.89543 5 5 5H9L11 7H19C20.1046 7 21 7.89543 21 9V18C21 19.1046 20.1046 20 19 20H5C3.89543 20 3 19.1046 3 18V7Z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 9H21"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              );
            })()}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                {!suppressChildren && children.length > 0 && (
                  <button
                    type="button"
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCollapse(base.id);
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 20 20"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      style={{
                        transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                        transformOrigin: "50% 50%",
                      }}
                    >
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                )}
                {isEntfaellt && (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: entfaelltCategory?.color_hex || "#fee2e2",
                      color: getReadableTextColor(entfaelltCategory?.color_hex || "#fee2e2"),
                    }}
                    title={entfaelltCategory?.name || "Entfällt"}
                    aria-label={entfaelltCategory?.name || "Entfällt"}
                  >
                    {((entfaelltCategory?.symbol ?? "") as string).trim() || "🚫"}
                  </span>
                )}
                {isGottesdienst && (
                  <span
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: gottesdienstCategory?.color_hex || "#F6E7B0",
                      color: getReadableTextColor(gottesdienstCategory?.color_hex || "#F6E7B0"),
                      // Subtle 3D effect: soft shadow + gentle highlight (keeps the original color visible).
                      boxShadow:
                        "0 1px 2px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)",
                      backgroundImage:
                        "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0))",
                    }}
                    title={gottesdienstCategory?.name || "Gottesdienst"}
                    aria-label={gottesdienstCategory?.name || "Gottesdienst"}
                  >
                    {((gottesdienstCategory?.symbol ?? "") as string).trim() || "⛪"}
                  </span>
                )}
                <h2
                  className={`truncate text-sm font-semibold ${
                    titleHasWarning ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  <>
                    <span className="mr-2 text-[11px] font-normal text-slate-500">#{base.id}</span>
                    <span className="truncate">{titleToDisplay}</span>
                  </>
                </h2>
                {(isInKlaerung || hasChildInKlaerung || hasGrandChildInKlaerung) && (
                  <span
                    className="text-sm text-red-600"
                    title={
                      isInKlaerung
                        ? "Dieses Event ist als \"in Klärung\" markiert."
                        : hasChildInKlaerung
                          ? "Mindestens ein Unterevent ist als \"in Klärung\" markiert."
                          : "Mindestens ein Unter-Unterevent ist als \"in Klärung\" markiert."
                    }
                    aria-label="In Klärung"
                  >
                    ⚠️
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                {dateLabel && <span>{dateLabel}</span>}
                {timeLabel && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span>{timeLabel}</span>
                  </>
                )}
</div>

              {showChildLinksInsteadOfParentCategories ? (
                (() => {
                  // If a child (or grandchild) event is cancelled (category "Entfällt"),
                  // do NOT display any related button/icon on parent or grandparent rows.
                  // (The cancelled icon/title treatment is only shown on the cancelled event itself.)
                  const visibleChildrenForLinks = directChildrenForLinks.filter(
                    (c) => !hasCategoryByName(c, "Entfällt")
                  );

                  // Only stack the parent buttons vertically on the *grandparent* level.
                  // A "grandparent" is treated as a root event (depth === 0) that has at least
                  // one direct child which itself has direct children.
                  const isGrandparentLevel =
                    depth === 0 &&
                    visibleChildrenForLinks.some(
                      (c) => getDirectChildrenInUiOrder(c.id).length > 0
                    );

                  const containerClass = isGrandparentLevel
                    ? "mt-0.5 flex flex-col gap-1"
                    : "mt-0.5 flex flex-wrap items-start gap-1";

                  const rowClass = isGrandparentLevel
                    ? "flex items-start gap-2"
                    : "inline-flex items-start gap-2";


                  const godiChildChipWidthCh: string | null = (() => {
                    // Apply equal-width pills only to Gottesdienst children ("Godi …") within this parent row.
                    const wanted = normalizeCatName("gottesdienst");
                    let maxLen = 0;
                    for (const c of visibleChildrenForLinks) {
                      const cTitle = (c.title ?? "").trim();
                      const cCategory = (c.categories ?? [])[0] ?? null;
                      const isGodiChild =
                        cTitle.startsWith("Godi") ||
                        normalizeCatName(cCategory?.name ?? "") === wanted;
                      if (!isGodiChild) continue;
                      maxLen = Math.max(maxLen, cTitle.length);
                    }
                    if (maxLen <= 0) return null;
                    // Width is driven by the longest sibling title (+ small buffer for padding).
                    return `${maxLen + 2}ch`;
                  })();
                  return (
                    <div className={containerClass}>
                      {visibleChildrenForLinks.map((child) => (
                    (() => {
                      const childHasWarning = warningByEventId.get(child.id) === true;

                      // Cancelled child events are intentionally not represented on parent rows.
                      // (They are already filtered out via visibleChildrenForLinks.)
                      const childCategory = (child.categories ?? [])[0] ?? null;
                      const isGodiChild =
                        (child.title ?? "").trim().startsWith("Godi") ||
                        normalizeCatName(childCategory?.name ?? "") === normalizeCatName("gottesdienst");
                      // Show the child's title only for "Godi…" events; otherwise show the child's assigned category.
                      const showChildTitle = (child.title ?? "").startsWith("Godi");

                      const childStyle: React.CSSProperties = {
                        backgroundColor: childCategory?.color_hex || "#eef2ff",
                      };

                      const rawChildTitle = child.title ?? "";

                      const childLabel = showChildTitle ? (
                        <>
                          <span className={isGodiChild ? "whitespace-nowrap" : "max-w-[160px] truncate"}>{rawChildTitle}</span>
                        </>
                      ) : childCategory ? (
                        <>
                          {childCategory.symbol && (
                            <span className="text-xs">{childCategory.symbol}</span>
                          )}
                          <span className={isGodiChild ? "whitespace-nowrap" : "max-w-[160px] truncate"}>{childCategory.name}</span>
                        </>
                      ) : (
                        <>
                          <span className={isGodiChild ? "whitespace-nowrap" : "max-w-[160px] truncate"}>{rawChildTitle}</span>
                        </>
                      );

                      // Show grandchild events (direct children of this child) as compact, icon-only chips
                      // next to the child chip, so the user understands the association.
                      const grandChildren = getDirectChildrenInUiOrder(child.id).filter(
                        (gc) => !hasCategoryByName(gc, "Entfällt")
                      );

                      return (
                        <div
                          key={`childlink-row-${base.id}-${child.id}`}
                          className={rowClass}
                        >
                          <button
                            type="button"
                            className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200 hover:shadow-sm ${
                              childHasWarning
                                ? "border-red-500 ring-1 ring-red-200 text-red-600"
                                : "border-transparent text-slate-900"
                            }`}
                            style={{
                              ...childStyle,
                              height: `${CATEGORY_PILL_HEIGHT_PX}px`,
                              lineHeight: `${CATEGORY_PILL_HEIGHT_PX}px`,
                              display: "inline-flex",
                              alignItems: "center",
                              ...(isGodiChild && godiChildChipWidthCh
                                ? {
                                    width: godiChildChipWidthCh,
                                    minWidth: godiChildChipWidthCh,
                                    flex: "0 0 auto",
                                  }
                                : {}),
                            }}
                            title={`Unterevent öffnen: ${child.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditEvent(child);
                            }}
                          >
                            {childLabel}
                          </button>

                          {grandChildren.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {grandChildren.map((gc) => {
                                const gcHasWarning = warningByEventId.get(gc.id) === true;
                                // Cancelled grandchild events are intentionally not represented on grandparent rows.
                                const gcCategory = (gc.categories ?? [])[0] ?? null;
                                const gcStyle: React.CSSProperties = {
                                  backgroundColor: gcCategory?.color_hex || "#eef2ff",
                                };
                                const gcSymbol = (gcCategory?.symbol ?? "").trim();
                                const gcCategoryLabel = (gcCategory?.name ?? "").trim();

                                return (
                                  <button
                                    key={`grandchild-${base.id}-${child.id}-${gc.id}`}
                                    type="button"
                                    className={`inline-flex h-5 w-5 md:w-auto items-center justify-center gap-1 rounded-full border px-0 md:px-2 text-[11px] font-semibold transition hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200 hover:shadow-sm ${
                                      gcHasWarning
                                        ? "border-red-500 ring-1 ring-red-200 text-red-600"
                                        : "border-transparent text-slate-900"
                                    }`}
                                    style={{
                                      ...gcStyle,
                                      height: `${CATEGORY_PILL_HEIGHT_PX}px`,
                                      lineHeight: `${CATEGORY_PILL_HEIGHT_PX}px`,
                                      display: "inline-flex",
                                      alignItems: "center"
                                    }}
                                    title={`Unter-Unterevent öffnen: ${gc.title}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditEvent(gc);
                                    }}
                                  >
                                    <span className="text-[11px] font-semibold">
                                      {gcSymbol ? gcSymbol : "•"}
                                    </span>
                                    {gcCategoryLabel && (
                                      <span className="hidden md:inline whitespace-nowrap text-[11px] font-medium">
                                        {gcCategoryLabel}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ))}
                    </div>
                  );
                })()
              ) : (
                event.categories &&
                event.categories.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {event.categories
                      .filter((cat) => normalizeCatName(cat.name ?? "") !== normalizeCatName("Entfällt"))
                      .map((cat) => (
                      (() => {
                        const selfHasWarning = warningByEventId.get(base.id) === true;
                        const linkedEvent = getLinkedEventForCategory(cat, event);
                        const commonStyle: React.CSSProperties = {
                          backgroundColor: cat.color_hex || "#eef2ff",
                        };

                        const content = (
                          <>
                            {cat.symbol && (
                              <span className="text-xs">{cat.symbol}</span>
                            )}
                            <span className="truncate">{cat.name}</span>
                          </>
                        );

                        if (linkedEvent && children.length > 0) {
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition hover:border-indigo-300 hover:ring-1 hover:ring-indigo-200 hover:shadow-sm ${
                                selfHasWarning
                                  ? "border-red-500 ring-1 ring-red-200 text-red-600"
                                  : "border-transparent text-slate-900"
                              }`}
                              style={{
                              ...commonStyle,
                              height: `${CATEGORY_PILL_HEIGHT_PX}px`,
                              lineHeight: `${CATEGORY_PILL_HEIGHT_PX}px`,
                              display: "inline-flex",
                              alignItems: "center"
                            }}
                              title={`Event öffnen: ${linkedEvent.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditEvent(linkedEvent);
                              }}
                            >
                              {content}
                            </button>
                          );
                        }

                        return (
                          <span
                            key={cat.id}
                            className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              selfHasWarning
                                ? "border-red-500 ring-1 ring-red-200 text-red-600"
                                : "border-transparent text-slate-900"
                            }`}
                            style={{
                            ...commonStyle,
                            height: `${CATEGORY_PILL_HEIGHT_PX}px`,
                            lineHeight: `${CATEGORY_PILL_HEIGHT_PX}px`,
                            display: "inline-flex",
                            alignItems: "center"
                          }}
                          >
                            {content}
                          </span>
                        );
                      })()
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
          </div>
        </li>

        {!isCollapsed &&
          children.map((child) => renderEventNode(child, depth + 1, dayContext))}
      </React.Fragment>
    );
  };

  const renderEventsWithMonths = (): React.ReactElement[] => {
    const roots = sortedFilteredEvents.filter((e) => e.parent_id == null);

    let lastMonthLabel: string | null = null;

    let currentDayKey: string | null = null;
    let currentDayLabel: string | null = null;
    let currentDayEvents: React.ReactElement[] = [];

    const items: React.ReactElement[] = [];

    type DayGroupProps = {
      dayKey: string;
      dayLabel: string;
      monthLabelForKey: string | null;
      spanning: Event[];
      childrenNodes: React.ReactElement[];
    };

    const DayGroup: React.FC<DayGroupProps> = ({
      dayKey,
      dayLabel,
      monthLabelForKey,
      spanning,
      childrenNodes,
    }) => {
      const eventsRef = React.useRef<HTMLUListElement | null>(null);
      const [eventsHeight, setEventsHeight] = React.useState<number>(0);

      React.useLayoutEffect(() => {
        const el = eventsRef.current;
        if (!el) return;

        const update = () => {
          const rect = el.getBoundingClientRect();
          const h = Math.max(0, Math.round(rect.height));
          setEventsHeight(h);
        };

        update();

        // Keep the bar height in sync with the event list height.
        let ro: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
          ro = new ResizeObserver(() => update());
          ro.observe(el);
        } else {
          window.addEventListener("resize", update);
        }

        return () => {
          if (ro) ro.disconnect();
          else window.removeEventListener("resize", update);
        };
      }, [childrenNodes.length]);

      const barWidthPx = CATEGORY_PILL_HEIGHT_PX;
      const barHeightStyle: React.CSSProperties =
        eventsHeight > 0 ? { height: `${eventsHeight}px` } : {};

      return (
        <li
          key={`daygroup-${dayKey}-${monthLabelForKey ?? "nomonth"}`}
          className="mt-2"
        >
          {/* Day separator */}
          <div className="mb-2 pt-2">
            <div className="pl-1 text-[11px] font-semibold text-slate-700">
              {dayLabel}
            </div>
          </div>

          {/* Day content (bars + events) */}
          <div className="flex items-start gap-3">
            {spanning.length > 0 && (
              <div className="flex items-start gap-2 pl-1" style={barHeightStyle}>
                {spanning.map((ev) => {
                  const color = getCategoryColorForEvent(ev);
                  const fg = getReadableTextColor(color);
                  const title = `${ev.title} (#${ev.id})`;
                  return (
                    <div
                      key={`mdbar-${dayKey}-${ev.id}`}
                      title={title}
                      aria-label={title}
                      className="rounded-lg overflow-hidden"
                      style={{
                        backgroundColor: color,
                        width: `${barWidthPx}px`,
                        ...(eventsHeight > 0 ? { height: `${eventsHeight}px` } : {}),
                        border: "1px solid rgba(0,0,0,0.08)",
                        boxShadow: "0 1px 1px rgba(0,0,0,0.10)",
                      }}
                    >
                      <div className="flex h-full w-full items-center justify-center">
                      <div
                        className="select-none text-center text-[10px] font-semibold tracking-wide"
                        style={{
                          color: fg,
                          writingMode: "vertical-rl",
                          transform: "rotate(180deg)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxHeight: "100%",
                        }}
                      >
                        {ev.title}
                      </div>
                    </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Events take the remaining width */}
            <div className="min-w-0 flex-1">
              <ul ref={eventsRef}>{childrenNodes}</ul>
            </div>
          </div>
        </li>
      );
    };

    const flushDayGroup = () => {
      if (!currentDayKey || !currentDayLabel) {
        currentDayEvents = [];
        currentDayKey = null;
        currentDayLabel = null;
        return;
      }

      // Bars represent multi-day events that are strictly *between* start and end date.
      // (Start day excluded, end day excluded.)
      const spanning = multiDayRootEvents.filter((e) => {
        const s = (e.start_date ?? "").trim();
        const ed = (e.end_date ?? "").trim();
        const d = (currentDayKey ?? "").trim();
        return !!s && !!ed && !!d && s < d && d < ed;
      });

      items.push(
        <DayGroup
          key={`daygroup-${currentDayKey}-${lastMonthLabel ?? "nomonth"}`}
          dayKey={currentDayKey}
          dayLabel={currentDayLabel}
          monthLabelForKey={lastMonthLabel}
          spanning={spanning}
          childrenNodes={currentDayEvents}
        />
      );

      currentDayEvents = [];
      currentDayKey = null;
      currentDayLabel = null;
    };

    roots.forEach((event) => {
      const monthLabel = getMonthLabel(event);
      if (monthLabel && monthLabel !== lastMonthLabel) {
        // New month: flush current day group first, then render month separator.
        flushDayGroup();

        lastMonthLabel = monthLabel;

        items.push(
          <li
            key={`month-${monthLabel}`}
            className="mb-3 pt-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            <div className="h-px flex-1 bg-slate-300" />
            <div>{monthLabel}</div>
            <div className="h-px flex-1 bg-slate-300" />
          </li>
        );
      }

      const day = getDayLabel(event);
      if (day.key && day.key !== currentDayKey) {
        // New day: flush previous day group and start a new one.
        flushDayGroup();
        currentDayKey = day.key;
        currentDayLabel = day.label;
      }

      currentDayEvents.push(renderEventNode(event, 0));
    });

    // Flush last day group
    flushDayGroup();

    return items;
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const eventForEdit: EventForEdit | null = eventBeingEdited
    ? { ...eventBeingEdited, in_klaerung: eventBeingEdited.in_klaerung === true }
    : null;

  return (
    <AppLayout
      activeView={activeView}
      onChangeView={(view) => setActiveView(view)}
      onLogout={handleLogout}
      onCreateEvent={handleCreateEventFromNav}  
  >
      {activeView === "events" && (
        <>
          {/* Filters */}
          <div className="mb-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">

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
          onChange={(e) => setCategoryFilterId(e.target.value === "" ? "" : Number(e.target.value))}
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
          onChange={(e) => setPlanningLevelFilterId(e.target.value === "" ? "" : Number(e.target.value))}
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
  eventToEdit={eventForEdit}
  onCancelEdit={handleFormClosed}
  onCreated={async () => {
    await loadEvents();
    handleFormClosed();
  }}
  parentOptions={eventsForUi}
  categoryOptions={categories}
  planningLevelOptions={planningLevels}
  initialParentId={initialParentIdForForm}
  allEvents={eventsForUi}
  onOpenEditFromRelated={(eventId) => {
    const target = eventsForUi.find((e) => e.id === eventId);
    if (target) {
      setFormMode("edit");
      setEventBeingEdited(target);
      setSelectedParentId(target.parent_id);
    }
  }}
  onRequestDuplicate={() => {
    if (eventBeingEdited) {
      openDuplicateEvent(eventBeingEdited);
    }
  }}
  onRequestAddSubEvent={() => {
    if (eventBeingEdited) {
      openCreateSubEvent(eventBeingEdited);
    }
  }}
  onRequestDelete={async () => {
    if (eventBeingEdited) {
      await deleteEvent(eventBeingEdited.id);
      handleFormClosed();
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

      {activeView === "mobileVisitors" && <MobileVisitorsPage />}

      {activeView === "users" && <UsersPage />}

      {activeView === "predigtplanung" && <Predigtplanung />}
    </AppLayout>
  );
};

export default App;
