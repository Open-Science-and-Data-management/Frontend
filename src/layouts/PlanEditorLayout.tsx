import React from "react";

interface PlanEditorLayoutProps {
  sectionNav?: React.ReactNode;
  /** Shown instead of `sectionNav` below lg, where there's no room for a rail. */
  sectionTabs?: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
}

export const PlanEditorLayout: React.FC<PlanEditorLayoutProps> = ({
  sectionNav,
  sectionTabs,
  rail,
  children,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
      {sectionNav && (
        // Sticky like the readiness rail: finishing a section at the bottom of
        // a long form shouldn't mean scrolling back up to leave it.
        <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
          {sectionNav}
        </aside>
      )}
      <div className="min-w-0 space-y-6">
        {sectionTabs && (
          <div className="border-b pb-2 lg:hidden">{sectionTabs}</div>
        )}
        {children}
      </div>
      {rail && (
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          {rail}
        </aside>
      )}
    </div>
  );
};
