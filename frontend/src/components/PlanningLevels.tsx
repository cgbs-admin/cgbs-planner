import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";

type PlanningLevel = {
  id: number;
  name: string;
};

export const PlanningLevelsPanel: React.FC = () => {
  const [levels, setLevels] = useState<PlanningLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchPlanningLevels();
  }, []);

  const fetchPlanningLevels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/planning-levels");
      if (!res.ok) {
        throw new Error(`Failed to fetch planning levels: ${res.status}`);
      }
      const data: PlanningLevel[] = await res.json();
      setLevels(data);
    } catch (err: any) {
      setError(err.message || "Failed to load planning levels");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (id: number, value: string) => {
    setLevels((prev) =>
      prev.map((level) => (level.id === id ? { ...level, name: value } : level))
    );
  };

  const handleSaveLevel = async (level: PlanningLevel) => {
    if (!level.name.trim()) {
      window.alert("Name cannot be empty.");
      return;
    }

    try {
      setSavingId(level.id);
      setError(null);

      const res = await apiFetch(`/planning-levels/${level.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: level.name.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update planning level: ${res.status}`);
      }

      const updated = (await res.json()) as PlanningLevel;
      setLevels((prev) =>
        prev.map((l) => (l.id === updated.id ? updated : l))
      );
    } catch (err: any) {
      setError(err.message || "Failed to update planning level");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteLevel = async (id: number) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this planning level?"
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      setError(null);

      const res = await apiFetch(`/planning-levels/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete planning level: ${res.status}`);
      }

      setLevels((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete planning level");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateLevel = async () => {
    if (!newName.trim()) {
      window.alert("Please enter a name for the new planning level.");
      return;
    }

    try {
      setError(null);

      const res = await apiFetch("/planning-levels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create planning level: ${res.status}`);
      }

      const created = (await res.json()) as PlanningLevel;
      setLevels((prev) => [...prev, created]);
      setNewName("");
    } catch (err: any) {
      setError(err.message || "Failed to create planning level");
    }
  };

  return (
    <div className="grid max-w-3xl gap-4">
      {/* Create card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold">Planning levels</h2>
            <p className="mt-1 text-xs text-slate-500">
              Describe the status/maturity of planning and reuse across events.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <h3 className="mb-2 text-[13px] font-semibold">
          Create new planning level
        </h3>

        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1.6fr)]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Draft, Confirmed, Published"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => setNewName("")}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-full border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            onClick={handleCreateLevel}
          >
            Create level
          </button>
        </div>
      </div>

      {/* Existing levels */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[15px] font-semibold">
              Existing planning levels
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Edit names in place or remove levels no longer needed.
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-xs text-slate-500">Loading&hellip;</p>
        )}

        {!loading && levels.length === 0 && (
          <p className="text-xs text-slate-500">No planning levels found.</p>
        )}

        {!loading && levels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {levels.map((level) => (
              <div
                key={level.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-2.5 py-1.5"
              >
                <div className="flex-1">
                  <label className="mb-0.5 block text-[11px] font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    type="text"
                    value={level.name}
                    onChange={(e) =>
                      handleFieldChange(level.id, e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-1 text-[13px]"
                  />
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    ID: {level.id}
                  </div>
                </div>

                <div className="flex flex-shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    onClick={() => handleSaveLevel(level)}
                    disabled={savingId === level.id}
                  >
                    {savingId === level.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-red-700 bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                    onClick={() => handleDeleteLevel(level.id)}
                    disabled={deletingId === level.id}
                  >
                    {deletingId === level.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanningLevelsPanel;
