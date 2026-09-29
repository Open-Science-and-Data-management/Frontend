import React from "react";

interface PlanEditorLayoutProps {
  sectionNav?: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
}

export const PlanEditorLayout: React.FC<PlanEditorLayoutProps> = ({
  sectionNav,
  rail,
  children,
}) => {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
      {sectionNav && <aside className="hidden lg:block">{sectionNav}</aside>}
      <div className="min-w-0 space-y-6">{children}</div>
      {rail && <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">{rail}</aside>}
    </div>
  );
};
