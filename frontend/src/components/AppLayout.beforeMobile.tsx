import React, { useState } from "react";
import CreateEventWizard from "./CreateEventWizard";

type ActiveView = "events" | "categories" | "planningLevels" | "reports" | "mobileVisitors";

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
  const navItemClass = (view: ActiveView) =>
    [
      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-150",
      activeView === view
        ? "bg-brand-primary/10 text-ink font-semibold"
        : "text-ink-muted hover:bg-surface-subtle",
    ].join(" ");

  const badgeClass = (view: ActiveView) =>
    [
      "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold",
      activeView === view
        ? "bg-brand-primary text-ink-inverted"
        : "bg-surface-soft text-brand-primary",
    ].join(" ");

  const [showCreateWizard, setShowCreateWizard] = useState(false);

  const handleWizardClosed = () => {
    setShowCreateWizard(false);
  };

  const handleWizardCreated = async () => {
    // Let parent reload events if a callback is provided
    if (onCreateEvent) {
      await onCreateEvent();
    }
    setShowCreateWizard(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="border-b border-slate-200 px-4 pb-4 pt-5">
          {/* Title */}
          <div className="text-base font-semibold">CGBS Planner</div>

          {/* Subtitle */}
          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Planning workspace
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Navigation
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              className={navItemClass("events")}
              onClick={() => onChangeView("events")}
              aria-current={activeView === "events" ? "page" : undefined}
            >
              <span className={badgeClass("events")}>E</span>
              <span className="truncate">Events</span>
            </button>

            <button
              type="button"
              className={navItemClass("categories")}
              onClick={() => onChangeView("categories")}
              aria-current={activeView === "categories" ? "page" : undefined}
            >
              <span className={badgeClass("categories")}>C</span>
              <span className="truncate">Categories</span>
            </button>

            <button
              type="button"
              className={navItemClass("planningLevels")}
              onClick={() => onChangeView("planningLevels")}
              aria-current={
                activeView === "planningLevels" ? "page" : undefined
              }
            >
              <span className={badgeClass("planningLevels")}>P</span>
              <span className="truncate">Planning levels</span>
            </button>

<button
  type="button"
  className={navItemClass("reports")}
  onClick={() => onChangeView("reports")}
  aria-current={activeView === "reports" ? "page" : undefined}
>
  <span className={badgeClass("reports")}>R</span>
  <span className="truncate">Reports</span>
</button>
          </nav>

          {/* Create Event button opens the wizard */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setShowCreateWizard(true)}
              className="flex w-full items-center justify-center rounded-full bg-brand-primary px-3 py-2 text-sm font-semibold text-ink-inverted shadow-sm transition"
            >
              + Event erstellen
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center justify-between gap-2">
            <span>Signed in</span>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-sm">
          <div>
            <h1 className="text-sm font-semibold text-slate-900">
              Event Planning Workspace
            </h1>
            <p className="text-xs text-slate-500">
              Manage events, structure, categories, and planning levels
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Create Event Wizard Modal */}
      {showCreateWizard && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-3"
          onClick={handleWizardClosed}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <CreateEventWizard
              onClose={handleWizardClosed}
              onCreated={handleWizardCreated}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AppLayout;
