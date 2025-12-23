import React, { useEffect, useMemo, useState } from "react";
import CreateEventWizard from "./CreateEventWizard";

type ActiveView = "events" | "categories" | "planningLevels" | "reports" | "mobileVisitors" | "predigtplanung";

interface AppLayoutProps {
  children: React.ReactNode;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onLogout?: () => void;

  // Used as callback from the wizard to let the parent refresh events
  onCreateEvent?: () => void;
}

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

  const viewTitle = useMemo(() => {
    switch (activeView) {
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
      default:
        return "Navigation";
    }
  }, [activeView]);

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

  const navItems: Array<{ view: ActiveView; label: string; icon: string; color: string }> = [
    { view: "events", label: "Events", icon: "📅", color: "#e0e7ff" },
    { view: "categories", label: "Kategorien", icon: "🏷️", color: "#fce7f3" },
    { view: "planningLevels", label: "Planungslevel", icon: "🧩", color: "#dcfce7" },
    { view: "predigtplanung", label: "Predigtplanung", icon: "🎙️", color: "#ede9fe" },
    { view: "reports", label: "Besucherstatistik", icon: "📊", color: "#e0f2fe" },
    { view: "mobileVisitors", label: "Besucherzahl erfassen", icon: "👥", color: "#fff7ed" },
  ];

  const makeNavButtonStyle = (view: ActiveView): React.CSSProperties => {
    const isSelected = activeView === view;
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
    display: isMobile ? "inline-flex" : "none",
    alignItems: "center",
    justifyContent: "center",
  };

  const shellStyle: React.CSSProperties = {
    minHeight: "100vh",
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
              onClick={() => handleChangeView(item.view)}
              aria-current={activeView === item.view ? "page" : undefined}
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
        </div>

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
      </div>
    </div>
  );

  const SidebarFooter = (
    <div style={footerStyle}>
      <span>Signed in</span>
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
          <div style={mainInnerStyle}>{children}</div>
        </main>
      </div>

      {/* Mobile FAB: create event */}
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
