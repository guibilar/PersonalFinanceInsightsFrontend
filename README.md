# Personal Finances Frontend

Angular 22 frontend for the Personal Finance Insights API: a spending and income dashboard,
transaction list with budget linking, budget management, category and flow rules, and the bank
accounts statements are imported into.

## Accounts and flows

Statements are imported into an **account** (`/accounts`): a name and a type (chequing, savings or
credit card) that can't change. Only an account that never had transactions can be deleted. When a
file doesn't look like it belongs to the chosen account (a credit card export into a chequing account,
or rows already stored on another account), the import asks before going ahead ("Import anyway").

Every transaction also has a **flow**, what it counts as in the reports: spending, refund, income,
transfer (between your own accounts, like a card payment) or ignored. Without a matching flow rule,
money out is spending, money in is income on chequing and a refund on a credit card, and everything on
a savings account is a transfer. Flow rules (the Rules page's "Money in and transfers" tab) override
that by keyword; the longest matching keyword wins. A flow or category picked by hand on a transaction
is kept when the rules are re-applied ("Apply rules").

## Getting started

Requires Node 24 (or 22.22.3+) and the backend (`FinanceApi`) running on `http://localhost:5096`.

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
| `npm test`             | Unit tests (Vitest in Chromium, watch mode)     |
| `npm run test:ci`      | Unit tests once, headless Chromium              |
| `npm run lint`         | ESLint (angular-eslint) for TypeScript and HTML |
| `npm run format`       | Format with Prettier                            |
| `npm run format:check` | Check formatting (used in CI)                   |

CI (`.github/workflows/ci.yml`) runs lint, format check, tests and build on every PR.

The tests run in a real browser (Vitest browser mode through Playwright), because some of them need
layout and focus behaviour that a simulated DOM doesn't have. Before the first run, download the
browser once: `npx playwright install chromium-headless-shell` (add `chromium` for the visible browser
that `npm test` opens).

## Project structure

```
src/app/
  core/       api/ (repositories, API base URL), models/, layout/navigation
  shared/     ui/ (card, filter panel, form card, loader, error state, paginator), utils/
  features/   dashboard/, transactions/, budgets/, rules/, bank-accounts/   (lazy-loaded routes)
              account/ is the signed-in user's own account (change password), not a bank account
```

Components are standalone, OnPush and signal-based; the app runs zoneless.
Styling is Bootstrap 5 only: `src/styles.scss` imports just the Bootstrap modules in
use, so add a module there before using its classes.

## Docker, with HTTPS through Tailscale

The app is served at **`https://<TS_HOSTNAME>.<your-tailnet>.ts.net`** to the devices on your tailnet,
with a certificate Tailscale issues and renews. Nothing is opened on the router or published on the LAN:
a `tailscale` container joins your tailnet as its own machine and forwards HTTPS to nginx
(`tailscale/serve.json`), and nginx reaches the API over the private `finance` Docker network.

One-time setup:

1. In the [Tailscale admin console](https://login.tailscale.com/admin/dns), turn on **MagicDNS** and
   **HTTPS Certificates**.
2. Under **Settings → Keys**, generate an **auth key** (a one-off key is enough).
3. Start the backend project first (it creates the `finance` network): `docker compose up -d --build`
   in PersonalFinanceInsightsBackend.
4. Here: `cp .env.example .env`, put the key in `TS_AUTHKEY` (and pick `TS_HOSTNAME`, default `finance`),
   then `docker compose up -d --build`.
5. On the admin console's **Machines** page, open the new machine's menu and choose **Disable key
   expiry**; otherwise it must be logged in again after 180 days.

Then open `https://finance.<your-tailnet>.ts.net` from any device with Tailscale signed in to your tailnet
(the first visit can take a few seconds while the certificate is issued). On the server itself nginx is
also on `http://localhost:5095`. Troubleshooting: `docker compose logs tailscale` and
`docker compose exec tailscale tailscale serve status`. Container logs are capped at 3 files of 10 MB
per service.

`docker/smoke-test.sh [base-url]` checks a running container: security headers, HSTS only over HTTPS,
SPA routing, and that uploads over 1 MB get past nginx. CI builds the image and runs it on every change.

The image is `nginxinc/nginx-unprivileged:stable-alpine`: nginx runs as uid 101, not root, on the
stable branch. The tag moves with each stable release, so rebuild now and then with
`docker compose build --pull && docker compose up -d` to pick up nginx and Alpine fixes.

nginx serves the app and proxies `/api/` to `API_UPSTREAM` (default `http://personal-finance-api:8080`,
the API container on the `finance` network). It passes on Tailscale's `X-Forwarded-Proto: https`, so the
API marks the session cookie `Secure`, and sends HSTS on HTTPS requests.

nginx also:

- accepts uploads up to 6 MB on `/api/` (a 5 MB statement plus the form envelope; nginx's default is 1 MB);
- sends security headers on every response (`docker/security-headers.conf`): a Content-Security-Policy that
  only allows this origin's scripts, no framing, `nosniff`, a same-origin referrer policy;
- hides its version, and caches hashed bundles for a year while `index.html`, `theme.js` and the favicon
  are revalidated.

Because of the policy there is no inline script: the early theme switch lives in `public/theme.js`, and
critical-CSS inlining is off in `angular.json` (its `onload` handler would be blocked).
