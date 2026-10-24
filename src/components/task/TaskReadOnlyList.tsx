import React from "react";
import { format } from "date-fns";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { LifecycleStage } from "@/types/task";
import type { Task } from "@/types/task";
import type { Dataset } from "@/types/dataset";

const STATUS: Record<
  Task["status"],
  { label: string; badge: "draft" | "pending" | "approved" | "rejected" }
> = {
  todo: { label: "To do", badge: "draft" },
  in_progress: { label: "In progress", badge: "pending" },
  done: { label: "Done", badge: "approved" },
  cancelled: { label: "Cancelled", badge: "rejected" },
};

const STAGE_ORDER = LifecycleStage.options;

/**
 * The tasks as a reviewer sees them: what each is, how far along, and what
 * stands behind "done". Nothing here can be ticked, dragged or edited — the
 * work and its evidence are the researcher's.
 */
export const TaskReadOnlyList: React.FC<{
  tasks: Task[];
  datasets: Dataset[];
}> = ({ tasks, datasets }) => {
  const outputTitle = (id?: string) =>
    datasets.find((d) => d.dataset_id === id)?.title;

  const ordered = [...tasks].sort(
    (a, b) =>
      STAGE_ORDER.indexOf(a.lifecycle_stage) -
        STAGE_ORDER.indexOf(b.lifecycle_stage) ||
      a.title.localeCompare(b.title),
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">Stage</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="w-32 px-3 py-2 font-medium">Progress</th>
            <th className="px-3 py-2 font-medium">Due</th>
            <th className="px-3 py-2 font-medium">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ordered.map((task) => {
            const output = outputTitle(task.dataset_id);
            const evidence =
              task.evidence?.type && task.evidence.type !== "none"
                ? task.evidence.label || task.evidence.ref
                : undefined;
            return (
              <tr key={task.task_id} className="align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{task.title}</p>
                  {output && (
                    <p className="text-xs text-muted-foreground">{output}</p>
                  )}
                </td>
                <td className="px-3 py-2 capitalize">{task.lifecycle_stage}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={STATUS[task.status].badge}>
                    {STATUS[task.status].label}
                  </StatusBadge>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      value={task.progress_percent}
                      label={`${task.title} progress`}
                      className="flex-1"
                    />
                    <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                      {task.progress_percent}%
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                  {task.end_date ? format(task.end_date, "PP") : "No due date"}
                </td>
                <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-muted-foreground">
                  {evidence ?? "None yet"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
