# DMP Researcher

DMP Researcher is a frontend prototype for helping researchers create and
manage data management plans (DMPs). It supports a proposal-to-plan workflow,
structured research-output metadata, review-oriented version history, and
follow-up tasks. Plan authoring follows a FAIR-oriented maDMP data model.

> **Prototype notice:** The app currently uses seeded demo records and
> browser-local state. Proposal analysis and AI assistance are deterministic
> mock implementations, file uploads are held in memory for the current page
> session, and committee decisions are simulated in the UI. There is no
> authentication service, backend API, database, durable file storage, or
> external AI integration wired up.

## Features

- Create projects and associate project members, proposal files, and DMPs.
- Upload `.docx` proposals (up to 20 MB) and walk through a draft plan.
- Author DMP details, contributors, costs, datasets, distributions, ethics,
  preservation, and research-domain metadata.
- Review DMP readiness and submit the plan for a simulated review workflow.
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
- React Router (hash-based routing)
- Zustand for client state and browser persistence
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

Vite prints the local development URL in the terminal (normally
`http://localhost:5173`). The router uses hash-based URLs, so routes appear
after `/#/`.

No environment variables are required by the current frontend.

## Application routes

| Route | Purpose |
| --- | --- |
| `/#/` | Home and start of the proposal workflow |
| `/#/upload` | Upload a proposal and associate it with a project |
| `/#/dmp/create` | Create or edit a DMP draft |
| `/#/dmp/review` | Review and submit the draft |
| `/#/dmp/status` | View status and simulate a review decision |
| `/#/dmps` | Browse saved DMPs |
| `/#/tasks` | View and manage DMP tasks |
| `/#/projects` | Browse projects |
| `/#/projects/:projectId` | View a project and its files |
| `/#/notifications` | View and manage notifications |
| `/#/settings` | Theme and demo-data settings |
| `/#/help` | In-app workflow guide |

Editing a saved DMP at `/#/dmp/:id/edit` is currently a coming-soon screen.

## Project structure

```text
src/
├── api/          Demo AI and file API adapters
├── components/   Shared UI and feature components
├── config/       Current-user demo config, plan rules, and field policies
├── hooks/        Shared React hooks
├── layouts/      Application shell
├── pages/        Route-level screens
├── routes/       Hash-router routes and configuration
├── schemas/      Zod schemas for DMP, project, task, file, and related data
├── store/        Persisted Zustand stores and demo seed data
├── styles/       Global styles
└── types/        Types inferred from schemas
```

The [project ERD](./docs/project-erd.md) describes how the frontend schemas and
stores relate. It is a logical model of the current client code, not a schema
for a deployed database.

## Local data and demo behavior

Zustand stores persist records in the browser's `localStorage`. Reset the
sample state from **Settings → Local data → Reset data**. Clearing site data
for the browser also removes locally saved records.

The current adapters intentionally do not connect to production services:

- `src/api/aiApi.ts` returns canned proposal-analysis content and uses
  deterministic rules for regeneration, chat, and task suggestions.
- `src/api/fileApi.ts` stores uploaded file blobs in memory. Blobs are not
  durable and do not survive a page reload.
- `src/config/current-user.ts` supplies a fixed demo user ID; there is no login
  or authorization boundary.
- The status screen provides demo-only committee decisions. Decisions are not
  persisted as separate approval records or attributed to authenticated
  reviewers.

Do not use this prototype to store confidential research data or treat its
demo AI output, review decisions, quota counters, or local persistence as
production-grade.

## Development commands

```bash
npm run dev       # Start the Vite development server
npm run build     # Run TypeScript checking and create a production build
npm run preview   # Preview the built app locally
npm test          # Run the Vitest suite once
npm run test:watch # Run Vitest in watch mode
```

## License

This project is licensed under the MIT License; see [LICENSE](./LICENSE).
