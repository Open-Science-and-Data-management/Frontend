import React from "react";
import { Helmet } from "react-helmet-async";
import { Sparkles } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { TaskFormDialog } from "@/components/task/TaskFormDialog";
import { RegenerateTasksDialog } from "@/components/task/RegenerateTasksDialog";
import { TaskBoard } from "@/components/task/TaskBoard";
import { TaskKanban } from "@/components/task/TaskKanban";
import { TaskTimeline } from "@/components/task/TaskTimeline";
import { TaskTable } from "@/components/task/TaskTable";
import { useTaskView } from "@/components/task/TaskViewToggle";
import { TaskFilters, useTaskFilters } from "@/components/task/TaskFilters";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";

const ALL = "all";

export const TaskDashboard: React.FC = () => {
  const tasks = useTaskStore((s) => s.tasks);
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const dmpStatus = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);

  const [isCreating, setIsCreating] = React.useState(false);
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(null);
  const [regenOpen, setRegenOpen] = React.useState(false);
  const [view, setView] = useTaskView();

  const plans = React.useMemo(
    () =>
      buildDmpList({
        dmps,
        draft,
        status: dmpStatus,
        currentDmpId,
        draftCreatedAt,
        draftUpdatedAt,
        tasksGenerated,
      }),
    [
      dmps,
      draft,
      dmpStatus,
      currentDmpId,
      draftCreatedAt,
      draftUpdatedAt,
      tasksGenerated,
    ],
  );

  const planTitle = React.useCallback(
    (dmpId?: string) => plans.find((p) => p.dmp_id === dmpId)?.title,
    [plans],
  );

  // Every plan that owns tasks, plus the one open in the editor even when it
  // owns none — an empty board for that plan is the honest answer.
  const planOptions = React.useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => counts.set(t.dmp_id, (counts.get(t.dmp_id) ?? 0) + 1));
    if (currentDmpId && !counts.has(currentDmpId)) counts.set(currentDmpId, 0);

    return [...counts.entries()].map(([dmp_id, count]) => ({
      dmp_id,
      count,
      title: planTitle(dmp_id) ?? "Plan no longer in your library",
    }));
  }, [tasks, currentDmpId, planTitle]);

  const [selected, setSelected] = React.useState<string>(
    () => currentDmpId ?? tasks[0]?.dmp_id ?? ALL,
  );
  React.useEffect(() => {
    if (selected !== ALL && !planOptions.some((p) => p.dmp_id === selected)) {
      setSelected(ALL);
    }
  }, [planOptions, selected]);

  const inPlan = React.useMemo(
    () =>
      selected === ALL ? tasks : tasks.filter((t) => t.dmp_id === selected),
    [tasks, selected],
  );
  const filters = useTaskFilters(inPlan);

  const targetDmpId = selected === ALL ? (currentDmpId ?? undefined) : selected;
  const selectedPlan = plans.find((p) => p.dmp_id === targetDmpId);

  const editingTask = tasks.find((t) => t.task_id === editingTaskId) ?? null;
  const dialogOpen = isCreating || Boolean(editingTask);

  const closeDialog = () => {
    setIsCreating(false);
    setEditingTaskId(null);
  };

  return (
    <>
      <Helmet>
        <title>My Tasks | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything you're doing this week, across your plans. Tasks are
              yours to manage — only the DMP needs approval.
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
            {selectedPlan && (
              <Button
                variant="outline"
                className="text-ai"
                onClick={() => setRegenOpen(true)}
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Regenerate from plan
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingTaskId(null);
                setIsCreating(true);
              }}
              disabled={!targetDmpId}
              title={
                targetDmpId
                  ? undefined
                  : "Open a plan first — every task belongs to one"
              }
            >
              Create New Task
            </Button>
          </div>
        </div>

        <TaskFilters
          {...filters}
          total={inPlan.length}
          plan={
            planOptions.length > 0
              ? {
                  value: selected,
                  onChange: setSelected,
                  options: planOptions,
                  totalCount: tasks.length,
                }
              : undefined
          }
          view={view}
          onViewChange={setView}
        />

        {filters.visible.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {tasks.length === 0
                ? "No tasks yet. Approve a plan to generate its tasks."
                : inPlan.length === 0
                  ? "This plan has no tasks yet."
                  : "No tasks match these filters."}
            </p>
          </div>
        ) : view === "table" ? (
          <TaskTable
            tasks={filters.visible}
            planLabel={selected === ALL ? planTitle : undefined}
            onEdit={(task: Task) => setEditingTaskId(task.task_id as string)}
            onCreate={
              targetDmpId
                ? () => {
                    setEditingTaskId(null);
                    setIsCreating(true);
                  }
                : undefined
            }
            sort={filters.sort}
            onSortChange={filters.setSort}
            descending={filters.descending}
            onDescendingChange={filters.setDescending}
          />
        ) : view === "timeline" ? (
          <TaskTimeline
            tasks={filters.visible}
            planLabel={selected === ALL ? planTitle : undefined}
            onEdit={(task: Task) => setEditingTaskId(task.task_id as string)}
          />
        ) : view === "board" ? (
          <TaskKanban
            tasks={filters.visible}
            planLabel={selected === ALL ? planTitle : undefined}
            onEdit={(task: Task) => setEditingTaskId(task.task_id as string)}
          />
        ) : (
          <TaskBoard
            tasks={filters.visible}
            // Only worth naming the plan when the list mixes several.
            planLabel={selected === ALL ? planTitle : undefined}
            onEdit={(task: Task) => setEditingTaskId(task.task_id as string)}
          />
        )}
      </div>

      {selectedPlan && (
        <RegenerateTasksDialog
          plan={selectedPlan}
          open={regenOpen}
          onOpenChange={setRegenOpen}
        />
      )}

      <TaskFormDialog
        task={editingTask ?? undefined}
        dmpId={editingTask?.dmp_id ?? targetDmpId}
        planName={planTitle(editingTask?.dmp_id ?? targetDmpId)}
        open={dialogOpen}
        onOpenChange={(open) => !open && closeDialog()}
        onSuccess={closeDialog}
      />
    </>
  );
};
