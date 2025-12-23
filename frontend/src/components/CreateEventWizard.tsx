import React, { useEffect, useState, useRef, useMemo } from "react";
import { apiFetch } from "../api";

interface Category {
  id: number;
  name: string;
  description?: string | null;
  symbol?: string | null;
  color_hex?: string | null;
  godi_item?: boolean | null;
}

interface PlanningLevel {
  id: number;
  name: string;
  description?: string | null;
}

interface EventSummary {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  start_time?: string | null;
  end_time?: string | null;
  parent_id?: number | null;
  categories?: Category[] | null;
  category_ids?: number[] | null;
  [key: string]: any;
}

interface CreateEventWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
}> = ({ checked, onChange, disabled, ariaLabel }) => {
  const knobTranslateX = checked ? 16 : 0;

  return (
    <button
      type="button"
      className="cgb-cew-toggle"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      style={{
        width: "38px",
        height: "22px",
        borderRadius: "999px",
        border: "1px solid #d1d5db",
        backgroundColor: checked ? "#e0e7ff" : "#ffffff",
        cursor: disabled ? "not-allowed" : "pointer",
        position: "relative",
        padding: 0,
        opacity: disabled ? 0.6 : 1,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.02)",
        // IMPORTANT: do not animate/transition transform on the toggle button itself.
        // (It can cause a visible "jump" when :active/:focus styles apply.)
        transition: "background-color 0.15s ease, box-shadow 0.15s ease",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "18px",
          height: "18px",
          borderRadius: "999px",
          backgroundColor: checked ? "#4f46e5" : "#9ca3af",
          transform: `translateX(${knobTranslateX}px)`,
          transition: "transform 0.15s ease, background-color 0.15s ease",
          marginLeft: "2px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.12)",
        }}
      />
    </button>
  );
};

const WizardButton: React.FC<{
  label: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "secondary" | "primary";
  style?: React.CSSProperties;
}> = ({
  label,
  onClick,
  type = "button",
  disabled,
  variant = "secondary",
  style,
}) => {
  const [hovered, setHovered] = useState(false);

  const isDisabled = !!disabled;
  const isPrimary = variant === "primary";

  const base: React.CSSProperties = {
    padding: isPrimary ? "8px 16px" : "8px 14px",
    borderRadius: "999px",
    fontSize: "14px",
    cursor: isDisabled ? "not-allowed" : "pointer",
    transition:
      "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
    transform: !isDisabled && hovered ? "translateY(-1px)" : "translateY(0px)",
  };

  const secondary: React.CSSProperties = {
    border: "1px solid #d1d5db",
    backgroundColor: !isDisabled && hovered ? "#f9fafb" : "#ffffff",
    boxShadow:
      !isDisabled && hovered
        ? "0 2px 8px rgba(0,0,0,0.10)"
        : "0 1px 3px rgba(0,0,0,0.06)",
    color: "#111827",
  };

  const primary: React.CSSProperties = {
    border: "none",
    backgroundColor: isDisabled ? "#9ca3af" : !hovered ? "#4f46e5" : "#4338ca",
    boxShadow:
      !isDisabled && hovered
        ? "0 6px 16px rgba(79,70,229,0.30)"
        : "0 2px 8px rgba(79,70,229,0.18)",
    color: "#ffffff",
    fontWeight: 600,
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...base,
        ...(isPrimary ? primary : secondary),
        ...style,
      }}
    >
      {label}
    </button>
  );
};

const CreateEventWizard: React.FC<CreateEventWizardProps> = ({
  onClose,
  onCreated,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [planningLevels, setPlanningLevels] = useState<PlanningLevel[]>([]);
  const [selectedPlanningLevelIds, setSelectedPlanningLevelIds] = useState<
    number[]
  >([]);
  const [gottesdienstEvents, setGottesdienstEvents] = useState<EventSummary[]>(
    [],
  );
  const [selectedParentEventIds, setSelectedParentEventIds] = useState<
    number[]
  >([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [hoveredCategoryId, setHoveredCategoryId] = useState<number | null>(
    null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const parentEventsListRef = useRef<HTMLDivElement | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);

  // Centralized post-create callback (avoids runtime ReferenceError)
  const notifyCreated = () => {
    try {
      onCreated();
    } catch {
      // no-op
    }
  };

  const isEndTimeBeforeStartTime = (
    startDate: string | null,
    endDate: string | null,
    startTime?: string | null,
    endTime?: string | null,
  ): boolean => {
    if (
      !startDate ||
      !endDate ||
      startDate !== endDate ||
      !startTime ||
      !endTime
    ) {
      return false;
    }
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if (
      Number.isNaN(sh) ||
      Number.isNaN(sm) ||
      Number.isNaN(eh) ||
      Number.isNaN(em)
    ) {
      return false;
    }
    return eh < sh || (eh === sh && em < sm);
  };

  const normalizeTimeValue = (raw: string): string | null => {
    if (!raw) return null;
    const v = raw.trim().replace(/\./g, ":").toLowerCase();

    // Accept "HH:MM" directly
    const m24 = v.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (m24) {
      const hh = m24[1].padStart(2, "0");
      const mm = m24[2];
      return `${hh}:${mm}`;
    }

    // Accept "H" or "HH" as hour
    const mHour = v.match(/^([01]?\d|2[0-3])$/);
    if (mHour) {
      const hh = mHour[1].padStart(2, "0");
      return `${hh}:00`;
    }

    // Accept "10:00am" / "10am" / "3pm"
    const mAmPm = v.match(/^([0-9]{1,2})(?::([0-5]\d))?\s*(am|pm)$/);
    if (mAmPm) {
      let h = parseInt(mAmPm[1], 10);
      const mm = (mAmPm[2] ?? "00").padStart(2, "0");
      const ap = mAmPm[3];
      if (Number.isNaN(h) || h < 1 || h > 12) return null;
      if (ap === "am") {
        if (h === 12) h = 0;
      } else {
        if (h !== 12) h = h + 12;
      }
      const hh = String(h).padStart(2, "0");
      return `${hh}:${mm}`;
    }

    return null;
  };

  const parseMultipleTimes = (input: string): string[] => {
    if (!input) return [];
    const parts = input
      .split(/[,;\n\t\s]+/g)
      .map((p) => p.trim())
      .filter(Boolean);

    const normalized: string[] = [];
    for (const p of parts) {
      const t = normalizeTimeValue(p);
      if (t) normalized.push(t);
    }

    // unique + sort
    const uniq = Array.from(new Set(normalized));
    uniq.sort((a, b) => a.localeCompare(b));
    return uniq;
  };

  const addMinutesToTime = (time: string, minutes: number): string => {
    const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return time;
    const hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const total = hh * 60 + mm + minutes;
    const newTotal = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const nh = Math.floor(newTotal / 60);
    const nm = newTotal % 60;
    return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
  };

  const buildGodiChildTitle = (time: string): string => {
    const m = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return "Godi";
    const hh = String(parseInt(m[1], 10));
    const mm = m[2];
    if (mm === "00") return `Godi ${hh}er`;
    return `Godi ${hh}:${mm}er`;
  };

  const deriveGottesdienstFolderName = (dateIso: string): string | null => {
    // Erwartet YYYY-MM-DD
    if (!dateIso) return null;
    const m = String(dateIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const mm = m[2];
    const dd = m[3];
    return `${mm}_${dd}`;
  };

  const getReadableTextColor = (hex: string | null | undefined): string => {
    const h = (hex ?? "").trim();
    const match = /^#?([0-9a-fA-F]{6})$/.exec(h);
    if (!match) return "#111827";
    const v = match[1];
    const r = parseInt(v.slice(0, 2), 16) / 255;
    const g = parseInt(v.slice(2, 4), 16) / 255;
    const b = parseInt(v.slice(4, 6), 16) / 255;
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return L > 0.55 ? "#111827" : "#ffffff";
  };

  const gottesdienstCategoryForStyle = useMemo<Category | null>(() => {
    return (
      categories.find(
        (c) => (c.name ?? "").trim().toLowerCase() === "gottesdienst",
      ) ?? null
    );
  }, [categories]);

  const compareGodiEvents = (a: EventSummary, b: EventSummary): number => {
    const aDate = (a.start_date ?? a.end_date ?? "").trim();
    const bDate = (b.start_date ?? b.end_date ?? "").trim();
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;

    const aTime = (a.start_time ?? "").trim();
    const bTime = (b.start_time ?? "").trim();
    const aHasTime = aTime.length > 0;
    const bHasTime = bTime.length > 0;
    if (aHasTime !== bHasTime) return aHasTime ? 1 : -1;
    if (aHasTime && bHasTime && aTime !== bTime) return aTime < bTime ? -1 : 1;

    const aTitle = (a.title ?? "").trim();
    const bTitle = (b.title ?? "").trim();
    const t = aTitle.localeCompare(bTitle, undefined, { sensitivity: "base" });
    if (t !== 0) return t;

    return a.id - b.id;
  };

  const godisById = useMemo(() => {
    const map = new Map<number, EventSummary>();
    for (const ev of gottesdienstEvents) {
      map.set(ev.id, ev);
    }
    return map;
  }, [gottesdienstEvents]);

  const godiChildrenByParentId = useMemo(() => {
    const map = new Map<number, EventSummary[]>();
    for (const ev of gottesdienstEvents) {
      const pid = typeof ev.parent_id === "number" ? ev.parent_id : null;
      if (pid == null) continue;
      const arr = map.get(pid) ?? [];
      arr.push(ev);
      map.set(pid, arr);
    }
    // sort each child list for stable UI
    for (const [pid, arr] of map.entries()) {
      arr.sort(compareGodiEvents);
      map.set(pid, arr);
    }
    return map;
  }, [gottesdienstEvents]);

  const godiRoots = useMemo(() => {
    const ids = new Set(gottesdienstEvents.map((e) => e.id));
    const roots = gottesdienstEvents.filter((ev) => {
      const pid = typeof ev.parent_id === "number" ? ev.parent_id : null;
      // if parent_id is null OR points to a non-gottesdienst event, treat as root for this view
      return pid == null || !ids.has(pid);
    });
    roots.sort(compareGodiEvents);
    return roots;
  }, [gottesdienstEvents]);

  const getGodiDescendantIds = (rootId: number): number[] => {
    const out: number[] = [];
    const stack: number[] = [rootId];
    const visited = new Set<number>();
    visited.add(rootId);

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      const kids = godiChildrenByParentId.get(currentId) ?? [];
      for (const k of kids) {
        if (visited.has(k.id)) continue;
        visited.add(k.id);
        out.push(k.id);
        stack.push(k.id);
      }
    }
    return out;
  };

  const handleToggleGodiParentSelection = (
    eventId: number,
    checked: boolean,
  ) => {
    const descendantIds = getGodiDescendantIds(eventId);
    const allIds = [eventId, ...descendantIds];

    setSelectedParentEventIds((prev) => {
      if (checked) {
        const set = new Set(prev);
        for (const id of allIds) set.add(id);
        return Array.from(set);
      }

      // Unchecking a parent clears the parent and all its descendants
      const remove = new Set(allIds);
      return prev.filter((id) => !remove.has(id));
    });
  };

  const handleToggleGodiSingleSelection = (
    eventId: number,
    checked: boolean,
  ) => {
    setSelectedParentEventIds((prev) => {
      if (checked) {
        if (prev.includes(eventId)) return prev;
        return [...prev, eventId];
      }
      return prev.filter((id) => id !== eventId);
    });
  };

  const effectiveGodiTargetEventIds = useMemo(() => {
    // Never attach isGodiChild items to "grandparent" nodes when selected children exist.
    // Keep only the lowest selected nodes (no selected descendants).
    const selected = selectedParentEventIds.slice();
    const selectedSet = new Set<number>(selected);

    const hasSelectedDescendant = (id: number): boolean => {
      const kids = godiChildrenByParentId.get(id) ?? [];
      for (const k of kids) {
        if (selectedSet.has(k.id)) return true;
        if (hasSelectedDescendant(k.id)) return true;
      }
      return false;
    };

    return selected.filter((id) => !hasSelectedDescendant(id));
  }, [selectedParentEventIds, godiChildrenByParentId]);
  const scrollWizardToTop = () => {
    // Primary target: the wizard's own scroll container
    const panelEl = panelScrollRef.current as HTMLElement | null;
    if (panelEl) {
      try {
        panelEl.scrollTop = 0;
        // Some browsers honor scrollTo more consistently than assigning scrollTop
        panelEl.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
        return;
      } catch {
        // ignore and fall back
      }
    }

    if (typeof window === "undefined") return;

    // Secondary: try to scroll a scrollable ancestor (in case the wizard is embedded in a scrolling modal)
    const rootEl = containerRef.current as HTMLElement | null;
    if (rootEl) {
      let p: HTMLElement | null = rootEl;
      while (p) {
        try {
          const style = window.getComputedStyle(p);
          const overflowY = style.overflowY;
          const canScroll =
            (overflowY === "auto" || overflowY === "scroll") &&
            p.scrollHeight > p.clientHeight + 2;
          if (canScroll) {
            p.scrollTop = 0;
            break;
          }
        } catch {
          // ignore
        }
        p = p.parentElement;
      }

      try {
        rootEl.scrollIntoView({ block: "start", behavior: "auto" });
      } catch {
        // ignore
      }
    }

    // Last resort: window scroll
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch {
      // ignore
    }
  };

  // Scroll to top whenever a category is selected in step 1
  useEffect(() => {
    if (step === 1 && selectedCategoryId !== null) {
      scrollWizardToTop();
    }
  }, [step, selectedCategoryId]);

  // Scroll to top whenever we enter step 2
  useEffect(() => {
    if (step !== 2) return;
    if (typeof window === "undefined") return;

    // Run after the step-2 UI has been painted so the scroll container ref is definitely available.
    const raf1 = window.requestAnimationFrame(() => {
      const raf2 = window.requestAnimationFrame(() => {
        scrollWizardToTop();

        // Inner list scroll-areas (e. g. Gottesdienstliste) likewise reset
        if (parentEventsListRef.current) {
          parentEventsListRef.current.scrollTop = 0;
        }
      });
      return () => window.cancelAnimationFrame(raf2);
    });

    return () => window.cancelAnimationFrame(raf1);
  }, [step]);

  // Step 2 form state
  const [title, setTitle] = useState<string>("");
  const [titleFocused, setTitleFocused] = useState<boolean>(false);

  // Spezialfall "Feiertag": ein einzelner Tag
  const [day, setDay] = useState<string>("");

  // Datumsbereich (z.B. Ferien, Allgemein)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  useEffect(() => {
    if (startDate && !endDate) {
      setEndDate(startDate);
    }
  }, [startDate, endDate]);

  const handleResetDateRange = () => {
    setStartDate("");
    setEndDate("");
  };

  // Zusätzliche Felder für "Allgemein"
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [preacher, setPreacher] = useState<string>("");
  const [sermonTitle, setSermonTitle] = useState<string>("");
  const [pcoId, setPcoId] = useState<string>("");

  // Gottesdienst (Eltern + mehrere Startzeiten)
  const [godiTimes, setGodiTimes] = useState<string[]>([]);
  const [godiCustomTimesInput, setGodiCustomTimesInput] = useState<string>("");
  const [
    applyParentDetailsToAllGodiChildren,
    setApplyParentDetailsToAllGodiChildren,
  ] = useState<boolean>(true);
  const [godiChildOverrides, setGodiChildOverrides] = useState<
    Record<string, any>
  >({});

  const [remarks, setRemarks] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [mail, setMail] = useState<string>("");
  const [inKlaerung, setInKlaerung] = useState<boolean>(false);
  const [clarification, setClarification] = useState<string>("");
  const [createTaufeStageEvent, setCreateTaufeStageEvent] =
    useState<boolean>(true);

  // Nextcloud: Kollekte -> optional Bauspende image per selected Gottesdienst folder
  const [includeBauspendeImage, setIncludeBauspendeImage] =
    useState<boolean>(false);
  const [bauspendeStatus, setBauspendeStatus] = useState<
    "idle" | "copying" | "success" | "error"
  >("idle");
  const [bauspendeError, setBauspendeError] = useState<string | null>(null);
  const [bauspendeLinksByParentId, setBauspendeLinksByParentId] = useState<
    Record<number, string>
  >({});
  const [
    bauspendeCopyLinkStatusByParentId,
    setBauspendeCopyLinkStatusByParentId,
  ] = useState<Record<number, "idle" | "success" | "error">>({});

  const [location, setLocation] = useState<string>("");
  const [attachmentsInput, setAttachmentsInput] = useState<string>("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentUploadStatus, setAttachmentUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [attachmentUploadError, setAttachmentUploadError] = useState<
    string | null
  >(null);
  const [copyAttachmentStatus, setCopyAttachmentStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  // Nextcloud-Ordner für Gottesdienst
  const [godiFolderStatus, setGodiFolderStatus] = useState<
    "idle" | "creating" | "success" | "error"
  >("idle");
  const [godiFolderError, setGodiFolderError] = useState<string | null>(null);
  const [godiFolderCreatedForDate, setGodiFolderCreatedForDate] = useState<
    string | null
  >(null);

  const [isAttachmentDragOver, setIsAttachmentDragOver] =
    useState<boolean>(false);

  const [applyDetailsToAllChildren, setApplyDetailsToAllChildren] =
    useState<boolean>(true);
  const [godiChildDetailsByParentId, setGodiChildDetailsByParentId] = useState<
    Record<
      number,
      {
        remarks?: string;
        internalNotes?: string;
        inKlaerung?: boolean;
        clarification?: string;
        mail?: string;
      }
    >
  >({});

  const [selectedCategoryIdsForEvent, setSelectedCategoryIdsForEvent] =
    useState<number[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [startCalendarMonth, setStartCalendarMonth] = useState<Date>(
    new Date(),
  );
  const [endCalendarMonth, setEndCalendarMonth] = useState<Date | null>(null);

  const isFeiertag = selectedCategory?.name === "Feiertag";
  const isFerien = selectedCategory?.name === "Ferien";
  const isGottesdienstCategory =
    selectedCategory?.name?.trim().toLowerCase() === "gottesdienst";

  // Wenn der Nutzer beim Gottesdienst das Datum ändert, dürfen wir keinen alten Ordner-Link behalten.
  useEffect(() => {
    if (!isGottesdienstCategory) return;
    if (!godiFolderCreatedForDate) return;
    if (!startDate) return;
    if (startDate !== godiFolderCreatedForDate) {
      setAttachmentsInput("");
      setGodiFolderStatus("idle");
      setGodiFolderError(null);
      setGodiFolderCreatedForDate(null);
      setCopyAttachmentStatus("idle");
    }
  }, [isGottesdienstCategory, startDate, godiFolderCreatedForDate]);

  const isAlphaCategory =
    selectedCategory?.name?.trim().toLowerCase() === "alpha";
  const isPredigtreiheCategory =
    selectedCategory?.name?.trim().toLowerCase() === "predigtreihe";

  const extendedFormCategoryNames = [
    "allgemein",
    "intern",
    "entfällt",
    "alpha",
    "bibel",
    "camp / freizeit",
    "connect / jet",
    "evangelisation",
    "gebet",
    "lobpreis",
    "schatzinsel",
    "team night",
  ];

  const usesExtendedForm =
    !!selectedCategory &&
    extendedFormCategoryNames.includes(
      selectedCategory.name?.trim().toLowerCase() || "",
    );

  // Step 2 (extended form): keep the Step-1 category as the immutable "main" category.
  // Users may add/remove other categories, but the initially selected category must remain.
  useEffect(() => {
    if (step !== 2) return;
    if (!usesExtendedForm) return;
    if (!selectedCategory?.id) return;

    const mainId = selectedCategory.id;
    setSelectedCategoryIdsForEvent((prev) => {
      if (prev.includes(mainId)) return prev;
      return [mainId, ...prev];
    });
  }, [step, usesExtendedForm, selectedCategory?.id]);

  const godiChildCategoryNames = [
    "abendmahl",
    "kindersegnung",
    "kollekte",
    "lobpreisabend",
    "special",
    "gastprediger",
    "taufe",
    "predigtreihe",
  ];

  const isGodiChildCategory =
    !!selectedCategory &&
    !!selectedCategory.godi_item &&
    godiChildCategoryNames.includes(
      selectedCategory.name?.trim().toLowerCase() || "",
    );
  // For all isGodiChild elements, default to inheriting the section values across generated children.
  useEffect(() => {
    if (!isGodiChildCategory) return;
    setApplyDetailsToAllChildren(true);
  }, [isGodiChildCategory, selectedCategory?.id]);

  const isSpecialGodiChild =
    isGodiChildCategory &&
    selectedCategory?.name?.trim().toLowerCase() === "special";

  const isPredigtreiheGodiChild =
    isGodiChildCategory &&
    selectedCategory?.name?.trim().toLowerCase() === "predigtreihe";

  const parseIsoDateToMidnight = (iso: string): Date | null => {
    const v = (iso ?? "").trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const isIsoWithinInclusiveRange = (
    iso: string | null,
    rangeStartIso: string,
    rangeEndIso: string,
  ): boolean => {
    if (!iso) return false;
    const d = parseIsoDateToMidnight(iso);
    const s = parseIsoDateToMidnight(rangeStartIso);
    const e = parseIsoDateToMidnight(rangeEndIso);
    if (!d || !s || !e) return false;
    return d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
  };

  const predigtreiheRangeStartIso = isPredigtreiheGodiChild
    ? startDate || ""
    : "";
  const predigtreiheRangeEndIso = isPredigtreiheGodiChild
    ? endDate || startDate || ""
    : "";

  const predigtreiheVisibleGodiIds = useMemo(() => {
    if (!isPredigtreiheGodiChild) return null;
    if (!predigtreiheRangeStartIso || !predigtreiheRangeEndIso) return null;

    const ids = new Set<number>();
    for (const ev of gottesdienstEvents) {
      const evDateIso = (ev.start_date ?? ev.end_date ?? "").trim();
      if (!evDateIso) continue;
      if (
        isIsoWithinInclusiveRange(
          evDateIso,
          predigtreiheRangeStartIso,
          predigtreiheRangeEndIso,
        )
      ) {
        ids.add(ev.id);
      }
    }
    return ids;
  }, [
    isPredigtreiheGodiChild,
    predigtreiheRangeStartIso,
    predigtreiheRangeEndIso,
    gottesdienstEvents,
  ]);

  const visibleGodiRoots = useMemo(() => {
    if (!predigtreiheVisibleGodiIds) return godiRoots;

    const rootIsVisible = (rootId: number): boolean => {
      if (predigtreiheVisibleGodiIds.has(rootId)) return true;
      const stack: number[] = [rootId];
      const visited = new Set<number>();
      visited.add(rootId);
      while (stack.length > 0) {
        const currentId = stack.pop()!;
        const kids = godiChildrenByParentId.get(currentId) ?? [];
        for (const k of kids) {
          if (visited.has(k.id)) continue;
          visited.add(k.id);
          if (predigtreiheVisibleGodiIds.has(k.id)) return true;
          stack.push(k.id);
        }
      }
      return false;
    };

    return godiRoots.filter((r) => rootIsVisible(r.id));
  }, [predigtreiheVisibleGodiIds, godiRoots, godiChildrenByParentId]);

  // Safety: if the Predigtreihe date range changes, remove hidden selections so we never link
  // Gottesdienste that are outside the visible (date-filtered) list.
  useEffect(() => {
    if (!predigtreiheVisibleGodiIds) return;
    setSelectedParentEventIds((prev) =>
      prev.filter((id) => predigtreiheVisibleGodiIds.has(id)),
    );
  }, [predigtreiheVisibleGodiIds]);

  const isGastpredigerGodiChild =
    isGodiChildCategory &&
    selectedCategory?.name?.trim().toLowerCase() === "gastprediger";

  const isTaufeGodiChild =
    isGodiChildCategory &&
    selectedCategory?.name?.trim().toLowerCase() === "taufe";

  const isKollekteGodiChild =
    isGodiChildCategory &&
    selectedCategory?.name?.trim().toLowerCase() === "kollekte";

  // Prune stored Bauspende links when selection changes (Kollekte only)
  useEffect(() => {
    if (!isKollekteGodiChild) return;
    setBauspendeLinksByParentId((prev) => {
      const next: Record<number, string> = {};
      for (const pid of effectiveGodiTargetEventIds) {
        if (prev && prev[pid]) next[pid] = prev[pid];
      }
      return next;
    });
    setBauspendeCopyLinkStatusByParentId((prev) => {
      const next: Record<number, "idle" | "success" | "error"> = {};
      for (const pid of effectiveGodiTargetEventIds) {
        if (prev && prev[pid]) next[pid] = prev[pid];
      }
      return next;
    });
  }, [isKollekteGodiChild, effectiveGodiTargetEventIds]);

  let taufeStageSuggestionDateLabel: string | null = null;
  if (isTaufeGodiChild && effectiveGodiTargetEventIds.length === 1) {
    const parentForTaufeSuggestion = gottesdienstEvents.find(
      (ev) => ev.id === effectiveGodiTargetEventIds[0],
    );
    if (parentForTaufeSuggestion?.start_date) {
      const baseDate = new Date(parentForTaufeSuggestion.start_date as any);
      if (!isNaN(baseDate.getTime())) {
        baseDate.setDate(baseDate.getDate() - 4);
        const yyyy = baseDate.getFullYear();
        const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
        const dd = String(baseDate.getDate()).padStart(2, "0");
        taufeStageSuggestionDateLabel = `${dd}.${mm}.${yyyy}`;
      }
    }
  }

  const hasCustomTitleGodiChild =
    isSpecialGodiChild || isPredigtreiheGodiChild || isGastpredigerGodiChild;

  const nonGodiCategories = categories.filter((c) => !c.godi_item);
  const godiItemCategories = categories.filter((c) => c.godi_item);

  useEffect(() => {
    if (!isGottesdienstCategory) return;
    if (!planningLevels || planningLevels.length === 0) return;

    const desiredNames = ["rahmenplan", "predigtplanung"];
    const desiredIds = planningLevels
      .filter((pl) =>
        desiredNames.includes((pl.name || "").trim().toLowerCase()),
      )
      .map((pl) => pl.id);

    if (desiredIds.length === 0) return;

    setSelectedPlanningLevelIds((prev) => {
      // if user already selected something, keep it
      if (prev && prev.length > 0) return prev;
      return desiredIds;
    });
  }, [isGottesdienstCategory, planningLevels]);

  useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const raw = await apiFetch("/categories");
        if (!isMounted) return;

        let data: any = raw;

        // apiFetch might either return parsed JSON (array) or a Response object.
        if (
          !Array.isArray(data) &&
          data &&
          typeof (data as any).json === "function"
        ) {
          try {
            const json = await (data as any).json();
            data = json;
          } catch (jsonErr) {
            console.error(
              "Fehler beim Parsen der Kategorien-Antwort:",
              jsonErr,
            );
          }
        }

        if (!Array.isArray(data)) {
          console.error("Unerwartetes Antwortformat für /categories:", data);
          throw new Error("Unerwartetes Antwortformat für Kategorien.");
        }

        const sorted = [...data].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "de-DE"),
        );
        setCategories(sorted);

        // Planungsebenen laden
        try {
          const plRaw = await apiFetch("/planning-levels");
          let plData: any = plRaw;

          if (
            !Array.isArray(plData) &&
            plData &&
            typeof (plData as any).json === "function"
          ) {
            try {
              const json = await (plData as any).json();
              plData = json;
            } catch (jsonErr) {
              console.error(
                "Fehler beim Parsen der Planungsebenen-Antwort:",
                jsonErr,
              );
            }
          }

          if (Array.isArray(plData)) {
            const plSorted = [...plData].sort((a, b) =>
              (a.name || "").localeCompare(b.name || "", "de-DE"),
            );
            if (isMounted) {
              setPlanningLevels(plSorted);
            }
          } else {
            console.error(
              "Unerwartetes Antwortformat für /planning-levels:",
              plData,
            );
          }
        } catch (plErr) {
          console.error("Fehler beim Laden der Planungsebenen:", plErr);
        }

        // Gottesdienst-Events laden (zukünftige mit Startdatum)
        try {
          const eventsRaw = await apiFetch("/events");
          let eventsData: any = eventsRaw;

          if (
            !Array.isArray(eventsData) &&
            eventsData &&
            typeof (eventsData as any).json === "function"
          ) {
            try {
              const json = await (eventsData as any).json();
              eventsData = json;
            } catch (jsonErr) {
              console.error("Fehler beim Parsen der Events-Antwort:", jsonErr);
            }
          }

          if (Array.isArray(eventsData)) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const gottesdienstCategory = (data as any[]).find(
              (c) => c.name && c.name.toLowerCase() === "gottesdienst",
            ) as Category | undefined;

            const filtered = (eventsData as any[]).filter((ev) => {
              const sd = ev.start_date;
              if (!sd) return false;
              const d = new Date(sd);
              if (isNaN(d.getTime())) return false;
              if (d < today) return false;

              let hasGodi = false;
              if (gottesdienstCategory) {
                if (Array.isArray(ev.category_ids)) {
                  hasGodi = ev.category_ids.includes(gottesdienstCategory.id);
                }
                if (!hasGodi && Array.isArray(ev.categories)) {
                  hasGodi = ev.categories.some(
                    (c: any) =>
                      c.id === gottesdienstCategory.id ||
                      (typeof c.name === "string" &&
                        c.name.toLowerCase() === "gottesdienst"),
                  );
                }
                if (!hasGodi && Array.isArray(ev.category_names)) {
                  hasGodi = ev.category_names.some(
                    (n: any) =>
                      typeof n === "string" &&
                      n.toLowerCase() === "gottesdienst",
                  );
                }
              }
              return hasGodi;
            });

            const mapped: EventSummary[] = filtered.map((ev: any) => {
              // Versuche, die bestehenden Kategorie-IDs des Gottesdienstes zu ermitteln,
              // damit wir sie später sauber ergänzen können.
              let categoryIds: number[] | null = null;

              if (Array.isArray(ev.category_ids)) {
                categoryIds = (ev.category_ids as any[]).filter(
                  (id) => typeof id === "number",
                ) as number[];
              } else if (Array.isArray(ev.categories)) {
                categoryIds = (ev.categories as any[])
                  .map((c) => (c && typeof c.id === "number" ? c.id : null))
                  .filter((id) => typeof id === "number") as number[];
              }

              return {
                id: ev.id,
                title: ev.title,
                start_date: ev.start_date ?? null,
                end_date: ev.end_date ?? ev.start_date ?? null,
                start_time: ev.start_time ?? null,
                end_time: ev.end_time ?? null,
                parent_id:
                  typeof ev.parent_id === "number" ? ev.parent_id : null,
                categories: Array.isArray(ev.categories)
                  ? (ev.categories as any[])
                  : null,
                category_ids: categoryIds,
              } as EventSummary;
            });

            if (isMounted) {
              setGottesdienstEvents(mapped);
            }
          } else {
            console.error(
              "Unerwartetes Antwortformat für /events:",
              eventsData,
            );
          }
        } catch (eventsErr) {
          console.error("Fehler beim Laden der Events:", eventsErr);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Kategorien:", err);
        if (isMounted) {
          setError(
            "Die Kategorien konnten nicht geladen werden. Bitte versuche es erneut.",
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const initCalendarMonth = () => {
    const base = new Date();
    setStartCalendarMonth(base);
    setEndCalendarMonth(null);
  };

  const goToFeiertagStep = () => {
    // Initialisiere den Kalendermonat (heute)
    initCalendarMonth();

    // Falls bereits ein Tag gewählt wurde, Kalendermonat anpassen
    if (day) {
      const parsed = new Date(day);
      if (!isNaN(parsed.getTime())) {
        setStartCalendarMonth(
          new Date(parsed.getFullYear(), parsed.getMonth(), 1),
        );
      }
    }

    setStep(2);
  };

  const handleSelectCategory = (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId) || null;
    setSelectedCategoryId(categoryId);
    setSelectedCategory(category);

    // Kategorienauswahl für das Event initialisieren
    const lowerName = category?.name?.trim().toLowerCase() || "";
    const isExtended =
      !!category && extendedFormCategoryNames.includes(lowerName);

    if (isExtended && category) {
      setSelectedCategoryIdsForEvent([category.id]);
    } else {
      setSelectedCategoryIdsForEvent([]);
    }

    // Planungsebenen-Auswahl zurücksetzen / Default setzen
    // Requirements:
    // - If category "Intern" is selected, add planning level "Intern" by default.
    // - If category "Alpha" is selected, add planning level "Rahmenplan" by default.
    // We match case-insensitively to be robust against naming variations.
    const isInternCategory = lowerName === "intern";
    const isAlphaCategory = lowerName === "alpha";

    if (isInternCategory) {
      const internPlanningLevelId = planningLevels.find(
        (pl) => (pl.name || "").trim().toLowerCase() === "intern",
      )?.id;
      if (typeof internPlanningLevelId === "number") {
        setSelectedPlanningLevelIds([internPlanningLevelId]);
      } else {
        // Fallback: if the planning level is not present yet, keep reset behavior.
        setSelectedPlanningLevelIds([]);
      }
    } else if (isAlphaCategory) {
      const rahmenplanPlanningLevelId = planningLevels.find(
        (pl) => (pl.name || "").trim().toLowerCase() === "rahmenplan",
      )?.id;
      if (typeof rahmenplanPlanningLevelId === "number") {
        setSelectedPlanningLevelIds([rahmenplanPlanningLevelId]);
      } else {
        // Fallback: if the planning level is not present yet, keep reset behavior.
        setSelectedPlanningLevelIds([]);
      }
    } else {
      setSelectedPlanningLevelIds([]);
    }
    // Auswahl der Eltern-Events zurücksetzen
    setSelectedParentEventIds([]);

    // Formularzustand zurücksetzen
    if (
      category &&
      category.name &&
      category.name.trim().toLowerCase() === "alpha"
    ) {
      setTitle("Alpha Kurs");
    } else {
      setTitle("");
    }
    setDay("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setPreacher("");
    setSermonTitle("");
    setPcoId("");
    setGodiTimes([]);
    setGodiCustomTimesInput("");
    setApplyParentDetailsToAllGodiChildren(true);
    setGodiChildOverrides({});
    setRemarks("");
    setInternalNotes("");
    setMail("");
    setInKlaerung(false);
    setClarification("");
    setIncludeBauspendeImage(false);
    setBauspendeStatus("idle");
    setBauspendeError(null);
    setBauspendeLinksByParentId({});
    setBauspendeCopyLinkStatusByParentId({});

    setLocation("");
    setAttachmentsInput("");
    setAttachmentFile(null);
    setAttachmentUploadStatus("idle");
    setAttachmentUploadError(null);
    setCopyAttachmentStatus("idle");
    setGodiFolderStatus("idle");
    setGodiFolderError(null);
    setGodiFolderCreatedForDate(null);
    setSubmitError(null);
    if (attachmentFileInputRef.current) {
      attachmentFileInputRef.current.value = "";
    }
    initCalendarMonth();

    if (category && category.name === "Feiertag") {
      // Direkt zu Schritt 2 mit Kalender für Feiertag
      goToFeiertagStep();
    } else {
      // Für andere Kategorien zunächst zu einem Kategorie-spezifischen Schritt 2 wechseln
      setStep(2);
    }
  };

  const handleCancel = () => {
	  onClose();
  };

  const handleBackToStep1 = () => {
    setStep(1);
  };

  const handleCreateFeiertag = async () => {
    if (!title.trim() || !day) {
      setSubmitError("Bitte Titel und Tag ausfüllen.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload: any = {
        title: title.trim(),
        start_date: day,
        end_date: day,
        parent_id: null,
        start_time: null,
        end_time: null,
        preacher: null,
        sermon_title: null,
        remarks: null,
        internal_notes: null,
        clarification: null,
        link: null,
        in_klaerung: false,
        pco_id: null,
        besucherzahl: null,
        mail: null,
        attachments: null,
        ort: null,
        link_id: null,
        // Defaults:
        planning_level_ids: [1], // "Rahmenplan"
        category_ids: [4], // "Feiertag"
      };

      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      } as any);

	      notifyCreated();
	      notifyCreated();
	      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des Feiertags:", err);
      setSubmitError(
        "Der Feiertag konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateFerien = async () => {
    if (!title.trim() || !startDate || !endDate) {
      setSubmitError("Bitte Titel, Start- und Enddatum ausfüllen.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setSubmitError("Das Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload: any = {
        title: title.trim(),
        start_date: startDate,
        end_date: endDate,
        parent_id: null,
        start_time: null,
        end_time: null,
        preacher: null,
        sermon_title: null,
        remarks: null,
        internal_notes: null,
        clarification: null,
        link: null,
        in_klaerung: false,
        pco_id: null,
        besucherzahl: null,
        mail: null,
        attachments: null,
        ort: null,
        link_id: null,
        // Defaults:
        planning_level_ids: [1], // "Rahmenplan"
        category_ids: [8], // "Ferien"
      };

      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      } as any);

	      notifyCreated();
	      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen der Ferien:", err);
      setSubmitError(
        "Die Ferien konnten nicht angelegt werden. Bitte versuche es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAllgemein = async () => {
    let finalTitle = title;
    if (isPredigtreiheCategory && title) {
      const trimmed = title.trim();
      if (!trimmed.toLowerCase().startsWith("predigtreihe:")) {
        finalTitle = `Predigtreihe: ${trimmed}`;
      }
    }

    if (!title.trim() || !startDate || !endDate) {
      setSubmitError("Bitte Titel, Start- und Enddatum ausfüllen.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      setSubmitError("Das Enddatum darf nicht vor dem Startdatum liegen.");
      return;
    }

    if (isEndTimeBeforeStartTime(startDate, endDate, startTime, endTime)) {
      setSubmitError("Die Endzeit darf nicht vor der Startzeit liegen.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload: any = {
        title: finalTitle.trim(),
        start_date: startDate,
        end_date: endDate,
        parent_id: null,
        start_time: startTime || null,
        end_time: endTime || null,
        preacher: null,
        sermon_title: null,
        remarks: remarks.trim() || null,
        internal_notes: internalNotes.trim() || null,
        clarification:
          inKlaerung && clarification.trim() ? clarification.trim() : null,
        link: null,
        in_klaerung: inKlaerung,
        pco_id: null,
        besucherzahl: null,
        mail: null,
        attachments: null,
        ort: location.trim() || null,
        link_id: null,
        // Defaults:
        planning_level_ids: selectedPlanningLevelIds,
        category_ids:
          selectedCategoryIdsForEvent.length > 0
            ? selectedCategoryIdsForEvent
            : selectedCategory
              ? [selectedCategory.id]
              : [12], // Fallback: Allgemein
      };

      await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      } as any);

	      notifyCreated();
	      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des allgemeinen Events:", err);
      setSubmitError(
        "Der allgemeine Termin konnte nicht angelegt werden. Bitte versuche es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGottesdienst = async () => {
    const gottesdienstCategory = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === "gottesdienst",
    );
    if (!gottesdienstCategory) {
      setSubmitError('Kategorie "Gottesdienst" wurde nicht gefunden.');
      return;
    }

    if (!startDate) {
      setSubmitError("Bitte ein Datum auswählen.");
      return;
    }

    if (!godiTimes || godiTimes.length === 0) {
      setSubmitError(
        "Bitte mindestens eine Startzeit auswählen oder hinzufügen.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      // Parent event (no start/end time)
      const parentPayload: any = {
        title: "Gottesdienst",
        start_date: startDate,
        end_date: startDate,
        parent_id: null,
        start_time: null,
        end_time: null,
        preacher: preacher.trim() || null,
        sermon_title: sermonTitle.trim() || null,
        remarks: remarks.trim() || null,
        internal_notes: internalNotes.trim() || null,
        clarification:
          inKlaerung && clarification.trim() ? clarification.trim() : null,
        link: null,
        in_klaerung: inKlaerung,
        pco_id: null,
        besucherzahl: null,
        mail: null,
        attachments: attachmentsInput.trim() || null,
        ort: location.trim() || null,
        link_id: null,
        planning_level_ids: selectedPlanningLevelIds,
        category_ids: [gottesdienstCategory.id],
      };

      const createdParent = await createEventViaApi(parentPayload);
      const parentId =
        createdParent && typeof createdParent.id === "number"
          ? createdParent.id
          : null;

      if (!parentId) {
        throw new Error(
          "Parent-Event konnte nicht erstellt werden (keine ID).",
        );
      }

      // Child events for each time
      for (const t of godiTimes) {
        const childOverride = applyParentDetailsToAllGodiChildren
          ? null
          : (godiChildOverrides || {})[t];

        const childPreacher =
          (childOverride && typeof childOverride.preacher === "string"
            ? childOverride.preacher
            : preacher) || "";
        const childSermonTitle =
          (childOverride && typeof childOverride.sermonTitle === "string"
            ? childOverride.sermonTitle
            : sermonTitle) || "";
        const childRemarks =
          (childOverride && typeof childOverride.remarks === "string"
            ? childOverride.remarks
            : remarks) || "";
        const childInternalNotes =
          (childOverride && typeof childOverride.internalNotes === "string"
            ? childOverride.internalNotes
            : internalNotes) || "";

        const childInKlaerung =
          childOverride && typeof childOverride.inKlaerung === "boolean"
            ? childOverride.inKlaerung
            : inKlaerung;

        const childClarification = childInKlaerung
          ? (
              (childOverride && typeof childOverride.clarification === "string"
                ? childOverride.clarification
                : clarification) || ""
            ).trim() || null
          : null;

        const rawPco =
          childOverride && typeof childOverride.pcoId === "string"
            ? childOverride.pcoId
            : pcoId;

        const parsedPco =
          rawPco && rawPco.trim() ? parseInt(rawPco.trim(), 10) : NaN;
        const childPcoId = Number.isFinite(parsedPco) ? parsedPco : null;

        const childStartTime = t;
        const childEndTime = addMinutesToTime(t, 90);

        const childPayload: any = {
          title: buildGodiChildTitle(t),
          start_date: startDate,
          end_date: startDate,
          parent_id: parentId,
          start_time: childStartTime,
          end_time: childEndTime,
          preacher: childPreacher.trim() || null,
          sermon_title: childSermonTitle.trim() || null,
          remarks: childRemarks.trim() || null,
          internal_notes: childInternalNotes.trim() || null,
          clarification: childClarification,
          link: null,
          in_klaerung: !!childInKlaerung,
          pco_id: childPcoId,
          besucherzahl: null,
          mail: null,
          attachments: attachmentsInput.trim() || null,
          ort: location.trim() || null,
          link_id: null,
          planning_level_ids: selectedPlanningLevelIds,
          category_ids: [gottesdienstCategory.id],
        };

        await apiFetch("/events", {
          method: "POST",
          body: JSON.stringify(childPayload),
        } as any);
      }

	          notifyCreated();
	          onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des Gottesdienstes:", err);
      setSubmitError(
        "Der Gottesdienst konnte nicht angelegt werden. Bitte versuche es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachmentFileChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    // Wenn bereits ein Dokument erfolgreich hochgeladen und verlinkt wurde,
    // erlauben wir keine weitere Auswahl.
    if (attachmentsInput || attachmentUploadStatus === "success") {
      // Zur Sicherheit Eingabe zurücksetzen
      if (attachmentFileInputRef.current) {
        attachmentFileInputRef.current.value = "";
      }
      return;
    }

    const file =
      event.target.files && event.target.files[0]
        ? event.target.files[0]
        : null;
    setAttachmentFile(file);
    setAttachmentUploadStatus("idle");
    setAttachmentUploadError(null);
    // Wenn eine neue Datei gewählt wird, leeren wir zunächst den bisherigen Link
    setAttachmentsInput("");
  };

  const handleUploadAttachment = async (fileOverride?: File) => {
    const fileToUpload = fileOverride || attachmentFile;
    if (!fileToUpload) {
      setAttachmentUploadError("Bitte wähle zuerst eine Datei aus.");
      return;
    }

    try {
      setAttachmentUploadStatus("uploading");
      setAttachmentUploadError(null);

      const formData = new FormData();
      formData.append("file", fileToUpload);

      // Placeholder-Endpoint. Die eigentliche Nextcloud-Integration erfolgt im Backend.
      let response = await apiFetch("/nextcloud/predigtreihe-attachment", {
        method: "POST",
        body: formData,
      } as any);

      let data: any = response;
      if (data && typeof (data as any).json === "function") {
        try {
          data = await (data as any).json();
        } catch (jsonErr) {
          console.error("Fehler beim Parsen der Nextcloud-Antwort:", jsonErr);
        }
      }

      if (!data || typeof data.url !== "string") {
        throw new Error("Antwort enthält keine gültige URL.");
      }

      setAttachmentsInput(data.url);
      setAttachmentUploadStatus("success");
    } catch (err) {
      console.error("Fehler beim Hochladen des Dokuments nach Nextcloud:", err);
      setAttachmentUploadStatus("error");
      setAttachmentUploadError(
        "Das Dokument konnte nicht hochgeladen werden. Bitte versuche es später erneut.",
      );
    }
  };

  const handleCreateGottesdienstFolder = async () => {
    if (!startDate) {
      setGodiFolderError("Bitte zuerst ein Datum wählen.");
      setGodiFolderStatus("error");
      return;
    }

    const folderName = deriveGottesdienstFolderName(startDate);
    if (!folderName) {
      setGodiFolderError("Das Datum konnte nicht verarbeitet werden.");
      setGodiFolderStatus("error");
      return;
    }

    try {
      setGodiFolderStatus("creating");
      setGodiFolderError(null);

      const response = await apiFetch("/nextcloud/gottesdienst-folder", {
        method: "POST",
        body: JSON.stringify({
          base_dir: "/Gottesdienst",
          folder_name: folderName,
        }),
      } as any);

      let data: any = response;
      if (data && typeof (data as any).json === "function") {
        try {
          data = await (data as any).json();
        } catch (jsonErr) {
          console.error("Fehler beim Parsen der Nextcloud-Antwort:", jsonErr);
        }
      }

      if (!data || typeof data.url !== "string") {
        throw new Error("Antwort enthält keine gültige URL.");
      }

      setAttachmentsInput(data.url);
      setGodiFolderStatus("success");
      setGodiFolderCreatedForDate(startDate);
    } catch (err) {
      console.error(
        "Fehler beim Erstellen/Freigeben des Nextcloud-Ordners:",
        err,
      );
      setGodiFolderStatus("error");
      setGodiFolderError(
        "Der Ordner konnte nicht erstellt oder freigegeben werden. Bitte versuche es später erneut.",
      );
    }
  };

  const ensureBauspendeLinksForParents = async (
    parentIds: number[],
  ): Promise<Record<number, string> | null> => {
    if (!parentIds || parentIds.length === 0) return {};
    try {
      setBauspendeStatus("copying");
      setBauspendeError(null);

      const nextMap: Record<number, string> = {
        ...(bauspendeLinksByParentId || {}),
      };

      for (const pid of parentIds) {
        if (nextMap[pid]) continue;

        const parent = godisById.get(pid);
        const dateIso = (parent?.start_date ?? "").trim();
        if (!dateIso) {
          throw new Error(
            "Mindestens ein ausgewählter Gottesdienst hat kein Startdatum.",
          );
        }

        const folderName = deriveGottesdienstFolderName(dateIso);
        if (!folderName) {
          throw new Error(
            "Startdatum eines ausgewählten Gottesdienstes konnte nicht verarbeitet werden.",
          );
        }

        // Backend soll folgende Schritte erledigen:
        // 1) /Gottesdienst/00_Orga/Bauspende.png nach /Gottesdienst/MM_DD/Bauspende.png kopieren (ordner ggf. anlegen)
        // 2) Datei öffentlich teilen und die öffentliche URL zurückgeben
        const response = await apiFetch("/nextcloud/bauspende-copy", {
          method: "POST",
          body: JSON.stringify({
            source_path: "/Gottesdienst/00_Orga/Bauspende.png",
            target_dir: `/Gottesdienst/${folderName}`,
            target_filename: "Bauspende.png",
          }),
        } as any);

        let data: any = response;
        if (data && typeof (data as any).json === "function") {
          try {
            data = await (data as any).json();
          } catch (jsonErr) {
            console.error(
              "Fehler beim Parsen der Nextcloud-Antwort (Bauspende):",
              jsonErr,
            );
          }
        }

        if (!data || typeof data.url !== "string" || !data.url.trim()) {
          throw new Error(
            "Antwort enthält keine gültige öffentliche URL (Bauspende).",
          );
        }

        nextMap[pid] = data.url.trim();
      }

      setBauspendeLinksByParentId(nextMap);
      setBauspendeStatus("success");
      return nextMap;
    } catch (err) {
      console.error("Fehler beim Kopieren/Freigeben der Bauspende-Datei:", err);
      setBauspendeStatus("error");
      setBauspendeError(
        "Bauspende.png konnte nicht kopiert oder freigegeben werden. Bitte versuche es später erneut.",
      );
      return null;
    }
  };

  const handlePrepareBauspendeForSelection = async () => {
    if (!includeBauspendeImage) return;
    if (effectiveGodiTargetEventIds.length === 0) {
      setBauspendeError(
        "Bitte wähle zuerst mindestens einen Gottesdienst aus.",
      );
      setBauspendeStatus("error");
      return;
    }
    await ensureBauspendeLinksForParents(effectiveGodiTargetEventIds);
  };

  const handleAttachmentDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (attachmentsInput || attachmentUploadStatus === "success") {
      return;
    }
    setIsAttachmentDragOver(true);
  };

  const handleAttachmentDragLeave = (
    event: React.DragEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragOver(false);
  };

  const handleAttachmentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsAttachmentDragOver(false);

    if (attachmentsInput || attachmentUploadStatus === "success") {
      return;
    }

    const dt = event.dataTransfer;
    if (!dt || !dt.files || dt.files.length === 0) {
      return;
    }

    const file = dt.files[0];
    if (!file) {
      return;
    }

    // Datei aus Drop direkt auswählen und Upload anstoßen
    setAttachmentFile(file);
    setAttachmentUploadStatus("uploading");
    setAttachmentUploadError(null);
    setAttachmentsInput("");

    void handleUploadAttachment(file);
  };
  const getAttachmentLabel = () => {
    if (attachmentFile && attachmentFile.name) {
      return attachmentFile.name;
    }

    // For Gottesdienst-Ordner: do not show the cryptic share token, show the folder name instead.
    if (isGottesdienstCategory && startDate) {
      const folder = deriveGottesdienstFolderName(startDate);
      if (folder) {
        return `/Gottesdienst/${folder}`;
      }
    }

    if (attachmentsInput) {
      try {
        const url = new URL(attachmentsInput);
        const parts = url.pathname.split("/");
        const last = parts[parts.length - 1] || "";
        return last || "Dokument öffnen";
      } catch {
        const parts = attachmentsInput.split("/");
        const last = parts[parts.length - 1] || "";
        return last || "Dokument öffnen";
      }
    }
    return "Dokument öffnen";
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    if (!text) return false;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      return true;
    } catch (err) {
      console.error("Fehler beim Kopieren in die Zwischenablage:", err);
      return false;
    }
  };

  const handleCopyAttachmentLink = async () => {
    const text = attachmentsInput?.trim();
    if (!text) return;
    const ok = await copyTextToClipboard(text);
		setCopyAttachmentStatus(ok ? "success" : "error");
		setTimeout(() => setCopyAttachmentStatus("idle"), ok ? 2000 : 3000);
  };

  const handleRemoveAttachment = () => {
    setAttachmentsInput("");
    setAttachmentFile(null);
    setAttachmentUploadStatus("idle");
    setAttachmentUploadError(null);
    setCopyAttachmentStatus("idle");
    setGodiFolderStatus("idle");
    setGodiFolderError(null);
    setGodiFolderCreatedForDate(null);
    if (attachmentFileInputRef.current) {
      attachmentFileInputRef.current.value = "";
    }
  };

  const createEventViaApi = async (payload: any) => {
    // Ensure: every event that has category "Gottesdienst" receives planning level "Predigtplanung" by default.
    // This must apply regardless of hierarchy.
    const gottesdienstCategoryId = categories.find(
      (c) => (c.name || "").trim().toLowerCase() === "gottesdienst",
    )?.id;
    const predigtplanungLevelId = planningLevels.find(
      (pl) => (pl.name || "").trim().toLowerCase() === "predigtplanung",
    )?.id;

    let normalizedPayload: any = payload;
    if (
      typeof gottesdienstCategoryId === "number" &&
      typeof predigtplanungLevelId === "number" &&
      Array.isArray(payload?.category_ids) &&
      payload.category_ids.includes(gottesdienstCategoryId)
    ) {
      const existing = Array.isArray(payload?.planning_level_ids)
        ? payload.planning_level_ids.filter((v: any) => typeof v === "number")
        : [];
      const merged = Array.from(new Set([...existing, predigtplanungLevelId]));
      normalizedPayload = { ...payload, planning_level_ids: merged };
    }

    const response = await apiFetch("/events", {
      method: "POST",
      body: JSON.stringify(normalizedPayload),
    } as any);

    let data: any = response;
    if (data && typeof (data as any).json === "function") {
      try {
        data = await (data as any).json();
      } catch (jsonErr) {
        console.error("Fehler beim Parsen der Event-Antwort:", jsonErr);
      }
    }
    return data;
  };

  const handleCreateGodiChild = async () => {
    if (!selectedCategory) {
      setSubmitError("Es ist keine Kategorie ausgewählt.");
      return;
    }

    if (effectiveGodiTargetEventIds.length === 0) {
      setSubmitError("Bitte wähle mindestens einen Gottesdienst aus.");
      return;
    }

    const isGastpredigerForValidation =
      selectedCategory?.name?.trim().toLowerCase() === "gastprediger";

    // Gastprediger: Mail is a single shared field (no per-parent overrides)
    if (isGastpredigerForValidation) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const trimmedMail = mail.trim();
      if (!trimmedMail) {
        setSubmitError(
          "Bitte eine E-Mail-Adresse für den Gastprediger eingeben.",
        );
        return;
      }
      if (!emailRegex.test(trimmedMail)) {
        setSubmitError("Bitte eine gültige E-Mail-Adresse eingeben.");
        return;
      }
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const selectedParents = gottesdienstEvents.filter((ev) =>
        effectiveGodiTargetEventIds.includes(ev.id),
      );

      // Kollekte: optional Bauspende image in Nextcloud per selected Gottesdienst
      let bauspendeLinksForRun: Record<number, string> | null = null;
      if (isKollekteGodiChild && includeBauspendeImage) {
        bauspendeLinksForRun = await ensureBauspendeLinksForParents(
          effectiveGodiTargetEventIds,
        );
        if (!bauspendeLinksForRun) {
          setSubmitting(false);
          return;
        }
      }

      // Predigtreihe (Godi-Child): create one master "Predigtreihe" event and link
      // all created children (which are attached to each selected Gottesdienst)
      // to that master via the "link" field. The children inherit all non-schedule
      // data from the master.
      let predigtreiheMasterId: number | null = null;
      if (isPredigtreiheGodiChild) {
        if (!startDate) {
          setSubmitError("Bitte Startdatum für die Predigtreihe wählen.");
          setSubmitting(false);
          return;
        }

        const effectiveRemarksForMaster =
          applyDetailsToAllChildren && remarks.trim() ? remarks.trim() : null;
        const effectiveInternalNotesForMaster =
          applyDetailsToAllChildren && internalNotes.trim()
            ? internalNotes.trim()
            : null;
        const effectiveInKlaerungForMaster = applyDetailsToAllChildren
          ? inKlaerung
          : false;
        const effectiveClarificationForMaster =
          applyDetailsToAllChildren &&
          effectiveInKlaerungForMaster &&
          clarification.trim()
            ? clarification.trim()
            : null;

        const trimmedTitle = title.trim();
        let masterTitle: string;
        if (trimmedTitle) {
          masterTitle = trimmedTitle.toLowerCase().startsWith("predigtreihe:")
            ? trimmedTitle
            : `Predigtreihe: ${trimmedTitle}`;
        } else {
          masterTitle = selectedCategory.name;
        }

        const effectiveAttachmentsForMaster = attachmentsInput.trim()
          ? attachmentsInput.trim()
          : null;

        let masterPlanningLevelIds: number[] = [];
        const predigtplanung = planningLevels.find(
          (pl) => pl.name && pl.name.trim().toLowerCase() === "predigtplanung",
        );
        const predigtplanungId: number | null =
          predigtplanung && typeof predigtplanung.id === "number"
            ? predigtplanung.id
            : null;
        if (predigtplanungId) {
          masterPlanningLevelIds = [predigtplanungId];
        }

        const masterPayload: any = {
          title: masterTitle,
          start_date: startDate,
          end_date: endDate || startDate,
          parent_id: null,
          start_time: null,
          end_time: null,
          preacher: null,
          sermon_title: null,
          remarks: effectiveRemarksForMaster,
          internal_notes: effectiveInternalNotesForMaster,
          clarification: effectiveClarificationForMaster,
          link: null,
          in_klaerung: effectiveInKlaerungForMaster,
          pco_id: null,
          besucherzahl: null,
          mail: null,
          attachments: effectiveAttachmentsForMaster,
          ort: null,
          link_id: null,
          planning_level_ids: masterPlanningLevelIds,
          category_ids: selectedCategoryIdsForEvent.length
            ? selectedCategoryIdsForEvent
            : [selectedCategory.id],
        };

        const createdMaster = await createEventViaApi(masterPayload);
        if (!createdMaster || typeof createdMaster.id !== "number") {
          setSubmitError(
            "Die Predigtreihe konnte nicht als Master-Event angelegt werden.",
          );
          setSubmitting(false);
          return;
        }
        predigtreiheMasterId = createdMaster.id;

        // Predigtreihe: do not create child events. Instead, link all selected Gottesdienst events
        // to the newly created Predigtreihe master via link_id.
        // Root-cause fix: some backends validate PUT bodies as full-update payloads.
        // Therefore, we fetch each parent event first and PUT the complete object with link_id set.
        if (predigtreiheMasterId) {
          for (const parent of selectedParents) {
            try {
              const existingParent: any = await apiFetch(
                `/events/${parent.id}`,
              );

              const extractCategoryIds = (obj: any): number[] => {
                if (!obj) return [];
                if (Array.isArray(obj.category_ids))
                  return obj.category_ids.filter(
                    (v: any) => typeof v === "number",
                  );
                if (Array.isArray(obj.categories)) {
                  return obj.categories
                    .map((c: any) =>
                      c && typeof c.id === "number" ? c.id : null,
                    )
                    .filter((v: any) => typeof v === "number");
                }
                // Fallback for alternative shapes
                if (Array.isArray(obj.event_categories)) {
                  return obj.event_categories
                    .map((ec: any) =>
                      ec && typeof ec.category_id === "number"
                        ? ec.category_id
                        : null,
                    )
                    .filter((v: any) => typeof v === "number");
                }
                return [];
              };

              const extractPlanningLevelIds = (obj: any): number[] => {
                if (!obj) return [];
                if (Array.isArray(obj.planning_level_ids)) {
                  return obj.planning_level_ids.filter(
                    (v: any) => typeof v === "number",
                  );
                }
                if (Array.isArray(obj.planning_levels)) {
                  return obj.planning_levels
                    .map((pl: any) =>
                      pl && typeof pl.id === "number" ? pl.id : null,
                    )
                    .filter((v: any) => typeof v === "number");
                }
                if (Array.isArray(obj.event_planning_levels)) {
                  return obj.event_planning_levels
                    .map((epl: any) =>
                      epl && typeof epl.planning_level_id === "number"
                        ? epl.planning_level_id
                        : null,
                    )
                    .filter((v: any) => typeof v === "number");
                }
                return [];
              };

              // We must never change categories/planning-levels on the selected Gottesdienst events.
              // However, some backends treat PUT as full replacement. Therefore we provide the
              // existing IDs to preserve relationships. We are defensive about the response shape
              // and fall back to what we already have in-memory.

              const fallbackCategoryIdsFromParent: number[] =
                extractCategoryIds(parent);

              const fallbackPlanningLevelIdsFromParent: number[] =
                extractPlanningLevelIds(parent);

              const existingCategoryIds: number[] =
                extractCategoryIds(existingParent);

              const existingPlanningLevelIds: number[] =
                extractPlanningLevelIds(existingParent);

              const preservedCategoryIds: number[] = existingCategoryIds.length
                ? existingCategoryIds
                : fallbackCategoryIdsFromParent;

              let preservedPlanningLevelIds: number[] =
                existingPlanningLevelIds.length
                  ? existingPlanningLevelIds
                  : fallbackPlanningLevelIdsFromParent;

              // Requirement: add "Predigtplanung" planning level to the selected Gottesdienst events
              // (parent/grandparent selections) while preserving existing planning levels.
              if (predigtplanungId) {
                if (!Array.isArray(preservedPlanningLevelIds))
                  preservedPlanningLevelIds = [];
                if (!preservedPlanningLevelIds.includes(predigtplanungId)) {
                  preservedPlanningLevelIds = [
                    ...preservedPlanningLevelIds,
                    predigtplanungId,
                  ];
                }
              }

              const updatePayload: any = {
                ...existingParent,
                link_id: predigtreiheMasterId,
                // Ensure IDs are present for many-to-many relationships.
                category_ids: preservedCategoryIds,
                planning_level_ids: preservedPlanningLevelIds,
              };

              // Extra safety: never send empty arrays that might wipe existing relationships.
              // If we couldn't reliably determine IDs, omit the field so we don't clear it.
              if (!preservedCategoryIds.length) {
                delete updatePayload.category_ids;
              }
              if (!preservedPlanningLevelIds.length) {
                // Note: if predigtplanungId exists, preservedPlanningLevelIds would not be empty.
                delete updatePayload.planning_level_ids;
              }

              // Remove nested objects that the backend might not accept on update.
              delete updatePayload.categories;
              delete updatePayload.planning_levels;

              await apiFetch(`/events/${parent.id}`, {
                method: "PUT",
                body: JSON.stringify(updatePayload),
              });
            } catch (updErr) {
              console.error(
                "Fehler beim Verlinken des Gottesdienstes mit der Predigtreihe:",
                updErr,
              );
            }
          }
	      notifyCreated();
	      onClose();
          return;
        }
      }

      // Taufe (Godi-Child): if the user wants the additional preparation event,
      // create at most ONE preparation event per Taufe-day (even if multiple
      // Taufe children are created for the same date).
      const taufePrepEventIdByTaufeDate: Record<string, number> = {};

      for (const parent of selectedParents) {
        const usePerParent =
          !applyDetailsToAllChildren && selectedParents.length > 1;
        const perParentDetails = usePerParent
          ? (godiChildDetailsByParentId || {})[parent.id] || {}
          : {};
        const effectiveRemarks = usePerParent
          ? typeof perParentDetails.remarks === "string" &&
            perParentDetails.remarks.trim()
            ? perParentDetails.remarks.trim()
            : null
          : applyDetailsToAllChildren && remarks.trim()
            ? remarks.trim()
            : null;

        const effectiveInternalNotes = usePerParent
          ? typeof perParentDetails.internalNotes === "string" &&
            perParentDetails.internalNotes.trim()
            ? perParentDetails.internalNotes.trim()
            : null
          : applyDetailsToAllChildren && internalNotes.trim()
            ? internalNotes.trim()
            : null;

        const effectiveInKlaerung = usePerParent
          ? !!perParentDetails.inKlaerung
          : applyDetailsToAllChildren
            ? inKlaerung
            : false;

        const effectiveClarification = usePerParent
          ? effectiveInKlaerung &&
            typeof perParentDetails.clarification === "string" &&
            perParentDetails.clarification.trim()
            ? perParentDetails.clarification.trim()
            : null
          : applyDetailsToAllChildren &&
              effectiveInKlaerung &&
              clarification.trim()
            ? clarification.trim()
            : null;

        let childTitle: string;
        if (isPredigtreiheGodiChild) {
          const trimmedTitle = title.trim();
          if (trimmedTitle) {
            if (trimmedTitle.toLowerCase().startsWith("predigtreihe:")) {
              childTitle = trimmedTitle;
            } else {
              childTitle = `Predigtreihe: ${trimmedTitle}`;
            }
          } else {
            childTitle = selectedCategory.name;
          }
        } else if (hasCustomTitleGodiChild && title.trim()) {
          childTitle = title.trim();
        } else {
          childTitle = selectedCategory.name;
        }

        let childStartDate = parent.start_date;
        let childEndDate = parent.end_date ?? parent.start_date;
        let childStartTime = parent.start_time ?? null;
        let childEndTime = parent.end_time ?? null;

        if (
          isEndTimeBeforeStartTime(
            childStartDate,
            childEndDate,
            childStartTime,
            childEndTime,
          )
        ) {
          setSubmitError("Die Endzeit darf nicht vor der Startzeit liegen.");
          setSubmitting(false);
          return;
        }

        const effectiveAttachments =
          isPredigtreiheGodiChild && attachmentsInput.trim()
            ? attachmentsInput.trim()
            : null;

        const bauspendeAttachmentForParent =
          isKollekteGodiChild && includeBauspendeImage
            ? (bauspendeLinksForRun && bauspendeLinksForRun[parent.id]
                ? bauspendeLinksForRun[parent.id]
                : (bauspendeLinksByParentId || {})[parent.id]) || null
            : null;

        let planningLevelIds: number[] = [];
        if (isPredigtreiheGodiChild || isGastpredigerGodiChild) {
          const predigtplanung = planningLevels.find(
            (pl) =>
              pl.name && pl.name.trim().toLowerCase() === "predigtplanung",
          );
          if (predigtplanung) {
            planningLevelIds = [predigtplanung.id];
          }
        }

        const payload: any = {
          title: childTitle,
          start_date: childStartDate,
          end_date: childEndDate,
          parent_id: parent.id,
          start_time: childStartTime,
          end_time: childEndTime,
          preacher: null,
          sermon_title: null,
          remarks: effectiveRemarks,
          internal_notes: effectiveInternalNotes,
          clarification: effectiveClarification,
          link:
            isPredigtreiheGodiChild && predigtreiheMasterId
              ? String(predigtreiheMasterId)
              : null,
          in_klaerung: effectiveInKlaerung,
          pco_id: null,
          besucherzahl: null,
          mail: isGastpredigerGodiChild ? mail.trim() : null,
          attachments: bauspendeAttachmentForParent || effectiveAttachments,
          ort: null,
          link_id: null,
          planning_level_ids: planningLevelIds,
          category_ids: selectedCategoryIdsForEvent.length
            ? selectedCategoryIdsForEvent
            : [selectedCategory.id],
        };

        // IMPORTANT:
        // Do NOT mutate the parent "Gottesdienst" categories when creating a Godi-child element.
        // (Child elements must not add their category to the parent event.)

        if (isTaufeGodiChild) {
          // Zuerst das eigentliche Taufe-Element anlegen
          const createdChild = await createEventViaApi(payload);
          const taufeChildId =
            createdChild && typeof createdChild.id === "number"
              ? createdChild.id
              : null;

          if (createTaufeStageEvent) {
            const taufeDateKey = childStartDate || "";

            // If there is already a preparation event for this Taufe-day, only link
            // the newly created Taufe-child to that existing preparation event.
            if (taufeDateKey && taufePrepEventIdByTaufeDate[taufeDateKey]) {
              const existingStageId = taufePrepEventIdByTaufeDate[taufeDateKey];
              if (taufeChildId) {
                try {
                  await apiFetch(`/events/${taufeChildId}`, {
                    method: "PUT",
                    body: JSON.stringify({ link_id: existingStageId }),
                  } as any);
                } catch (linkErr) {
                  console.error(
                    "Fehler beim Aktualisieren der Link-ID für das Taufe-Element:",
                    linkErr,
                  );
                }
              }
            } else {
              // Datum für den Umbau-Termin: vier Tage vor der Taufe
              let stageStartDate = childStartDate;
              if (childStartDate) {
                const baseDate = new Date(childStartDate as any);
                if (!isNaN(baseDate.getTime())) {
                  baseDate.setDate(baseDate.getDate() - 4);
                  const yyyy = baseDate.getFullYear();
                  const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
                  const dd = String(baseDate.getDate()).padStart(2, "0");
                  stageStartDate = `${yyyy}-${mm}-${dd}`;
                }
              }

              const taufeCategory = categories.find(
                (c) => c.name && c.name.trim().toLowerCase() === "taufe",
              );
              const lobpreisLevel = planningLevels.find(
                (pl) => pl.name && pl.name.trim().toLowerCase() === "lobpreis",
              );
              const technikLevel = planningLevels.find(
                (pl) => pl.name && pl.name.trim().toLowerCase() === "technik",
              );

              const stagePlanningLevelIds: number[] = [];
              if (lobpreisLevel) stagePlanningLevelIds.push(lobpreisLevel.id);
              if (technikLevel) stagePlanningLevelIds.push(technikLevel.id);

              const stagePayload: any = {
                title: "Bühne für Taufe umbauen",
                start_date: stageStartDate || childStartDate,
                end_date: stageStartDate || childStartDate,
                parent_id: null,
                start_time: "21:00",
                end_time: "21:30",
                preacher: null,
                sermon_title: null,
                remarks: effectiveRemarks,
                internal_notes: effectiveInternalNotes,
                clarification: effectiveClarification,
                link:
                  isPredigtreiheGodiChild && predigtreiheMasterId
                    ? String(predigtreiheMasterId)
                    : null,
                in_klaerung: effectiveInKlaerung,
                pco_id: null,
                besucherzahl: null,
                mail: null,
                attachments: null,
                ort: null,
                link_id: taufeChildId,
                planning_level_ids: stagePlanningLevelIds,
                category_ids: taufeCategory
                  ? [taufeCategory.id]
                  : [selectedCategory.id],
              };

              const createdStageEvent = await createEventViaApi(stagePayload);
              const stageId =
                createdStageEvent && typeof createdStageEvent.id === "number"
                  ? createdStageEvent.id
                  : null;

              if (taufeDateKey && stageId) {
                taufePrepEventIdByTaufeDate[taufeDateKey] = stageId;
              }

              if (taufeChildId && stageId) {
                try {
                  await apiFetch(`/events/${taufeChildId}`, {
                    method: "PUT",
                    body: JSON.stringify({ link_id: stageId }),
                  } as any);
                } catch (linkErr) {
                  console.error(
                    "Fehler beim Aktualisieren der Link-ID für das Taufe-Element:",
                    linkErr,
                  );
                }
              }
            }
          }
        } else {
          await apiFetch("/events", {
            method: "POST",
            body: JSON.stringify(payload),
          } as any);
        }
      }

      // Gastprediger: If a selected parent Gottesdienst has no preacher set yet,
      // fill it with the Gastprediger title (name) from this form.
      // Additionally, propagate to the grandparent event (one level above each selected parent)
      // if it also has no preacher set yet.
      if (isGastpredigerGodiChild) {
        const gastpredigerName = title.trim();
        if (gastpredigerName) {
          const grandParentIds = new Set<number>();
          for (const parent of selectedParents) {
            const existingPreacher =
              typeof (parent as any).preacher === "string"
                ? String((parent as any).preacher)
                : "";
            if (!existingPreacher.trim()) {
              try {
                await apiFetch(`/events/${parent.id}`, {
                  method: "PUT",
                  body: JSON.stringify({ preacher: gastpredigerName }),
                } as any);
              } catch (updErr) {
                console.error(
                  "Fehler beim Setzen des Predigers im Eltern-Gottesdienst:",
                  updErr,
                );
              }
            }

            const gpId = (parent as any)?.parent_id;
            if (typeof gpId === "number" && gpId > 0) {
              grandParentIds.add(gpId);
            }
          }

          // Update grandparent(s) only if empty (do not overwrite existing data)
          for (const gpId of Array.from(grandParentIds)) {
            try {
              const gp = await apiFetch(`/events/${gpId}`, {
                method: "GET",
              } as any);
              const gpPreacher =
                typeof (gp as any)?.preacher === "string"
                  ? String((gp as any).preacher)
                  : "";
              if (!gpPreacher.trim()) {
                await apiFetch(`/events/${gpId}`, {
                  method: "PUT",
                  body: JSON.stringify({ preacher: gastpredigerName }),
                } as any);
              }
            } catch (gpErr) {
              console.error(
                "Fehler beim Setzen des Predigers im Großeltern-Event:",
                gpErr,
              );
            }
          }
        }
      }

      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des Gottesdienst-Elements:", err);
      setSubmitError(
        "Das Gottesdienst-Element konnte nicht angelegt werden. Bitte versuche es erneut.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const changeMonth = (delta: number, source: "start" | "end" | "single") => {
    if (source === "start") {
      setStartCalendarMonth((prev) => {
        const year = prev.getFullYear();
        const month = prev.getMonth();
        const next = new Date(year, month + delta, 1);
        // Beim Navigieren im Start-Kalender den End-Kalender mitziehen
        setEndCalendarMonth(() => next);
        return next;
      });
    } else if (source === "end") {
      setEndCalendarMonth((prev) => {
        const base = prev || startCalendarMonth;
        const year = base.getFullYear();
        const month = base.getMonth();
        return new Date(year, month + delta, 1);
      });
    } else {
      // "single"-Kalender (einzelnes Datum) verwenden den Start-Kalenderzustand
      setStartCalendarMonth((prev) => {
        const year = prev.getFullYear();
        const month = prev.getMonth();
        return new Date(year, month + delta, 1);
      });
    }
  };

  const formatHeaderDateLabel = (value: string) => {
    if (!value) {
      return "Datum wählen";
    }
    const dateObj = new Date(value as any);
    if (isNaN(dateObj.getTime())) {
      return value;
    }
    return dateObj.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
  };

  const renderCalendar = (
    selectedValue: string | null,
    onSelect: (value: string) => void,
    source: "start" | "end" | "single" = "single",
  ) => {
    const activeMonth =
      source === "end" && endCalendarMonth
        ? endCalendarMonth
        : startCalendarMonth;
    const year = activeMonth.getFullYear();
    const monthIndex = activeMonth.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    // Wochentag des ersten Tages (Montag = 1, Sonntag = 7)
    const firstDay = new Date(year, monthIndex, 1);
    let startWeekday = firstDay.getDay(); // 0 (Sonntag) - 6 (Samstag)
    if (startWeekday === 0) {
      startWeekday = 7; // Sonntag als 7 behandeln
    }
    const leadingEmpty = startWeekday - 1;

    // Immer 6 Wochen rendern (6 * 7 = 42 Zellen), damit die Höhe konstant bleibt
    const totalSlots = 42;
    const slots: (number | null)[] = Array.from(
      { length: totalSlots },
      (_, index) => {
        const dayNumber = index - leadingEmpty + 1;
        if (dayNumber < 1 || dayNumber > daysInMonth) {
          return null;
        }
        return dayNumber;
      },
    );

    const monthName = activeMonth.toLocaleDateString("de-DE", {
      month: "long",
    });
    const yearLabel = activeMonth.getFullYear();

    const today = new Date();
    const todayValue = (() => {
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      return `${today.getFullYear()}-${mm}-${dd}`;
    })();

    const formatDate = (y: number, mIndex: number, d: number) => {
      const mm = String(mIndex + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    };

    // Bereich (z. B. Ferien / Predigtreihe / erweiterte Events) optisch hervorheben
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    if (startDate && endDate) {
      const rs = new Date(startDate as any);
      const re = new Date(endDate as any);
      if (!isNaN(rs.getTime()) && !isNaN(re.getTime())) {
        if (rs <= re) {
          rangeStart = rs;
          rangeEnd = re;
        } else {
          rangeStart = re;
          rangeEnd = rs;
        }
      }
    }

    return (
      <div
        className="cgb-cew-root"
        style={{
          borderRadius: "8px",
          border: "1px solid #e0e4f0",
          padding: "14px 16px 16px",
          backgroundColor: "#f9fafc",
          minHeight: "305px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* (styles are injected once at the main wizard root below) */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "6px",
              fontSize: "13px",
              textTransform: "capitalize",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                color: "#111827",
              }}
            >
              {monthName}
            </span>
            <span
              style={{
                color: "#6b7280",
                fontSize: "12px",
              }}
            >
              {yearLabel}
            </span>
          </div>
          <div
            style={{
              display: "inline-flex",
              gap: "6px",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              onClick={() => changeMonth(-1, source)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "999px",
                border: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
                fontSize: "12px",
                color: "#6b7280",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => changeMonth(1, source)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "999px",
                border: "1px solid #cbd5f5",
                backgroundColor: "#eef2ff",
                fontSize: "12px",
                color: "#4338ca",
                cursor: "pointer",
                padding: 0,
              }}
            >
              ›
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "4px",
            fontSize: "11px",
            marginBottom: "6px",
            textAlign: "center",
            color: "#9ca3af",
          }}
        >
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
            <div
              key={label}
              style={{
                fontWeight: 500,
                padding: "4px 0",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "2px",
            fontSize: "13px",
            flexGrow: 1,
          }}
        >
          {slots.map((dayNumber, index) => {
            if (dayNumber == null) {
              return (
                <div
                  key={index}
                  style={{
                    height: "36px",
                  }}
                />
              );
            }

            const value = formatDate(year, monthIndex, dayNumber);
            const isSelected = selectedValue === value;
            const isToday = value === todayValue;

            const dateObj = new Date(value as any);
            const isInRange =
              rangeStart &&
              rangeEnd &&
              !isNaN(dateObj.getTime()) &&
              dateObj >= rangeStart &&
              dateObj <= rangeEnd;

            const isRangeEdge =
              isInRange && (value === startDate || value === endDate);

            const weekday = new Date(year, monthIndex, dayNumber).getDay(); // 0 So, 6 Sa
            const isWeekend = weekday === 0 || weekday === 6;

            let dayTextColor = "#111827";
            if (isWeekend) {
              dayTextColor = "#ef4444";
            }

            const isRangeMiddle = isInRange && !isRangeEdge;

            let buttonBorder = "1px solid transparent";
            let buttonBackground = "#ffffff";
            let buttonColor = dayTextColor;
            let buttonShadow = "none";

            if (isRangeMiddle) {
              buttonBackground = "transparent";
              buttonBorder = "1px solid transparent";
            } else if (isSelected || isRangeEdge) {
              buttonBackground = "#2563eb";
              buttonBorder = "1px solid #4338ca";
              buttonColor = "#ffffff";
              buttonShadow = "0 8px 18px rgba(37, 99, 235, 0.35)";
            } else if (isToday) {
              buttonBackground = "#eff6ff";
              buttonBorder = "1px solid #93c5fd";
            }

            return (
              <div
                key={value}
                style={{
                  position: "relative",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isRangeMiddle ? "#e5f0ff" : "transparent",
                  borderRadius: isRangeMiddle ? "8px" : "999px",
                }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(value)}
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "999px",
                    border: buttonBorder,
                    backgroundColor: buttonBackground,
                    color: buttonColor,
                    cursor: "pointer",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: buttonShadow,
                    padding: 0,
                  }}
                >
                  {dayNumber}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const renderCategoryButton = (category: Category) => {
    const isSelected = selectedCategoryId === category.id;
    const isHovered = hoveredCategoryId === category.id;
    const bgColor = category.color_hex || "#f3f4f6";

    return (
      <button
        key={category.id}
        type="button"
        onClick={() => handleSelectCategory(category.id)}
        onMouseEnter={() => setHoveredCategoryId(category.id)}
        onMouseLeave={() =>
          setHoveredCategoryId((prev) => (prev === category.id ? null : prev))
        }
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "12px",
          padding: "12px 14px",
          borderRadius: "12px",
          border: isSelected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
          backgroundColor: isSelected
            ? "#eef2ff"
            : isHovered
              ? "#f9fafb"
              : "#ffffff",
          cursor: "pointer",
          textAlign: "left",
          transition:
            "box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease",
          boxShadow: isSelected
            ? "0 4px 10px rgba(79, 70, 229, 0.18)"
            : isHovered
              ? "0 3px 8px rgba(15, 23, 42, 0.12)"
              : "0 1px 3px rgba(15, 23, 42, 0.08)",
          transform: isHovered && !isSelected ? "translateY(-1px)" : "none",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: "36px",
            height: "36px",
            borderRadius: "999px",
            backgroundColor: bgColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "18px",
          }}
        >
          {category.symbol || "?"}
        </div>
        <div
          style={{
            flex: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {category.name}
          </div>
          {category.description && (
            <div
              style={{
                marginTop: "2px",
                fontSize: "12px",
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {category.description}
            </div>
          )}
        </div>
      </button>
    );
  };

  const titlePlaceholder = isFeiertag
    ? "z. B. Reformationstag"
    : isFerien
      ? "z. B. Sommerferien"
      : usesExtendedForm
        ? isAlphaCategory
          ? "Alpha Kurs"
          : "Titel des Events"
        : "Titel deines Events";

  // For non-Gottesdienst-child events we use a general submit label.
  // (Gottesdienst-Element keeps its dedicated label.)
  const extendedSubmitLabel = "Event anlegen";

  const stripEventIdFromTitle = (raw: string): string => {
    const t = (raw ?? "").trim();
    // Only strip very explicit trailing id patterns to avoid harming legitimate titles.
    return t
      .replace(/\s*\(#\d+\)\s*$/g, "")
      .replace(/\s*#\d+\s*$/g, "")
      .trim();
  };

  const renderGodiSelectionRow = (
    ev: EventSummary,
    _depth: number,
  ): React.ReactElement[] => {
    const isSelectableRoot =
      !predigtreiheVisibleGodiIds || predigtreiheVisibleGodiIds.has(ev.id);
    const checked = isSelectableRoot && selectedParentEventIds.includes(ev.id);
    const kids = (godiChildrenByParentId.get(ev.id) ?? [])
      .slice()
      .filter((k) =>
        !predigtreiheVisibleGodiIds
          ? true
          : predigtreiheVisibleGodiIds.has(k.id),
      );
    const hasChildren = kids.length > 0;

    const dateLabel = ev.start_date
      ? new Date(ev.start_date).toLocaleDateString(undefined, {
          weekday: "short",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
      : "Ohne Datum";

    const timeLabel =
      ev.start_time && typeof ev.start_time === "string"
        ? ev.start_time.substring(0, 5)
        : "";

    const badgeBg = gottesdienstCategoryForStyle?.color_hex || "#F6E7B0";
    const badgeText = getReadableTextColor(badgeBg);
    const badgeSymbol =
      (gottesdienstCategoryForStyle?.symbol ?? "").trim() || "⛪";

    const row = (
      <div
        key={`godi-opt-${ev.id}`}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          padding: "8px 10px",
          borderRadius: "12px",
          border: checked ? "1px solid #4f46e5" : "1px solid #e5e7eb",
          backgroundColor: checked ? "#eef2ff" : "#ffffff",
          cursor: isSelectableRoot ? "pointer" : "default",
          boxShadow: checked
            ? "0 4px 10px rgba(79, 70, 229, 0.12)"
            : "0 1px 3px rgba(15, 23, 42, 0.06)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "#c7d2fe";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = checked
            ? "#4f46e5"
            : "#e5e7eb";
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isSelectableRoot) return;
          if (hasChildren) {
            handleToggleGodiParentSelection(ev.id, !checked);
          } else {
            handleToggleGodiSingleSelection(ev.id, !checked);
          }
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={!isSelectableRoot}
          onChange={(e) => {
            const nextChecked = e.target.checked;
            if (!isSelectableRoot) return;
            if (hasChildren) {
              handleToggleGodiParentSelection(ev.id, nextChecked);
            } else {
              handleToggleGodiSingleSelection(ev.id, nextChecked);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ marginTop: "6px" }}
        />

        <div
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "999px",
            backgroundColor: badgeBg,
            // 3D effect: match the Gottesdienst badge style in App.extended.tsx (light shadow + subtle highlight)
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)",
            backgroundImage:
              "linear-gradient(to bottom, rgba(255,255,255,0.18), rgba(255,255,255,0))",
            transform: "translateZ(0)",
            color: badgeText,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "16px",
            flexShrink: 0,
            marginTop: "1px",
          }}
          title="Gottesdienst"
        >
          {badgeSymbol}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            minWidth: 0,
            flex: 1,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              color: "#0f172a",
              fontSize: "13px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={stripEventIdFromTitle(ev.title)}
          >
            {stripEventIdFromTitle(ev.title)}
          </span>

          <div style={{ fontSize: "11px", color: "#475569" }}>
            {dateLabel}
            {timeLabel ? `, ${timeLabel} Uhr` : ""}
          </div>

          {hasChildren && (
            <div
              style={{
                marginTop: "6px",
                display: "flex",
                flexWrap: "wrap",
                gap: "6px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {kids.map((child) => {
                const childChecked = selectedParentEventIds.includes(child.id);
                const childTime =
                  child.start_time && typeof child.start_time === "string"
                    ? child.start_time.substring(0, 5)
                    : "";
                const childLabel = childTime
                  ? childTime
                  : stripEventIdFromTitle(child.title);

                return (
                  <button
                    key={`godi-pill-${ev.id}-${child.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGodiSingleSelection(child.id, !childChecked);
                    }}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "999px",
                      border: childChecked
                        ? "1px solid #4f46e5"
                        : "1px solid #d1d5db",
                      backgroundColor: childChecked ? "#eef2ff" : "#ffffff",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#111827",
                      fontWeight: 600,
                    }}
                    title={stripEventIdFromTitle(child.title)}
                  >
                    {childLabel}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );

    return [row];
  };

  return (
    <div
      className="cgb-cew-root"
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        // Outer modal already provides spacing; avoid excessive white space here
        padding: "0px",
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        /* Button hover/active affordance (wizard-wide) */
        .cgb-cew-root button:not(:disabled):not(.cgb-cew-toggle),
        .cgb-cew-root [role="button"]:not([aria-disabled="true"]):not(.cgb-cew-toggle),
        .cgb-cew-root a.cgb-cew-link-button:not(.disabled) {
          cursor: pointer;
          will-change: transform, box-shadow, filter, background-image;
          transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease, background-image 0.15s ease;
        }
        .cgb-cew-root button:not(:disabled):not(.cgb-cew-toggle):hover,
        .cgb-cew-root [role="button"]:not([aria-disabled="true"]):not(.cgb-cew-toggle):hover,
        .cgb-cew-root a.cgb-cew-link-button:not(.disabled):hover {
          filter: brightness(1.06) !important;
          box-shadow: 0 10px 22px rgba(0,0,0,0.16) !important;
          transform: translateY(-2px) !important;
          background-image: linear-gradient(rgba(255,255,255,0.14), rgba(255,255,255,0.14)) !important;
        }
        .cgb-cew-root button:not(:disabled):not(.cgb-cew-toggle):active,
        .cgb-cew-root [role="button"]:not([aria-disabled="true"]):not(.cgb-cew-toggle):active,
        .cgb-cew-root a.cgb-cew-link-button:not(.disabled):active {
          transform: translateY(-1px) !important;
          box-shadow: 0 8px 18px rgba(0,0,0,0.14) !important;
          filter: brightness(1.04) !important;
        }
        .cgb-cew-root button:focus-visible:not(.cgb-cew-toggle),
        .cgb-cew-root [role="button"]:focus-visible:not(.cgb-cew-toggle),
        .cgb-cew-root a.cgb-cew-link-button:focus-visible {
          outline: 2px solid rgba(79, 70, 229, 0.55);
          outline-offset: 2px;
        }

        /* Toggle stability: never apply global button lift/shadow/filter or focus outlines */
        .cgb-cew-root .cgb-cew-toggle,
        .cgb-cew-root .cgb-cew-toggle:hover,
        .cgb-cew-root .cgb-cew-toggle:active,
        .cgb-cew-root .cgb-cew-toggle:focus,
        .cgb-cew-root .cgb-cew-toggle:focus-visible {
          transform: none !important;
          filter: none !important;
          outline: none !important;
          background-image: none !important;
          /* Preserve the toggle's own inset shadow to avoid any visual "jump" on click */
          box-shadow: inset 0 0 0 1px rgba(0,0,0,0.02) !important;
        }

        /* Unified focus style for all text inputs (match Titel input) */
        .cgb-cew-root input:focus,
        .cgb-cew-root textarea:focus,
        .cgb-cew-root select:focus {
          outline: none !important;
          border: 1px solid #60a5fa !important;
          box-shadow: 0 0 0 1px #bfdbfe !important;
        }
        .cgb-cew-root input:focus-visible,
        .cgb-cew-root textarea:focus-visible,
        .cgb-cew-root select:focus-visible {
          outline: none !important;
          border: 1px solid #60a5fa !important;
          box-shadow: 0 0 0 1px #bfdbfe !important;
        }

        /*
          Disabled form controls should behave like truly disabled controls:
          - no focus/selection affordances
          - no click/drag interaction
        */
        .cgb-cew-root input:disabled,
        .cgb-cew-root textarea:disabled,
        .cgb-cew-root select:disabled {
          pointer-events: none;
          user-select: none;
          -webkit-user-select: none;
          cursor: not-allowed;
        }

        /*
          Scroll/rounding fix without adding a visible "second" panel.
          We only clip the scroll area so rounded corners stay rounded,
          but we intentionally do NOT add border/shadow/background here.
        */
        .cgb-cew-panel {
          border: none;
          background: transparent;
          box-shadow: none;
          border-radius: 16px;
          overflow: hidden; /* prevents the right-side scrollbar from "squaring" corners */
          /* Make only the content area scrollable (below the header/title). */
          max-height: min(78vh, 860px);
          display: flex;
          flex-direction: column;
        }

        .cgb-cew-panel-header {
          padding: 22px;
          padding-bottom: 14px;
          flex: 0 0 auto;
          border-bottom: 1px solid rgba(229, 231, 235, 0.9);
          box-sizing: border-box;
        }

        .cgb-cew-panel-body {
          padding: 22px;
          padding-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow-y: auto;
          flex: 1 1 auto;
          scrollbar-gutter: stable;
          box-sizing: border-box;
        }

        /* Subtle scrollbars (WebKit + Firefox) */
        .cgb-cew-panel-body {
          scrollbar-width: thin;
          scrollbar-color: rgba(17, 24, 39, 0.28) transparent;
        }
        .cgb-cew-panel-body::-webkit-scrollbar {
          width: 10px;
        }
        .cgb-cew-panel-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .cgb-cew-panel-body::-webkit-scrollbar-thumb {
          background-color: rgba(17, 24, 39, 0.22);
          border-radius: 999px;
          border: 3px solid transparent;
          background-clip: content-box;
        }
        .cgb-cew-panel-body:hover::-webkit-scrollbar-thumb {
          background-color: rgba(17, 24, 39, 0.30);
        }
      `}</style>

      <div className="cgb-cew-panel">
        <div className="cgb-cew-panel-header">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                {step === 1
                  ? "Event-Typ auswählen"
                  : `${selectedCategory?.name ?? "Event"}`}
              </h2>
            </div>

            {step === 1 && (
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Abbrechen"
                title="Abbrechen"
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  backgroundColor: "#ffffff",
                  boxShadow:
                    "0 6px 14px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.55)",
                  cursor: "pointer",
                  transform: "translateZ(0)",
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
                    d="M6 6L18 18M18 6L6 18"
                    stroke="#111827"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}

            {step === 2 && selectedCategory && (
              <div
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "999px",
                  backgroundColor: selectedCategory.color_hex || "#e5e7eb",
                  fontSize: "16px",
                  /* subtle 3D / depth effect */
                  boxShadow:
                    "0 6px 14px rgba(0,0,0,0.14), inset 0 1px 0 rgba(255,255,255,0.35)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  transform: "translateZ(0)",
                }}
              >
                {selectedCategory.symbol || "?"}
              </div>
            )}
          </div>
        </div>

        <div className="cgb-cew-panel-body" ref={panelScrollRef}>

      {step === 1 ? (
        <>
          {loading && (
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid #e5e7eb",
                fontSize: "14px",
              }}
            >
              Kategorien werden geladen…
            </div>
          )}

          {!loading && error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid #fca5a5",
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && categories.length === 0 && (
            <div
              style={{
                padding: "16px",
                borderRadius: "8px",
                border: "1px dashed #d1d5db",
                fontSize: "14px",
                color: "#6b7280",
              }}
            >
              Es wurden noch keine Kategorien angelegt. Bitte lege zuerst
              Kategorien an, bevor du einen Event-Typ auswählst.
            </div>
          )}

          {!loading && !error && categories.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {nonGodiCategories.length > 0 && (
                <div>
                  <div
                    style={{
                      marginBottom: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Allgemeine Kategorien
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {nonGodiCategories.map((category) =>
                      renderCategoryButton(category),
                    )}
                  </div>
                </div>
              )}

              {godiItemCategories.length > 0 && (
                <div>
                  <div
                    style={{
                      margin: "12px 0 4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#374151",
                    }}
                  >
                    Gottesdienst-Elemente
                  </div>
                  <div
                    style={{
                      marginBottom: "8px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Hinweis: Diese Event-Typen können nur für bestehende{" "}
                    <strong>Gottesdienste</strong> angelegt oder diesen
                    hinzugefügt werden.
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {godiItemCategories.map((category) =>
                      renderCategoryButton(category),
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            marginTop: "8px",
          }}
        >
          {!isGodiChildCategory && !isGottesdienstCategory && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Titel
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={titlePlaceholder}
                onFocus={() => setTitleFocused(true)}
                onBlur={() => setTitleFocused(false)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: titleFocused
                    ? "1px solid #60a5fa"
                    : "1px solid #d1d5db",
                  boxShadow: titleFocused ? "0 0 0 1px #bfdbfe" : "none",
                  outline: "none",
                  fontSize: "14px",
                }}
              />
            </div>
          )}

          {isFeiertag ? (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Tag
                </label>
                {renderCalendar(day || null, setDay, "single")}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Enddatum wird automatisch auf denselben Tag gesetzt.
                Planungsebene: <strong>Rahmenplan</strong>, Kategorie:{" "}
                <strong>Feiertag</strong>.
              </div>

              {submitError && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: "13px",
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          ) : isFerien ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Zeitraum wählen
              </div>
              <div
                style={{
                  borderRadius: "8px",
                  border: "1px solid #e0e4f0",
                  padding: "16px 18px 18px",
                  backgroundColor: "#ffffff",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Startdatum
                    </label>
                    {renderCalendar(startDate || null, setStartDate, "start")}
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Enddatum
                    </label>
                    {renderCalendar(endDate || null, setEndDate, "end")}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "#6b7280",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          backgroundColor: "#e5f0ff",
                          display: "inline-block",
                        }}
                      />
                      <span>Ausgewählter Zeitraum</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          backgroundColor: "#2563eb",
                          display: "inline-block",
                        }}
                      />
                      <span>Start / Ende</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "8px",
                          border: "1px solid #93c5fd",
                          display: "inline-block",
                        }}
                      />
                      <span>Heutiges Datum</span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#2563eb",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={handleResetDateRange}
                  >
                    Reset
                  </div>
                </div>
              </div>

              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Planungsebene: <strong>Rahmenplan</strong>, Kategorie:{" "}
                <strong>Ferien</strong>.
              </div>

              {submitError && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: "13px",
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          ) : isGottesdienstCategory ? (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Datum
                </label>
                {renderCalendar(
                  startDate || null,
                  (value) => {
                    setStartDate(value);
                    setEndDate(value);
                  },
                  "single",
                )}
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "#6b7280",
                  }}
                >
                  Enddatum wird automatisch auf denselben Tag gesetzt.
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Nextcloud-Ordner
                </label>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "12px",
                    padding: "12px",
                    backgroundColor: "#f9fafb",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ fontSize: "12px", color: "#374151" }}>
                    Bitte erstelle für diesen Gottesdienst einen Ordner in
                    Nextcloud unter{" "}
                    <strong>
                      /Gottesdienst/
                      {startDate
                        ? deriveGottesdienstFolderName(startDate) || ""
                        : "MM_DD"}
                    </strong>
                    .
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <WizardButton
                      type="button"
                      onClick={() => void handleCreateGottesdienstFolder()}
                      disabled={
                        !startDate ||
                        godiFolderStatus === "creating" ||
                        !!attachmentsInput ||
                        attachmentUploadStatus === "uploading"
                      }
                      variant="primary"
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                      label={
                        godiFolderStatus === "creating"
                          ? "Ordner wird erstellt..."
                          : "Ordner erstellen & Link erzeugen"
                      }
                    />

                    {godiFolderStatus === "error" && godiFolderError && (
                      <span style={{ fontSize: "12px", color: "#b91c1c" }}>
                        {godiFolderError}
                      </span>
                    )}
                  </div>

                  {attachmentsInput && (
                    <div
                      style={{
                        marginTop: "4px",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid #22c55e",
                        backgroundColor: "#dcfce7",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        color: "#065f46",
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>Ordner:</span>
                      <a
                        href={attachmentsInput}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          textDecoration: "underline",
                          color: "#047857",
                          fontWeight: 500,
                          wordBreak: "break-all",
                        }}
                      >
                        {getAttachmentLabel()}
                      </a>
                      <button
                        type="button"
                        onClick={handleCopyAttachmentLink}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          padding: "4px 8px",
                          backgroundColor: "#e5e7eb",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Link kopieren
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveAttachment}
                        style={{
                          border: "none",
                          borderRadius: "999px",
                          padding: "4px 8px",
                          backgroundColor: "#fee2e2",
                          cursor: "pointer",
                          fontSize: "11px",
                        }}
                      >
                        Link entfernen
                      </button>
                      {copyAttachmentStatus === "success" && (
                        <span style={{ fontSize: "11px", color: "#16a34a" }}>
                          Kopiert
                        </span>
                      )}
                      {copyAttachmentStatus === "error" && (
                        <span style={{ fontSize: "11px", color: "#b91c1c" }}>
                          Kopieren fehlgeschlagen
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginBottom: "6px",
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    Startzeiten
                  </label>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Endzeit wird automatisch auf +90 Minuten gesetzt.
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  {["10:00", "11:00", "12:00", "15:00", "19:00"].map((t) => {
                    const checked = godiTimes.includes(t);
                    return (
                      <label
                        key={t}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: checked
                            ? "1px solid #4f46e5"
                            : "1px solid #d1d5db",
                          backgroundColor: checked ? "#eef2ff" : "#ffffff",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setGodiTimes((prev) => {
                              if (e.target.checked) {
                                const next = Array.from(
                                  new Set([...(prev || []), t]),
                                );
                                next.sort((a, b) => a.localeCompare(b));
                                return next;
                              } else {
                                return (prev || []).filter((x) => x !== t);
                              }
                            });
                          }}
                          style={{ margin: 0 }}
                        />
                        <span>{t} Uhr</span>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 500,
                      marginBottom: "4px",
                      color: "#374151",
                    }}
                  >
                    Zusätzliche Zeiten (mehrere auf einmal)
                  </label>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="time"
                      value={godiCustomTimesInput}
                      onChange={(e) => setGodiCustomTimesInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = normalizeTimeValue(godiCustomTimesInput);
                          if (!t) return;
                          setGodiTimes((prev) => {
                            const next = Array.from(
                              new Set([...(prev || []), t]),
                            );
                            next.sort((a, b) => a.localeCompare(b));
                            return next;
                          });
                          setGodiCustomTimesInput("");
                        }
                      }}
                      step={300}
                      style={{
                        flex: "1 1 240px",
                        minWidth: "220px",
                        height: "36px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "13px",
                      }}
                    />

                    <WizardButton
                      type="button"
                      onClick={() => {
                        const t = normalizeTimeValue(godiCustomTimesInput);
                        if (!t) return;
                        setGodiTimes((prev) => {
                          const next = Array.from(
                            new Set([...(prev || []), t]),
                          );
                          next.sort((a, b) => a.localeCompare(b));
                          return next;
                        });
                        setGodiCustomTimesInput("");
                      }}
                      variant="primary"
                      style={{
                        height: "36px",
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "8px 14px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                      label="Zeiten hinzufügen"
                    />
                    <WizardButton
                      type="button"
                      onClick={() => {
                        setGodiTimes([]);
                        setGodiCustomTimesInput("");
                      }}
                      variant="secondary"
                      style={{
                        height: "36px",
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "8px 14px",
                        fontSize: "13px",
                      }}
                      label="Zeiten leeren"
                    />
                  </div>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "11px",
                      color: "#6b7280",
                    }}
                  >
                    Zeit auswählen und per <strong>Enter</strong> oder{" "}
                    <strong>&quot;Zeiten hinzufügen&quot;</strong> übernehmen.
                  </div>
                </div>

                {godiTimes.length > 0 && (
                  <div
                    style={{
                      marginTop: "10px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      fontSize: "12px",
                      color: "#374151",
                    }}
                  >
                    {godiTimes.map((t) => (
                      <span
                        key={t}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          backgroundColor: "#f3f4f6",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        <strong>{buildGodiChildTitle(t)}</strong>
                        <span style={{ color: "#6b7280" }}>
                          {t}–{addMinutesToTime(t, 90)} Uhr
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setGodiTimes((prev) =>
                              (prev || []).filter((x) => x !== t),
                            )
                          }
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#9ca3af",
                            fontSize: "14px",
                            lineHeight: 1,
                          }}
                          title="Zeit entfernen"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {(godiTimes?.length ?? 0) > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={applyParentDetailsToAllGodiChildren}
                    onChange={(e) =>
                      setApplyParentDetailsToAllGodiChildren(e.target.checked)
                    }
                    style={{ margin: 0 }}
                  />
                  <span>Angaben automatisch an alle Zeiten übernehmen</span>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Prediger
                  </label>
                  <input
                    type="text"
                    value={preacher}
                    onChange={(e) => setPreacher(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Predigttitel
                  </label>
                  <input
                    type="text"
                    value={sermonTitle}
                    onChange={(e) => setSermonTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "nowrap",
                  alignItems: "stretch",
                }}
              >
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Bemerkungen
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      minWidth: 0,
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Interne Notizen
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      minWidth: 0,
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      minWidth: "140px",
                    }}
                  >
                    <span>In Klärung</span>
                    {inKlaerung && <span aria-hidden="true">⚠️</span>}
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      flex: "1 1 auto",
                      minWidth: 220,
                    }}
                  >
                    <span>Offene Punkte</span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: "140px" }}>
                    <ToggleSwitch
                      checked={inKlaerung}
                      onChange={(next) => setInKlaerung(next)}
                      ariaLabel="In Klärung"
                    />
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <textarea
                      value={clarification}
                      onChange={(e) => setClarification(e.target.value)}
                      disabled={!inKlaerung}
                      rows={1}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        height: "38px",
                        minHeight: "38px",
                        resize: "vertical",
                        backgroundColor: inKlaerung ? "#ffffff" : "#f3f4f6",
                      }}
                    />
                  </div>
                </div>
              </div>

              {!isGottesdienstCategory && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Planungsebene(n)
                  </label>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {planningLevels.map((pl) => {
                      const checked = selectedPlanningLevelIds.includes(pl.id);
                      return (
                        <label
                          key={pl.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "4px 8px",
                            borderRadius: "999px",
                            border: checked
                              ? "1px solid #4f46e5"
                              : "1px solid #d1d5db",
                            backgroundColor: checked ? "#eef2ff" : "#ffffff",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedPlanningLevelIds((prev) => {
                                if (e.target.checked) {
                                  if (prev.includes(pl.id)) return prev;
                                  return [...prev, pl.id];
                                } else {
                                  return prev.filter((id) => id !== pl.id);
                                }
                              });
                            }}
                            style={{ margin: 0 }}
                          />
                          <span>{pl.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Kategorie ist standardmäßig <strong>Gottesdienst</strong>.
                  </div>
                </div>
              )}

              {!applyParentDetailsToAllGodiChildren && godiTimes.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "12px",
                    borderRadius: "12px",
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#f9fafb",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    Details je Kind-Event
                  </div>

                  {godiTimes.map((t) => {
                    const current = (godiChildOverrides || {})[t] || {
                      preacher,
                      sermonTitle,
                      remarks,
                      internalNotes,
                      inKlaerung,
                      clarification,
                      pcoId,
                    };

                    const setField = (field: string, value: any) => {
                      setGodiChildOverrides((prev) => {
                        const next = { ...(prev || {}) };
                        next[t] = { ...(next[t] || current), [field]: value };
                        return next;
                      });
                    };

                    const childInK = !!current.inKlaerung;

                    return (
                      <div
                        key={t}
                        style={{
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          backgroundColor: "#ffffff",
                          padding: "12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {buildGodiChildTitle(t)} ({t}–
                            {addMinutesToTime(t, 90)} Uhr)
                          </div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>
                            PCO ID gilt nur für Kind-Events
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 500,
                                marginBottom: "4px",
                                color: "#374151",
                              }}
                            >
                              Prediger
                            </label>
                            <input
                              type="text"
                              value={current.preacher || ""}
                              onChange={(e) =>
                                setField("preacher", e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "13px",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 500,
                                marginBottom: "4px",
                                color: "#374151",
                              }}
                            >
                              Predigttitel
                            </label>
                            <input
                              type="text"
                              value={current.sermonTitle || ""}
                              onChange={(e) =>
                                setField("sermonTitle", e.target.value)
                              }
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "13px",
                              }}
                            />
                          </div>

                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 500,
                                marginBottom: "4px",
                                color: "#374151",
                              }}
                            >
                              PCO ID
                            </label>
                            <input
                              type="text"
                              value={current.pcoId || ""}
                              onChange={(e) =>
                                setField("pcoId", e.target.value)
                              }
                              placeholder="z. B. 12345"
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "13px",
                              }}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "nowrap",
                            alignItems: "stretch",
                          }}
                        >
                          <div style={{ flex: "1 1 0", minWidth: 0 }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 500,
                                marginBottom: "4px",
                                color: "#374151",
                              }}
                            >
                              Bemerkungen
                            </label>
                            <textarea
                              value={current.remarks || ""}
                              onChange={(e) =>
                                setField("remarks", e.target.value)
                              }
                              rows={2}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "13px",
                                resize: "vertical",
                              }}
                            />
                          </div>

                          <div style={{ flex: "1 1 0", minWidth: 0 }}>
                            <label
                              style={{
                                display: "block",
                                fontSize: "12px",
                                fontWeight: 500,
                                marginBottom: "4px",
                                color: "#374151",
                              }}
                            >
                              Interne Notizen
                            </label>
                            <textarea
                              value={current.internalNotes || ""}
                              onChange={(e) =>
                                setField("internalNotes", e.target.value)
                              }
                              rows={2}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                fontSize: "13px",
                                resize: "vertical",
                              }}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: "16px",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#374151",
                                minWidth: "140px",
                              }}
                            >
                              <span>In Klärung</span>
                              {childInK && <span aria-hidden="true">⚠️</span>}
                            </div>

                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: 500,
                                color: "#374151",
                                flex: "1 1 auto",
                                minWidth: 200,
                              }}
                            >
                              <span>Offene Punkte</span>
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "16px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ minWidth: "140px" }}>
                              <ToggleSwitch
                                checked={childInK}
                                onChange={(next) =>
                                  setField("inKlaerung", next)
                                }
                                ariaLabel="In Klärung"
                              />
                            </div>

                            <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                              <textarea
                                value={current.clarification || ""}
                                onChange={(e) =>
                                  setField("clarification", e.target.value)
                                }
                                disabled={!childInK}
                                rows={1}
                                style={{
                                  width: "100%",
                                  padding: "8px 10px",
                                  borderRadius: "8px",
                                  border: "1px solid #d1d5db",
                                  fontSize: "13px",
                                  height: "36px",
                                  minHeight: "36px",
                                  resize: "vertical",
                                  backgroundColor: childInK
                                    ? "#ffffff"
                                    : "#f3f4f6",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {submitError && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: "13px",
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          ) : isGodiChildCategory ? (
            <>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                {hasCustomTitleGodiChild ? (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Titel
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={
                        isPredigtreiheGodiChild
                          ? "Name der Predigtreihe"
                          : isGastpredigerGodiChild
                            ? "Name des Gastpredigers"
                            : "Titel deines Specials"
                      }
                      onFocus={() => setTitleFocused(true)}
                      onBlur={() => setTitleFocused(false)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: titleFocused
                          ? "1px solid #60a5fa"
                          : "1px solid #d1d5db",
                        boxShadow: titleFocused ? "0 0 0 1px #bfdbfe" : "none",
                        outline: "none",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Titel
                    </label>
                    <input
                      type="text"
                      value={selectedCategory?.name || ""}
                      disabled
                      tabIndex={-1}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        backgroundColor: "#f9fafb",
                        color: "#4b5563",
                      }}
                    />
                  </div>
                )}

                {isGastpredigerGodiChild && (
                  <div
                    style={{
                      marginTop: "8px",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Mail
                    </label>
                    <input
                      type="email"
                      value={mail}
                      onChange={(e) => setMail(e.target.value)}
                      placeholder="E-Mail-Adresse des Gastpredigers"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                )}

                {isPredigtreiheGodiChild && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                        lineHeight: "1.2",
                      }}
                    >
                      Zeitraum wählen
                    </label>
                    <div
                      style={{
                        borderRadius: "8px",
                        border: "1px solid #e0e4f0",
                        padding: "0px 18px 18px",
                        backgroundColor: "#ffffff",
                        marginTop: "0px",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(160px, 1fr))",
                          gap: "16px",
                        }}
                      >
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "13px",
                              fontWeight: 500,
                              marginBottom: "4px",
                            }}
                          >
                            Startdatum
                          </label>
                          {renderCalendar(
                            startDate || null,
                            setStartDate,
                            "start",
                          )}
                        </div>
                        <div>
                          <label
                            style={{
                              display: "block",
                              fontSize: "13px",
                              fontWeight: 500,
                              marginBottom: "4px",
                            }}
                          >
                            Enddatum
                          </label>
                          {renderCalendar(
                            endDate || startDate || null,
                            setEndDate,
                            "end",
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: "14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "11px",
                          color: "#6b7280",
                          flexWrap: "wrap",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "999px",
                                backgroundColor: "#e5f0ff",
                                display: "inline-block",
                              }}
                            />
                            <span>Ausgewählter Zeitraum</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "999px",
                                backgroundColor: "#2563eb",
                                display: "inline-block",
                              }}
                            />
                            <span>Start / Ende</span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "8px",
                                border: "1px solid #93c5fd",
                                display: "inline-block",
                              }}
                            />
                            <span>Heutiges Datum</span>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#2563eb",
                            cursor: "pointer",
                            userSelect: "none",
                          }}
                          onClick={handleResetDateRange}
                        >
                          Reset
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Zugehörige Gottesdienste
                  </label>
                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    Auswahl eines Eltern-Events wählt automatisch alle
                    Unterevents aus.
                  </div>

                  <div
                    ref={parentEventsListRef}
                    style={{
                      maxHeight: "220px",
                      overflowY: "auto",
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    {visibleGodiRoots.length === 0 && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        {isPredigtreiheGodiChild && startDate
                          ? "Es wurden keine Gottesdienste im gewählten Zeitraum gefunden."
                          : "Es wurden keine zukünftigen Gottesdienste mit Startdatum gefunden."}
                      </div>
                    )}
                    {visibleGodiRoots.map((ev) =>
                      renderGodiSelectionRow(ev, 0),
                    )}
                  </div>

                  {isPredigtreiheGodiChild && (
                    <div
                      style={{
                        marginTop: "12px",
                      }}
                    >
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 500,
                          marginBottom: "4px",
                        }}
                      >
                        Anhang
                      </label>
                      <div
                        onDragOver={handleAttachmentDragOver}
                        onDragEnter={handleAttachmentDragOver}
                        onDragLeave={handleAttachmentDragLeave}
                        onDrop={handleAttachmentDrop}
                        style={{
                          border: "1px dashed #d1d5db",
                          borderRadius: "8px",
                          padding: "8px 10px",
                          backgroundColor: isAttachmentDragOver
                            ? "#eef2ff"
                            : "#f9fafb",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <input
                            ref={attachmentFileInputRef}
                            type="file"
                            onChange={handleAttachmentFileChange}
                            disabled={
                              !!attachmentsInput ||
                              attachmentUploadStatus === "success" ||
                              attachmentUploadStatus === "uploading"
                            }
                            style={{
                              flexGrow: 1,
                              minWidth: "200px",
                            }}
                          />
                          <WizardButton
                            type="button"
                            onClick={() => void handleUploadAttachment()}
                            disabled={
                              !attachmentFile ||
                              attachmentUploadStatus === "uploading" ||
                              !!attachmentsInput ||
                              attachmentUploadStatus === "success"
                            }
                            variant="primary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "13px",
                              fontWeight: 500,
                            }}
                            label={
                              attachmentUploadStatus === "uploading"
                                ? "Wird hochgeladen..."
                                : "In CGBS Media hochladen"
                            }
                          />
                        </div>
                        {attachmentUploadStatus === "uploading" && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "11px",
                              color: "#6b7280",
                            }}
                          >
                            Dokument wird hochgeladen. Bitte warte, bis der Link
                            angezeigt wird.
                          </div>
                        )}
                        {!attachmentsInput &&
                          !attachmentUploadError &&
                          attachmentUploadStatus !== "uploading" && (
                            <div
                              style={{
                                marginTop: "4px",
                                fontSize: "11px",
                                color: "#6b7280",
                              }}
                            >
                              Du kannst eine Datei auswählen oder hierher
                              ziehen, um sie in CGBS Media hochzuladen.
                            </div>
                          )}
                        {attachmentUploadError && (
                          <div
                            style={{
                              marginTop: "6px",
                              fontSize: "11px",
                              color: "#b91c1c",
                            }}
                          >
                            {attachmentUploadError}
                          </div>
                        )}
                        {attachmentsInput && (
                          <div
                            style={{
                              marginTop: "4px",
                              fontSize: "11px",
                              color: "#6b7280",
                            }}
                          >
                            Es ist bereits ein Dokument hochgeladen. Weitere
                            Uploads sind nicht möglich.
                          </div>
                        )}
                      </div>
                      {attachmentsInput && (
                        <div
                          style={{
                            marginTop: "12px",
                            padding: "10px 12px",
                            borderRadius: "10px",
                            border: "1px solid #22c55e",
                            backgroundColor: "#dcfce7",
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "12px",
                            color: "#065f46",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            Upload erfolgreich:
                          </span>
                          <span>Gespeicherter Link:</span>
                          <a
                            href={attachmentsInput}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              textDecoration: "underline",
                              color: "#047857",
                              fontWeight: 500,
                              wordBreak: "break-all",
                            }}
                          >
                            {getAttachmentLabel()}
                          </a>
                          <button
                            type="button"
                            onClick={handleCopyAttachmentLink}
                            style={{
                              border: "none",
                              borderRadius: "999px",
                              padding: "4px 8px",
                              backgroundColor: "#e5e7eb",
                              cursor: "pointer",
                              fontSize: "11px",
                            }}
                          >
                            Link kopieren
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveAttachment}
                            style={{
                              border: "none",
                              borderRadius: "999px",
                              padding: "4px 8px",
                              backgroundColor: "#fee2e2",
                              cursor: "pointer",
                              fontSize: "11px",
                            }}
                          >
                            Datei entfernen
                          </button>
                          {copyAttachmentStatus === "success" && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#16a34a",
                              }}
                            >
                              Kopiert
                            </span>
                          )}
                          {copyAttachmentStatus === "error" && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "#b91c1c",
                              }}
                            >
                              Kopieren fehlgeschlagen
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isKollekteGodiChild &&
                  !isTaufeGodiChild &&
                  !isPredigtreiheGodiChild &&
                  selectedParentEventIds.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "13px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={applyDetailsToAllChildren}
                        onChange={(e) =>
                          setApplyDetailsToAllChildren(e.target.checked)
                        }
                        style={{ margin: 0 }}
                      />
                      <span>
                        Angaben in diesem Abschnitt für alle erzeugten Elemente
                        übernehmen
                      </span>
                    </div>
                  )}

                {isKollekteGodiChild && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#111827",
                      }}
                    >
                      Bauspende (Nextcloud)
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        fontSize: "13px",
                        color: "#111827",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={includeBauspendeImage}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIncludeBauspendeImage(checked);
                          setBauspendeStatus("idle");
                          setBauspendeError(null);
                          if (!checked) {
                            setBauspendeLinksByParentId({});
                            setBauspendeCopyLinkStatusByParentId({});
                          }
                        }}
                        style={{ marginTop: "2px" }}
                      />
                      <span>
                        <span
                          style={{
                            fontWeight: 500,
                            display: "block",
                            marginBottom: "2px",
                          }}
                        >
                          Soll das Bild <strong>Bauspende.png</strong> in den
                          Nextcloud-Ordner(n) der ausgewählten Gottesdienste
                          kopiert werden?
                        </span>
                        <span style={{ fontSize: "12px", color: "#4b5563" }}>
                          Quelle:{" "}
                          <strong>/Gottesdienst/00_Orga/Bauspende.png</strong>{" "}
                          &nbsp;→&nbsp; Ziel:{" "}
                          <strong>/Gottesdienst/MM_DD/Bauspende.png</strong>
                        </span>
                      </span>
                    </label>

                    {includeBauspendeImage && (
                      <>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <WizardButton
                            type="button"
                            onClick={() =>
                              void handlePrepareBauspendeForSelection()
                            }
                            disabled={
                              bauspendeStatus === "copying" ||
                              effectiveGodiTargetEventIds.length === 0
                            }
                            variant="primary"
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                            }}
                            label={
                              bauspendeStatus === "copying"
                                ? "Wird kopiert & freigegeben..."
                                : "Bauspende kopieren & Link erzeugen"
                            }
                          />

                          {bauspendeStatus === "error" && bauspendeError && (
                            <span
                              style={{ fontSize: "12px", color: "#b91c1c" }}
                            >
                              {bauspendeError}
                            </span>
                          )}
                        </div>

                        {Object.keys(bauspendeLinksByParentId || {}).length >
                          0 && (
                          <div
                            style={{
                              marginTop: "2px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              fontSize: "12px",
                              color: "#065f46",
                            }}
                          >
                            {effectiveGodiTargetEventIds.map((pid) => {
                              const url = (bauspendeLinksByParentId || {})[pid];
                              if (!url) return null;

                              const parent = godisById.get(pid);
                              const labelFolder = parent?.start_date
                                ? `/Gottesdienst/${deriveGottesdienstFolderName(parent.start_date) || "MM_DD"}`
                                : "/Gottesdienst/MM_DD";

                              const copyStatus =
                                (bauspendeCopyLinkStatusByParentId || {})[
                                  pid
                                ] || "idle";

                              return (
                                <div
                                  key={`bauspende-link-${pid}`}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid #22c55e",
                                    backgroundColor: "#dcfce7",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: "8px",
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>
                                    Datei:
                                  </span>
                                  <span style={{ color: "#065f46" }}>
                                    {labelFolder}/Bauspende.png
                                  </span>
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      textDecoration: "underline",
                                      color: "#047857",
                                      fontWeight: 500,
                                      wordBreak: "break-all",
                                    }}
                                  >
                                    Öffentlicher Link
                                  </a>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const ok = await copyTextToClipboard(url);
                                      setBauspendeCopyLinkStatusByParentId(
                                        (prev) => ({
                                          ...(prev || {}),
                                          [pid]: ok ? "success" : "error",
                                        }),
                                      );
                                      setTimeout(
                                        () => {
                                          setBauspendeCopyLinkStatusByParentId(
                                            (prev) => ({
                                              ...(prev || {}),
                                              [pid]: "idle",
                                            }),
                                          );
                                        },
                                        ok ? 2000 : 3000,
                                      );
                                    }}
                                    style={{
                                      border: "none",
                                      borderRadius: "999px",
                                      padding: "4px 8px",
                                      backgroundColor: "#e5e7eb",
                                      cursor: "pointer",
                                      fontSize: "11px",
                                    }}
                                  >
                                    Link kopieren
                                  </button>
                                  {copyStatus === "success" && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#16a34a",
                                      }}
                                    >
                                      Kopiert
                                    </span>
                                  )}
                                  {copyStatus === "error" && (
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        color: "#b91c1c",
                                      }}
                                    >
                                      Kopieren fehlgeschlagen
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {isKollekteGodiChild && selectedParentEventIds.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={applyDetailsToAllChildren}
                      onChange={(e) =>
                        setApplyDetailsToAllChildren(e.target.checked)
                      }
                      style={{ margin: 0 }}
                    />
                    <span>
                      Angaben in diesem Abschnitt für alle erzeugten Elemente
                      übernehmen
                    </span>
                  </div>
                )}

                {isTaufeGodiChild && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      backgroundColor: "#f9fafb",
                    }}
                  >
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "8px",
                        fontSize: "13px",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={createTaufeStageEvent}
                        onChange={(e) =>
                          setCreateTaufeStageEvent(e.target.checked)
                        }
                        style={{ marginTop: "2px" }}
                      />
                      <span>
                        <span
                          style={{
                            fontWeight: 500,
                            display: "block",
                            marginBottom: "2px",
                          }}
                        >
                          Zusätzlichen Vorbereitungs-Termin anlegen
                        </span>
                        <span
                          style={{
                            fontSize: "12px",
                            color: "#4b5563",
                          }}
                        >
                          Es wird ein Event{" "}
                          <strong>"Bühne für Taufe umbauen"</strong>
                          {taufeStageSuggestionDateLabel
                            ? ` am ${taufeStageSuggestionDateLabel} um 21:00–21:30 Uhr`
                            : " vier Tage vor dem Gottesdienst-Termin von 21:00–21:30 Uhr"}{" "}
                          erstellt.
                        </span>
                      </span>
                    </label>
                  </div>
                )}
                {isTaufeGodiChild && selectedParentEventIds.length > 1 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      marginTop: "12px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={applyDetailsToAllChildren}
                      onChange={(e) =>
                        setApplyDetailsToAllChildren(e.target.checked)
                      }
                      style={{ margin: 0 }}
                    />
                    <span>
                      Angaben in diesem Abschnitt für alle erzeugten Elemente
                      übernehmen
                    </span>
                  </div>
                )}

                {applyDetailsToAllChildren ||
                selectedParentEventIds.length <= 1 ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "nowrap",
                        alignItems: "stretch",
                      }}
                    >
                      <div style={{ flex: "1 1 0", minWidth: 0 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 500,
                            marginBottom: "4px",
                          }}
                        >
                          Bemerkungen
                        </label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          rows={3}
                          disabled={
                            selectedParentEventIds.length > 1 &&
                            !applyDetailsToAllChildren
                          }
                          style={{
                            width: "100%",
                            minWidth: 0,
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                            resize: "vertical",
                            backgroundColor:
                              selectedParentEventIds.length > 1 &&
                              !applyDetailsToAllChildren
                                ? "#f3f4f6"
                                : "#ffffff",
                          }}
                        />
                      </div>

                      <div style={{ flex: "1 1 0", minWidth: 0 }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "13px",
                            fontWeight: 500,
                            marginBottom: "4px",
                          }}
                        >
                          Interne Notizen
                        </label>
                        <textarea
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          rows={3}
                          disabled={
                            selectedParentEventIds.length > 1 &&
                            !applyDetailsToAllChildren
                          }
                          style={{
                            width: "100%",
                            minWidth: 0,
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: "1px solid #d1d5db",
                            fontSize: "14px",
                            resize: "vertical",
                            backgroundColor:
                              selectedParentEventIds.length > 1 &&
                              !applyDetailsToAllChildren
                                ? "#f3f4f6"
                                : "#ffffff",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "16px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                            fontWeight: 500,
                            minWidth: "140px",
                          }}
                        >
                          <span>In Klärung</span>
                          {inKlaerung && <span aria-hidden="true">⚠️</span>}
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            flex: "1 1 auto",
                            minWidth: 220,
                          }}
                        >
                          <span>Offene Punkte</span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "16px",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ minWidth: "140px" }}>
                          <ToggleSwitch
                            checked={inKlaerung}
                            onChange={(next) => setInKlaerung(next)}
                            disabled={
                              selectedParentEventIds.length > 1 &&
                              !applyDetailsToAllChildren
                            }
                            ariaLabel="In Klärung"
                          />
                        </div>

                        <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                          <textarea
                            value={clarification}
                            onChange={(e) => setClarification(e.target.value)}
                            disabled={
                              !inKlaerung ||
                              (selectedParentEventIds.length > 1 &&
                                !applyDetailsToAllChildren)
                            }
                            rows={1}
                            style={{
                              width: "100%",
                              padding: "8px 10px",
                              borderRadius: "8px",
                              border: "1px solid #d1d5db",
                              fontSize: "14px",
                              height: "38px",
                              minHeight: "38px",
                              resize: "vertical",
                              backgroundColor:
                                !inKlaerung ||
                                (selectedParentEventIds.length > 1 &&
                                  !applyDetailsToAllChildren)
                                  ? "#f3f4f6"
                                  : "#ffffff",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ marginTop: "10px" }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        marginBottom: "8px",
                      }}
                    >
                      Individuelle Angaben pro ausgewähltem Gottesdienst
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        marginBottom: "10px",
                      }}
                    >
                      Titel sowie Start-/Enddatum und Start-/Endzeit werden
                      weiterhin automatisch vom jeweiligen Gottesdienst
                      übernommen.
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                      }}
                    >
                      {effectiveGodiTargetEventIds.map((pid) => {
                        const parent = godisById.get(pid);
                        if (!parent) return null;

                        const current =
                          (godiChildDetailsByParentId || {})[pid] || {};
                        const setCurrent = (patch: any) => {
                          setGodiChildDetailsByParentId((prev) => ({
                            ...(prev || {}),
                            [pid]: { ...((prev || {})[pid] || {}), ...patch },
                          }));
                        };

                        const childInK = !!current.inKlaerung;

                        const parentCat = Array.isArray(parent.category_ids)
                          ? categories.find((c) =>
                              parent.category_ids!.includes(c.id),
                            ) || null
                          : null;

                        const parentDateTimeLabel = (() => {
                          const d = parent.start_date
                            ? new Date(parent.start_date as any)
                            : null;
                          const datePart =
                            d && !isNaN(d.getTime())
                              ? d.toLocaleDateString("de-DE", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })
                              : parent.start_date || "";
                          const timeRaw =
                            typeof parent.start_time === "string"
                              ? parent.start_time
                              : "";
                          const timePart = timeRaw ? timeRaw.slice(0, 5) : "";
                          if (datePart && timePart)
                            return `${datePart} ${timePart}`;
                          return datePart || timePart || "";
                        })();

                        return (
                          <div
                            key={pid}
                            style={{
                              border: "1px solid #e5e7eb",
                              borderRadius: "10px",
                              padding: "12px",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "10px",
                                alignItems: "flex-start",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "2px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "18px",
                                      height: "18px",
                                      borderRadius: "999px",
                                      backgroundColor:
                                        parentCat?.color_hex || "#e5e7eb",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "11px",
                                      flex: "0 0 auto",
                                    }}
                                  >
                                    {parentCat?.symbol || "?"}
                                  </span>
                                  <span>{parent.title || "Gottesdienst"}</span>
                                </div>

                                {parentDateTimeLabel && (
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      color: "#6b7280",
                                    }}
                                  >
                                    {parentDateTimeLabel}
                                  </div>
                                )}
                              </div>

                              <div
                                style={{
                                  fontSize: "12px",
                                  color: "#6b7280",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ID: {pid}
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: "10px",
                                display: "flex",
                                gap: "12px",
                                flexWrap: "nowrap",
                                alignItems: "stretch",
                              }}
                            >
                              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Bemerkungen
                                </label>
                                <textarea
                                  value={
                                    typeof current.remarks === "string"
                                      ? current.remarks
                                      : ""
                                  }
                                  onChange={(e) =>
                                    setCurrent({ remarks: e.target.value })
                                  }
                                  rows={3}
                                  style={{
                                    width: "100%",
                                    minWidth: 0,
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    border: "1px solid #d1d5db",
                                    fontSize: "14px",
                                    resize: "vertical",
                                  }}
                                />
                              </div>

                              <div style={{ flex: "1 1 0", minWidth: 0 }}>
                                <label
                                  style={{
                                    display: "block",
                                    fontSize: "13px",
                                    fontWeight: 500,
                                    marginBottom: "4px",
                                  }}
                                >
                                  Interne Notizen
                                </label>
                                <textarea
                                  value={
                                    typeof current.internalNotes === "string"
                                      ? current.internalNotes
                                      : ""
                                  }
                                  onChange={(e) =>
                                    setCurrent({
                                      internalNotes: e.target.value,
                                    })
                                  }
                                  rows={3}
                                  style={{
                                    width: "100%",
                                    minWidth: 0,
                                    padding: "8px 10px",
                                    borderRadius: "8px",
                                    border: "1px solid #d1d5db",
                                    fontSize: "14px",
                                    resize: "vertical",
                                  }}
                                />
                              </div>
                            </div>

                            <div style={{ marginTop: "10px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "6px",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "baseline",
                                    gap: "16px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      minWidth: "140px",
                                    }}
                                  >
                                    <span>In Klärung</span>
                                    {childInK && (
                                      <span aria-hidden="true">⚠️</span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 500,
                                      flex: "1 1 auto",
                                      minWidth: 220,
                                    }}
                                  >
                                    <span>Offene Punkte</span>
                                  </div>
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: "16px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <div style={{ minWidth: "140px" }}>
                                    <ToggleSwitch
                                      checked={childInK}
                                      onChange={(next) =>
                                        setCurrent({ inKlaerung: next })
                                      }
                                      ariaLabel="In Klärung"
                                    />
                                  </div>

                                  <div
                                    style={{ flex: "1 1 260px", minWidth: 220 }}
                                  >
                                    <textarea
                                      value={
                                        typeof current.clarification ===
                                        "string"
                                          ? current.clarification
                                          : ""
                                      }
                                      onChange={(e) =>
                                        setCurrent({
                                          clarification: e.target.value,
                                        })
                                      }
                                      disabled={!childInK}
                                      rows={1}
                                      style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: "8px",
                                        border: "1px solid #d1d5db",
                                        fontSize: "14px",
                                        height: "38px",
                                        minHeight: "38px",
                                        resize: "vertical",
                                        backgroundColor: childInK
                                          ? "#ffffff"
                                          : "#f3f4f6",
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {submitError && (
                  <div
                    style={{
                      marginTop: "4px",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #fca5a5",
                      backgroundColor: "#fef2f2",
                      color: "#b91c1c",
                      fontSize: "13px",
                    }}
                  >
                    {submitError}
                  </div>
                )}
              </div>
            </>
          ) : usesExtendedForm ? (
            <>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Kategorien
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {categories
                    .filter(
                      (cat) =>
                        (!cat.godi_item ||
                          ["taufe", "abendmahl"].includes(
                            (cat.name || "").trim().toLowerCase(),
                          )) &&
                        !["gottesdienst", "feiertag", "ferien"].includes(
                          cat.name?.toLowerCase() || "",
                        ),
                    )
                    .map((cat) => {
                      const isMainCategory = selectedCategory?.id === cat.id;
                      const checked =
                        isMainCategory ||
                        selectedCategoryIdsForEvent.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "4px 10px",
                            borderRadius: "999px",
                            border: isMainCategory
                              ? "1px solid #d1d5db"
                              : checked
                                ? "1px solid #4f46e5"
                                : "1px solid #d1d5db",
                            backgroundColor: isMainCategory
                              ? "#f3f4f6"
                              : checked
                                ? "#eef2ff"
                                : "#ffffff",
                            fontSize: "12px",
                            cursor: isMainCategory ? "not-allowed" : "pointer",
                            opacity: isMainCategory ? 0.85 : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isMainCategory}
                            onChange={(e) => {
                              if (isMainCategory) return;
                              setSelectedCategoryIdsForEvent((prev) => {
                                const mainId = selectedCategory?.id;
                                const withMain =
                                  typeof mainId === "number" && !prev.includes(mainId)
                                    ? [mainId, ...prev]
                                    : prev;
                                if (e.target.checked) {
                                  if (withMain.includes(cat.id)) return withMain;
                                  return [...withMain, cat.id];
                                } else {
                                  return withMain.filter((id) => id !== cat.id);
                                }
                              });
                            }}
                            style={{ margin: 0 }}
                          />
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "999px",
                                backgroundColor: cat.color_hex || "#e5e7eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "11px",
                              }}
                            >
                              {cat.symbol || "?"}
                            </span>
                            <span>{cat.name}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  marginBottom: "4px",
                }}
              >
                Zeitraum wählen
              </div>
              <div
                style={{
                  borderRadius: "8px",
                  border: "1px solid #e0e4f0",
                  padding: "16px 18px 18px",
                  backgroundColor: "#ffffff",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Startdatum
                    </label>
                    {renderCalendar(startDate || null, setStartDate, "start")}
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Enddatum
                    </label>
                    {renderCalendar(endDate || null, setEndDate, "end")}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "11px",
                    color: "#6b7280",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: "16px",
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          backgroundColor: "#e5f0ff",
                          display: "inline-block",
                        }}
                      />
                      <span>Ausgewählter Zeitraum</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          backgroundColor: "#2563eb",
                          display: "inline-block",
                        }}
                      />
                      <span>Start / Ende</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "8px",
                          border: "1px solid #93c5fd",
                          display: "inline-block",
                        }}
                      />
                      <span>Heutiges Datum</span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#2563eb",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={handleResetDateRange}
                  >
                    Reset
                  </div>
                </div>
              </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "nowrap",
                  alignItems: "stretch",
                }}
              >
                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Bemerkungen
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      resize: "vertical",
                    }}
                  />
                </div>

                <div style={{ flex: "1 1 0", minWidth: 0 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      fontWeight: 500,
                      marginBottom: "4px",
                    }}
                  >
                    Interne Notizen
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      resize: "vertical",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      minWidth: "140px",
                    }}
                  >
                    <span>In Klärung</span>
                    {inKlaerung && <span aria-hidden="true">⚠️</span>}
                  </div>

                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      flex: "1 1 auto",
                      minWidth: 220,
                    }}
                  >
                    <span>Offene Punkte</span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: "140px" }}>
                    <ToggleSwitch
                      checked={inKlaerung}
                      onChange={(next) => setInKlaerung(next)}
                      disabled={!applyDetailsToAllChildren}
                      ariaLabel="In Klärung"
                    />
                  </div>

                  <div style={{ flex: "1 1 260px", minWidth: 220 }}>
                    <textarea
                      value={clarification}
                      onChange={(e) => setClarification(e.target.value)}
                      disabled={!inKlaerung || !applyDetailsToAllChildren}
                      rows={1}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        height: "38px",
                        minHeight: "38px",
                        resize: "vertical",
                        backgroundColor:
                          !inKlaerung || !applyDetailsToAllChildren
                            ? "#f3f4f6"
                            : "#ffffff",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginBottom: "4px",
                  }}
                >
                  Planungsebene(n)
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  {planningLevels.map((pl) => {
                    const checked = selectedPlanningLevelIds.includes(pl.id);
                    return (
                      <label
                        key={pl.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 8px",
                          borderRadius: "999px",
                          border: checked
                            ? "1px solid #4f46e5"
                            : "1px solid #d1d5db",
                          backgroundColor: checked ? "#eef2ff" : "#ffffff",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedPlanningLevelIds((prev) => {
                              if (e.target.checked) {
                                if (prev.includes(pl.id)) return prev;
                                return [...prev, pl.id];
                              } else {
                                return prev.filter((id) => id !== pl.id);
                              }
                            });
                          }}
                          style={{ margin: 0 }}
                        />
                        <span>{pl.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {submitError && (
                <div
                  style={{
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #fca5a5",
                    backgroundColor: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: "13px",
                  }}
                >
                  {submitError}
                </div>
              )}
            </>
          ) : (
            <div
              style={{
                fontSize: "12px",
                color: "#6b7280",
              }}
            >
              Hier kannst du später weitere Angaben für diesen Event-Typ machen.
              Für den Moment steht dir nur der Titel zur Verfügung.
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <WizardButton
              label="Zurück"
              onClick={handleBackToStep1}
              variant="secondary"
            />
            {isFeiertag ? (
              <WizardButton
                label={submitting ? "Wird angelegt..." : "Feiertag anlegen"}
                onClick={handleCreateFeiertag}
                disabled={submitting || !day}
                variant="primary"
              />
            ) : isFerien ? (
              <WizardButton
                label={submitting ? "Wird angelegt..." : "Ferien anlegen"}
                onClick={handleCreateFerien}
                disabled={submitting || !startDate || !endDate}
                variant="primary"
              />
            ) : isGottesdienstCategory ? (
              <WizardButton
                label={submitting ? "Wird angelegt..." : "Gottesdienst anlegen"}
                onClick={handleCreateGottesdienst}
                disabled={submitting || !startDate || godiTimes.length === 0}
                variant="primary"
              />
            ) : usesExtendedForm ? (
              <WizardButton
                label={submitting ? "Wird angelegt..." : extendedSubmitLabel}
                onClick={handleCreateAllgemein}
                disabled={submitting || !title.trim() || !startDate || !endDate}
                variant="primary"
              />
            ) : isGodiChildCategory ? (
              <WizardButton
                label={
                  submitting
                    ? "Wird angelegt..."
                    : "Gottesdienst-Element anlegen"
                }
                onClick={handleCreateGodiChild}
                disabled={submitting || selectedParentEventIds.length === 0}
                variant="primary"
              />
            ) : (
              <WizardButton
                label="Speichern (folgt)"
                disabled
                variant="primary"
              />
            )}
        </div>
      )}

        </div>
      </div>
    </div>
  );
};

export default CreateEventWizard;
