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
import { useTaskStore } from "@/store/taskStore";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { LifecycleStage } from "@/types/task";
import type { Task } from "@/types/task";

/**
 * The project's own slice of the board. Same tasks as My Tasks, narrowed to
 * this project — one place to work from, two ways in.
 */
export const ProjectTasks: React.FC<{ projectId: string }> = ({
  projectId,
}) => {
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

  // Progress is the lifecycle's, not a raw task count: each stage counts once
  // its tasks are done, and the datasets' own status carries the rest.
  const stageProgress = LifecycleStage.options.map((stage) => {
    const forStage = projectTasks.filter(
      (t) => t.lifecycle_stage === stage && t.status !== "cancelled",
    );
    const done = forStage.filter((t) => t.status === "done").length;
    return { stage, total: forStage.length, done };
  });
  const tracked = stageProgress.filter((s) => s.total > 0);
  const overall =
    tracked.length === 0
      ? 0
      : Math.round(
          (tracked.reduce((sum, s) => sum + s.done / s.total, 0) /
            tracked.length) *
            100,
        );

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
        <Button variant="outline" size="sm" onClick={() => navigate("/tasks")}>
          Open My Tasks
        </Button>
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

      <TaskFormDialog
        task={editing ?? undefined}
        dmpId={editing?.dmp_id ?? planIds[0]}
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditingId(null)}
        onSuccess={() => setEditingId(null)}
      />
    </section>
  );
};
