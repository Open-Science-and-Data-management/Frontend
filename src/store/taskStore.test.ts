import { beforeEach, describe, expect, it } from "vitest";
import { useTaskStore, type NewTask } from "@/store/taskStore";
import { useDmpStore } from "@/store/dmpStore";

const baseTask: NewTask = {
  dmp_id: "dmp-a",
  title: "Run QC on the batch",
  priority: "medium",
  lifecycle_stage: "process",
  generated_by: "user",
};

const only = () => useTaskStore.getState().tasks[0];
const id = () => only().task_id as string;
const steps = () => only().checklist;

beforeEach(() => {
  localStorage.clear();
  useTaskStore.setState({ tasks: [] });
});

describe("the checklist is what moves progress", () => {
  it("starts a task empty, at zero, to do", () => {
    useTaskStore.getState().addTask(baseTask);

    expect(only().progress_percent).toBe(0);
    expect(only().status).toBe("todo");
    expect(only().checklist).toEqual([]);
    expect(only().evidence).toEqual({ type: "none" });
  });

  it("derives the percentage from steps done", () => {
    useTaskStore.getState().addTask(baseTask);
    ["Run the pipeline", "Write up failures", "File the report"].forEach((s) =>
      useTaskStore.getState().addChecklistItem(id(), s),
    );

    useTaskStore.getState().toggleChecklistItem(id(), steps()[0].item_id);
    expect(only().progress_percent).toBe(33);
    expect(only().status).toBe("in_progress");

    useTaskStore.getState().toggleChecklistItem(id(), steps()[1].item_id);
    expect(only().progress_percent).toBe(67);
  });

  it("does not close a task just because every step is ticked", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore.getState().addChecklistItem(id(), "The only step");
    useTaskStore.getState().toggleChecklistItem(id(), steps()[0].item_id);

    expect(only().progress_percent).toBe(100);
    // Closing is a separate, evidence-checked act.
    expect(only().status).toBe("in_progress");
  });

  it("renames and removes steps", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore.getState().addChecklistItem(id(), "Draft");
    useTaskStore
      .getState()
      .renameChecklistItem(id(), steps()[0].item_id, "Draft the QC note");
    expect(steps()[0].label).toBe("Draft the QC note");

    useTaskStore.getState().removeChecklistItem(id(), steps()[0].item_id);
    expect(steps()).toEqual([]);
    expect(only().progress_percent).toBe(0);
  });

  it("keeps ticked steps when the list is redrafted", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore.getState().addChecklistItem(id(), "Already done");
    useTaskStore.getState().toggleChecklistItem(id(), steps()[0].item_id);

    useTaskStore.getState().replaceChecklist(id(), ["Fresh one", "Fresh two"]);

    expect(steps().map((s) => s.label)).toEqual([
      "Already done",
      "Fresh one",
      "Fresh two",
    ]);
  });
});

describe("evidence is the trust boundary for closing a task", () => {
  it("lets general work be self-declared", () => {
    // No dataset attached: nothing tangible to point at.
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: undefined });

    expect(useTaskStore.getState().completeTask(id())).toBe(true);
    expect(only().status).toBe("done");
    expect(only().completed_at).toBeInstanceOf(Date);
    expect(only().completed_by).toBeTruthy();
  });

  it("refuses to close collect/process/analyse work with no evidence", () => {
    useTaskStore
      .getState()
      .addTask({ ...baseTask, dataset_id: "d1", lifecycle_stage: "process" });

    expect(useTaskStore.getState().completeTask(id())).toBe(false);
    expect(only().status).toBe("todo");

    useTaskStore
      .getState()
      .setEvidence(id(), { type: "file", ref: "f1", label: "qc.csv" });
    expect(useTaskStore.getState().completeTask(id())).toBe(true);
    expect(only().status).toBe("done");
  });

  it("refuses to close preserve/share work with no repository record", () => {
    useTaskStore
      .getState()
      .addTask({ ...baseTask, dataset_id: "d1", lifecycle_stage: "share" });

    expect(useTaskStore.getState().completeTask(id())).toBe(false);

    useTaskStore
      .getState()
      .setEvidence(id(), { type: "rdm_deposit", ref: "10.5281/zenodo.1" });
    expect(useTaskStore.getState().completeTask(id())).toBe(true);
  });

  it("ticks every step when the task is closed, and clears audit on reopen", () => {
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: undefined });
    useTaskStore.getState().addChecklistItem(id(), "One");
    useTaskStore.getState().addChecklistItem(id(), "Two");

    useTaskStore.getState().completeTask(id());
    expect(steps().every((s) => s.done)).toBe(true);

    useTaskStore.getState().reopenTask(id());
    expect(only().status).toBe("in_progress");
    expect(only().completed_at).toBeUndefined();
    expect(only().completed_by).toBeUndefined();
  });
});

describe("tasks follow the plan they came from", () => {
  it("scopes by dmp_id", () => {
    useTaskStore.getState().addTask(baseTask);
    useTaskStore.getState().addTask({ ...baseTask, dmp_id: "dmp-b" });

    expect(useTaskStore.getState().getTasksForDmp("dmp-a")).toHaveLength(1);
    expect(useTaskStore.getState().getTasksForDmp("dmp-c")).toHaveLength(0);
  });

  it("cancels a dropped dataset's open tasks instead of deleting them", () => {
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: "d1" });
    useTaskStore.getState().addTask({
      ...baseTask,
      dataset_id: "d1",
      title: "Already closed",
      dmp_id: "dmp-a",
    });
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: "d2" });

    const closed = useTaskStore.getState().tasks[1];
    useTaskStore
      .getState()
      .setEvidence(closed.task_id as string, { type: "file", ref: "f" });
    useTaskStore.getState().completeTask(closed.task_id as string);

    const cancelled = useTaskStore
      .getState()
      .cancelTasksForDataset("dmp-a", "d1");

    const byTitle = useTaskStore.getState().tasks;
    expect(cancelled).toBe(1);
    expect(byTitle).toHaveLength(3);
    expect(byTitle[0].status).toBe("cancelled");
    // A finished task keeps its record.
    expect(byTitle[1].status).toBe("done");
    // Another dataset's task is untouched.
    expect(byTitle[2].status).toBe("todo");
  });

  it("replaces untouched AI tasks and keeps everything worked on", () => {
    const ai = { ...baseTask, generated_by: "ai" as const };
    useTaskStore.getState().addGeneratedTasks([
      { ...ai, title: "AI untouched" },
      { ...ai, title: "AI started" },
    ]);
    useTaskStore.getState().addTask({ ...baseTask, title: "Mine" });

    const started = useTaskStore.getState().tasks[1];
    useTaskStore.getState().addChecklistItem(started.task_id as string, "Step");
    useTaskStore
      .getState()
      .toggleChecklistItem(
        started.task_id as string,
        useTaskStore.getState().tasks[1].checklist[0].item_id,
      );

    const result = useTaskStore
      .getState()
      .replaceGeneratedTasks("dmp-a", [{ ...ai, title: "Fresh" }]);

    const titles = useTaskStore.getState().tasks.map((t) => t.title);
    expect(result.removed).toBe(1);
    expect(titles).toContain("Fresh");
    expect(titles).toContain("AI started");
    expect(titles).toContain("Mine");
    expect(titles).not.toContain("AI untouched");
  });
});

describe("closing a task moves its dataset along the lifecycle", () => {
  beforeEach(() => {
    useDmpStore.setState({
      currentDmpId: "dmp-a",
      draft: {
        dataset: [
          {
            dataset_id: "d1",
            type: "raw",
            title: "Reads",
            status: "planned",
            access: "shared",
            personal_data: "no",
            sensitive_data: "no",
            protection_level: "x",
            security_classification_level: "y",
            keyword: [],
            preservation: { doi_requested: false },
            distribution: [],
            schema_fields: [],
          },
        ],
      },
      dmps: [],
    });
  });

  it("advances the dataset when the task closes", () => {
    useTaskStore
      .getState()
      .addTask({ ...baseTask, dataset_id: "d1", lifecycle_stage: "collect" });
    useTaskStore.getState().setEvidence(id(), { type: "file", ref: "f1" });
    useTaskStore.getState().completeTask(id());

    expect(useDmpStore.getState().draft.dataset?.[0].status).toBe("collected");
  });

  it("never walks a dataset backwards", () => {
    useDmpStore.setState((s) => ({
      draft: {
        ...s.draft,
        dataset: (s.draft.dataset ?? []).map((d) => ({
          ...d,
          status: "preserved" as const,
        })),
      },
    }));

    useTaskStore
      .getState()
      .addTask({ ...baseTask, dataset_id: "d1", lifecycle_stage: "collect" });
    useTaskStore.getState().setEvidence(id(), { type: "file", ref: "f1" });
    useTaskStore.getState().completeTask(id());

    expect(useDmpStore.getState().draft.dataset?.[0].status).toBe("preserved");
  });
});

describe("the output a closed task points at is fixed", () => {
  it("ignores a dataset change while the task is done", () => {
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: undefined });
    useTaskStore.getState().completeTask(id());
    expect(only().status).toBe("done");

    // Re-pointing it would retroactively raise the bar it was closed under.
    useTaskStore.getState().updateTask(id(), { dataset_id: "d1" });
    expect(only().dataset_id).toBeUndefined();

    // Other edits still go through.
    useTaskStore.getState().updateTask(id(), { title: "Renamed" });
    expect(only().title).toBe("Renamed");
  });

  it("allows the change once the task is reopened", () => {
    useTaskStore.getState().addTask({ ...baseTask, dataset_id: undefined });
    useTaskStore.getState().completeTask(id());
    useTaskStore.getState().reopenTask(id());

    useTaskStore.getState().updateTask(id(), { dataset_id: "d1" });
    expect(only().dataset_id).toBe("d1");
  });
});
