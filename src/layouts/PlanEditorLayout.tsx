import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/store/authStore";
import { useAssistantStore } from "@/store/assistantStore";

// Hidden until it's opened, so its tool layer shouldn't be in the first load.
const AiChatPanel = React.lazy(() =>
  import("@/components/dmp/AiChatPanel").then((m) => ({
    default: m.AiChatPanel,
  })),
);

interface PlanEditorLayoutProps {
  sectionNav?: React.ReactNode;
  /** Shown instead of `sectionNav` below lg, where there's no room for a rail. */
  sectionTabs?: React.ReactNode;
  rail?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The shell of the plan editor. The assistant lives here rather than in the
 * app header: it answers about the plan being edited, so it exists only
 * where one is — and only for the researcher drafting it.
 */
export const PlanEditorLayout: React.FC<PlanEditorLayoutProps> = ({
  sectionNav,
  sectionTabs,
  rail,
  children,
}) => {
  const researcher = useCurrentUser()?.role === "researcher";
  const open = useAssistantStore((s) => s.open);
  const setOpen = useAssistantStore((s) => s.setOpen);

  // The panel closes with the page. A reply still on its way isn't lost: it
  // is recorded on the plan it was asked about whenever it arrives.
  React.useEffect(() => () => setOpen(false), [setOpen]);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px]">
        {sectionNav && (
          // Sticky like the readiness rail: finishing a section at the bottom
          // of a long form shouldn't mean scrolling back up to leave it.
          <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
            {sectionNav}
          </aside>
        )}
        <div className="min-w-0 space-y-6">
          {researcher && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant={open ? "outline" : "ai"}
                size="sm"
                aria-expanded={open}
                aria-label={open ? "Close AI assistant" : "Open AI assistant"}
                onClick={() => setOpen(!open)}
              >
                <MessageSquare className="mr-1.5 h-4 w-4" />
                Ask AI
              </Button>
            </div>
          )}
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

      {researcher && open && (
        <React.Suspense fallback={null}>
          <AiChatPanel open onClose={() => setOpen(false)} />
        </React.Suspense>
      )}
    </>
  );
};
