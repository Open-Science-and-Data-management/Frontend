# Reviews

A **Review** is one plan version sent to the committee: the newest version of
an institutional plan, with who wrote it, where it belongs, and where its
decision stands. The Review queue, the dashboard and the
"Recently decided by you" list all read reviews.

## Endpoints

| | |
| --- | --- |
| [List reviews](#list-reviews) | `GET /v1/reviews` |

## The Review object

<!-- ADDED: JSON example, copied from `data[0]` of the List reviews response. -->

```json
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
```

### Attributes

- `object` (string, value is `"review"`) <!-- ADDED -->
  The object's type. <!-- ADDED -->
- `id` (string, required)
  `dmp_id` and version number, e.g. `dmp-soil:1`.
- `dmp_id` (string, required)
  The plan.
- `title` (string, required)
  The plan's title. <!-- ADDED: split from the combined `dmp_id, title` bullet -->
- `version` (integer, required)
  The version this review is about, the plan's newest.
- `status` (enum, required)
  Possible enum values:
  - `pending`: waiting on a decision.
  - `approved`: approved by the committee.
  - `rejected`: sent back to the researcher.
- `is_revision` (boolean, required)
  `true` when an earlier version is in force.
- `active_version` (integer, nullable)
  The version in force, if any.
- `submitted_at` (date-time, required)
  When the version was submitted.
- `days_waiting` (integer, required)
  Whole days since submission. The frontend tags 3+ days amber and
  **7+ days red**.
- `changes_summary` (object, required)
  Change counts, for revisions.
  - `major` (integer, required) <!-- ADDED -->
    Number of major changes. <!-- ADDED -->
  - `minor` (integer, required) <!-- ADDED -->
    Number of minor changes. <!-- ADDED -->
- `timeline` (string, required)
  Where today falls in the plan, e.g. "Week 4 of 14".
- `researcher` (object, required)
  Who wrote the plan. <!-- ADDED -->
  - `user_id` (string, required)
    The researcher's user id. <!-- ADDED -->
  - `name` (string, required)
    Display name.
- `project` (object, required)
  The project the plan belongs to. <!-- ADDED -->
  - `project_id` (string, required)
    The project's id. <!-- ADDED -->
  - `project_name` (string, required)
    The project's name. <!-- ADDED -->
- `decided_at` (date-time, nullable)
  As on the [Version](./dmps.md#the-version-object), once decided.
- `decided_by` (string, nullable)
  As on the [Version](./dmps.md#the-version-object), once decided. <!-- ADDED: split from the combined decided_at/decided_by/approver/note bullet -->
- `approver` (object, nullable)
  As on the [Version](./dmps.md#the-version-object), once decided. <!-- ADDED: split -->
- `note` (string, nullable)
  As on the [Version](./dmps.md#the-version-object), once decided. <!-- ADDED: split -->

### List reviews

`GET /v1/reviews`

Lists reviews, oldest submission first by default, so the head of the pending
list is always the plan that has waited longest.

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

- `status` (array of enums, optional)
  Only reviews whose version has this status. Send one value or several,
  comma-separated. Defaults to all three.
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
