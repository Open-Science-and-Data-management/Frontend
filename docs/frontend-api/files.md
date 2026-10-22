# Files

Files uploaded to a project: proposals, task deliverables, evidence. Committee
members can list and download them; they can't upload or remove them.

## Endpoints

| | |
| --- | --- |
| [List files](#list-files) | `GET /v1/files` |
| [Download a file](#download-a-file) | `GET /v1/files/:file_id/content` |

## The File object

<!-- ADDED: JSON example, copied from `data[0]` of the List files response. -->

```json
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
```

### Attributes

- `object` (string, value is `"file"`) <!-- ADDED -->
  The object's type. <!-- ADDED -->
- `file_id` (string, required)
  Unique id. <!-- ADDED -->
- `project_id` (string, required)
  The project the file belongs to. <!-- ADDED -->
- `uploaded_by` (string, required)
  The uploader's `user_id`. <!-- ADDED -->
- `filename` (string, required)
  The original filename. <!-- ADDED: split from the combined file_id/project_id/uploaded_by/filename bullet -->
- `file_type` (enum, required)
  Possible enum values:
  - `docx`
  - `pdf`
  - `other`
- `purpose` (enum, required)
  Possible enum values:
  - `proposal`
  - `task_deliverable`
  - `evidence`
- `metadata` (object, required)
  About the file's content. <!-- ADDED -->
  - `byte_size` (integer, required)
    Size in bytes. <!-- ADDED -->
  - `mime_type` (string, nullable)
    The content's MIME type. <!-- ADDED --> <!-- TODO: confirm nullable; the seeded file-2 has no mime_type -->
- `uploaded_at` (date-time, required)
  When the file was uploaded. <!-- ADDED -->
- `superseded_at` (date-time, nullable)
  Set when a newer proposal replaced it.

### List files

`GET /v1/files`

Lists a project's files for the **Files** section, current files first and
superseded proposals after.

**Who can call:** `committee`, `chief` <!-- ADDED -->

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
  Possible enum values: <!-- ADDED: reformatted from the inline list -->
  - `proposal`
  - `task_deliverable`
  - `evidence`

**Returns** a list of [Files](#the-file-object).

**Error codes**

<!-- ADDED: table -->

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `project_id_required` | `project_id` wasn't sent. <!-- TODO: confirm; not in the requested list, but `project_id` is required here as in List plans --> |
| 400 | `invalid_purpose` | `purpose` holds a value other than the three above. |

### Download a file

`GET /v1/files/:file_id/content`

Returns the file's bytes, with `Content-Disposition: attachment` and its
original filename.

**Who can call:** `committee`, `chief` <!-- ADDED -->

**Frontend today:** `fileApi.getDownloadUrl(file_id)`. It only works for files
uploaded in the current browser session; this endpoint removes that limit.

**Request**

```bash
curl -L -O -J https://api.example.ac.th/v1/files/file-1/content \
  -H "Authorization: Bearer <session_token>"
```

**Response** the file, as `application/octet-stream` or its `mime_type`.

**Parameters** none.

**Returns** the file's content. <!-- ADDED -->

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 404 | `file_not_found` | No file with that id. |
| 410 | `file_content_gone` | The record exists but its content is no longer stored. |
