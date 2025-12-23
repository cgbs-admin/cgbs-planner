import React, { useEffect, useState } from "react";
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
  category_ids?: number[] | null;
  [key: string]: any;
}

interface CreateEventWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

const CreateEventWizard: React.FC<CreateEventWizardProps> = ({ onClose, onCreated }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [planningLevels, setPlanningLevels] = useState<PlanningLevel[]>([]);
  const [selectedPlanningLevelIds, setSelectedPlanningLevelIds] = useState<number[]>([]);
  const [gottesdienstEvents, setGottesdienstEvents] = useState<EventSummary[]>([]);
  const [selectedParentEventIds, setSelectedParentEventIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  // Step 2 form state
  const [title, setTitle] = useState<string>("");
  const [titleFocused, setTitleFocused] = useState<boolean>(false);

  // Spezialfall "Feiertag": ein einzelner Tag
  const [day, setDay] = useState<string>("");

  // Datumsbereich (z.B. Ferien, Allgemein)
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Zusätzliche Felder für "Allgemein"
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [internalNotes, setInternalNotes] = useState<string>("");
  const [inKlaerung, setInKlaerung] = useState<boolean>(false);
  const [clarification, setClarification] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [attachmentsInput, setAttachmentsInput] = useState<string>("");
  const [copyAttachmentStatus, setCopyAttachmentStatus] = useState<"idle" | "success" | "error">("idle");

  const [applyDetailsToAllChildren, setApplyDetailsToAllChildren] = useState<boolean>(true);


  const [selectedCategoryIdsForEvent, setSelectedCategoryIdsForEvent] = useState<number[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const isFeiertag = selectedCategory?.name === "Feiertag";
  const isFerien = selectedCategory?.name === "Ferien";

  const extendedFormCategoryNames = [
    "allgemein",
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
    extendedFormCategoryNames.includes(selectedCategory.name?.trim().toLowerCase() || "");

  const godiChildCategoryNames = [
    "abendmahl",
    "kindersegnung",
    "kollekte",
    "lobpreisabend",
    "special",
    "taufe",
    "predigtreihe",
  ];

  const isGodiChildCategory =
    !!selectedCategory &&
    !!selectedCategory.godi_item &&
    godiChildCategoryNames.includes(selectedCategory.name?.trim().toLowerCase() || "");

  const isSpecialGodiChild =
    isGodiChildCategory &&
    (selectedCategory?.name?.trim().toLowerCase() === "special");

  const isPredigtreiheGodiChild =
    isGodiChildCategory &&
    (selectedCategory?.name?.trim().toLowerCase() === "predigtreihe");

  const hasCustomTitleGodiChild = isSpecialGodiChild || isPredigtreiheGodiChild;

  const nonGodiCategories = categories.filter((c) => !c.godi_item);
  const godiItemCategories = categories.filter((c) => c.godi_item);

  
  const getAttachmentLabel = (url: string) => {
    try {
      const decoded = decodeURIComponent(url);
      const parts = decoded.split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.trim().length > 0) {
        return lastPart;
      }
      return "Dokument öffnen";
    } catch {
      return "Dokument öffnen";
    }
  };
useEffect(() => {
    let isMounted = true;

    const loadCategories = async () => {
      try {
        setLoading(true);
        setError(null);

        const raw = await apiFetch<any>("/categories");
        if (!isMounted) return;

        let data: any = raw;

        // apiFetch might either return parsed JSON (array) or a Response object.
        if (!Array.isArray(data) && data && typeof (data as any).json === "function") {
          try {
            const json = await (data as any).json();
            data = json;
          } catch (jsonErr) {
            console.error("Fehler beim Parsen der Kategorien-Antwort:", jsonErr);
          }
        }

        if (!Array.isArray(data)) {
          console.error("Unerwartetes Antwortformat für /categories:", data);
          throw new Error("Unerwartetes Antwortformat für Kategorien.");
        }

        const sorted = [...data].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "de-DE")
        );
        setCategories(sorted);

        // Planungsebenen laden
        try {
          const plRaw = await apiFetch<any>("/planning-levels");
          let plData: any = plRaw;

          if (!Array.isArray(plData) && plData && typeof (plData as any).json === "function") {
            try {
              const json = await (plData as any).json();
              plData = json;
            } catch (jsonErr) {
              console.error("Fehler beim Parsen der Planungsebenen-Antwort:", jsonErr);
            }
          }

          if (Array.isArray(plData)) {
            const plSorted = [...plData].sort((a, b) =>
              (a.name || "").localeCompare(b.name || "", "de-DE")
            );
            if (isMounted) {
              setPlanningLevels(plSorted);
            }
          } else {
            console.error("Unerwartetes Antwortformat für /planning-levels:", plData);
          }
        } catch (plErr) {
          console.error("Fehler beim Laden der Planungsebenen:", plErr);
        }

        // Gottesdienst-Events laden (zukünftige mit Startdatum)
        try {
          const eventsRaw = await apiFetch<any>("/events");
          let eventsData: any = eventsRaw;

          if (!Array.isArray(eventsData) && eventsData && typeof (eventsData as any).json === "function") {
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
              (c) => c.name && c.name.toLowerCase() === "gottesdienst"
            ) as Category | undefined;

            const filtered = (eventsData as any[]).filter((ev) => {
              const sd = ev.start_date;
              if (!sd) return false;
              const d = new Date(sd);
              if (isNaN(d.getTime())) return false;
              if (d < today) return false;

              const st = ev.start_time;
              if (!st) return false;

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
                        c.name.toLowerCase() === "gottesdienst")
                  );
                }
                if (!hasGodi && Array.isArray(ev.category_names)) {
                  hasGodi = ev.category_names.some(
                    (n: any) => typeof n === "string" && n.toLowerCase() === "gottesdienst"
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
                  (id) => typeof id === "number"
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
                category_ids: categoryIds,
              } as EventSummary;
            });

            if (isMounted) {
              setGottesdienstEvents(mapped);
            }
          } else {
            console.error("Unerwartetes Antwortformat für /events:", eventsData);
          }
        } catch (eventsErr) {
          console.error("Fehler beim Laden der Events:", eventsErr);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Kategorien:", err);
        if (isMounted) {
          setError("Die Kategorien konnten nicht geladen werden. Bitte versuche es erneut.");
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
    setCalendarMonth(new Date());
  };

  const goToFeiertagStep = () => {
    // Initialisiere den Kalendermonat (heute)
    initCalendarMonth();

    // Falls bereits ein Tag gewählt wurde, Kalendermonat anpassen
    if (day) {
      const parsed = new Date(day);
      if (!isNaN(parsed.getTime())) {
        setCalendarMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
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
    const isExtended = !!category && extendedFormCategoryNames.includes(lowerName);

    if (isExtended && category) {
      setSelectedCategoryIdsForEvent([category.id]);
    } else {
      setSelectedCategoryIdsForEvent([]);
    }

    // Planungsebenen-Auswahl zurücksetzen
    setSelectedPlanningLevelIds([]);
    // Auswahl der Eltern-Events zurücksetzen
    setSelectedParentEventIds([]);

    // Formularzustand zurücksetzen
    setTitle("");
    setDay("");
    setStartDate("");
    setEndDate("");
    setStartTime("");
    setEndTime("");
    setRemarks("");
    setInternalNotes("");
    setInKlaerung(false);
    setClarification("");
    setLocation("");
    setAttachmentsInput("");
    setSubmitError(null);
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

      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des Feiertags:", err);
      setSubmitError("Der Feiertag konnte nicht angelegt werden. Bitte versuchen Sie es erneut.");
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

      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen der Ferien:", err);
      setSubmitError("Die Ferien konnten nicht angelegt werden. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAllgemein = async () => {
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
        start_time: startTime || null,
        end_time: endTime || null,
        preacher: null,
        sermon_title: null,
        remarks: remarks.trim() || null,
        internal_notes: internalNotes.trim() || null,
        clarification: inKlaerung && clarification.trim() ? clarification.trim() : null,
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

      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des allgemeinen Events:", err);
      setSubmitError(
        "Der allgemeine Termin konnte nicht angelegt werden. Bitte versuche es erneut."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateGodiChild = async () => {
    if (!selectedCategory) {
      setSubmitError("Es ist keine Kategorie ausgewählt.");
      return;
    }

    if (selectedParentEventIds.length === 0) {
      setSubmitError("Bitte wähle mindestens einen Gottesdienst aus.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const selectedParents = gottesdienstEvents.filter((ev) =>
        selectedParentEventIds.includes(ev.id)
      );

      for (const parent of selectedParents) {
        const effectiveRemarks =
          applyDetailsToAllChildren && remarks.trim() ? remarks.trim() : null;
        const effectiveInternalNotes =
          applyDetailsToAllChildren && internalNotes.trim() ? internalNotes.trim() : null;
        const effectiveInKlaerung = applyDetailsToAllChildren ? inKlaerung : false;
        const effectiveClarification =
          applyDetailsToAllChildren &&
          effectiveInKlaerung &&
          clarification.trim()
            ? clarification.trim()
            : null;

        const childTitle =
          hasCustomTitleGodiChild && title.trim()
            ? title.trim()
            : selectedCategory.name;

        let childStartDate = parent.start_date;
        let childEndDate = parent.end_date ?? parent.start_date;
        let childStartTime = parent.start_time ?? null;
        let childEndTime = parent.end_time ?? null;

        if (isPredigtreiheGodiChild) {
          if (!startDate) {
            setSubmitError("Bitte Startdatum für die Predigtreihe wählen.");
            setSubmitting(false);
            return;
          }
          childStartDate = startDate;
          childEndDate = endDate || startDate;
          childStartTime = null;
          childEndTime = null;
        }

        const effectiveAttachments =
          isPredigtreiheGodiChild && attachmentsInput.trim()
            ? attachmentsInput.trim()
            : null;

        let planningLevelIds: number[] = [];
        if (isPredigtreiheGodiChild) {
          const predigtplanung = planningLevels.find(
            (pl) => pl.name && pl.name.trim().toLowerCase() === "predigtplanung"
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
          link: null,
          in_klaerung: effectiveInKlaerung,
          pco_id: null,
          besucherzahl: null,
          mail: null,
          attachments: effectiveAttachments,
          ort: null,
          link_id: null,
          planning_level_ids: planningLevelIds,
          category_ids: selectedCategoryIdsForEvent.length
            ? selectedCategoryIdsForEvent
            : [selectedCategory.id],
        };

        // Eltern-Gottesdienst-Kategorien um die Kategorie des Kindes ergänzen (falls bekannt)
        const existingParentCategories = Array.isArray(parent.category_ids)
          ? [...(parent.category_ids as number[])]
          : null;

        if (existingParentCategories && !existingParentCategories.includes(selectedCategory.id)) {
          existingParentCategories.push(selectedCategory.id);
          try {
            await apiFetch(`/events/${parent.id}`, {
              method: "PUT",
              body: JSON.stringify({ category_ids: existingParentCategories }),
            } as any);
          } catch (updateErr) {
            console.error(
              "Fehler beim Aktualisieren der Kategorien des Eltern-Gottesdienstes:",
              updateErr
            );
          }
        }

        await apiFetch("/events", {
          method: "POST",
          body: JSON.stringify(payload),
        } as any);
      }

      onClose();
    } catch (err) {
      console.error("Fehler beim Anlegen des Gottesdienst-Elements:", err);
      setSubmitError(
        "Das Gottesdienst-Element konnte nicht angelegt werden. Bitte versuche es erneut."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const changeMonth = (delta: number) => {
    setCalendarMonth((prev) => {
      const year = prev.getFullYear();
      const month = prev.getMonth();
      return new Date(year, month + delta, 1);
    });
  };

  const renderCalendar = (selectedValue: string | null, onSelect: (value: string) => void) => {
    const year = calendarMonth.getFullYear();
    const monthIndex = calendarMonth.getMonth();
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
    const slots: (number | null)[] = Array.from({ length: totalSlots }, (_, index) => {
      const dayNumber = index - leadingEmpty + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return null;
      }
      return dayNumber;
    });

    const monthLabel = calendarMonth.toLocaleDateString("de-DE", {
      month: "long",
      year: "numeric",
    });

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

    return (
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid #d1d5db",
          padding: "12px",
          backgroundColor: "#ffffff",
          minHeight: "305px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "18px",
              padding: "4px 8px",
            }}
          >
            ‹
          </button>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 600,
              textTransform: "capitalize",
              color: "#111827",
              whiteSpace: "nowrap",
            }}
          >
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "18px",
              padding: "4px 8px",
            }}
          >
            ›
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "4px",
            fontSize: "11px",
            marginBottom: "6px",
            textAlign: "center",
          }}
        >
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((label) => (
            <div
              key={label}
              style={{
                fontWeight: 600,
                color: "#4b5563",
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
            gap: "4px",
          }}
        >
          {slots.map((dayNumber, index) => {
            if (dayNumber == null) {
              return (
                <div
                  key={index}
                  style={{
                    padding: "6px 0",
                  }}
                />
              );
            }

            const value = formatDate(year, monthIndex, dayNumber);
            const isSelected = selectedValue === value;
            const isToday = value === todayValue;

            let backgroundColor = "#ffffff";
            let border = "1px solid transparent";
            let color = "#111827";

            if (isSelected) {
              backgroundColor = "#4f46e5";
              border = "1px solid #4338ca";
              color = "#ffffff";
            } else if (isToday) {
              backgroundColor = "#eff6ff";
              border = "1px solid #93c5fd";
            }

            return (
              <button
                key={value}
                type="button"
                onClick={() => onSelect(value)}
                style={{
                  padding: "6px 0",
                  borderRadius: "999px",
                  border,
                  backgroundColor,
                  color,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {dayNumber}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderCategoryButton = (category: Category) => {
    const isSelected = selectedCategoryId === category.id;
    const bgColor = category.color_hex || "#f3f4f6";

    return (
      <button
        key={category.id}
        type="button"
        onClick={() => handleSelectCategory(category.id)}
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "12px",
          padding: "12px 14px",
          borderRadius: "12px",
          border: isSelected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
          backgroundColor: isSelected ? "#eef2ff" : "#ffffff",
          cursor: "pointer",
          textAlign: "left",
          transition:
            "box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease",
          boxShadow: isSelected
            ? "0 4px 10px rgba(79, 70, 229, 0.18)"
            : "0 1px 3px rgba(15, 23, 42, 0.08)",
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
    ? "z. B. Teammeeting"
    : "Titel deines Events";

  const extendedSubmitLabel = selectedCategory?.name
    ? `${selectedCategory.name} anlegen`
    : "Event anlegen";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "24px",
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
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
            {step === 1 ? "Event-Typ auswählen" : `${selectedCategory?.name ?? "Event"} anlegen`}
          </h2>
          {step === 1 && (
            <p
              style={{
                marginTop: "4px",
                marginBottom: 0,
                fontSize: "14px",
                color: "#555555",
              }}
            >
              Bitte wähle aus, welchen Event-Typ du anlegen möchtest. Die Liste wird aus den vorhandenen Kategorien im
              System generiert.
            </p>
          )}
        </div>

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
            }}
          >
            {selectedCategory.symbol || "?"}
          </div>
        )}
      </div>

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
              Es wurden noch keine Kategorien angelegt. Bitte lege zuerst Kategorien an, bevor du einen Event-Typ
              auswählst.
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
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {nonGodiCategories.map((category) => renderCategoryButton(category))}
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
                    <strong>Gottesdienste</strong> angelegt oder diesen hinzugefügt werden.
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {godiItemCategories.map((category) => renderCategoryButton(category))}
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
          {!isGodiChildCategory && (
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
                  border: titleFocused ? "1px solid #60a5fa" : "1px solid #d1d5db",
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
                {renderCalendar(day || null, setDay)}
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Enddatum wird automatisch auf denselben Tag gesetzt. Planungsebene:{" "}
                <strong>Rahmenplan</strong>, Kategorie: <strong>Feiertag</strong>.
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
                  {renderCalendar(startDate || null, setStartDate)}
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
                  {renderCalendar(endDate || null, setEndDate)}
                </div>
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Planungsebene: <strong>Rahmenplan</strong>, Kategorie: <strong>Ferien</strong>.
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
                          : "Titel deines Specials"
                      }
                      onFocus={() => setTitleFocused(true)}
                      onBlur={() => setTitleFocused(false)}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: titleFocused ? "1px solid #60a5fa" : "1px solid #d1d5db",
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
                      readOnly
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

                {isPredigtreiheGodiChild && (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                        gap: "16px",
                        marginTop: "16px",
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
                        {renderCalendar(startDate || null, setStartDate)}
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
                        {renderCalendar(endDate || startDate || null, setEndDate)}
                      </div>
                    </div>

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
                      <input
                        type="text"
                        value={attachmentsInput}
                        onChange={(e) => setAttachmentsInput(e.target.value)}
                        placeholder="Link zum Dokument (z. B. Nextcloud)"
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #d1d5db",
                          fontSize: "14px",
                        }}
                      />
                      {attachmentsInput.trim() && (
                        <div
                          style={{
                            marginTop: "6px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            fontSize: "13px",
                          }}
                        >
                          <a
                            href={attachmentsInput}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              textDecoration: "underline",
                            }}
                          >
                            {getAttachmentLabel(attachmentsInput)}
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(attachmentsInput);
                                setCopyAttachmentStatus("success");
                                setTimeout(() => setCopyAttachmentStatus("idle"), 2000);
                              } catch (err) {
                                console.error("Fehler beim Kopieren der URL:", err);
                                setCopyAttachmentStatus("error");
                                setTimeout(() => setCopyAttachmentStatus("idle"), 2000);
                              }
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: "16px",
                            }}
                            aria-label="URL kopieren"
                            title="URL kopieren"
                          >
                            📋
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
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "11px",
                          color: "#6b7280",
                        }}
                      >
                        Bitte gib hier den Link zu deinem Dokument ein.
                      </div>
                    </div>
                  </>

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
                    {gottesdienstEvents.length === 0 && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#6b7280",
                        }}
                      >
                        Es wurden keine zukünftigen Gottesdienste mit Startdatum gefunden.
                      </div>
                    )}
                    {gottesdienstEvents.map((ev) => {
                      const checked = selectedParentEventIds.includes(ev.id);
                      const dateLabel = ev.start_date
                        ? new Date(ev.start_date).toLocaleDateString("de-DE", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "Ohne Datum";
                      const timeLabel =
                        ev.start_time && typeof ev.start_time === "string"
                          ? ev.start_time.substring(0, 5)
                          : "";

                      return (
                        <label
                          key={ev.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "6px 8px",
                            borderRadius: "8px",
                            backgroundColor: checked ? "#eef2ff" : "#ffffff",
                            border: checked ? "1px solid #4f46e5" : "1px solid #e5e7eb",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setSelectedParentEventIds((prev) => {
                                if (e.target.checked) {
                                  if (prev.includes(ev.id)) return prev;
                                  return [...prev, ev.id];
                                } else {
                                  return prev.filter((id) => id !== ev.id);
                                }
                              });
                            }}
                            style={{ margin: 0 }}
                          />
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 500,
                                color: "#111827",
                              }}
                            >
                              {ev.title}
                            </span>
                            <span
                              style={{
                                color: "#4b5563",
                              }}
                            >
                              {dateLabel}
                              {timeLabel ? `, ${timeLabel} Uhr` : ""}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

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
                    onChange={(e) => setApplyDetailsToAllChildren(e.target.checked)}
                    style={{ margin: 0 }}
                  />
                  <span>
                    Angaben in diesem Abschnitt für alle erzeugten Elemente übernehmen
                  </span>
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
                    Bemerkungen
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    disabled={!applyDetailsToAllChildren}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      resize: "vertical",
                      backgroundColor: !applyDetailsToAllChildren ? "#f3f4f6" : "#ffffff",
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
                    Interne Notizen
                  </label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={3}
                    disabled={!applyDetailsToAllChildren}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #d1d5db",
                      fontSize: "14px",
                      resize: "vertical",
                      backgroundColor: !applyDetailsToAllChildren ? "#f3f4f6" : "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inKlaerung}
                      onChange={(e) => setInKlaerung(e.target.checked)}
                    />
                    In Klärung
                  </label>

                  {inKlaerung && (
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          fontWeight: 500,
                          marginBottom: "4px",
                        }}
                      >
                        Klärung / offene Punkte
                      </label>
                      <textarea
                        value={clarification}
                        onChange={(e) => setClarification(e.target.value)}
                        rows={3}
                        disabled={!applyDetailsToAllChildren}
                        style={{
                          width: "100%",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: "1px solid #d1d5db",
                          fontSize: "14px",
                          resize: "vertical",
                          backgroundColor: !applyDetailsToAllChildren
                            ? "#f3f4f6"
                            : "#ffffff",
                        }}
                      />
                    </div>
                  )}
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
                    .filter((cat) => !cat.godi_item && !["gottesdienst", "feiertag", "ferien"].includes(cat.name?.toLowerCase() || ""))
                    .map((cat) => {
                    const checked = selectedCategoryIdsForEvent.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          border: checked ? "1px solid #4f46e5" : "1px solid #d1d5db",
                          backgroundColor: checked ? "#eef2ff" : "#ffffff",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setSelectedCategoryIdsForEvent((prev) => {
                              if (e.target.checked) {
                                if (prev.includes(cat.id)) return prev;
                                return [...prev, cat.id];
                              } else {
                                return prev.filter((id) => id !== cat.id);
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
                  {renderCalendar(startDate || null, setStartDate)}
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
                  {renderCalendar(endDate || null, setEndDate)}
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

      <div>
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
                    resize: "vertical",
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
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={inKlaerung}
                    disabled={!applyDetailsToAllChildren}
                    onChange={(e) => setInKlaerung(e.target.checked)}
                  />
                  In Klärung
                </label>

                {inKlaerung && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "13px",
                        fontWeight: 500,
                        marginBottom: "4px",
                      }}
                    >
                      Klärung / offene Punkte
                    </label>
                    <textarea
                      value={clarification}
                      onChange={(e) => setClarification(e.target.value)}
                      rows={3}
                      disabled={!applyDetailsToAllChildren}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #d1d5db",
                        fontSize: "14px",
                        resize: "vertical",
                        backgroundColor: !applyDetailsToAllChildren ? "#f3f4f6" : "#ffffff",
                      }}
                    />
                  </div>
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
                  Ort
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
                          border: checked ? "1px solid #4f46e5" : "1px solid #d1d5db",
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

        
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                }}
              >
                Die in Schritt 1 gewählte Kategorie ist standardmäßig vorausgewählt.{" "}
                Zusätzliche Kategorien und Planungsebenen kannst du hier ergänzen.
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
              Hier kannst du später weitere Angaben für diesen Event-Typ machen. Für den Moment steht dir nur der Titel
              zur Verfügung.
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "8px",
        }}
      >
        {step === 1 ? (
          <>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                fontSize: "14px",
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
              onClick={handleBackToStep1}
              style={{
                padding: "8px 14px",
                borderRadius: "999px",
                border: "1px solid #d1d5db",
                backgroundColor: "#ffffff",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Zurück
            </button>
            {isFeiertag ? (
              <button
                type="button"
                onClick={handleCreateFeiertag}
                disabled={submitting || !day}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: submitting || !day ? "#9ca3af" : "#4f46e5",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: submitting || !day ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Wird angelegt..." : "Feiertag anlegen"}
              </button>
            ) : isFerien ? (
              <button
                type="button"
                onClick={handleCreateFerien}
                disabled={submitting || !startDate || !endDate}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor:
                    submitting || !startDate || !endDate ? "#9ca3af" : "#4f46e5",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor:
                    submitting || !startDate || !endDate ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Wird angelegt..." : "Ferien anlegen"}
              </button>
            ) : usesExtendedForm ? (
              <button
                type="button"
                onClick={handleCreateAllgemein}
                disabled={submitting || !title.trim() || !startDate || !endDate}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor:
                    submitting || !title.trim() || !startDate || !endDate
                      ? "#9ca3af"
                      : "#4f46e5",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor:
                    submitting || !title.trim() || !startDate || !endDate
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting ? "Wird angelegt..." : extendedSubmitLabel}
              </button>
            ) : isGodiChildCategory ? (
              <button
                type="button"
                onClick={handleCreateGodiChild}
                disabled={submitting || selectedParentEventIds.length === 0}
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor:
                    submitting || selectedParentEventIds.length === 0
                      ? "#9ca3af"
                      : "#4f46e5",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor:
                    submitting || selectedParentEventIds.length === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {submitting ? "Wird angelegt..." : "Gottesdienst-Element anlegen"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                style={{
                  padding: "8px 16px",
                  borderRadius: "999px",
                  border: "none",
                  backgroundColor: "#9ca3af",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "not-allowed",
                }}
              >
                Speichern (folgt)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateEventWizard;
