import React, { useEffect, useState } from "react";
import { apiFetch } from "../api";

export type Category = {
  id: number;
  name: string;
  symbol: string;
  color_hex: string;
  description?: string | null;
  godi_item: boolean;
};

const EMOJI_OPTIONS = [
  "🎉",
  "🍷",
  "⛪",
  "🎉",
  "💧",
  "🧢",
  "📖",
  "🎶",
  "📅",
  "🏝️",
  "🙏",
  "⛺",
  "📢",
  "✈️",
  "🎤",
  "👤",
  "👶",
  "💰",
  "🌃",
  "⭐",
  "❓",
  "🚫",
  "🔐",
];

export const CategoryManagement: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newSymbol, setNewSymbol] = useState("🎵");
  const [newColor, setNewColor] = useState("#007bff");
  const [newDescription, setNewDescription] = useState("");
  const [newGodiItem, setNewGodiItem] = useState(false);

  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch("/categories");
      if (!res.ok) {
        throw new Error(`Failed to fetch categories: ${res.status}`);
      }
      const data: Category[] = await res.json();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (
    id: number,
    field: keyof Category,
    value: any
  ) => {
    setCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, [field]: value } : cat))
    );
  };

  const handleSaveCategory = async (category: Category) => {
    try {
      setSavingId(category.id);
      setError(null);

      const res = await apiFetch(`/categories/${category.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: category.name,
          symbol: category.symbol,
          color_hex: category.color_hex,
          description: category.description ?? null,
          godi_item: category.godi_item,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update category: ${res.status}`);
      }

      const updated = (await res.json()) as Category;
      setCategories((prev) =>
        prev.map((cat) => (cat.id === updated.id ? updated : cat))
      );
    } catch (err: any) {
      setError(err.message || "Failed to update category");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this category?"
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(id);
      setError(null);

      const res = await apiFetch(`/categories/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error(`Failed to delete category: ${res.status}`);
      }

      setCategories((prev) => prev.filter((cat) => cat.id !== id));
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreateCategory = async () => {
    if (!newName.trim()) {
      window.alert("Please enter a name for the new category.");
      return;
    }

    try {
      setError(null);

      const res = await apiFetch("/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newName.trim(),
          symbol: newSymbol,
          color_hex: newColor,
          description: newDescription.trim() || null,
          godi_item: newGodiItem,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to create category: ${res.status}`);
      }

      const created = (await res.json()) as Category;
      setCategories((prev) => [...prev, created]);

      setNewName("");
      setNewSymbol("🎵");
      setNewColor("#007bff");
      setNewDescription("");
      setNewGodiItem(false);
    } catch (err: any) {
      setError(err.message || "Failed to create category");
    }
  };

  return (
    <div className="grid max-w-3xl gap-4">
      {/* Create card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold">Categories</h2>
            <p className="mt-1 text-xs text-slate-500">
              Define reusable categories with emoji and color for visual
              grouping.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <h3 className="mb-2 text-[13px] font-semibold">Create new category</h3>

        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Name *
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="e.g. Sunday service"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Symbol (emoji)
            </label>
            <select
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              {EMOJI_OPTIONS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-700">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-lg border border-slate-300 p-0"
              />
              <span className="text-xs text-slate-500">{newColor}</span>
            </div>
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-slate-700">
            Description
          </label>
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Optional description for this category"
            rows={3}
          />
        </div>

        <div className="mb-3 flex items-center gap-2">
          <input
            id="new-godi-item"
            type="checkbox"
            checked={newGodiItem}
            onChange={(e) => setNewGodiItem(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          <label
            htmlFor="new-godi-item"
            className="text-xs font-medium text-slate-700"
          >
            Gottesdienst Element
          </label>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              setNewName("");
              setNewSymbol("🎵");
              setNewColor("#007bff");
              setNewDescription("");
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded-full border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            onClick={handleCreateCategory}
          >
            Create category
          </button>
        </div>
      </div>

      {/* Existing categories */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[15px] font-semibold">
              Existing categories
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Edit emoji, color, name or description. These settings are used
              across events.
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-xs text-slate-500">Loading&hellip;</p>
        )}

        {!loading && categories.length === 0 && (
          <p className="text-xs text-slate-500">No categories found.</p>
        )}

        {!loading && categories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-1 items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200"
                      style={{
                        backgroundColor: cat.color_hex || "#ffffff",
                      }}
                    >
                      <span>{cat.symbol}</span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="grid gap-2 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
                        <input
                          type="text"
                          value={cat.name}
                          onChange={(e) =>
                            handleFieldChange(cat.id, "name", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-[13px]"
                        />

                        <select
                          value={cat.symbol}
                          onChange={(e) =>
                            handleFieldChange(cat.id, "symbol", e.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-[13px]"
                        >
                          {EMOJI_OPTIONS.map((emoji) => (
                            <option key={emoji} value={emoji}>
                              {emoji}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={cat.color_hex || "#000000"}
                            onChange={(e) =>
                              handleFieldChange(
                                cat.id,
                                "color_hex",
                                e.target.value
                              )
                            }
                            className="h-7 w-8 cursor-pointer rounded-md border border-slate-300 p-0"
                          />
                          <span className="text-[11px] text-slate-500">
                            {cat.color_hex}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1">
                        <label className="mb-0.5 block text-[11px] font-medium text-slate-700">
                          Description
                        </label>
                        <textarea
                          value={cat.description ?? ""}
                          onChange={(e) =>
                            handleFieldChange(
                              cat.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]"
                          rows={2}
                          placeholder="Optional description for this category"
                        />
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <input
                          id={`godi-item-${cat.id}`}
                          type="checkbox"
                          checked={cat.godi_item}
                          onChange={(e) =>
                            handleFieldChange(cat.id, "godi_item", e.target.checked)
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <label
                          htmlFor={`godi-item-${cat.id}`}
                          className="text-[11px] font-medium text-slate-700"
                        >
                          Gottesdienst Element
                        </label>
                      </div>

                      <div className="mt-0.5">
                        <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600">
                          ID: {cat.id}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col gap-1 sm:flex-row">
                    <button
                      type="button"
                      className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      onClick={() => handleSaveCategory(cat)}
                      disabled={savingId === cat.id}
                    >
                      {savingId === cat.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-700 bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                      onClick={() => handleDeleteCategory(cat.id)}
                      disabled={deletingId === cat.id}
                    >
                      {deletingId === cat.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
