import React from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { TaskBoard } from "@/components/task/TaskBoard";
import { TaskKanban } from "@/components/task/TaskKanban";
import { TaskTimeline } from "@/components/task/TaskTimeline";
import { TaskTable } from "@/components/task/TaskTable";
import { useTaskView } from "@/components/task/TaskViewToggle";
import { TaskFilters, useTaskFilters } from "@/components/task/TaskFilters";
import { TaskFormDialog } from "@/components/task/TaskFormDialog";
import { TaskReadOnlyList } from "@/components/task/TaskReadOnlyList";
import { useTaskStore } from "@/store/taskStore";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { lifecycleProgress } from "@/config/progress";
import type { Task } from "@/types/task";

/**
 * The project's own slice of the board. Same tasks as My Tasks, narrowed to
 * this project — one place to work from, two ways in.
 *
 * `readOnly` is the committee's view: the same progress, but nothing to tick.
 */
export const ProjectTasks: React.FC<{
  projectId: string;
  readOnly?: boolean;
}> = ({ projectId, readOnly }) => {
  const navigate = useNavigate();
  const tasks = useTaskStore((s) => s.tasks);
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const status = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [view, setView] = useTaskView();

  const plans = React.useMemo(
    () =>
      buildDmpList({
        dmps,
        draft,
        status,
        currentDmpId,
        draftCreatedAt,
        draftUpdatedAt,
        tasksGenerated,
      }),
    [
      dmps,
      draft,
      status,
      currentDmpId,
      draftCreatedAt,
      draftUpdatedAt,
      tasksGenerated,
    ],
  );

  const planIds = plans
    .filter((p) => p.project_id === projectId)
    .map((p) => p.dmp_id);
  const projectTasks = tasks.filter((t) => planIds.includes(t.dmp_id));
  const filters = useTaskFilters(projectTasks);

  const editing = tasks.find((t) => t.task_id === editingId) ?? null;
  const datasets = plans.find((p) => planIds.includes(p.dmp_id))?.draft.dataset;

  const { stages: tracked, overall } = lifecycleProgress(projectTasks);

  return (
    <section className="space-y-4 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Progress &amp; tasks</h2>
          <p className="text-xs text-muted-foreground">
            {projectTasks.length} task{projectTasks.length === 1 ? "" : "s"} for
            this project.
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/tasks")}
          >
            Open My Tasks
          </Button>
        )}
      </div>

      {projectTasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          description="Tasks are generated once this project's DMP is approved."
        />
      ) : (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Lifecycle progress</span>
              <span className="tabular-nums">{overall}%</span>
            </div>
            <ProgressBar value={overall} label="Project lifecycle progress" />
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
              {tracked.map((s) => (
                <span key={s.stage} className="capitalize">
                  {s.stage} {s.done}/{s.total}
                </span>
              ))}
              {datasets && datasets.length > 0 && (
                <span>
                  Outputs:{" "}
                  {datasets.map((d) => d.status).join(", ") || "planned"}
                </span>
              )}
            </div>
          </div>

          {readOnly ? (
            <TaskReadOnlyList
              tasks={projectTasks}
              datasets={plans
                .filter((p) => planIds.includes(p.dmp_id))
                .flatMap((p) => p.draft.dataset ?? [])}
            />
          ) : (
            <>
              <TaskFilters
                {...filters}
                total={projectTasks.length}
                view={view}
                onViewChange={setView}
              />

              {filters.visible.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No tasks match these filters.
                </p>
              ) : view === "table" ? (
                <TaskTable
                  tasks={filters.visible}
                  onEdit={(task: Task) => setEditingId(task.task_id as string)}
                  sort={filters.sort}
                  onSortChange={filters.setSort}
                  descending={filters.descending}
                  onDescendingChange={filters.setDescending}
                />
              ) : view === "timeline" ? (
                <TaskTimeline
                  tasks={filters.visible}
                  onEdit={(task: Task) => setEditingId(task.task_id as string)}
                />
              ) : view === "board" ? (
                <TaskKanban
                  tasks={filters.visible}
                  onEdit={(task: Task) => setEditingId(task.task_id as string)}
                />
              ) : (
                <TaskBoard
                  tasks={filters.visible}
                  onEdit={(task: Task) => setEditingId(task.task_id as string)}
                />
              )}
            </>
          )}
        </>
      )}

      {!readOnly && (
        <TaskFormDialog
          task={editing ?? undefined}
          dmpId={editing?.dmp_id ?? planIds[0]}
          open={Boolean(editing)}
          onOpenChange={(open) => !open && setEditingId(null)}
          onSuccess={() => setEditingId(null)}
        />
      )}
    </section>
  );
};
