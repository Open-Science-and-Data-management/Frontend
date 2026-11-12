# DMP Researcher

DMP Researcher is the web frontend for creating and managing data management
plans (DMPs). Researchers turn a proposal into a FAIR-oriented maDMP draft,
submit it to their committee, and then work through the follow-up tasks.
Everything is stored by the backend,
[uni-backend](https://github.com/Open-Science-and-Data-management/Backend);
the browser holds only a session cache.

## Features

- Create projects and associate project members, proposal files, and DMPs.
- Upload `.docx` proposals (up to 20 MB) and walk through a draft plan.
- Author DMP details, contributors, costs, datasets, distributions, ethics,
  preservation, and research-domain metadata.
- Check DMP readiness, submit the plan, and have the committee approve or
  return it.
- Track plan revisions, pending/approved/rejected states, and minor versus major
  changes.
- Generate and manage research tasks with lifecycle stages, priorities,
  checklists, progress, and evidence such as files, URLs, or repository DOIs.
- View notifications and switch between light, dark, and system themes.
- Validate/map DMP form data to the project's maDMP-shaped JSON schema (the
  mapper is currently code-level, not exposed as an export action in the UI).

## Tech stack

- React 18 and TypeScript
- Vite 6
- React Router (browser history routing)
- Zustand for the session cache of server data
- Zod and React Hook Form for validation and forms
- Tailwind CSS 4 and Radix UI primitives
- Vitest and jsdom for tests

## Getting started

### Requirements

- Node.js 18 or newer
- npm

### Install and run

```bash
git clone https://github.com/Open-Science-and-Data-management/Frontend.git
cd Frontend
npm ci
npm run dev
```

The app needs the backend running. Start it first (see its README: Postgres,
a `.env` with `DATABASE_URL` and `JWT_SECRET`, `pnpm db:migrate`, then
`pnpm dev`; AI features also need `OPENROUTER_KEY`). It listens on port 3000.

Vite prints the local development URL (normally `http://localhost:5173`) and
proxies `/api` to the backend, so the browser sees one origin and the backend
needs no CORS. The proxy also rewrites the refresh cookie's path from `/auth`
to `/api/auth` so the browser sends it back.

### Configuration

Copy `.env.example` to `.env` if the defaults don't fit:

| Variable | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `VITE_API_URL` | browser | `/api` | Base URL for API requests |
| `BACKEND_URL` | dev server | `http://localhost:3000` | Where the `/api` proxy forwards |

A production host must serve `index.html` for every path (an SPA fallback)
and serve the API on the same origin as the app, because the refresh token is
a `SameSite=Strict` httpOnly cookie.

### Accounts and sessions

Sign-in returns a short-lived access token, kept in memory only, and sets the
refresh token as an httpOnly cookie. After a reload the app gets a new access
token from that cookie; a request that hits an expired token refreshes once
and retries. The backend has no seed accounts: register a researcher first.
Committee, chief and admin accounts are created by the institution and can't
sign up.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Home and start of the proposal workflow |
| `/upload` | Upload a proposal and associate it with a project |
| `/dmp/create` | Create or edit a DMP draft |
| `/dmp/review` | Review and submit the draft |
| `/dmp/status` | Plan status, versions and task generation |
| `/dmps` | Browse saved DMPs |
| `/tasks` | View and manage DMP tasks |
| `/projects` | Browse projects |
| `/projects/:projectId` | View a project and its files |
| `/notifications` | View and manage notifications |
| `/settings` | Profile and theme |
| `/review`, `/review/:dmpId` | Committee queue and decision page |
| `/help` | In-app workflow guide |

Editing a saved DMP at `/dmp/:id/edit` is currently a coming-soon screen.

## Project structure

```text
src/
├── api/          HTTP client, one module per backend resource, AI streaming
├── components/   Shared UI and feature components
├── config/       Roles, plan rules, and field policies
├── hooks/        Shared React hooks
├── layouts/      Application shell
├── pages/        Route-level screens
├── routes/       Route definitions and router configuration
├── schemas/      Zod schemas for DMP, project, task, file, and related data
├── store/        Zustand stores holding what the server returned
├── styles/       Global styles
└── types/        Types inferred from schemas
```

The [project ERD](./docs/project-erd.md) describes how the frontend schemas and
stores relate. It is a logical model of the current client code, not a schema
for a deployed database.

## What the backend doesn't support yet

These show as unavailable in the UI rather than being simulated:

- Email notifications and notification preferences.
- Editing a saved DMP at `/dmp/:id/edit` (a coming-soon screen).
- A sample DMP walkthrough.
- The content of past plan versions: the server shares only the version
  under review or in force, so older versions show their change lists only.

## Development commands

```bash
npm run dev       # Start the Vite dev server (needs the backend)
npm run build     # Run TypeScript checking and create a production build
npm run preview   # Preview the built app locally
npm test          # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## License

This project is licensed under the MIT License; see [LICENSE](./LICENSE).
