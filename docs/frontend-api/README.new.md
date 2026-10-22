# Frontend API docs

The API each side of the DMP Researcher frontend needs: every page, how many
inputs it asks for, and the endpoints behind it. The format follows the
[Stripe API reference](https://docs.stripe.com/api/v2/core/accounts): one page
per resource, with an endpoint list, the object it returns, then each endpoint
with its request, response, parameters, return value and error codes. <!-- ADDED -->

> **Status: proposed contract.** There is no backend yet. The frontend does all
> of this today with browser-held Zustand stores. Each endpoint names the store
> call it replaces (**Frontend today**), so it can be swapped for a request
> without changing what the page does.

Field names follow the frontend schemas and [the ERD](../project-erd.md)
(`snake_case`), so a response can be stored without renaming.

---

## Contents

1. [Page maps](#page-maps) <!-- ADDED -->
2. [Resources](#resources) <!-- ADDED -->
3. [Conventions](#conventions)

---

## Page maps

What each role fills in on each page, and which endpoints the page calls. <!-- ADDED -->

| Role | Page map | Status |
| --- | --- | --- |
| Committee | [pages/committee.md](./pages/committee.md) | Done |
| Researcher | [pages/researcher.md](./pages/researcher.md) | To do |

## Resources

<!-- ADDED: index table; the descriptions are the opening lines of each resource page. -->

| Resource | Page | Objects | Endpoints |
| --- | --- | --- | --- |
| Authentication and profile | [auth.md](./auth.md) | User | Sign in, Sign out, Retrieve the current user, Update the current user |
| Reviews | [reviews.md](./reviews.md) | Review | List reviews |
| Plans (DMPs) | [dmps.md](./dmps.md) | Plan, Version | Retrieve a plan, List plans, Approve a version, Reject a version |
| Projects | [projects.md](./projects.md) | Project, Progress | List projects, Retrieve a project, List project members |
| Tasks | [tasks.md](./tasks.md) | Task | List tasks |
| Files | [files.md](./files.md) | File | List files, Download a file |
| Notifications | [notifications.md](./notifications.md) | Notification | List notifications, Mark a notification read, Mark all notifications read, Delete a notification, Delete all notifications |

---

## Conventions

### Base URL

`https://api.example.ac.th/v1` (placeholder).

### Authentication

[Sign in](./auth.md#sign-in) returns a session token. Send it on every other
request:

```http
Authorization: Bearer <session_token>
```

### Who may call

Every committee endpoint requires a user whose `role` is `committee` or
`chief`; anyone else gets `403 not_a_reviewer`. The committee sees every
**institutional** project and plan, not only projects it is a member of.
Independent plans are finalized by their researcher and never reach the
committee.

Each endpoint lists its roles under **Who can call**. Researcher access is <!-- ADDED -->
left out until [pages/researcher.md](./pages/researcher.md) is written. <!-- ADDED -->

### Requests and responses

Requests and responses are JSON. Timestamps are `date-time` strings and <!-- ADDED -->
calendar dates without a time (plan begin/end, task due dates) are `date` <!-- ADDED -->
strings, as defined below. <!-- ADDED -->

### Types

The type names used in every **Attributes** and **Parameters** list: <!-- ADDED -->

<!-- ADDED: whole table. `array of objects`, `array of strings` and `number` are not in the requested list but are needed by the Plan, Version and Task objects. TODO: confirm -->

| Type | Meaning |
| --- | --- |
| `string` | A JSON string. |
| `integer` | A JSON number with no fractional part. |
| `number` | A JSON number that may have a fractional part (cost `value`). |
| `boolean` | `true` or `false`. |
| `enum` | A string from a fixed list, given under "Possible enum values". |
| `array of enums` | A list of enum values. In a query string, send them comma-separated. |
| `array of strings` | A list of strings. |
| `array of objects` | A list of objects, with their attributes listed underneath. |
| `object` | A JSON object, with its attributes listed underneath. |
| `date-time` | A timestamp in [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) format, e.g. `2026-10-22T08:41:00Z`. |
| `date` | A calendar date with no time, `YYYY-MM-DD`, e.g. `2026-11-01`. |

An attribute marked `nullable` can be `null`; one marked `required` is always <!-- ADDED -->
present and never `null`. <!-- ADDED -->

### Lists and pagination

Lists share one shape and are paged with `limit` (1–100, default 20) and
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

This is the Stripe **v1** list shape (`object: "list"`, `data`, `has_more`, <!-- ADDED -->
`total_count`, paged with `starting_after`), not Stripe v2's `next_page_url`. <!-- ADDED -->
The dashboard's stat cards read `total_count` directly (see <!-- ADDED -->
[List reviews](./reviews.md#list-reviews)), and v2 lists don't return a total. <!-- ADDED -->

### Errors

Errors return a non-2xx status and one shape:

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

Each endpoint's **Error codes** table lists only the codes specific to it. <!-- ADDED -->
