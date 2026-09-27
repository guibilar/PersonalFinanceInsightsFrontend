# Personal Finances Frontend

Angular 20 frontend for the Personal Finance Insights API: a spending dashboard,
transaction list with budget linking, and budget management.

## Getting started

Requires Node 22 and the backend (`FinanceApi`) running on `http://localhost:5096`.

```bash
npm ci
npm start          # http://localhost:4200
```

The app calls a relative `/api`. During development, `ng serve` forwards it to the
backend using [`proxy.conf.json`](proxy.conf.json); change the target there if your
backend runs elsewhere.

## Signing in

Every page except `/login` needs a signed-in user. The API keeps the session in an HttpOnly cookie,
so the app never handles a token: it asks `GET /api/Auth/me` who is signed in, and any other 401 from
the API sends you back to `/login` (returning to the same page afterwards). This relies on the app and
the API sharing an origin, which the dev proxy and the nginx proxy both provide. Against a local API in
Development, sign in as `dev` / `development-only`.

## Scripts

| Command                | What it does                                    |
| ---------------------- | ----------------------------------------------- |
| `npm start`            | Dev server with the API proxy                   |
| `npm run build`        | Production build into `dist/`                   |
| `npm test`             | Unit tests (Karma, watch mode)                  |
| `npm run test:ci`      | Unit tests once, headless Chrome                |
| `npm run lint`         | ESLint (angular-eslint) for TypeScript and HTML |
| `npm run format`       | Format with Prettier                            |
| `npm run format:check` | Check formatting (used in CI)                   |

CI (`.github/workflows/ci.yml`) runs lint, format check, tests and build on every PR.

## Project structure

```
src/app/
  core/       api/ (repositories, API base URL), models/, layout/navigation
  shared/     ui/ (card, filter panel, form card, loader, error state, paginator), utils/
  features/   dashboard/, transactions/, budgets/   (lazy-loaded routes)
```

Components are standalone, OnPush and signal-based; the app runs zoneless.
Styling is Bootstrap 5 only: `src/styles.scss` imports just the Bootstrap modules in
use, so add a module there before using its classes.

## Docker

```bash
docker compose up --build   # http://localhost:5095
```

nginx serves the app and proxies `/api/` to `API_UPSTREAM` (set in
`docker-compose.yml`; the backend base URL without a path, e.g.
`http://192.168.1.153:5096`). The same image works for any backend address.

nginx also:

- accepts uploads up to 6 MB on `/api/` (a 5 MB statement plus the form envelope; nginx's default is 1 MB);
- sends security headers on every response (`docker/security-headers.conf`): a Content-Security-Policy that
  only allows this origin's scripts, no framing, `nosniff`, a same-origin referrer policy;
- hides its version, and caches hashed bundles for a year while `index.html`, `theme.js` and the favicon
  are revalidated.

Because of the policy there is no inline script: the early theme switch lives in `public/theme.js`, and
critical-CSS inlining is off in `angular.json` (its `onload` handler would be blocked).
