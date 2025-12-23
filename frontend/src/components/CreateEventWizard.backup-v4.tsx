import React, { useState, useEffect } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { apiFetch } from "../api";

type EventType = "GOTTESDIENST" | "OTHER";

interface CreateEventWizardProps {
  onClose: () => void;
  onCreated: () => void; // call after successful creation so parent can reload
}

interface PlanningLevel {
  id: number;
  name: string;
}

interface CreatedEvent {
  id: number;
}

interface StartTimeEntry {
  time: string; // "HH:MM"
  inKlaerung: boolean;
}

function timeLabelFromHHMM(time: string): string {
  const [h, m] = time.split(":");
  if (m === "00") {
    return `${parseInt(h, 10)}er`;
  }
  return `${h}:${m}er`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const total = h * 60 + m + minutes;
  const endH = Math.floor((total / 60) % 24);
  const endM = total % 60;
  return `${endH.toString().padStart(2, "0")}:${endM
    .toString()
    .padStart(2, "0")}`;
}

function findPredigtplanungId(levels: PlanningLevel[]): number | null {
  for (const pl of levels) {
    const norm = (pl.name || "")
      .toLowerCase()
      .replace(/\./g, "")
      .trim();
    if (norm.startsWith("predigtplanung")) {
      return pl.id;
    }
  }
  return null;
}

export const CreateEventWizard: React.FC<CreateEventWizardProps> = ({
  onClose,
  onCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [eventType, setEventType] = useState<EventType | null>(null);

  // Shared / Gottesdienst state
  const [date, setDate] = useState<string>(""); // YYYY-MM-DD
  const [startTimes, setStartTimes] = useState<StartTimeEntry[]>([]);
  const [customTimeInput, setCustomTimeInput] = useState<string>("");

  const [preacher, setPreacher] = useState<string>("");
  const [sermonTitle, setSermonTitle] = useState<string>("");

  const [planningLevels, setPlanningLevels] = useState<PlanningLevel[]>([]);
  const [selectedPlanningLevelIds, setSelectedPlanningLevelIds] = useState<
    number[]
  >([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load planning levels to preselect "Predigtplanung"
  useEffect(() => {
    const loadPlanningLevels = async () => {
      try {
        const raw = await apiFetch("/planning-levels");

        let data: PlanningLevel[] = [];
        if (Array.isArray(raw)) {
          data = raw;
        } else if (raw && Array.isArray((raw as any).items)) {
          data = (raw as any).items;
        } else {
          console.error("Unexpected /planning-levels response", raw);
          data = [];
        }

        setPlanningLevels(data);

        const predigtId = findPredigtplanungId(data);
        if (predigtId != null) {
          setSelectedPlanningLevelIds([predigtId]);
        } else if (data.length > 0) {
          setSelectedPlanningLevelIds([data[0].id]);
        } else {
          setSelectedPlanningLevelIds([]);
        }
      } catch (e) {
        console.error("Failed to load planning levels", e);
        setPlanningLevels([]);
        setSelectedPlanningLevelIds([]);
      }
    };

    loadPlanningLevels();
  }, []);

  const handleSelectEventType = (type: EventType) => {
    setEventType(type);
    if (type === "GOTTESDIENST") {
      setStep(2);
    } else {
      setStep(4);
    }
  };

  const hasTime = (time: string) =>
    startTimes.some((entry) => entry.time === time);

  const addSuggestedTime = (time: string) => {
    if (!hasTime(time)) {
      setStartTimes((prev) =>
        [...prev, { time, inKlaerung: false }].sort((a, b) =>
          a.time.localeCompare(b.time)
        )
      );
    }
  };

  const addCustomTime = () => {
    if (!customTimeInput) return;
    const match = customTimeInput.match(/^([01]\d|2[0-3]):[0-5]\d$/);
    if (!match) {
      setError("Bitte ein gültiges Zeitformat HH:MM eingeben.");
      return;
    }
    if (!hasTime(customTimeInput)) {
      setStartTimes((prev) =>
        [...prev, { time: customTimeInput, inKlaerung: false }].sort((a, b) =>
          a.time.localeCompare(b.time)
        )
      );
    }
    setCustomTimeInput("");
    setError(null);
  };

  const removeTime = (time: string) => {
    setStartTimes((prev) => prev.filter((t) => t.time !== time));
  };

  const toggleInKlaerung = (time: string) => {
    setStartTimes((prev) =>
      prev.map((entry) =>
        entry.time === time
          ? { ...entry, inKlaerung: !entry.inKlaerung }
          : entry
      )
    );
  };

  const canContinueFromStep3 = date !== "" && startTimes.length > 0;

  const handleSubmitGottesdienst = async () => {
    if (!canContinueFromStep3) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // Determine effective planning levels: default to Predigtplanung if nothing selected
      let effectivePlanningLevelIds = selectedPlanningLevelIds;
      if (
        (!effectivePlanningLevelIds ||
          effectivePlanningLevelIds.length === 0) &&
        planningLevels.length > 0
      ) {
        const predigtId = findPredigtplanungId(planningLevels);
        if (predigtId != null) {
          effectivePlanningLevelIds = [predigtId];
        } else {
          effectivePlanningLevelIds = [planningLevels[0].id];
        }
      }

      // 1) Parent event (Gottesdienst)
      const parentPayload: any = {
        title: "Gottesdienst",
        start_date: date,
        end_date: date,
        start_time: null,
        end_time: null,
        preacher: preacher || null,
        sermon_title: sermonTitle || null,
        planning_level_ids: effectivePlanningLevelIds ?? [],
      };

      const parent: CreatedEvent = await apiFetch("/events", {
        method: "POST",
        body: JSON.stringify(parentPayload),
      });

      // 2) Sub-events for each start time
      for (const entry of startTimes) {
        const time = entry.time;
        const endTime = addMinutesToTime(time, 90);
        const label = timeLabelFromHHMM(time);

        const childPayload: any = {
          title: `Godi ${label}`,
          parent_id: parent.id,
          start_date: date,
          end_date: date,
          // IMPORTANT: use "HH:MM" like AddEventForm, not HH:MM:SS
          start_time: time,
          end_time: endTime,
          preacher: preacher || null,
          sermon_title: sermonTitle || null,
          planning_level_ids: effectivePlanningLevelIds ?? [],
        };

        if (entry.inKlaerung) {
          childPayload.clarification = "In Klärung";
        }

        await apiFetch("/events", {
          method: "POST",
          body: JSON.stringify(childPayload),
        });
      }

      setIsSubmitting(false);
      onCreated();
      onClose();
    } catch (e: any) {
      console.error("Error creating Gottesdienst", e);
      setIsSubmitting(false);
      setError("Beim Anlegen des Gottesdienstes ist ein Fehler aufgetreten.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Step indicator */}
      <div className="text-sm text-gray-600">
        {eventType === "GOTTESDIENST"
          ? `Schritt ${step} von 4`
          : step === 1
          ? "Schritt 1 von 2"
          : "Schritt 2 von 2"}
      </div>

      {/* STEP 1 – Choose event type */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Was möchten Sie anlegen?</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleSelectEventType("GOTTESDIENST")}
              className="rounded-xl border px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="font-medium">Gottesdienst</div>
              <div className="text-sm text-gray-600">
                Mehrere Startzeiten, automatische Unter-Events.
              </div>
            </button>
            <button
              type="button"
              onClick={() => handleSelectEventType("OTHER")}
              className="rounded-xl border px-4 py-3 text-left hover:bg-gray-50"
            >
              <div className="font-medium">Anderes Event</div>
              <div className="text-sm text-gray-600">
                Einfaches Event mit freier Konfiguration.
              </div>
            </button>
          </div>
        </div>
      )}

{/* STEP 2 – Date (Gottesdienst only) */}
{step === 2 && eventType === "GOTTESDIENST" && (
  <div className="flex flex-col gap-4">
    <h2 className="text-lg font-semibold">Datum auswählen</h2>
    <p className="text-sm text-gray-600">
      Wählen Sie ein Datum für den Gottesdienst. Nach dem Klick auf einen
      Tag springen Sie automatisch zum nächsten Schritt, um die Zeiten zu wählen.
    </p>

    <div className="flex justify-center">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <Calendar
          onClickDay={(value) => {
            const iso = value.toISOString().slice(0, 10); // YYYY-MM-DD
            setDate(iso);
            setStep(3);
          }}
          locale="de-DE"
          className="w-full"
        />
      </div>
    </div>

    <div className="text-xs text-center text-gray-500">
      Tipp: Sie können den Vorgang jederzeit abbrechen, indem Sie den Dialog schließen.
    </div>

    <button
      type="button"
      onClick={() => setStep(1)}
      className="self-start text-sm text-gray-600"
    >
      Zurück
    </button>
  </div>
)}

      {/* STEP 3 – Start times (Gottesdienst only) */}
      {step === 3 && eventType === "GOTTESDIENST" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Startzeiten wählen</h2>
          <div className="text-sm text-gray-600">
            Sie können mehrere Startzeiten anlegen. Für jede Startzeit wird ein
            eigenes Unter-Event mit 90 Minuten Dauer erzeugt. Optional können
            Sie Startzeiten als <span className="font-medium">"In Klärung"</span> markieren.
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addSuggestedTime("10:00")}
              className="rounded-full border px-3 py-1 text-sm"
            >
              10er (10:00)
            </button>
            <button
              type="button"
              onClick={() => addSuggestedTime("12:00")}
              className="rounded-full border px-3 py-1 text-sm"
            >
              12er (12:00)
            </button>
            <button
              type="button"
              onClick={() => addSuggestedTime("19:00")}
              className="rounded-full border px-3 py-1 text-sm"
            >
              19er (19:00)
            </button>
          </div>

          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="flex flex-col gap-1 text-sm">
                <span>Eigene Startzeit (HH:MM)</span>
                <input
                  type="time"
                  value={customTimeInput}
                  onChange={(e) => setCustomTimeInput(e.target.value)}
                  className="rounded-md border px-3 py-2"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={addCustomTime}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Hinzufügen
            </button>
          </div>

          {startTimes.length > 0 && (
            <div className="mt-2 text-sm">
              <div className="mb-1 font-medium">Ausgewählte Startzeiten:</div>
              <div className="flex flex-col gap-2">
                {startTimes.map((entry) => (
                  <div
                    key={entry.time}
                    className="flex items-center justify-between gap-3 rounded-full border px-3 py-1"
                  >
                    <div className="flex items-center gap-2">
                      <span>
                        {entry.time} ({timeLabelFromHHMM(entry.time)})
                      </span>
                      <label className="flex items-center gap-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={entry.inKlaerung}
                          onChange={() => toggleInKlaerung(entry.time)}
                        />
                        <span>In Klärung</span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTime(entry.time)}
                      className="text-xs text-gray-500"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="text-sm text-gray-600"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={!canContinueFromStep3}
              onClick={() => setStep(4)}
              className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
            >
              Weiter
            </button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>
      )}

      {/* STEP 4 – Details (Gottesdienst) OR handover for "other event" */}
      {step === 4 && (
        <div className="flex flex-col gap-4">
          {eventType === "GOTTESDIENST" ? (
            <>
              <h2 className="text-lg font-semibold">Details zum Gottesdienst</h2>

              <label className="flex flex-col gap-1 text-sm">
                <span>Prediger*in</span>
                <input
                  type="text"
                  value={preacher}
                  onChange={(e) => setPreacher(e.target.value)}
                  className="rounded-md border px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Predigttitel</span>
                <input
                  type="text"
                  value={sermonTitle}
                  onChange={(e) => setSermonTitle(e.target.value)}
                  className="rounded-md border px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Planungslevel</span>
                <select
                  multiple
                  value={selectedPlanningLevelIds.map(String)}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions
                    ).map((o) => Number(o.value));
                    setSelectedPlanningLevelIds(values);
                  }}
                  className="h-24 rounded-md border px-3 py-2"
                >
                  {planningLevels.map((pl) => (
                    <option key={pl.id} value={pl.id}>
                      {pl.name}
                    </option>
                  ))}
                </select>
              </label>

              {error && (
                <div className="mt-1 text-sm text-red-600">{error}</div>
              )}

              <div className="mt-4 flex justify-between">
                <button
                  type="button"
                  onClick={() =>
                    eventType === "GOTTESDIENST" ? setStep(3) : setStep(1)
                  }
                  className="text-sm text-gray-600"
                >
                  Zurück
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border px-4 py-2 text-sm"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitGottesdienst}
                    disabled={isSubmitting || !canContinueFromStep3}
                    className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {isSubmitting ? "Speichern…" : "Gottesdienst anlegen"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm">
                Hier sollte Ihr bestehendes Formular für „Anderes Event“
                eingebettet werden (AddEventForm im Create-Modus).
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
