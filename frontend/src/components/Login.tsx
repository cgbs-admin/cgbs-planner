// src/components/Login.tsx
import React, { useState } from "react";
import { apiFetch, setAuthToken } from "../api";

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const body = new URLSearchParams();
      body.set("username", username);
      body.set("password", password);

      const response = await apiFetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        setError("Anmeldung fehlgeschlagen. Bitte überprüfen Sie Benutzername und Passwort.");
        return;
      }

      const data: { access_token: string; token_type: string } =
        await response.json();

      setAuthToken(data.access_token);
      onLoginSuccess();
    } catch (err) {
      console.error("Login error", err);
      setError("Unerwarteter Fehler während der Anmeldung.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{
        background: "linear-gradient(to bottom, #c4b3cd, #f4dfcd, #d5e1dd)",
      }}
    >
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Logo above the card */}
        <img
          src="https://media.cghh-bs.de/s/SLWHHBiY8946ETY/download"
          alt="Logo"
          className="mb-6 h-32 w-auto"
        />

        {/* Card */}
        <div className="w-full rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-card">
          <h2 className="mb-4 text-center text-lg font-semibold text-ink">
            CGBS PLANNER
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Benutzername
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-surface-soft bg-white px-2.5 py-1.5 text-sm text-ink focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">
                Passwort
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-soft bg-white px-2.5 py-1.5 text-sm text-ink focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>

            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-brand-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-primarySoft disabled:opacity-60"
            >
              {loading ? "Wird angemeldet…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
