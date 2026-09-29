import React from "react";
import { Helmet } from "react-helmet-async";
import { useTaskStore } from "@/store/taskStore";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { TaskFormDialog } from "@/components/task/TaskFormDialog";
import { TaskBoard } from "@/components/task/TaskBoard";
import { TaskProgressDialog } from "@/components/task/TaskProgressDialog";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

const ALL = "all";

export const TaskDashboard: React.FC = () => {
  const { tasks } = useTaskStore();
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const dmpStatus = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);

  const [isCreating, setIsCreating] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  // Held here, not on the card: evidence can move a task to another column,
  // which would unmount a card-owned dialog mid-edit.
  const [progressTaskId, setProgressTaskId] = React.useState<string | null>(
    null,
  );

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
  // owns none — an empty board for that plan is the honest answer, and far
  // better than quietly falling back to showing every other plan's tasks.
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

  // Default to the plan open in the editor, else the first plan that owns
  // tasks — a scoped board is the useful default, and it keeps "Create New
  // Task" usable without first picking a plan.
  const [selected, setSelected] = React.useState<string>(
    () => currentDmpId ?? tasks[0]?.dmp_id ?? ALL,
  );
  React.useEffect(() => {
    // Only a selection naming nothing at all falls back to "All plans".
    if (selected !== ALL && !planOptions.some((p) => p.dmp_id === selected)) {
      setSelected(ALL);
    }
  }, [planOptions, selected]);

  const visible = React.useMemo(
    () =>
      selected === ALL ? tasks : tasks.filter((t) => t.dmp_id === selected),
    [tasks, selected],
  );

  // A task has to belong to a plan, so creating one needs a definite target.
  const targetDmpId = selected === ALL ? (currentDmpId ?? undefined) : selected;
  const progressTask = tasks.find((t) => t.task_id === progressTaskId) ?? null;

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsCreating(true);
  };

  const handleFormSuccess = () => {
    setIsCreating(false);
    setEditingTask(null);
  };

  return (
    <>
      <Helmet>
        <title>Task Dashboard | DMP-Researcher</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tasks belong to the plan they were generated from.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {planOptions.length > 0 && (
              <Select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                aria-label="Filter tasks by plan"
                className="sm:w-64"
              >
                <option value={ALL}>All plans ({tasks.length})</option>
                {planOptions.map((plan) => (
                  <option key={plan.dmp_id} value={plan.dmp_id}>
                    {plan.title} ({plan.count})
                  </option>
                ))}
              </Select>
            )}
            <Button
              onClick={() => setIsCreating(true)}
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

        {visible.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {tasks.length === 0
                ? "No tasks yet. Approve a plan to generate its tasks."
                : "This plan has no tasks yet."}
            </p>
          </div>
        ) : (
          <TaskBoard
            tasks={visible}
            // Only worth naming the plan when the board is mixing several.
            planLabel={selected === ALL ? planTitle : undefined}
            onEdit={handleEditTask}
            onOpenProgress={(task) => setProgressTaskId(task.task_id as string)}
          />
        )}
      </div>

      <TaskFormDialog
        task={editingTask ?? undefined}
        dmpId={targetDmpId}
        planName={targetDmpId ? planTitle(targetDmpId) : undefined}
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false);
            setEditingTask(null);
          }
        }}
        onSuccess={handleFormSuccess}
      />

      {progressTask && (
        <TaskProgressDialog
          task={progressTask}
          open
          onOpenChange={(open) => !open && setProgressTaskId(null)}
        />
      )}
    </>
  );
};
