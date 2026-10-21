import React from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useTaskStore } from "@/store/taskStore";
import { buildDmpList, useDmpStore } from "@/store/dmpStore";
import { useProjectStore } from "@/store/projectStore";
import { isActive } from "@/config/plan-mode";
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
  const allTasks = useTaskStore((s) => s.tasks);
  const dmps = useDmpStore((s) => s.dmps);
  const draft = useDmpStore((s) => s.draft);
  const dmpStatus = useDmpStore((s) => s.status);
  const currentDmpId = useDmpStore((s) => s.currentDmpId);
  const draftCreatedAt = useDmpStore((s) => s.draftCreatedAt);
  const draftUpdatedAt = useDmpStore((s) => s.draftUpdatedAt);
  const tasksGenerated = useDmpStore((s) => s.tasksGenerated);

  const [isCreating, setIsCreating] = React.useState(false);
  // `?task=<id>` opens that task straight away — how the dashboard links in.
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingTaskId, setEditingTaskId] = React.useState<string | null>(() =>
    searchParams.get("task"),
  );
  React.useEffect(() => {
    // Consumed once, so closing the task doesn't leave a link that reopens it.
    if (searchParams.has("task")) setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  // An archived plan's tasks are kept, untouched — just off the board.
  const archivedIds = React.useMemo(
    () => new Set(dmps.filter((d) => d.archived_at).map((d) => d.dmp_id)),
    [dmps],
  );
  const tasks = React.useMemo(
    () => allTasks.filter((t) => !archivedIds.has(t.dmp_id)),
    [allTasks, archivedIds],
  );

  const planTitle = React.useCallback(
    (dmpId?: string) => plans.find((p) => p.dmp_id === dmpId)?.title,
    [plans],
  );

  // Every plan that owns tasks, plus the one open in the editor even when it
  // owns none — an empty board for that plan is the honest answer.
  const projects = useProjectStore((s) => s.projects);
  const projectOfPlan = React.useCallback(
    (dmpId: string) => plans.find((p) => p.dmp_id === dmpId)?.project_id,
    [plans],
  );
  const [projectSelected, setProjectSelected] = React.useState<string>(ALL);

  // Every project, so a new one is findable before it has any tasks.
  const projectOptions = React.useMemo(
    () =>
      projects.map((p) => ({
        project_id: p.project_id as string,
        name: p.project_name,
        count: tasks.filter((t) => projectOfPlan(t.dmp_id) === p.project_id)
          .length,
      })),
    [projects, tasks, projectOfPlan],
  );

  // Every plan in the library — not only those that already have tasks, which
  // made a plan's presence depend on whatever happened to be open.
  const planOptions = React.useMemo(() => {
    const count = (dmpId: string) =>
      tasks.filter((t) => t.dmp_id === dmpId).length;
    const inLibrary = plans
      .filter(
        (p) => projectSelected === ALL || p.project_id === projectSelected,
      )
      .map((p) => ({
        dmp_id: p.dmp_id,
        count: count(p.dmp_id),
        // With every project showing, the project name tells same-named plans apart.
        title:
          projectSelected === ALL
            ? `${p.title} · ${projects.find((x) => x.project_id === p.project_id)?.project_name ?? "No project"}`
            : p.title,
      }));
    const orphans = [...new Set(tasks.map((t) => t.dmp_id))]
      .filter((id) => !plans.some((p) => p.dmp_id === id))
      .filter(() => projectSelected === ALL)
      .map((id) => ({
        dmp_id: id,
        count: count(id),
        title: "Plan no longer in your library",
      }));
    return [...inLibrary, ...orphans];
  }, [plans, tasks, projects, projectSelected]);

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
      tasks.filter(
        (t) =>
          (projectSelected === ALL ||
            projectOfPlan(t.dmp_id) === projectSelected) &&
          (selected === ALL || t.dmp_id === selected),
      ),
    [tasks, selected, projectSelected, projectOfPlan],
  );
  const filters = useTaskFilters(inPlan);

  // A new task goes to the chosen plan; with only a project chosen, to the
  // open plan if it belongs there, else that project's only plan — never to a
  // plan in some other project.
  const projectPlans = plans.filter(
    (p) => projectSelected === ALL || p.project_id === projectSelected,
  );
  const targetDmpId =
    selected !== ALL
      ? selected
      : currentDmpId && projectPlans.some((p) => p.dmp_id === currentDmpId)
        ? currentDmpId
        : projectPlans.length === 1
          ? projectPlans[0].dmp_id
          : undefined;
  const selectedPlan = plans.find((p) => p.dmp_id === targetDmpId);

  // An empty list should say why, in terms of where the plan actually is.
  const narrowedPlan = plans.find((p) => p.dmp_id === selected);
  const narrowedProject = projects.find(
    (p) => p.project_id === projectSelected,
  );
  const emptyReason =
    inPlan.length > 0
      ? "No tasks match these filters."
      : narrowedPlan
        ? isActive(narrowedPlan.status)
          ? "This plan is approved but hasn't been broken into tasks yet."
          : "This plan isn't approved yet. Its tasks are created once it is."
        : narrowedProject &&
            !plans.some((p) => p.project_id === narrowedProject.project_id)
          ? "This project has no plan yet. Upload its proposal to start one."
          : narrowedProject
            ? "None of this project's plans has tasks yet. They're created once a plan is approved."
            : "No tasks yet. Approve a plan to generate its tasks.";

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
              yours to manage. Only the DMP needs approval.
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
                  : "Pick a plan in the filter first. Every task belongs to one."
              }
            >
              Create New Task
            </Button>
          </div>
        </div>

        <TaskFilters
          {...filters}
          total={inPlan.length}
          project={
            projectOptions.length > 0
              ? {
                  value: projectSelected,
                  onChange: setProjectSelected,
                  options: projectOptions,
                  totalCount: tasks.length,
                }
              : undefined
          }
          plan={
            planOptions.length > 0
              ? {
                  value: selected,
                  onChange: setSelected,
                  options: planOptions,
                  // "All plans" means all of the chosen project's plans.
                  totalCount: planOptions.reduce((n, p) => n + p.count, 0),
                }
              : undefined
          }
          view={view}
          onViewChange={setView}
        />

        {filters.visible.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">{emptyReason}</p>
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
