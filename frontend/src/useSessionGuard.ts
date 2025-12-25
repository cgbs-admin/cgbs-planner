// src/useSessionGuard.ts
// Session guard that:
// 1) Logs out after inactivity
// 2) When the app regains focus/visibility, performs a lightweight auth check
// 3) Reacts to 401-triggered logout events from apiFetch

import { useEffect, useMemo } from "react";
import { apiFetch, AUTH_LOGOUT_EVENT, setAuthToken } from "./api";

type UseSessionGuardArgs = {
  // Set to null/undefined to disable idle logout
  idleTimeoutMs?: number | null;
  // Called whenever the app should consider the user logged out
  onLogout: (reason: "idle" | "unauthorized" | "token_cleared") => void;
};

export function useSessionGuard(args: UseSessionGuardArgs) {
  const idleTimeoutMs = args.idleTimeoutMs ?? 30 * 60 * 1000; // default 30 minutes

  const activityEvents = useMemo(
    () => ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const,
    []
  );

  useEffect(() => {
    let idleTimer: number | null = null;

    const scheduleIdleLogout = () => {
      if (!idleTimeoutMs) return;

      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        setAuthToken(null);
        args.onLogout("idle");
      }, idleTimeoutMs);
    };

    const onActivity = () => scheduleIdleLogout();

    scheduleIdleLogout();
    activityEvents.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [activityEvents, idleTimeoutMs, args]);

  useEffect(() => {
    const onVisibilityOrFocus = async () => {
      if (document.visibilityState === "hidden") return;

      try {
        // Protected endpoint check; if 401 happens apiFetch will logout centrally.
        await apiFetch("/events", { method: "GET" });
      } catch {
        // ignore (401 triggers logout elsewhere)
      }
    };

    window.addEventListener("focus", onVisibilityOrFocus);
    document.addEventListener("visibilitychange", onVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", onVisibilityOrFocus);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    const onLogoutEvent = (e: Event) => {
      const ce = e as CustomEvent;
      const reason = (ce.detail?.reason as string | undefined) || "token_cleared";
      if (reason === "unauthorized") args.onLogout("unauthorized");
      else args.onLogout("token_cleared");
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, onLogoutEvent as EventListener);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "authToken" && !ev.newValue) {
        args.onLogout("token_cleared");
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, onLogoutEvent as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [args]);
}
