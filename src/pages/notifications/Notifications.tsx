import React from "react";
import { Helmet } from "react-helmet-async";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const Notifications: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Notifications | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You'll see updates here when your committee reviews a plan, or when AI finishes drafting one."
        />
      </div>
    </>
  );
};
