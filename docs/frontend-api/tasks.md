# Tasks

The work a plan in force has been broken into. Committee members see tasks to
follow a project's progress; they can't tick, move, or edit them.

## Endpoints

| | |
| --- | --- |
| [List tasks](#list-tasks) | `GET /v1/tasks` |

## The Task object

```json
{
  "object": "task",
  "task_id": "2",
  "dmp_id": "dmp-pollinator",
  "dataset_id": "ds-pollinator-reads",
  "dataset_title": "Pollinator genomic sequence reads",
  "title": "Run QC on the sequencing batch",
  "details": "Check read quality and record the failures.",
  "lifecycle_stage": "process",
  "status": "in_progress",
  "priority": "medium",
  "progress_percent": 50,
  "start_date": null,
  "end_date": "2026-10-09",
  "evidence": { "type": "none" },
  "completed_at": null,
  "completed_by": null
}
```

### Attributes

- `object` (string, value is `"task"`)
  The object's type.
- `task_id` (string, required)
  Unique id.
- `dmp_id` (string, required)
  The plan the task belongs to.
- `dataset_id` (string, nullable)
  The research output the task is for.
- `dataset_title` (string, nullable)
  The research output's title, for display.
- `title` (string, required)
  What the task is.
- `details` (string, nullable)
  More detail.
- `lifecycle_stage` (enum, required)
  Possible enum values:
  - `collect`
  - `process`
  - `analyse`
  - `preserve`
  - `share`
- `status` (enum, required)
  Possible enum values:
  - `todo`
  - `in_progress`
  - `done`
  - `cancelled`
- `priority` (enum, required)
  Possible enum values:
  - `low`
  - `medium`
  - `high`
- `progress_percent` (integer, required)
  Derived from the checklist.
- `start_date` (date, nullable)
  When the task starts.
- `end_date` (date, nullable)
  When the task is due.
- `evidence` (object, required)
  What shows the work was done.
  - `type` (enum, required)
    Possible enum values:
    - `none`
    - `file`
    - `url`
    - `rdm_deposit`
  - `ref` (string, nullable)
    File id, URL, or DOI, depending on `type`.
  - `label` (string, nullable)
    Shown in place of `ref` in the task table, so the file doesn't need
    looking up.
  - `attached_at` (date-time, nullable)
    When it was attached.
- `completed_at` (date-time, nullable)
  When the task was completed.
- `completed_by` (string, nullable)
  Who completed it.

### List tasks

`GET /v1/tasks`

Lists a project's tasks for the read-only task table on the **Project** page:
task, stage, status, progress, due date, evidence.

**Who can call:** `committee`, `chief`

**Frontend today:** `useTaskStore.tasks` filtered to the project's plans,
shown by `TaskReadOnlyList`.

**Request**

```bash
curl "https://api.example.ac.th/v1/tasks?project_id=proj-1" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "task",
      "task_id": "2",
      "dmp_id": "dmp-pollinator",
      "dataset_id": "ds-pollinator-reads",
      "dataset_title": "Pollinator genomic sequence reads",
      "title": "Run QC on the sequencing batch",
      "details": "Check read quality and record the failures.",
      "lifecycle_stage": "process",
      "status": "in_progress",
      "priority": "medium",
      "progress_percent": 50,
      "end_date": "2026-10-09",
      "evidence": { "type": "none" }
    }
  ],
  "has_more": false,
  "total_count": 4
}
```

**Parameters**

- `project_id` (string, one of `project_id` or `dmp_id` **required**)
  Tasks of the project's plans.
- `dmp_id` (string, one of `project_id` or `dmp_id` **required**)
  Tasks of one plan.
- `status` (enum, optional)
  Possible enum values:
  - `todo`
  - `in_progress`
  - `done`
  - `cancelled`

**Returns** a list of [Tasks](#the-task-object), ordered by lifecycle stage,
then title.

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `filter_required` | Neither `project_id` nor `dmp_id` was sent. |
| 400 | `invalid_status` | `status` holds a value other than the four above. |
