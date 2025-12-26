import React, { useEffect, useMemo, useState } from "react";
import CreateEventWizard from "./CreateEventWizard";
import UsersPage from "./UsersPage";
import { apiFetch, AUTH_LOGOUT_EVENT, getAuthToken, setAuthToken } from "../api";

type ActiveView = "events" | "categories" | "planningLevels" | "reports" | "mobileVisitors" | "predigtplanung" | "users";

interface AppLayoutProps {
  children: React.ReactNode;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onLogout?: () => void;

  // Used as callback from the wizard to let the parent refresh events
  onCreateEvent?: () => void;
}


const getJwtPayload = (token: string | null): any | null => {
  if (!token) return null;
  try {
    const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
    const parts = raw.split(".");
    if (parts.length < 2) return null;

    // JWT is base64url encoded; atob expects standard base64.
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const getUsernameFromToken = (token: string | null): string | null => {
  const payload = getJwtPayload(token);
  return typeof payload?.sub === "string" ? payload.sub : null;
};

const getRoleFromToken = (token: string | null): string | null => {
  const payload = getJwtPayload(token);
  return typeof payload?.role === "string" ? payload.role : null;
};


const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeView,
  onChangeView,
  onLogout,
  onCreateEvent,
}) => {
  const colors = {
    pageBg: "#f6f8ff",
    panelBg: "#ffffff",
    panelBgSoft: "#fbfcff",
    border: "rgba(15, 23, 42, 0.10)",
    text: "#0f172a",
    muted: "#475569",
    muted2: "#64748b",
    indigo: "#4f46e5",
    indigoDark: "#4338ca",
    indigoTint: "#eef2ff",
  } as const;

  const shadows = {
    panelSoft: "0 8px 18px rgba(15, 23, 42, 0.05)",
    button: "0 6px 18px rgba(79, 70, 229, 0.22)",
  } as const;

  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });

  const [hoveredNav, setHoveredNav] = useState<ActiveView | null>(null);


// --- Admin detection (no network calls): derived from JWT role ---
const [authTokenValue, setAuthTokenValue] = useState<string | null>(() => getAuthToken());

useEffect(() => {
  // Keep token state in sync (same tab + other tabs)
  let last = getAuthToken();
  setAuthTokenValue(last);

  const onStorage = (ev: StorageEvent) => {
    if (ev.key === "authToken") {
      last = ev.newValue;
      setAuthTokenValue(ev.newValue);
    }
  };
  window.addEventListener("storage", onStorage);

  // Fallback for same-tab updates (storage does not fire in same tab)
  const id = window.setInterval(() => {
    const t = getAuthToken();
    if (t !== last) {
      last = t;
      setAuthTokenValue(t);
    }
  }, 1000);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.clearInterval(id);
  };
}, []);

const currentRole = useMemo(() => getRoleFromToken(authTokenValue), [authTokenValue]);
const isAdmin = currentRole === "admin";
const isWelcome = currentRole === "welcome";
const adminChecked = true;

// Force welcome users into the Mobile Visitors view only
useEffect(() => {
  if (isWelcome && activeView !== "mobileVisitors") {
    onChangeView("mobileVisitors");
  }
}, [isWelcome, activeView, onChangeView]);
// --- End admin detection ---




  // --- Session handling (centralized in AppLayout) ---
  // - Auto-logout on inactivity (default 30 minutes)
  // - When tab becomes active again, attempt a lightweight auth check
  // - React to global 401 logout events emitted from apiFetch
  const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

  useEffect(() => {
    if (!onLogout) return;

    let idleTimer: number | null = null;

    const schedule = () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        if (getAuthToken()) {
          setAuthToken(null);
          onLogout();
        }
      }, IDLE_TIMEOUT_MS);
    };

    const onActivity = () => schedule();

    schedule();
    const events: Array<keyof WindowEventMap> = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));

    return () => {
      if (idleTimer) window.clearTimeout(idleTimer);
      events.forEach((ev) => window.removeEventListener(ev, onActivity as any));
    };
  }, [onLogout]);

  useEffect(() => {
    if (!onLogout) return;

    const onAuthLogoutEvent = (e: Event) => {
      const ce = e as CustomEvent;
      const reason = (ce.detail?.reason as string | undefined) || "";
      const token = (ce.detail?.token as string | null | undefined) ?? undefined;

      if (reason === "unauthorized" || token === null || !getAuthToken()) {
        onLogout();
      }
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, onAuthLogoutEvent as EventListener);

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "authToken" && !ev.newValue) {
        onLogout();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, onAuthLogoutEvent as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [onLogout]);

  useEffect(() => {
    if (!onLogout) return;

    const checkOnReturn = async () => {
      if (document.visibilityState === "hidden") return;
      if (!getAuthToken()) return;

      try {
        const res = await apiFetch("/events", { method: "GET" });
        if (res.status === 401) {
          onLogout();
        }
      } catch {
        // ignore
      }
    };

    window.addEventListener("focus", checkOnReturn);
    document.addEventListener("visibilitychange", checkOnReturn);

    return () => {
      window.removeEventListener("focus", checkOnReturn);
      document.removeEventListener("visibilitychange", checkOnReturn);
    };
  }, [onLogout]);
  // --- End session handling ---

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleWizardClosed = () => setShowCreateWizard(false);

  const handleWizardCreated = async () => {
    if (onCreateEvent) {
      await onCreateEvent();
    }
    setShowCreateWizard(false);
  };
  const effectiveActiveView: ActiveView = isWelcome ? "mobileVisitors" : activeView;


  const viewTitle = useMemo(() => {
    switch (effectiveActiveView) {
      case "events":
        return "Events";
      case "categories":
        return "Kategorien";
      case "planningLevels":
        return "Planungslevel";
      case "reports":
        return "Besucherstatistik";
      case "mobileVisitors":
        return "Besucherzahl erfassen";
      case "predigtplanung":
        return "Predigtplanung";
      case "users":
        return "Users";
      default:
        return "Navigation";
    }
  }, [effectiveActiveView]);


  const showMobileFab = isMobile && effectiveActiveView === "events" && !isWelcome;

  // Prevent background scroll when mobile nav or wizard is open
  useEffect(() => {
    const shouldLock = mobileNavOpen || showCreateWizard;
    if (!shouldLock) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileNavOpen, showCreateWizard]);

  // Close drawer automatically when switching to desktop width
  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  const handleChangeView = (view: ActiveView) => {
    onChangeView(view);
    setMobileNavOpen(false);
  };

  const effectiveChangeView = (view: ActiveView) => {
    if (isWelcome) {
      // welcome users are restricted to Mobile Visitors only
      handleChangeView("mobileVisitors");
      return;
    }
    handleChangeView(view);
  };

  const baseNavItems: Array<{ view: ActiveView; label: string; icon: string; color: string }> = [
    { view: "events", label: "Events", icon: "📅", color: "#e0e7ff" },
    { view: "predigtplanung", label: "Predigtplanung", icon: "🎙️", color: "#ede9fe" },
    { view: "reports", label: "Besucherstatistik", icon: "📊", color: "#e0f2fe" },
    { view: "mobileVisitors", label: "Besucherzahl erfassen", icon: "👥", color: "#fff7ed" },
  ];

  const navItems: Array<{ view: ActiveView; label: string; icon: string; color: string }> = isWelcome
    ? baseNavItems.filter((i) => i.view === "mobileVisitors")
    : baseNavItems;

  const makeNavButtonStyle = (view: ActiveView): React.CSSProperties => {
    const isSelected = effectiveActiveView === view;
    const isHovered = hoveredNav === view;

    return {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      borderRadius: 12,
      border: isSelected ? `2px solid ${colors.indigo}` : "1px solid #e5e7eb",
      backgroundColor: isSelected ? colors.indigoTint : isHovered ? "#f9fafb" : "#ffffff",
      cursor: "pointer",
      textAlign: "left",
      transition: "box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease",
      boxShadow: isSelected
        ? "0 4px 10px rgba(79, 70, 229, 0.18)"
        : isHovered
          ? "0 4px 10px rgba(15, 23, 42, 0.08)"
          : "none",
      transform: isHovered ? "translateY(-1px)" : "translateY(0px)",
      color: colors.text,
    };
  };

  const makeBadgeStyle = (bgColor: string): React.CSSProperties => {
    return {
      flexShrink: 0,
      width: 36,
      height: 36,
      borderRadius: 999,
      backgroundColor: bgColor,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)",
    };
  };

  const sidebarShellStyle: React.CSSProperties = {
    width: 280,
    background: `linear-gradient(180deg, ${colors.panelBgSoft} 0%, ${colors.panelBg} 100%)`,
    borderRight: `1px solid ${colors.border}`,
    boxShadow: shadows.panelSoft,
    position: "sticky",
    top: 0,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
  };

  const sidebarHeaderStyle: React.CSSProperties = {
    padding: "18px 16px 14px 16px",
    borderBottom: `1px solid ${colors.border}`,
  };

  const sidebarTitleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 500,
    color: colors.text,
    letterSpacing: "-0.01em",
  };

  const sidebarSubTitleStyle: React.CSSProperties = {
    marginTop: 6,
    fontSize: 11,
    color: colors.muted2,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: colors.muted2,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    marginBottom: 8,
  };

  const primaryButtonStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 999,
    border: "none",
    background: `linear-gradient(180deg, ${colors.indigo} 0%, ${colors.indigoDark} 100%)`,
    color: "#ffffff",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: shadows.button,
    transition: "transform 120ms ease, opacity 120ms ease",
  };

  const headerStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    backgroundColor: "rgba(255,255,255,0.86)",
    backdropFilter: "blur(10px)",
    borderBottom: `1px solid ${colors.border}`,
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  };

  const roundIconButtonStyle: React.CSSProperties = {
    height: 38,
    width: 38,
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    backgroundColor: "#ffffff",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 6px 14px rgba(15, 23, 42, 0.06)",
  };

  const fabStyle: React.CSSProperties = {
    position: "fixed",
    right: 18,
    bottom: 18,
    height: 56,
    width: 56,
    borderRadius: 999,
    border: "none",
    background: `linear-gradient(180deg, ${colors.indigo} 0%, ${colors.indigoDark} 100%)`,
    color: "#ffffff",
    fontSize: 26,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: shadows.button,
    zIndex: 30,
    display: showMobileFab ? "inline-flex" : "none",
    alignItems: "center",
    justifyContent: "center",
  };

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
    height: "100vh",
    overflow: "hidden",
    display: "flex",
    background: `radial-gradient(1200px 500px at 25% -10%, rgba(79, 70, 229, 0.12), transparent 55%),
                radial-gradient(900px 400px at 90% 0%, rgba(79, 70, 229, 0.08), transparent 55%),
                ${colors.pageBg}`,
    color: colors.text,
  };

  const mainWrapStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  };

  const mainStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: isMobile ? "14px 14px 90px 14px" : "18px 20px",
  };

  const mainInnerStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
  };

  const footerStyle: React.CSSProperties = {
    borderTop: `1px solid ${colors.border}`,
    padding: "10px 14px",
    fontSize: 12,
    color: colors.muted2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    background: "rgba(255,255,255,0.6)",
  };

  const logoutButtonStyle: React.CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${colors.border}`,
    backgroundColor: "#ffffff",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 600,
    color: colors.muted,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(15, 23, 42, 0.05)",
  };

  const SidebarHeader = (
    <div style={sidebarHeaderStyle}>
      <div style={sidebarTitleStyle}>CGBS Planner</div>
      <div style={sidebarSubTitleStyle}>Planning workspace</div>
    </div>
  );

  const SidebarBody = (
    <div style={{ padding: "14px 10px", overflowY: "auto", flex: 1 }}>
      <div style={{ padding: "0 6px" }}>
        <div style={sectionLabelStyle}>Navigation</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {navItems.map((item) => (
            <button
              key={item.view}
              type="button"
              style={makeNavButtonStyle(item.view)}
              onMouseEnter={() => setHoveredNav(item.view)}
              onMouseLeave={() => setHoveredNav(null)}
              onClick={() => effectiveChangeView(item.view)}
              aria-current={effectiveActiveView === item.view ? "page" : undefined}
            >
              <span style={makeBadgeStyle(item.color)}>{item.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </div>
              </div>
            </button>
          ))}
        

{adminChecked && isAdmin && (
  <div style={{ marginTop: 14 }}>
    <div style={sectionLabelStyle}>Admin</div>

    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        type="button"
        style={makeNavButtonStyle("categories")}
        onMouseEnter={() => setHoveredNav("categories")}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => effectiveChangeView("categories")}
        aria-current={activeView === "categories" ? "page" : undefined}
      >
        <span style={makeBadgeStyle("#fce7f3")}>🏷️</span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Kategorien
          </div>
        </div>
      </button>

      <button
        type="button"
        style={makeNavButtonStyle("planningLevels")}
        onMouseEnter={() => setHoveredNav("planningLevels")}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => effectiveChangeView("planningLevels")}
        aria-current={activeView === "planningLevels" ? "page" : undefined}
      >
        <span style={makeBadgeStyle("#dcfce7")}>🧩</span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Planungslevel
          </div>
        </div>
      </button>

      <button
        type="button"
        style={makeNavButtonStyle("users")}
        onMouseEnter={() => setHoveredNav("users")}
        onMouseLeave={() => setHoveredNav(null)}
        onClick={() => effectiveChangeView("users")}
        aria-current={effectiveActiveView === "users" ? "page" : undefined}
      >
        <span style={makeBadgeStyle("#f1f5f9")}>👤</span>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Users
          </div>
        </div>
      </button>
    </div>
  </div>
)}
</div>

        {isAdmin && (
          <div style={{ marginTop: 14 }}>
            <button
              type="button"
              style={primaryButtonStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.98";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
              }}
              onClick={() => {
                setMobileNavOpen(false);
                setShowCreateWizard(true);
              }}
            >
              + Event erstellen
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const SidebarFooter = (
    <div style={footerStyle}>
      <span>Angemeldet als {getUsernameFromToken(authTokenValue) ?? "–"}</span>
      {onLogout && (
        <button
          type="button"
          style={logoutButtonStyle}
          onClick={() => {
            setMobileNavOpen(false);
            onLogout();
          }}
        >
          Logout
        </button>
      )}
    </div>
  );

  const DesktopSidebar = (
    <aside style={sidebarShellStyle}>
      {SidebarHeader}
      {SidebarBody}
      {SidebarFooter}
    </aside>
  );

  return (
    <div style={shellStyle}>
      {/* Desktop sidebar */}
      {!isMobile && DesktopSidebar}

      {/* Mobile navigation drawer */}
      {isMobile && mobileNavOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
          <div
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(2, 6, 23, 0.42)" }}
            onClick={() => setMobileNavOpen(false)}
          />

          <aside
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: "100%",
              width: "86%",
              maxWidth: 340,
              ...sidebarShellStyle,
            }}
          >
            <div
              style={{
                ...sidebarHeaderStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div>
                <div style={sidebarTitleStyle}>CGBS Planner</div>
                <div style={sidebarSubTitleStyle}>Planning workspace</div>
              </div>

              <button
                type="button"
                aria-label="Close navigation"
                style={roundIconButtonStyle}
                onClick={() => setMobileNavOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Drawer body + footer (no duplicated header) */}
            {SidebarBody}
            {SidebarFooter}
          </aside>
        </div>
      )}

      <div style={mainWrapStyle}>
        <header style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {isMobile && (
              <button
                type="button"
                aria-label="Open navigation"
                style={roundIconButtonStyle}
                onClick={() => setMobileNavOpen(true)}
              >
                ☰
              </button>
            )}

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {viewTitle}
              </div>
            </div>
          </div>

          <div />
        </header>

        <main style={mainStyle}>
          <div style={mainInnerStyle}>{activeView === "users" ? <UsersPage /> : children}</div>
        </main>
      </div>

      {/* Mobile FAB: create event */}
      {isAdmin && showMobileFab && (
        <button
                type="button"
                aria-label="Event erstellen"
                style={fabStyle}
                onClick={() => {
                  setMobileNavOpen(false);
                  setShowCreateWizard(true);
                }}
              >
                +
              </button>
      )}

{/* Create Event Wizard Modal */}
      {showCreateWizard && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
            backgroundColor: "rgba(2, 6, 23, 0.45)",
          }}
          onClick={handleWizardClosed}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 980,
              maxHeight: "90vh",
              overflowY: "auto",
              borderRadius: 22,
              backgroundColor: "#ffffff",
              boxShadow: "0 26px 70px rgba(15, 23, 42, 0.18)",
              border: "1px solid rgba(15, 23, 42, 0.08)",
              padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CreateEventWizard onClose={handleWizardClosed} onCreated={handleWizardCreated} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
