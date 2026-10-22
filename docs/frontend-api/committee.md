# Committee API

The API the **committee** side of the DMP Researcher frontend needs: every
page a committee member uses, how many inputs each one asks them to fill, and
the endpoints behind it. The format follows the
[Stripe API reference](https://docs.stripe.com/api/v2/core/accounts): an
endpoint list per resource, then each endpoint with its request, response,
parameters, return value and error codes.

> **Status: proposed contract.** There is no backend yet. The frontend does all
> of this today with browser-held Zustand stores. Each endpoint names the store
> call it replaces (**Frontend today**), so it can be swapped for a request
> without changing what the page does.

Field names follow the frontend schemas and `docs/project-erd.md`
(`snake_case`), so a response can be stored without renaming.

---

## Contents

1. [Pages and inputs](#pages-and-inputs)
2. [Conventions](#conventions)
3. [Authentication and profile](#authentication-and-profile)
4. [Reviews](#reviews)
5. [Plans (DMPs)](#plans-dmps)
6. [Decisions](#decisions)
7. [Projects](#projects)
8. [Tasks](#tasks)
9. [Files](#files)
10. [Notifications](#notifications)
11. [Objects](#objects)

---

## Pages and inputs

What a committee member fills in on each page, and which endpoints the page
calls. Everything else on the committee side is read-only.

| Page | Route | Inputs to fill | Endpoints |
| --- | --- | --- | --- |
| Sign in | `/login` | **2**: username, password | [Sign in](#sign-in) |
| Dashboard | `/` | **0** | [List reviews](#list-reviews) (pending, and decided by me), [List projects](#list-projects) |
| Review queue | `/review` | **0** | [List reviews](#list-reviews) (pending, and recently decided) |
| Review | `/review/:dmp_id` | **2**: position, comments | [Retrieve a plan](#retrieve-a-plan), [Approve a version](#approve-a-version), [Reject a version](#reject-a-version) |
| Projects | `/projects` | **0** | [List projects](#list-projects) |
| Project | `/projects/:project_id` | **0** | [Retrieve a project](#retrieve-a-project), [List project members](#list-project-members), [List plans](#list-plans), [List tasks](#list-tasks), [List files](#list-files), [Download a file](#download-a-file) |
| Notifications | `/notifications` | **0** | [List](#list-notifications), [mark read](#mark-a-notification-read), [mark all read](#mark-all-notifications-read), [delete](#delete-a-notification), [delete all](#delete-all-notifications) |
| Settings | `/settings` | **4**: title, name, surname, email | [Retrieve the current user](#retrieve-the-current-user), [Update the current user](#update-the-current-user) |
| User menu | every page | **0** | [Sign out](#sign-out) |

**8 inputs in total**, on three pages. Settings also has a theme choice and an
email-notification switch; both are device preferences stored in the browser
and call no endpoint.

### Inputs in detail

| Page | Input | Type | Required | Rules |
| --- | --- | --- | --- | --- |
| Sign in | `username` | text | yes | Matched case-insensitively. |
| Sign in | `password` | password | yes | Wrong username and wrong password give the same error. |
| Review | `position` | text | yes | Defaults to "Committee member". Recorded on the decision and named in maDMP exports. |
| Review | `note` (Comments for the researcher) | textarea | for **Reject** only | Optional when approving; sent to the researcher either way. |
| Settings | `title` | text | no | e.g. "Prof." |
| Settings | `name` | text | yes | |
| Settings | `surname` | text | yes | |
| Settings | `email` | email | yes | Must be a valid address that no other account uses (case and spaces ignored). |

---

## Conventions

**Base URL** `https://api.example.ac.th/v1` (placeholder).

**Authentication.** [Sign in](#sign-in) returns a session token. Send it on
every other request:

```http
Authorization: Bearer <session_token>
```

Every committee endpoint requires a user whose `role` is `committee` or
`chief`; anyone else gets `403 not_a_reviewer`. The committee sees every
**institutional** project and plan, not only projects it is a member of.
Independent plans are finalized by their researcher and never reach the
committee.

**Requests and responses** are JSON. Dates are ISO 8601 strings. Calendar
dates without a time (plan begin/end, task due dates) are `YYYY-MM-DD`.

**Lists** share one shape and are paged with `limit` (1–100, default 20) and
`starting_after` (the last `id` of the previous page):

```json
{
  "object": "list",
  "data": [],
  "has_more": false,
  "total_count": 0
}
```

`total_count` counts every match, not just this page. The dashboard's stat
cards are built from it.

**Errors** return a non-2xx status and one shape:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "note_required",
    "message": "A note is required when sending a version back.",
    "param": "note"
  }
}
```

These codes can come from any endpoint:

| HTTP status code | Code | Description |
| --- | --- | --- |
| 401 | `not_signed_in` | No session token, or it has expired. |
| 403 | `not_a_reviewer` | The signed-in user isn't committee or chief. |
| 404 | `resource_missing` | No object with that id. |
| 429 | `rate_limited` | Too many requests; retry later. |

---

## Authentication and profile

Signing in and out, and the signed-in person's own profile.

### Endpoints

| | |
| --- | --- |
| [Sign in](#sign-in) | `POST /v1/auth/sessions` |
| [Sign out](#sign-out) | `DELETE /v1/auth/sessions/current` |
| [Retrieve the current user](#retrieve-the-current-user) | `GET /v1/users/me` |
| [Update the current user](#update-the-current-user) | `PATCH /v1/users/me` |

### Sign in

`POST /v1/auth/sessions`

Starts a session for a username and password. Committee accounts are granted
by the institution; there is no committee sign-up.

**Frontend today:** `useAuthStore.signIn(username, password)`

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/auth/sessions \
  --json '{
    "username": "mali",
    "password": "demo1234"
  }'
```

**Response**

```json
{
  "object": "session",
  "token": "sess_9f2c1d…",
  "expires_at": "2026-10-23T09:00:00Z",
  "user": {
    "object": "user",
    "user_id": "user-2",
    "title": "Prof.",
    "name": "Mali",
    "surname": "Chaiyasit",
    "email": "mali@example.edu",
    "role": "committee",
    "username": "mali"
  }
}
```

**Parameters**

- `username` (string, **required**)
  The account's username. Matched case-insensitively.
- `password` (string, **required**)
  The account's password. Never stored or returned.

**Returns** a session object with a `token` and the signed-in
[User](#the-user-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `parameter_missing` | `username` or `password` is empty. |
| 401 | `invalid_credentials` | Username or password is incorrect. The same code for both, so the response doesn't reveal which usernames exist. |

### Sign out

`DELETE /v1/auth/sessions/current`

Ends the current session. The frontend then shows the public landing page.

**Frontend today:** `useAuthStore.logout()`

**Request**

```bash
curl -X DELETE https://api.example.ac.th/v1/auth/sessions/current \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{ "object": "session", "deleted": true }
```

**Parameters** none.

**Returns** a deletion confirmation.

### Retrieve the current user

`GET /v1/users/me`

Returns the signed-in user. The navbar, user menu, dashboard greeting and
Settings form read it.

**Frontend today:** `useCurrentUser()`

**Request**

```bash
curl https://api.example.ac.th/v1/users/me \
  -H "Authorization: Bearer <session_token>"
```

**Response** a [User object](#the-user-object).

**Parameters** none.

**Returns** the signed-in [User](#the-user-object).

### Update the current user

`PATCH /v1/users/me`

Updates the signed-in user's profile from the **Settings** page. Role, username
and AI quota can't be changed here.

**Frontend today:** `useProjectStore.updateUser(user_id, patch)`, after
`userProfileSchema` validation and `isEmailTaken` check.

**Request**

```bash
curl -X PATCH https://api.example.ac.th/v1/users/me \
  -H "Authorization: Bearer <session_token>" \
  --json '{
    "title": "Prof.",
    "name": "Mali",
    "surname": "Chaiyasit",
    "email": "mali.c@example.edu"
  }'
```

**Response** the updated [User object](#the-user-object).

**Parameters**

- `title` (string, optional)
  An honorific such as "Prof." An empty string clears it.
- `name` (string, optional)
  First name. Can't be empty.
- `surname` (string, optional)
  Last name. Can't be empty.
- `email` (string, optional)
  A valid email no other account uses, ignoring case and surrounding spaces.
  Accounts are matched to plan contributors by email, so it must be unique.

**Returns** the updated [User](#the-user-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `name_required` | `name` or `surname` was sent empty. |
| 400 | `email_invalid` | `email` isn't a valid address. |
| 409 | `email_taken` | Another account already uses this email. |

---

## Reviews

A **Review** is one plan version sent to the committee: the newest version of
an institutional plan, with who wrote it, where it belongs, and where its
decision stands. The Review queue, the dashboard and the
"Recently decided by you" list all read reviews.

### Endpoints

| | |
| --- | --- |
| [List reviews](#list-reviews) | `GET /v1/reviews` |

### List reviews

`GET /v1/reviews`

Lists reviews, oldest submission first by default, so the head of the pending
list is always the plan that has waited longest.

**Frontend today:** `reviewQueue(useDmpLibrary())` for pending reviews; the
decided list and the dashboard numbers are computed in `ReviewQueue.tsx` and
`useCommitteeDashboard`.

**Request** what each committee screen asks for:

```bash
# Dashboard and Review queue: everything waiting, longest-waiting first
curl "https://api.example.ac.th/v1/reviews?status=pending" \
  -H "Authorization: Bearer <session_token>"

# Review queue: the 8 most recent decisions
curl "https://api.example.ac.th/v1/reviews?status=approved,rejected&sort=-decided_at&limit=8" \
  -H "Authorization: Bearer <session_token>"

# Dashboard: decisions I made
curl "https://api.example.ac.th/v1/reviews?decided_by=me&sort=-decided_at&limit=5" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "review",
      "id": "dmp-soil:1",
      "dmp_id": "dmp-soil",
      "title": "Soil Microbiome Survey DMP",
      "version": 1,
      "status": "pending",
      "is_revision": false,
      "active_version": null,
      "submitted_at": "2026-10-20T03:12:00Z",
      "days_waiting": 2,
      "changes_summary": { "major": 0, "minor": 0 },
      "timeline": "Starts Nov 1, 2026",
      "researcher": {
        "user_id": "user-1",
        "name": "Dr. Aran Suwannachot"
      },
      "project": {
        "project_id": "proj-3",
        "project_name": "Soil Microbiome Survey"
      },
      "decided_at": null,
      "decided_by": null,
      "approver": null,
      "note": null
    }
  ],
  "has_more": false,
  "total_count": 1
}
```

**Parameters**

- `status` (enum or comma-separated enums, optional)
  Only reviews whose version has this status. Defaults to all three.
  Possible enum values:
  - `pending`: waiting on a decision.
  - `approved`: approved by the committee.
  - `rejected`: sent back to the researcher.
- `decided_by` (string, optional)
  Only versions decided by this `user_id`, or `me` for the signed-in reviewer.
- `project_id` (string, optional)
  Only reviews of plans in this project.
- `submitted_after` (date-time, optional)
  Only versions submitted after this moment. The dashboard's
  "N submitted this week" card sends today minus 7 days.
- `sort` (enum, optional)
  Defaults to `submitted_at`. Possible enum values:
  - `submitted_at`: oldest submission first.
  - `-submitted_at`: newest submission first.
  - `-decided_at`: most recent decision first.
- `limit` (integer, optional)
  1–100. Defaults to 20.
- `starting_after` (string, optional)
  A review `id` to page after.

**Returns** a list of [Review](#the-review-object) objects, with
`total_count`. The dashboard's stat cards come from these counts:

| Card | Request | Value |
| --- | --- | --- |
| Waiting my review | `status=pending` | `total_count` |
| Submitted this week | `status=pending&submitted_after=…` | `total_count` |
| Longest waiting | `status=pending&limit=1` | `data[0].days_waiting` |
| Approved by you | `decided_by=me&status=approved` | `total_count` |
| Decisions / sent back | `decided_by=me`, `decided_by=me&status=rejected` | `total_count` |

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `invalid_status` | `status` holds a value other than the three above. |

---

## Plans (DMPs)

A **Plan** is a Data Management Plan with its full version history. The
committee reads plans; it never edits their content.

### Endpoints

| | |
| --- | --- |
| [Retrieve a plan](#retrieve-a-plan) | `GET /v1/dmps/:dmp_id` |
| [List plans](#list-plans) | `GET /v1/dmps` |

### Retrieve a plan

`GET /v1/dmps/:dmp_id`

Returns a plan as a reviewer sees it on the **Review** page. `review_snapshot`
is the content under review: the pending version as submitted (never the
researcher's later, unsubmitted edits), else the version in force, else the
draft.

**Frontend today:** `useDmpLibrary().find(...)` with `reviewedSnapshot(record)`
and `computeReadiness(snapshot)`.

**Request**

```bash
curl "https://api.example.ac.th/v1/dmps/dmp-soil?include=versions,readiness" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "dmp",
  "dmp_id": "dmp-soil",
  "project_id": "proj-3",
  "title": "Soil Microbiome Survey DMP",
  "description": "16S amplicon reads and soil chemistry from 40 paddy plots…",
  "language": "eng",
  "status": "pending",
  "plan_mode": "institutional",
  "active_version": null,
  "created_at": "2026-10-16T03:00:00Z",
  "updated_at": "2026-10-20T03:12:00Z",
  "researcher": { "user_id": "user-1", "name": "Dr. Aran Suwannachot" },
  "review_snapshot": {
    "title": "Soil Microbiome Survey DMP",
    "begin_date": "2026-11-01",
    "end_date": "2028-10-31",
    "ethical_issues_exist": false,
    "contributor": [ { "name": "Aran", "surname": "Suwannachot", "role": "Principal investigator", "is_contact": true } ],
    "dataset": [ { "dataset_id": "ds-soil-reads", "title": "16S amplicon sequence reads", "access": "open" } ]
  },
  "versions": [
    {
      "object": "dmp_version",
      "number": 1,
      "status": "pending",
      "edit_type": "major",
      "changes": [],
      "created_at": "2026-10-20T03:12:00Z",
      "decided_at": null,
      "approver": null,
      "note": null
    }
  ],
  "readiness": {
    "complete": true,
    "unmet_items": []
  }
}
```

**Parameters**

- `include` (array of enums, optional)
  Extra fields to return. Possible enum values:
  - `versions`: every [Version](#the-version-object), newest first.
  - `readiness`: whether the reviewed content passes the plan rules, and
    which items don't (`unmet_items`, each with `label` and `section`).

**Returns** a [Plan](#the-plan-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `dmp_not_found` | No plan with that id. |
| 403 | `plan_not_reviewable` | The plan is independent; the committee has no part in it. |

### List plans

`GET /v1/dmps`

Lists a project's plans for the **Project** page, newest activity first.
Archived plans are left out.

**Frontend today:** `useDmpLibrary().filter((d) => d.project_id === id)`

**Request**

```bash
curl "https://api.example.ac.th/v1/dmps?project_id=proj-1" \
  -H "Authorization: Bearer <session_token>"
```

**Response** a list of [Plan](#the-plan-object) objects, without
`review_snapshot` or `versions` unless asked for with `include`.

**Parameters**

- `project_id` (string, **required** for committee members)
  The project whose plans to list.
- `include` (array of enums, optional)
  As in [Retrieve a plan](#retrieve-a-plan).

**Returns** a list of [Plans](#the-plan-object).

---

## Decisions

A decision moves a pending version to `approved` or `rejected`. It's recorded
on the version with the deciding member as its **approver**: name and email
from the session, and the position they typed. The maDMP export names that
approver.

### Endpoints

| | |
| --- | --- |
| [Approve a version](#approve-a-version) | `POST /v1/dmps/:dmp_id/versions/:number/approve` |
| [Reject a version](#reject-a-version) | `POST /v1/dmps/:dmp_id/versions/:number/reject` |

### Approve a version

`POST /v1/dmps/:dmp_id/versions/:number/approve`

Approves the pending version. It comes into force (`active_version` becomes
`number`), and the researcher is notified (`dmp_approved`). For a revision:

- minor fixes the researcher made to the version in force while it waited are
  merged into it (`carried_minor_edits`); fixes to an output the revision
  removed are kept in `dropped_minor_edits`;
- tasks of any research output the new version removes are cancelled, and the
  researcher is notified (`tasks_cancelled`).

**Frontend today:** `useDmpStore.approveDmp(dmp_id, approver, note)`, which runs
the same path as `approve(approver)` (`activate` in `dmpStore.ts`).

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/dmps/dmp-soil/versions/1/approve \
  -H "Authorization: Bearer <session_token>" \
  --json '{
    "position": "Committee chair",
    "note": "Clear plan. Please confirm the repository before data collection starts."
  }'
```

**Response**

```json
{
  "object": "dmp_version",
  "dmp_id": "dmp-soil",
  "number": 1,
  "status": "approved",
  "edit_type": "major",
  "created_at": "2026-10-20T03:12:00Z",
  "decided_at": "2026-10-22T08:41:00Z",
  "decided_by": "user-2",
  "approver": {
    "user_id": "user-2",
    "name": "Prof. Mali Chaiyasit",
    "position": "Committee chair",
    "mbox": "mali@example.edu"
  },
  "note": "Clear plan. Please confirm the repository before data collection starts.",
  "carried_minor_edits": null,
  "dropped_minor_edits": null
}
```

**Parameters**

- `position` (string, **required**)
  The deciding member's role, e.g. "Committee member" or "Committee chair".
  The page pre-fills "Committee member".
- `note` (string, optional)
  A comment for the researcher. Stored on the version and included in the
  approval notification.

**Returns** the decided [Version](#the-version-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `position_required` | `position` is missing or blank. |
| 404 | `version_not_found` | The plan has no version with that number. |
| 409 | `version_not_pending` | That version was already decided, so there is nothing to approve. |

### Reject a version

`POST /v1/dmps/:dmp_id/versions/:number/reject`

Sends the pending version back to the researcher with a reason, and notifies
them (`dmp_returned`). What happens to the plan depends on the version:

- **A first submission** (nothing in force): the plan goes back to `draft` for
  the researcher to revise. Their next submission is numbered after this one.
- **A revision**: the version in force keeps running, with its tasks. Minor
  fixes made to it while the revision waited stay on it.

The page calls this **Send back**; the stored status is `rejected`.

**Frontend today:** `useDmpStore.returnDmp(dmp_id, approver, note)`, which runs
`rejectRevision(note, approver)`.

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/dmps/dmp-soil/versions/1/reject \
  -H "Authorization: Bearer <session_token>" \
  --json '{
    "position": "Committee member",
    "note": "Add a preservation statement for the sequence reads."
  }'
```

**Response**

```json
{
  "object": "dmp_version",
  "dmp_id": "dmp-soil",
  "number": 1,
  "status": "rejected",
  "edit_type": "major",
  "created_at": "2026-10-20T03:12:00Z",
  "decided_at": "2026-10-22T08:45:00Z",
  "decided_by": "user-2",
  "approver": {
    "user_id": "user-2",
    "name": "Prof. Mali Chaiyasit",
    "position": "Committee member",
    "mbox": "mali@example.edu"
  },
  "note": "Add a preservation statement for the sequence reads.",
  "plan_status": "draft"
}
```

**Parameters**

- `position` (string, **required**)
  As in [Approve a version](#approve-a-version).
- `note` (string, **required**)
  What needs to change. The researcher sees it on their Status page and in
  the editor.

**Returns** the decided [Version](#the-version-object), plus `plan_status`:
the plan's status afterwards (`draft` for a returned first submission,
`approved` when a version stays in force).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `position_required` | `position` is missing or blank. |
| 400 | `note_required` | `note` is missing or blank. A version can't be sent back without a reason. |
| 404 | `version_not_found` | The plan has no version with that number. |
| 409 | `version_not_pending` | That version was already decided. |

---

## Projects

The projects the committee oversees: every **institutional** project. Read-only
for committee members.

### Endpoints

| | |
| --- | --- |
| [List projects](#list-projects) | `GET /v1/projects` |
| [Retrieve a project](#retrieve-a-project) | `GET /v1/projects/:project_id` |
| [List project members](#list-project-members) | `GET /v1/projects/:project_id/members` |

### List projects

`GET /v1/projects`

Lists institutional projects for the **Projects** page and the dashboard's
"Project progress" card and "Projects overseeing" stat.

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
- `limit`, `starting_after` (optional)
  As in [Conventions](#conventions).

**Returns** a list of [Projects](#the-project-object). "Projects overseeing" is
`total_count`; "N with overdue tasks" counts `progress.overdue > 0`.

### Retrieve a project

`GET /v1/projects/:project_id`

Returns one project for the **Project** page, including who its researcher is.

**Frontend today:** `useProjectStore.projects.find(...)`, `getResearcherFor(id)`

**Request**

```bash
curl "https://api.example.ac.th/v1/projects/proj-3?include=progress,researcher" \
  -H "Authorization: Bearer <session_token>"
```

**Response** a [Project object](#the-project-object), with `researcher`
(`user_id`, `name`, `email`) when included.

**Parameters**

- `include` (array of enums, optional)
  `progress`, and `researcher` (the project's researcher member).

**Returns** a [Project](#the-project-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `project_not_found` | No project with that id. |

### List project members

`GET /v1/projects/:project_id/members`

Lists the project's team for the **Team** section.

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

---

## Tasks

The work a plan in force has been broken into. Committee members see tasks to
follow a project's progress; they can't tick, move, or edit them.

### Endpoints

| | |
| --- | --- |
| [List tasks](#list-tasks) | `GET /v1/tasks` |

### List tasks

`GET /v1/tasks`

Lists a project's tasks for the read-only task table on the **Project** page:
task, stage, status, progress, due date, evidence.

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
  `todo`, `in_progress`, `done` or `cancelled`.

**Returns** a list of [Tasks](#the-task-object), ordered by lifecycle stage,
then title.

---

## Files

Files uploaded to a project: proposals, task deliverables, evidence. Committee
members can list and download them; they can't upload or remove them.

### Endpoints

| | |
| --- | --- |
| [List files](#list-files) | `GET /v1/files` |
| [Download a file](#download-a-file) | `GET /v1/files/:file_id/content` |

### List files

`GET /v1/files`

Lists a project's files for the **Files** section, current files first and
superseded proposals after.

**Frontend today:** `useProjectStore.files.filter(...)` in `FileList` with
`readOnly`.

**Request**

```bash
curl "https://api.example.ac.th/v1/files?project_id=proj-1" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "file",
      "file_id": "file-1",
      "project_id": "proj-1",
      "uploaded_by": "user-1",
      "filename": "pollinator-proposal.docx",
      "file_type": "docx",
      "purpose": "proposal",
      "metadata": { "byte_size": 184320, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      "uploaded_at": "2026-08-01T02:05:00Z",
      "superseded_at": null
    }
  ],
  "has_more": false,
  "total_count": 2
}
```

**Parameters**

- `project_id` (string, **required**)
  The project whose files to list.
- `purpose` (enum, optional)
  `proposal`, `task_deliverable` or `evidence`.

**Returns** a list of [Files](#the-file-object).

### Download a file

`GET /v1/files/:file_id/content`

Returns the file's bytes, with `Content-Disposition: attachment` and its
original filename.

**Frontend today:** `fileApi.getDownloadUrl(file_id)`. It only works for files
uploaded in the current browser session; this endpoint removes that limit.

**Request**

```bash
curl -L -O -J https://api.example.ac.th/v1/files/file-1/content \
  -H "Authorization: Bearer <session_token>"
```

**Response** the file, as `application/octet-stream` or its `mime_type`.

**Parameters** none.

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `file_not_found` | No file with that id. |
| 410 | `file_content_gone` | The record exists but its content is no longer stored. |

---

## Notifications

The signed-in user's notifications. Committee members mostly receive
`review_requested`, sent to every reviewer when a plan or revision is
submitted. Each user only ever sees their own.

### Endpoints

| | |
| --- | --- |
| [List notifications](#list-notifications) | `GET /v1/notifications` |
| [Mark a notification read](#mark-a-notification-read) | `POST /v1/notifications/:notification_id/read` |
| [Mark all notifications read](#mark-all-notifications-read) | `POST /v1/notifications/read_all` |
| [Delete a notification](#delete-a-notification) | `DELETE /v1/notifications/:notification_id` |
| [Delete all notifications](#delete-all-notifications) | `DELETE /v1/notifications` |

### List notifications

`GET /v1/notifications`

Lists the signed-in user's notifications, newest first, for the
**Notifications** page and the sidebar's unread badge.

**Frontend today:** `useNotificationStore.notifications` filtered to the
signed-in `user_id`.

**Request**

```bash
curl "https://api.example.ac.th/v1/notifications?limit=50" \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "list",
  "data": [
    {
      "object": "notification",
      "notification_id": "ntf-review-soil",
      "user_id": "user-2",
      "type": "review_requested",
      "title": "New plan to review",
      "message": "Soil Microbiome Survey DMP was submitted for approval.",
      "link": "/review/dmp-soil",
      "dmp_id": "dmp-soil",
      "project_id": "proj-3",
      "read_at": null,
      "created_at": "2026-10-20T03:12:00Z"
    }
  ],
  "has_more": false,
  "total_count": 1,
  "unread_count": 1
}
```

**Parameters**

- `unread` (boolean, optional)
  `true` for unread notifications only.
- `limit`, `starting_after` (optional)
  As in [Conventions](#conventions).

**Returns** a list of [Notifications](#the-notification-object), plus
`unread_count` for the sidebar badge.

### Mark a notification read

`POST /v1/notifications/:notification_id/read`

Marks one notification read. The page calls it when a notification is opened,
then follows its `link`.

**Frontend today:** `useNotificationStore.markRead(id)`

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/notifications/ntf-review-soil/read \
  -H "Authorization: Bearer <session_token>"
```

**Response** the [Notification](#the-notification-object) with `read_at` set.
Already-read notifications are returned unchanged.

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `notification_not_found` | No notification with that id for this user. |

### Mark all notifications read

`POST /v1/notifications/read_all`

Marks every unread notification of the signed-in user read (**Mark all read**).

**Frontend today:** `useNotificationStore.markAllRead(user_id)`

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/notifications/read_all \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{ "object": "notification_batch", "updated": 3 }
```

**Returns** how many notifications were marked read.

### Delete a notification

`DELETE /v1/notifications/:notification_id`

Dismisses one notification (the **×** on a row).

**Frontend today:** `useNotificationStore.remove(id)`

**Request**

```bash
curl -X DELETE https://api.example.ac.th/v1/notifications/ntf-review-soil \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{ "object": "notification", "notification_id": "ntf-review-soil", "deleted": true }
```

### Delete all notifications

`DELETE /v1/notifications`

Removes all of the signed-in user's notifications (**Clear all**, after a
confirmation). Other users' notifications are untouched.

**Frontend today:** `useNotificationStore.clearAll(user_id)`

**Request**

```bash
curl -X DELETE https://api.example.ac.th/v1/notifications \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{ "object": "notification_batch", "deleted": 4 }
```

---

## Objects

The objects the endpoints above return. Attribute names match
`docs/project-erd.md`.

### The User object

- `user_id` (string): unique id.
- `title` (string, nullable): honorific, e.g. "Prof."
- `name` (string): first name.
- `surname` (string): last name.
- `email` (string): unique per account, ignoring case and spaces.
- `role` (enum): `admin`, `chief`, `committee` or `researcher`. Committee
  endpoints need `committee` or `chief`.
- `username` (string): sign-in name.
- `ai_token_limit`, `ai_token_used` (integer): AI budget; researchers only use it.

### The Review object

- `id` (string): `dmp_id` and version number, e.g. `dmp-soil:1`.
- `dmp_id`, `title` (string): the plan.
- `version` (integer): the version this review is about, the plan's newest.
- `status` (enum): `pending`, `approved` or `rejected`.
- `is_revision` (boolean): `true` when an earlier version is in force.
- `active_version` (integer, nullable): the version in force, if any.
- `submitted_at` (date-time): when the version was submitted.
- `days_waiting` (integer): whole days since submission. The frontend tags
  3+ days amber and **7+ days red**.
- `changes_summary` (object): `major` and `minor` change counts, for revisions.
- `timeline` (string): where today falls in the plan, e.g. "Week 4 of 14".
- `researcher` (object): `user_id` and display `name`.
- `project` (object): `project_id` and `project_name`.
- `decided_at`, `decided_by`, `approver`, `note`: as on the
  [Version](#the-version-object), once decided.

### The Plan object

- `dmp_id` (string), `project_id` (string, nullable)
- `title`, `description`, `language` (string)
- `status` (enum): `draft`, `pending` or `approved`.
- `plan_mode` (enum): `institutional` or `independent`, frozen at first
  submission.
- `active_version` (integer, nullable): the version in force.
- `created_at`, `updated_at` (date-time)
- `review_snapshot` (object): the plan content under review. Same shape as the
  DMP form: dates, ethics, contributors, costs, research outputs.
- `versions` (array of [Versions](#the-version-object)): when included.
- `readiness` (object): `complete` (boolean) and `unmet_items`, when included.

### The Version object

A numbered revision of a plan (`DMP_VERSION` in the ERD).

- `number` (integer): per plan; a rejected number is never reused.
- `status` (enum): `pending`, `approved` or `rejected`.
- `edit_type` (enum): `minor` or `major`.
- `changes` (array): what the revision changes against the version in force.
  Each has `path`, `label`, `from`, `to`, `edit_type`. A first submission has
  none.
- `created_at` (date-time): submitted.
- `decided_at` (date-time, nullable), `decided_by` (string, nullable): the
  deciding reviewer's `user_id`.
- `approver` (object, nullable): `user_id`, `name`, `position`, `mbox` as they
  were at decision time. A later change of committee doesn't rewrite it.
- `note` (string, nullable): the reviewer's comment.
- `carried_minor_edits`, `dropped_minor_edits` (array, nullable): fixes merged
  into an approved revision, or that couldn't be merged.

### The Project object

- `project_id`, `project_name`, `description` (string)
- `status` (enum): `draft`, `active` or `done`.
- `plan_mode` (enum): `institutional` or `independent`.
- `proposal_file_id` (string, nullable): the active proposal.
- `created_at`, `updated_at` (date-time)
- `file_count`, `member_count` (integer), `awaiting_review` (boolean): for the
  project cards.
- `progress` ([Progress](#the-progress-object), nullable): when included.

### The Progress object

The lifecycle progress of a project's lead plan: the one in force, else the
newest.

- `dmp_id` (string): the plan measured.
- `overall` (integer, 0–100): each lifecycle stage with tasks counts equally,
  by the share of its tasks done. Cancelled tasks are left out.
- `done`, `total` (integer): tasks done, out of all that aren't cancelled.
- `overdue` (integer): open tasks past their due date.
- `timeline` (string): "Week N of M", "Starts …", "Timeline ended" or
  "No timeline set".

### The Task object

- `task_id`, `dmp_id` (string), `dataset_id` (string, nullable)
- `dataset_title` (string, nullable): the research output's title, for display.
- `title`, `details` (string)
- `lifecycle_stage` (enum): `collect`, `process`, `analyse`, `preserve` or
  `share`.
- `status` (enum): `todo`, `in_progress`, `done` or `cancelled`.
- `priority` (enum): `low`, `medium` or `high`.
- `progress_percent` (integer): derived from the checklist.
- `start_date`, `end_date` (date, nullable)
- `evidence` (object): `type` (`none`, `file`, `url`, `rdm_deposit`), `ref`,
  `label`, `attached_at`.
- `completed_at` (date-time, nullable), `completed_by` (string, nullable)

### The File object

- `file_id`, `project_id`, `uploaded_by`, `filename` (string)
- `file_type` (enum): `docx`, `pdf` or `other`.
- `purpose` (enum): `proposal`, `task_deliverable` or `evidence`.
- `metadata` (object): `byte_size`, `mime_type`.
- `uploaded_at` (date-time), `superseded_at` (date-time, nullable): set when a
  newer proposal replaced it.

### The Notification object

- `notification_id`, `user_id` (string)
- `type` (enum): `dmp_submitted`, `dmp_approved`, `dmp_finalized`,
  `tasks_generated`, `tasks_cancelled`, `proposal_superseded`,
  `review_requested`, `dmp_returned`.
- `title` (string), `message` (string, nullable)
- `link` (string, nullable): the frontend route to open, e.g. `/review/dmp-soil`.
- `dmp_id`, `project_id` (string, nullable)
- `read_at` (date-time, nullable), `created_at` (date-time)
