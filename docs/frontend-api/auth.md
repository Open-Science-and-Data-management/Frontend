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

<!-- ADDED: JSON example, built from the `user` in the Sign in response plus `ai_token_limit` / `ai_token_used` (values from the seeded user-2 in src/store/projectStore.ts). -->

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
  "ai_token_used": 0
}
```

### Attributes

- `object` (string, value is `"user"`) <!-- ADDED -->
  The object's type. <!-- ADDED -->
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
- `username` (string, required)
  Sign-in name.
- `ai_token_limit` (integer, required)
  AI budget; researchers only use it.
- `ai_token_used` (integer, required)
  AI budget used so far; researchers only use it. <!-- ADDED: split from the combined ai_token_limit/ai_token_used bullet -->

### Sign in

`POST /v1/auth/sessions`

Starts a session for a username and password. Committee accounts are granted
by the institution; there is no committee sign-up.

**Who can call:** `committee`, `chief`. Called without a session token. <!-- ADDED --> <!-- TODO: confirm -->

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

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

Only the common errors listed in [README](./README.md#errors). <!-- ADDED -->

### Retrieve the current user

`GET /v1/users/me`

Returns the signed-in user. The navbar, user menu, dashboard greeting and
Settings form read it.

**Who can call:** `committee`, `chief` <!-- ADDED -->

**Frontend today:** `useCurrentUser()`

**Request**

```bash
curl https://api.example.ac.th/v1/users/me \
  -H "Authorization: Bearer <session_token>"
```

**Response**

<!-- ADDED: JSON response, the same as the User object example. -->

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
  "ai_token_used": 0
}
```

**Parameters** none.

**Returns** the signed-in [User](#the-user-object).

**Error codes**

Only the common errors listed in [README](./README.md#errors). <!-- ADDED -->

### Update the current user

`PATCH /v1/users/me`

Updates the signed-in user's profile from the **Settings** page. Role, username
and AI quota can't be changed here.

**Who can call:** `committee`, `chief` <!-- ADDED -->

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

<!-- ADDED: JSON response, the User object example with the email from the request applied. -->

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
  "ai_token_used": 0
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

**Returns** the updated [User](#the-user-object).

**Error codes**

| HTTP status code | Code | Description |
| --- | --- | --- |
| 400 | `name_required` | `name` or `surname` was sent empty. |
| 400 | `email_invalid` | `email` isn't a valid address. |
| 409 | `email_taken` | Another account already uses this email. |
