# Authentication and profile

Signing in and out, and the signed-in person's own profile.

## Endpoints

| | |
| --- | --- |
| [Sign in](#sign-in) | `POST /v1/auth/sessions` |
| [Sign out](#sign-out) | `DELETE /v1/auth/sessions/current` |
| [Retrieve the current user](#retrieve-the-current-user) | `GET /v1/users/me` |
| [Update the current user](#update-the-current-user) | `PATCH /v1/users/me` |

## The User object

```json
{
  "object": "user",
  "user_id": "user-2",
  "title": "Prof.",
  "name": "Mali",
  "surname": "Chaiyasit",
  "email": "mali@example.edu",
  "role": "committee",
  "username": "mali",
  "ai_token_limit": 4500,
  "ai_token_used": 0,
  "account_type": null,
  "phone": null,
  "orcid": null,
  "affiliation": null,
  "address": null
}
```

### Attributes

- `object` (string, value is `"user"`)
  The object's type.
- `user_id` (string, required)
  Unique id.
- `title` (string, nullable)
  Honorific, e.g. "Prof."
- `name` (string, required)
  First name.
- `surname` (string, required)
  Last name.
- `email` (string, required)
  Unique per account, ignoring case and spaces.
- `role` (enum, required)
  Committee endpoints need `committee` or `chief`.
  Possible enum values:
  - `admin`
  - `chief`
  - `committee`
  - `researcher`
- `username` (string, nullable)
  Sign-in name, set at sign-up.
- `ai_token_limit` (integer, required)
  AI budget; researchers only use it.
- `ai_token_used` (integer, required)
  AI budget used so far; researchers only use it.
- `account_type` (enum, nullable)
  Researchers only; `null` for committee and chief accounts.
  Possible enum values:
  - `institutional`: belongs to an organisation (มีสังกัด).
  - `citizen`: no affiliation (ไม่มีสังกัด).
- `phone` (string, nullable)
  Phone number.
- `orcid` (string, nullable)
  ORCID iD, the same format as a contributor's `orcid`.
- `affiliation` (object, nullable)
  Institutional researchers only.
  - `organization` (string, required)
    The organisation.
  - `department` (string, nullable)
    The department.
  - `position` (string, nullable)
    Their position.
- `address` (string, nullable)
  Citizen researchers only.

### Sign in

`POST /v1/auth/sessions`

Starts a session for a username and password. Committee accounts are granted
by the institution; there is no committee sign-up.

**Who can call:** anyone with an account; no session token needed.

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

**Who can call:** `committee`, `chief`

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

**Error codes**

Only the common errors listed in [README](./README.md#errors).

### Retrieve the current user

`GET /v1/users/me`

Returns the signed-in user. The navbar, user menu, dashboard greeting and
Settings form read it.

**Who can call:** `committee`, `chief`

**Frontend today:** `useCurrentUser()`

**Request**

```bash
curl https://api.example.ac.th/v1/users/me \
  -H "Authorization: Bearer <session_token>"
```

**Response**

```json
{
  "object": "user",
  "user_id": "user-2",
  "title": "Prof.",
  "name": "Mali",
  "surname": "Chaiyasit",
  "email": "mali@example.edu",
  "role": "committee",
  "username": "mali",
  "ai_token_limit": 4500,
  "ai_token_used": 0,
  "account_type": null,
  "phone": null,
  "orcid": null,
  "affiliation": null,
  "address": null
}
```

**Parameters** none.

**Returns** the signed-in [User](#the-user-object).

**Error codes**

Only the common errors listed in [README](./README.md#errors).

### Update the current user

`PATCH /v1/users/me`

Updates the signed-in user's profile from the **Settings** page. Role, username
and AI quota can't be changed here.

**Who can call:** `committee`, `chief`

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

**Response**

```json
{
  "object": "user",
  "user_id": "user-2",
  "title": "Prof.",
  "name": "Mali",
  "surname": "Chaiyasit",
  "email": "mali.c@example.edu",
  "role": "committee",
  "username": "mali",
  "ai_token_limit": 4500,
  "ai_token_used": 0,
  "account_type": null,
  "phone": null,
  "orcid": null,
  "affiliation": null,
  "address": null
}
```

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

Every value is trimmed before it's checked (`userProfileSchema`).

**Returns** the updated [User](#the-user-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `name_required` | `name` or `surname` was sent empty. |
| 400 | `email_invalid` | `email` isn't a valid address. |
| 409 | `email_taken` | Another account already uses this email. |
