# Notifications

The signed-in user's notifications. Committee members mostly receive
`review_requested`, sent to every reviewer when a plan or revision is
submitted. Each user only ever sees their own.

## Endpoints

| | |
| --- | --- |
| [List notifications](#list-notifications) | `GET /v1/notifications` |
| [Mark a notification read](#mark-a-notification-read) | `POST /v1/notifications/:notification_id/read` |
| [Mark all notifications read](#mark-all-notifications-read) | `POST /v1/notifications/read_all` |
| [Delete a notification](#delete-a-notification) | `DELETE /v1/notifications/:notification_id` |
| [Delete all notifications](#delete-all-notifications) | `DELETE /v1/notifications` |

## The Notification object

<!-- ADDED: JSON example, copied from `data[0]` of the List notifications response. -->

```json
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
```

### Attributes

- `object` (string, value is `"notification"`) <!-- ADDED -->
  The object's type. <!-- ADDED -->
- `notification_id` (string, required)
  Unique id. <!-- ADDED -->
- `user_id` (string, required)
  The recipient. <!-- ADDED: split from the combined notification_id/user_id bullet -->
- `type` (enum, required)
  Possible enum values:
  - `dmp_submitted`
  - `dmp_approved`: to the researcher when a version is approved. <!-- ADDED: from Approve a version -->
  - `dmp_finalized`
  - `tasks_generated`
  - `tasks_cancelled`: to the researcher when an approval cancels tasks of a removed output. <!-- ADDED: from Approve a version -->
  - `proposal_superseded`
  - `review_requested`: to every reviewer when a plan or revision is submitted. <!-- ADDED: from the ERD -->
  - `dmp_returned`: to the researcher when a version is sent back. <!-- ADDED: from the ERD -->
- `title` (string, required)
  The notification's heading. <!-- ADDED -->
- `message` (string, nullable)
  The body text. <!-- ADDED: split from the combined title/message bullet -->
- `link` (string, nullable)
  The frontend route to open, e.g. `/review/dmp-soil`.
- `dmp_id` (string, nullable)
  The plan it refers to. <!-- ADDED -->
- `project_id` (string, nullable)
  The project it refers to. <!-- ADDED: split from the combined dmp_id/project_id bullet -->
- `read_at` (date-time, nullable)
  When it was read; `null` while unread. <!-- ADDED -->
- `created_at` (date-time, required)
  When it was sent. <!-- ADDED: split from the combined read_at/created_at bullet -->

### List notifications

`GET /v1/notifications`

Lists the signed-in user's notifications, newest first, for the
**Notifications** page and the sidebar's unread badge.

**Who can call:** `committee`, `chief` <!-- ADDED -->

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
- `limit` (integer, optional)
  As in [README](./README.md#lists-and-pagination).
- `starting_after` (string, optional)
  As in [README](./README.md#lists-and-pagination). <!-- ADDED: split from the combined limit/starting_after bullet -->

**Returns** a list of [Notifications](#the-notification-object), plus
`unread_count` for the sidebar badge.

**Error codes**

Only the common errors listed in [README](./README.md#errors). <!-- ADDED -->

### Mark a notification read

`POST /v1/notifications/:notification_id/read`

Marks one notification read. The page calls it when a notification is opened,
then follows its `link`.

**Who can call:** `committee`, `chief` <!-- ADDED -->

**Frontend today:** `useNotificationStore.markRead(id)`

**Request**

```bash
curl -X POST https://api.example.ac.th/v1/notifications/ntf-review-soil/read \
  -H "Authorization: Bearer <session_token>"
```

**Response**

<!-- ADDED: JSON response, the Notification object example with read_at set. The read_at value is illustrative. TODO: confirm -->

```json
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
  "read_at": "2026-10-22T08:30:00Z",
  "created_at": "2026-10-20T03:12:00Z"
}
```

Already-read notifications are returned unchanged.

**Parameters** none. <!-- ADDED -->

**Returns** the [Notification](#the-notification-object) with `read_at` set.

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `notification_not_found` | No notification with that id for this user. |

### Mark all notifications read

`POST /v1/notifications/read_all`

Marks every unread notification of the signed-in user read (**Mark all read**).

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

**Parameters** none. <!-- ADDED -->

**Returns** how many notifications were marked read.

**Error codes**

Only the common errors listed in [README](./README.md#errors). <!-- ADDED -->

### Delete a notification

`DELETE /v1/notifications/:notification_id`

Dismisses one notification (the **×** on a row).

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

**Parameters** none. <!-- ADDED -->

**Returns** a deletion confirmation. <!-- ADDED -->

**Error codes**

<!-- ADDED: table. Not in the requested list; the code is the one Mark a notification read uses for the same path. TODO: confirm -->

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `notification_not_found` | No notification with that id for this user. |

### Delete all notifications

`DELETE /v1/notifications`

Removes all of the signed-in user's notifications (**Clear all**, after a
confirmation). Other users' notifications are untouched.

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

**Parameters** none. <!-- ADDED -->

**Returns** how many notifications were deleted. <!-- ADDED -->

**Error codes**

Only the common errors listed in [README](./README.md#errors). <!-- ADDED -->
