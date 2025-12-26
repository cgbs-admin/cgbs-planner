import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api";

type UserRole = "admin" | "viewer" | "welcome";

type UserDTO = {
  id: number;
  username: string;
  role: UserRole;
  is_active: boolean;
};

function normalizeUsers(data: unknown): UserDTO[] | null {
  if (Array.isArray(data)) return data as UserDTO[];
  const asAny = data as any;
  if (asAny && Array.isArray(asAny.items)) return asAny.items as UserDTO[];
  if (asAny && Array.isArray(asAny.data)) return asAny.data as UserDTO[];
  return null;
}

function previewJson(data: unknown): string {
  try {
    if (data === null) return "null";
    if (data === undefined) return "undefined";
    if (typeof data === "string") return data.slice(0, 400);
    return JSON.stringify(data, null, 2).slice(0, 400);
  } catch {
    return String(data).slice(0, 400);
  }
}

function base64UrlDecode(input: string): string {
  // Convert base64url to base64
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  // Pad
  const padded = base64 + "===".slice((base64.length + 3) % 4);
  try {
    return decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(padded);
  }
}

function getCurrentUsernameFromToken(): string | null {
  try {
    const token = window.localStorage.getItem("authToken");
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson);
    // backend uses "sub" for username
    return typeof payload?.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");
  const [newRole, setNewRole] = useState<UserRole>("viewer");
  const [newIsActive, setNewIsActive] = useState<boolean>(true);

  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState<string>("");
  const [resetSaving, setResetSaving] = useState<boolean>(false);

  const currentUsername = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getCurrentUsernameFromToken();
  }, []);

  const canSubmit = useMemo(
    () => newUsername.trim().length > 0 && newPassword.length >= 4,
    [newUsername, newPassword]
  );

  const canResetPassword = useMemo(() => resetPassword.length >= 4, [resetPassword]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/users");
      const data: unknown = await res.json();

      const normalized = normalizeUsers(data);
      if (!normalized) {
        setUsers([]);
        setError(
          "Unerwartete Antwort von /users. Erwartet wurde eine Liste von Benutzern, erhalten wurde:\n" +
            previewJson(data)
        );
        return;
      }

      setUsers(normalized);
    } catch (e: any) {
      setUsers([]);
      setError(e?.message || "Benutzer konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    try {
      await apiFetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          is_active: newIsActive,
        }),
      });

      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      setNewIsActive(true);

      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Benutzer konnte nicht erstellt werden.");
    }
  }

  async function updateUser(userId: number, patch: Partial<Pick<UserDTO, "role" | "is_active">>) {
    setError(null);
    try {
      // Some backends define PUT /users/{id} as a full update.
      // To keep compatibility, we always send role + is_active.
      const current = users.find((u) => u.id === userId);
      const body = {
        role: patch.role ?? current?.role,
        is_active: patch.is_active ?? current?.is_active,
      };

      await apiFetch(`/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadUsers();
    } catch (e: any) {
      setError(e?.message || "Benutzer konnte nicht aktualisiert werden.");
    }
  }

  async function resetUserPassword(userId: number, password: string) {
    setError(null);
    setResetSaving(true);
    try {
      // Your backend exposes password update via PUT /users/{user_id}
      // (same endpoint as role / is_active), so we send password + current role + is_active.
      const current = users.find((u) => u.id === userId);
      const body = {
        password,
        role: current?.role ?? "viewer",
        is_active: current?.is_active ?? true,
      };

      await apiFetch(`/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setResetUserId(null);
      setResetPassword("");
    } catch (e: any) {
      setError(
        e?.message ||
          "Passwort konnte nicht zurückgesetzt werden. Hinweis: Der Request nutzt PUT /users/{id} (inkl. password, role, is_active). Bitte prüfe den Network-Tab und die Backend-Logs, falls weiterhin kein Update erfolgt."
      );
    } finally {
      setResetSaving(false);
    }
  }

  function isSelf(u: UserDTO): boolean {
    return !!currentUsername && u.username === currentUsername;
  }

  function getSelfProtectionHint(u: UserDTO): string | null {
    if (!isSelf(u)) return null;
    return "Der aktuell angemeldete Admin kann sich nicht selbst deaktivieren oder die Admin-Rolle entfernen.";
  }

  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={{ margin: 0 }}>Benutzerverwaltung</h2>
          {currentUsername && (
            <div style={{ fontSize: 12, color: "#666" }}>
              Angemeldet als: <strong>{currentUsername}</strong>
            </div>
          )}
        </div>
        <button
          onClick={() => void loadUsers()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #ddd",
            background: "white",
            cursor: "pointer",
          }}
        >
          Aktualisieren
        </button>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid #f3c7c7",
            background: "#fff5f5",
            color: "#7a1a1a",
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e6e6e6",
          background: "white",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Benutzer erstellen</h3>

        <form onSubmit={onCreateUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12 }}>Benutzername</label>
            <input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="z. B. john"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              autoComplete="off"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12 }}>Passwort</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="mind. 4 Zeichen"
              type="password"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
              autoComplete="new-password"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12 }}>Rolle</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "white" }}
            >
              <option value="viewer">viewer</option>
              <option value="welcome">welcome</option>
              <option value="admin">admin</option>
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 12 }}>Aktiv</label>
            <select
              value={newIsActive ? "true" : "false"}
              onChange={(e) => setNewIsActive(e.target.value === "true")}
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd", background: "white" }}
            >
              <option value="true">ja</option>
              <option value="false">nein</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: canSubmit ? "white" : "#f6f6f6",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              Erstellen
            </button>

            <span style={{ fontSize: 12, color: "#666" }}>Hinweis: Nur Admins können Benutzer erstellen.</span>
          </div>
        </form>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          border: "1px solid #e6e6e6",
          background: "white",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Bestehende Benutzer</h3>

        {loading ? (
          <div style={{ padding: 8 }}>Lädt…</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 8 }}>Keine Benutzer gefunden.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                  <th style={{ padding: "10px 8px" }}>ID</th>
                  <th style={{ padding: "10px 8px" }}>Benutzername</th>
                  <th style={{ padding: "10px 8px" }}>Rolle</th>
                  <th style={{ padding: "10px 8px" }}>Aktiv</th>
                  <th style={{ padding: "10px 8px" }}>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = isSelf(u);
                  const hint = getSelfProtectionHint(u);
                  const isResetting = resetUserId === u.id;

                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid #f3f3f3" }}>
                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{u.id}</td>
                      <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>
                        {u.username} {self ? <span style={{ color: "#666" }}>(Du)</span> : null}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <select
                          value={u.role}
                          disabled={self}
                          title={hint || undefined}
                          onChange={(e) => void updateUser(u.id, { role: e.target.value as UserRole })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: self ? "#f6f6f6" : "white",
                            cursor: self ? "not-allowed" : "pointer",
                          }}
                        >
                          <option value="viewer">viewer</option>
                          <option value="welcome">welcome</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <select
                          value={u.is_active ? "true" : "false"}
                          disabled={self}
                          title={hint || undefined}
                          onChange={(e) => void updateUser(u.id, { is_active: e.target.value === "true" })}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: self ? "#f6f6f6" : "white",
                            cursor: self ? "not-allowed" : "pointer",
                          }}
                        >
                          <option value="true">ja</option>
                          <option value="false">nein</option>
                        </select>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 280 }}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              disabled={self}
                              title={hint || undefined}
                              onClick={() => void updateUser(u.id, { is_active: !u.is_active })}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #ddd",
                                background: self ? "#f6f6f6" : "white",
                                cursor: self ? "not-allowed" : "pointer",
                              }}
                            >
                              {u.is_active ? "Deaktivieren" : "Aktivieren"}
                            </button>

                            <button
                              onClick={() => {
                                if (isResetting) {
                                  setResetUserId(null);
                                  setResetPassword("");
                                  return;
                                }
                                setResetUserId(u.id);
                                setResetPassword("");
                              }}
                              style={{
                                padding: "8px 10px",
                                borderRadius: 10,
                                border: "1px solid #ddd",
                                background: "white",
                                cursor: "pointer",
                              }}
                            >
                              Passwort zurücksetzen
                            </button>
                          </div>

                          {isResetting && (
                            <div
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: "1px solid #eee",
                                background: "#fafafa",
                              }}
                            >
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                <label style={{ fontSize: 12, color: "#444" }}>Neues Passwort (mind. 4 Zeichen)</label>
                                <input
                                  value={resetPassword}
                                  onChange={(e) => setResetPassword(e.target.value)}
                                  type="password"
                                  autoComplete="new-password"
                                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
                                />

                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  <button
                                    disabled={!canResetPassword || resetSaving}
                                    onClick={() => void resetUserPassword(u.id, resetPassword)}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      border: "1px solid #ddd",
                                      background: !canResetPassword || resetSaving ? "#f6f6f6" : "white",
                                      cursor: !canResetPassword || resetSaving ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {resetSaving ? "Speichert…" : "Speichern"}
                                  </button>

                                  <button
                                    disabled={resetSaving}
                                    onClick={() => {
                                      setResetUserId(null);
                                      setResetPassword("");
                                    }}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      border: "1px solid #ddd",
                                      background: resetSaving ? "#f6f6f6" : "white",
                                      cursor: resetSaving ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    Abbrechen
                                  </button>

                                  <span style={{ fontSize: 12, color: "#666" }}>
                                    Setzt das Passwort für <strong>{u.username}</strong>.
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
