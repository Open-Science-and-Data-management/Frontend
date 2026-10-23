# Projects

The projects the committee oversees: every **institutional** project. Read-only
for committee members.

## Endpoints

| | |
| --- | --- |
| [List projects](#list-projects) | `GET /v1/projects` |
| [Retrieve a project](#retrieve-a-project) | `GET /v1/projects/:project_id` |
| [List project members](#list-project-members) | `GET /v1/projects/:project_id/members` |

## The Project object

```json
{
  "object": "project",
  "project_id": "proj-1",
  "project_name": "Urban Pollinator Genomics",
  "description": "Genomic diversity survey of pollinator populations…",
  "status": "active",
  "plan_mode": "institutional",
  "proposal_file_id": "file-1",
  "created_at": "2026-08-01T02:00:00Z",
  "updated_at": "2026-09-12T07:30:00Z",
  "file_count": 2,
  "member_count": 2,
  "awaiting_review": false,
  "progress": {
    "dmp_id": "dmp-pollinator",
    "title": "Urban Pollinator Genomics Data Management Plan",
    "active_version": 1,
    "overall": 50,
    "done": 2,
    "total": 4,
    "overdue": 1,
    "timeline": "No timeline set"
  }
}
```

### Attributes

- `object` (string, value is `"project"`)
  The object's type.
- `project_id` (string, required)
  Unique id.
- `project_name` (string, required)
  The project's name.
- `description` (string, nullable)
  What the project is about.
- `status` (enum, required)
  Possible enum values:
  - `draft`
  - `active`
  - `done`
- `plan_mode` (enum, required)
  Possible enum values:
  - `institutional`
  - `independent`
- `proposal_file_id` (string, nullable)
  The active proposal.
- `created_at` (date-time, required)
  When the project was created.
- `updated_at` (date-time, required)
  When the project last changed.
- `file_count` (integer, required)
  Number of files, for the project cards.
- `member_count` (integer, required)
  Number of members, for the project cards.
- `awaiting_review` (boolean, required)
  `true` when any of the project's plans has a version with status `pending`.
  The card shows "Waiting on the committee".
- `progress` (object, includable, nullable)
  The lead plan's [Progress](#the-progress-object). Returned only with
  `include=progress`; `null` when the project has no plan yet.
- `researcher` (object, includable)
  The project's researcher member. Returned only with `include=researcher`.
  - `user_id` (string, required)
    The researcher's user id.
  - `name` (string, required)
    Display name.
  - `email` (string, required)
    The researcher's email.

## The Progress object

The lifecycle progress of a project's lead plan: the one in force, else the
newest.

```json
{
  "dmp_id": "dmp-pollinator",
  "title": "Urban Pollinator Genomics Data Management Plan",
  "active_version": 1,
  "overall": 50,
  "done": 2,
  "total": 4,
  "overdue": 1,
  "timeline": "No timeline set"
}
```

### Attributes

- `object` (string, value is `"project_progress"`)
  The object's type.
- `dmp_id` (string, required)
  The plan measured.
- `title` (string, required)
  The lead plan's title (`DMP.title`).
- `active_version` (integer, nullable)
  The lead plan's version in force (`DMP.active_version`), if any.
- `overall` (integer, required)
  0–100. Each lifecycle stage with tasks counts equally, by the share of its
  tasks done. Cancelled tasks are left out.
- `done` (integer, required)
  Tasks done.
- `total` (integer, required)
  All tasks that aren't cancelled.
- `overdue` (integer, required)
  Open tasks past their due date.
- `timeline` (string, required)
  "Week N of M", "Starts …", "Timeline ended" or "No timeline set".

### List projects

`GET /v1/projects`

Lists institutional projects for the **Projects** page and the dashboard's
"Project progress" card and "Projects overseeing" stat.

**Who can call:** `committee`, `chief`

**Frontend today:** `useProjectStore.projects` filtered to
`plan_mode === "institutional"`; progress from `projectProgressFor`.

**Request**

```bash
curl "https://api.example.ac.th/v1/projects?plan_mode=institutional&include=progress" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "project",
      "project_id": "proj-1",
      "project_name": "Urban Pollinator Genomics",
      "description": "Genomic diversity survey of pollinator populations…",
      "status": "active",
      "plan_mode": "institutional",
      "proposal_file_id": "file-1",
      "created_at": "2026-08-01T02:00:00Z",
      "updated_at": "2026-09-12T07:30:00Z",
      "file_count": 2,
      "member_count": 2,
      "awaiting_review": false,
      "progress": {
        "dmp_id": "dmp-pollinator",
        "title": "Urban Pollinator Genomics Data Management Plan",
        "active_version": 1,
        "overall": 50,
        "done": 2,
        "total": 4,
        "overdue": 1,
        "timeline": "No timeline set"
      }
    }
  ],
  "has_more": false,
  "total_count": 3
}
```

**Parameters**

- `plan_mode` (enum, optional)
  For committee members this is always `institutional`; any other value
  returns nothing.
- `include` (array of enums, optional)
  Possible enum values:
  - `progress`: the lead plan's lifecycle [progress](#the-progress-object).
- `limit` (integer, optional)
  As in [README](./README.md#lists-and-pagination).
- `starting_after` (string, optional)
  As in [README](./README.md#lists-and-pagination).

**Returns** a list of [Projects](#the-project-object). "Projects overseeing" is
`total_count`; "N with overdue tasks" counts `progress.overdue > 0`.

The dashboard's "Project progress" card shows the first 4 projects that have
a plan, most recently updated lead plan first.

**Error codes**

Only the common errors listed in [README](./README.md#errors).

### Retrieve a project

`GET /v1/projects/:project_id`

Returns one project for the **Project** page, including who its researcher is.

**Who can call:** `committee`, `chief`

**Frontend today:** `useProjectStore.projects.find(...)`, `getResearcherFor(id)`

**Request**

```bash
curl "https://api.example.ac.th/v1/projects/proj-3?include=progress,researcher" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "project",
  "project_id": "proj-3",
  "project_name": "Soil Microbiome Survey",
  "description": "Amplicon sequencing of soil samples from organic and conventional rice paddies.",
  "status": "active",
  "plan_mode": "institutional",
  "proposal_file_id": null,
  "created_at": "2026-09-28T03:00:00Z",
  "updated_at": "2026-10-05T08:00:00Z",
  "file_count": 0,
  "member_count": 2,
  "awaiting_review": true,
  "progress": {
    "dmp_id": "dmp-soil",
    "title": "Soil Microbiome Survey DMP",
    "active_version": null,
    "overall": 0,
    "done": 0,
    "total": 0,
    "overdue": 0,
    "timeline": "Starts Nov 1, 2026"
  },
  "researcher": {
    "user_id": "user-1",
    "name": "Dr. Aran Suwannachot",
    "email": "aran@example.edu"
  }
}
```

**Parameters**

- `include` (array of enums, optional)
  Possible enum values:
  - `progress`: the lead plan's lifecycle [progress](#the-progress-object).
  - `researcher`: the project's researcher member.

**Returns** a [Project](#the-project-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `project_not_found` | No project with that id. |

### List project members

`GET /v1/projects/:project_id/members`

Lists the project's team for the **Team** section.

**Who can call:** `committee`, `chief`

**Frontend today:** `useProjectStore.members.filter(...)` with `getUser(...)`

**Request**

```bash
curl https://api.example.ac.th/v1/projects/proj-1/members \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "project_member",
      "project_id": "proj-1",
      "user_id": "user-1",
      "project_role": "researcher",
      "user": { "name": "Dr. Aran Suwannachot", "email": "aran@example.edu" }
    },
    {
      "object": "project_member",
      "project_id": "proj-1",
      "user_id": "user-2",
      "project_role": "committee",
      "user": { "name": "Prof. Mali Chaiyasit", "email": "mali@example.edu" }
    }
  ],
  "has_more": false,
  "total_count": 2
}
```

**Parameters** none.

**Returns** a list of project members. One row per `(project_id, user_id)`.

**Error codes**

Only the common errors listed in [README](./README.md#errors).
