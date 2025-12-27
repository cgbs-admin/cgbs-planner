// src/components/Login.extended.tsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch, setAuthToken } from "../api";

interface LoginProps {
  onLoginSuccess: () => void;
}

type FocusField = "username" | "password" | null;

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [focusField, setFocusField] = useState<FocusField>(null);
  const [hoverLogin, setHoverLogin] = useState(false);
  const [pressLogin, setPressLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Ensure fields are always blank when the login screen is shown.
  useEffect(() => {
    setUsername("");
    setPassword("");
  }, []);

  const brand = useMemo(
    () => ({
      ink: "#0f172a",
      inkMuted: "#475569",
      border: "#e5e7eb",
      borderStrong: "#d1d5db",
      surface: "#ffffff",
      surfaceSoft: "#f8fafc",
      brand: "#4f46e5",
      brandHover: "#4338ca",
      ring: "rgba(79, 70, 229, 0.18)",
      danger: "#b91c1c",
    }),
    []
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

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
        setError("Anmeldung fehlgeschlagen. Bitte überprüfe Benutzername und Passwort.");
        return;
      }

      const data: { access_token: string; token_type: string } = await response.json();
      setAuthToken(data.access_token);
      onLoginSuccess();
    } catch (_err) {
      setError("Unerwarteter Fehler. Bitte versuche es erneut.");
    } finally {
      setLoading(false);
    }
  }

  const fieldBaseStyle: React.CSSProperties = {
    width: "100%",
    height: "44px", // touch-friendly
    borderRadius: "12px",
    border: `1px solid ${brand.border}`,
    background: brand.surface,
    color: brand.ink,
    padding: "0 12px",
    fontSize: "14px",
    outline: "none",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
    transition: "box-shadow 0.15s ease, border-color 0.15s ease, transform 0.15s ease",
  };

  const focusedStyle: React.CSSProperties = {
    border: `1px solid ${brand.brand}`,
    boxShadow: `0 0 0 3px ${brand.ring}, 0 1px 3px rgba(15, 23, 42, 0.08)`,
  };

  const loginButtonStyle: React.CSSProperties = {
    width: "100%",
    height: "44px",
    borderRadius: "12px",
    border: "1px solid transparent",
    background: hoverLogin ? brand.brandHover : brand.brand,
    color: "#ffffff",
    fontWeight: 400,
    letterSpacing: "0.2px",
    cursor: loading ? "not-allowed" : "pointer",
    boxShadow: hoverLogin
      ? "0 6px 14px rgba(79, 70, 229, 0.22)"
      : "0 4px 10px rgba(79, 70, 229, 0.18)",
    transform: pressLogin ? "translateY(1px)" : "none",
    opacity: loading ? 0.75 : 1,
    transition: "box-shadow 0.15s ease, transform 0.05s ease, background-color 0.15s ease",
  };

  const subtleButtonStyle: React.CSSProperties = {
    border: `1px solid ${brand.border}`,
    background: brand.surface,
    color: brand.inkMuted,
    borderRadius: "12px",
    height: "44px",
    padding: "0 12px",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 14px",
        background: "linear-gradient(to bottom, #c4b3cd, #f4dfcd, #d5e1dd)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "14px",
        }}
      >
        {/* Logo */}
        <img
          src="/logo.png"
          alt="Logo"
          style={{
            width: "auto",
            height: "128px",
            objectFit: "contain",
            userSelect: "none",
          }}
          draggable={false}
        />

        {/* Card */}
        <div
          style={{
            width: "100%",
            borderRadius: "18px",
            border: `1px solid ${brand.border}`,
            background: brand.surface,
            padding: "18px",
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.10)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "14px" }}>
            <div style={{ fontSize: "16px", fontWeight: 400, color: brand.ink, letterSpacing: "0.4px" }}>
              CGBS PLANNER
            </div>
          </div>

          <form onSubmit={handleSubmit} autoComplete="off" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label
                htmlFor="login-username"
                style={{ display: "block", fontSize: "12px", fontWeight: 400, color: brand.inkMuted, marginBottom: "6px" }}
              >
                Benutzername
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusField("username")}
                onBlur={() => setFocusField((prev) => (prev === "username" ? null : prev))}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="next"
                style={{
                  ...fieldBaseStyle,
                  ...(focusField === "username" ? focusedStyle : null),
                }}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                style={{ display: "block", fontSize: "12px", fontWeight: 400, color: brand.inkMuted, marginBottom: "6px" }}
              >
                Passwort
              </label>

              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusField("password")}
                  onBlur={() => setFocusField((prev) => (prev === "password" ? null : prev))}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  style={{
                    ...fieldBaseStyle,
                    flex: 1,
                    ...(focusField === "password" ? focusedStyle : null),
                  }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  style={{
                    ...subtleButtonStyle,
                    width: "56px",
                    flexShrink: 0,
                    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(185, 28, 28, 0.25)",
                  background: "rgba(185, 28, 28, 0.06)",
                  color: brand.danger,
                  padding: "10px 12px",
                  fontSize: "13px",
                  lineHeight: 1.35,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onMouseEnter={() => setHoverLogin(true)}
              onMouseLeave={() => {
                setHoverLogin(false);
                setPressLogin(false);
              }}
              onMouseDown={() => setPressLogin(true)}
              onMouseUp={() => setPressLogin(false)}
              onTouchStart={() => setPressLogin(true)}
              onTouchEnd={() => setPressLogin(false)}
              style={loginButtonStyle}
            >
              {loading ? "Anmelden…" : "Anmelden"}
            </button>

            <div style={{ textAlign: "center", fontSize: "12px", color: brand.inkMuted, marginTop: "2px" }}>
              {loading ? "Bitte warten…" : " "}
            </div>
          </form>
        </div>

        {/* Small footer spacing for safe-area on mobile */}
        <div style={{ height: "8px" }} />
      </div>
    </div>
  );
};

export default Login;
