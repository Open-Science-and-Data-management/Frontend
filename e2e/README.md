# End-to-end tests

These drive the real app against a real backend. Nothing is mocked, and they
make no AI calls, so they cost no tokens.

## Running

1. Start the backend, then `npm run dev` (Vite proxies `/api` to `BACKEND_URL`).
2. Give the tests two accounts on that backend, a researcher and a committee
   member who reviews the researcher's institution:

   ```sh
   export E2E_RESEARCHER_USERNAME=...
   export E2E_RESEARCHER_PASSWORD=...
   export E2E_COMMITTEE_USERNAME=...
   export E2E_COMMITTEE_PASSWORD=...
   # Optional: where the app runs (default http://localhost:5173)
   export E2E_BASE_URL=http://localhost:5173
   ```

3. `npm run test:e2e`. The first time, install the browser with
   `npx playwright install chromium`.

Without the accounts the tests are skipped, not failed, so CI stays green when
no backend is available.

## What they do to the backend

Each run creates a project and two plans with unique names, submits both, and
has the committee approve one and send the other back. Use a development
database.

## Known backend limits the tests work around

- The backend revokes a session on its second token refresh, so the tests
  move around with client-side navigation and keep full page reloads to the
  one test that checks session restore.
- A plan sent back on its first submission can't be submitted again. The
  "sent back" test checks that the app says so; update it when the backend
  allows resubmitting.
