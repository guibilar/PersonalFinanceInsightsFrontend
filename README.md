# Personal Finances Frontend

Angular 22 frontend for the Personal Finance Insights API: where the money goes, what is coming, and what you are
worth, from the bank statements you import. The app is growing into Hestia, a personal "everything app": finance is
its first module, **Money**.

## The shell and the modules

The main menu is the same as on Android: **Today**, **Timeline**, **Capture**, **Modules** and **Search**. On wide
screens it is the sidebar, with the active modules below it. On narrow screens it is a bottom bar, with Capture as the
round centre action; the menu button at the top opens the modules and the account actions.

| Page        | Path        | What it shows                                                                    |
| ----------- | ----------- | -------------------------------------------------------------------------------- |
| Today       | `/today`    | Cards from the Today API: Money tiles, "Needs attention", modules still to come  |
| Timeline    | `/timeline` | A placeholder for now                                                            |
| Capture     | `/capture`  | "Add transaction" and "Import statements"; the other actions are coming soon     |
| Modules     | `/modules`  | Every module: Money opens, the others show "Coming soon"                         |
| Search      | `/search`   | A placeholder for now                                                            |
| Money       | `/money/…`  | The finance pages below, with their own sub-menu                                 |

`/` opens Today. The modules are listed once, in `core/modules/module-registry.ts` (name, icon, route and status);
the Modules page, the sidebar and Today read that list. To add a module, add it there and give it its routes.

**Today** reads `GET /api/today` (Hestia.Api, Today module). The server makes all cards and their rules; the page
only shows them:

- The tiles of each module in a grid (Money first), then one "Needs attention" list for all modules.
- The server sends raw values. A card text has placeholders such as `{difference}`, and `features/today/today-text.ts`
  fills them with the app's formats: amounts as on every page (hidden in privacy mode), days as "Jun 30, 2026".
- A module with the status `Partial` shows a short note above its tiles. A module with the status `Failed` shows an
  error with "Retry". The other modules keep their cards.
- "Refresh" asks the server for a new answer (`?refresh=true`), past its 30-second cache. A statement import or a
  new transaction from this app does the same.
- A module in the registry that the server has no cards for shows a "Coming soon" card.

The models are in `core/models/outputs/today-output-dto.ts`, written by hand from the Hestia OpenAPI document.

The Money sub-menu keeps the groups of the old sidebar:

- **Overview:** the Dashboard (`/money`), Net worth and Review.
- **Spending:** Transactions, Budgets and Subscriptions.
- **Setup:** Accounts, Categories, Tags and Rules.

"Import statements" is at the top of the Money sub-menu, and on the Capture page.

"Add transaction" is on the Transactions page and on the Capture page (the same as "Expense" on Android). From
Capture, the form opens over the current page (`TransactionAddLauncher` opens it, and the shell shows it). After a
save, a notification has a "View" link that opens the new transaction in `/money/transactions`. The next transaction
starts on the same day and account.

**Old addresses.** Before Money was a module, the finance pages were at the top level (`/transactions`, `/budgets`,
`/net-worth` and so on). Each old address opens the same page under `/money`, with its query string and fragment, so
bookmarks and links from the Android app keep working: `/transactions?categoryId=…` opens
`/money/transactions?categoryId=…`. The list is `LEGACY_FINANCE_PATHS` in `features/money/money-paths.ts`.

## The Money pages

**Dashboard.** Four tiles: spent this month (against a usual month at the same point of the month), left over
this month, net worth (and its change since last month) and budgets over their limit. Under them, **Needs attention**
lists what wants a look, most pressing first, each linking to where it is dealt with:

- budgets over their limit;
- no statement imported for more than a week;
- an account whose statements stop before last month;
- a subscription whose price changed;
- transactions left in Other because no rule names their merchant.

Then:

- **Where the month is heading:** spent so far, the recurring payments still due, and usual spending for the days
  left, with each monthly and yearly budget's projected end.
- **By category:** this month's split, or each category against a usual month.
- **Budgets at a glance.**
- **Income and spending** per month, with what was left over, as a chart or a table.
- **Monthly spending** by category.
- **Investments:** what each holds, and this year's contributions and room.
- **Recent transactions.**

A category's name or chart segment opens its transactions.

**Transactions.** Search (descriptions and notes), filters (dates from presets or a custom range, category, tag,
account, what it counts as) and sorting. The page totals whatever the filters pick. Under "Over time" it spreads that
total over weeks, months, quarters or years, with a running total and the top merchants (more load 8 at a time);
clicking a bar lists that period.

Links can open the page filtered, as the dashboard's do:
`/money/transactions?categoryId=…&startDate=…&endDate=…&interval=Week&overTime=1`. Dates that match a preset show as that
preset.

A transaction can be:

- edited: its description, category (optionally adding a rule so similar ones follow), what it counts as, a note
  and tags;
- linked to a budget;
- deleted, which hides it: deleted ones are listed under "Deleted" to restore, and re-importing their statement
  doesn't add them back.

Transactions can also be added by hand. Ticking several opens a bar that sets a category, flow, budget or tag on all
of them at once.

**Budgets.** A budget's period is Total (everything linked), Monthly, Yearly or Custom (two dates). Any period but
Total can also count spending by itself, by categories or by a merchant (part of the description, ignoring case, so
"no frills" takes in every store of the chain). A budget counts one or the other, so the form locks the categories
once a merchant is typed, and the merchant once a category is ticked.

**Subscriptions.** Payments that come again and again (subscriptions, bills, rent), found in the last two years of
spending: what each costs a month and a year, when the next one is due, and price changes. Ones that stopped are
listed apart.

**Net worth.** What the accounts and investments hold, less what the cards owe, over the last twelve months, and each
account's latest balance (entered by hand, or from a Wealthsimple statement).

**Review.** A month or a year against the one before:

- spending and income;
- spending per month;
- each category, and what changed most;
- where the most went;
- the biggest purchase;
- days without spending.

**Rules.** Category rules, checked in order (first match wins; move them up or down), and flow rules. "Sort them" lists the
merchants left in Other because no rule names them; picking a category adds the rule and applies the rules.

**Categories and tags.** Names and colours, used everywhere they show. Tags are your own labels across categories
("Vacation 2026"); a tag on a row filters the list by it.

## Accounts and flows

Statements are imported into an **account** (`/money/accounts`): a name, a type (chequing, savings, credit card or
investment) and its statement format, which the import reads:

- CIBC CSV;
- Neo Financial CSV or PDF;
- Wealthsimple PDF;
- none, for an account kept by hand.

Several files can be imported at once, each into its account. When a file doesn't look like it belongs to the chosen
account (a credit card export into a chequing account, or rows already stored on another account), the import asks
before going ahead ("Import anyway").

Savings and investment accounts can be a registered plan (TFSA, RRSP or FHSA). The year's contribution room you enter
is then counted down by the deposits; transfers straight from another plan use none. Only an account that never had
transactions can be deleted.

Every transaction also has a **flow**, what it counts as in the reports: spending, refund, income,
transfer (between your own accounts, like a card payment) or ignored. Without a matching flow rule,
money out is spending, money in is income on chequing and a refund on a credit card, and everything on
a savings account is a transfer. Flow rules (the Rules page's "Money in and transfers" tab) override
that by keyword; the longest matching keyword wins. A flow or category picked by hand on a transaction
is kept when the rules are re-applied ("Apply rules").

## Charts

The charts share one look (`shared/charts/chart-theme.ts`):

- thin bars, rounded at the end that shows the value;
- a gap of the surface's colour between stacked segments;
- hairline grid lines with compact axis ticks;
- light and dark themes.

The income and spending series take the first slots of a colour-blind-checked categorical palette, with each mode
stepped for its surface; categories keep the colour they were given. The transactions breakdown draws the running total
in a chart of its own below the bars, not on a second axis. `shared/charts/chart-helper.ts` builds the dashboard's
charts.

Categories come from the API (`/api/Categories`): pages load the list and pass it to their forms, and
transactions, rules, budgets and reports carry each category's name and colour, so nothing is looked up.

## Getting started

Requires Node 24 (or 22.22.3+) and the backend (`FinanceApi`) running on `http://localhost:5096`.

```bash
npm ci
npm start          # http://localhost:4200
```

The app calls a relative `/api`. During development, `ng serve` forwards it to the
backend using [`proxy.conf.json`](proxy.conf.json); change the target there if your
backend runs elsewhere.

Today needs Hestia.Api (`GET /api/today`). The finance backend alone does not have it, so Today shows "Could not load
Today." To try Today, run HestiaBackend and set the target in `proxy.conf.json` to `http://localhost:5097`; the host
signs you in and forwards the finance requests.

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

### Test results as annotations

`npm run test:ci` uses the `ci` configuration of the `test` target (`angular.json`). It writes a JUnit
report to `test-results/junit.xml`, in addition to the normal console output. After the test step, CI
runs `scripts/test-annotations.py` (Python standard library only). It writes these annotations on the run:

- one notice with the totals, for example `Unit tests: totals` — `460 passed, 0 failed, 0 skipped. Test files: 70.`;
- one error for each failed test: the file and the test name in the title, then the first six lines of
  the message. GitHub shows at most 10 errors in a step, so after 9 failed tests one more error gives the
  count of the others;
- a warning if the report is missing (for example, the test build failed).

The step also runs when the tests fail. It does not run when an earlier step failed. To read the
annotations without the log:

```bash
gh api repos/guibilar/PersonalFinanceInsightsFrontend/commits/<sha>/check-runs --jq '.check_runs[] | {name, id}'
gh api repos/guibilar/PersonalFinanceInsightsFrontend/check-runs/<id>/annotations
```

Locally: `npm run test:ci`, then `python3 scripts/test-annotations.py`.

The tests run in a real browser (Vitest browser mode through Playwright), because some of them need
layout and focus behaviour that a simulated DOM doesn't have. Before the first run, download the
browser once: `npx playwright install chromium-headless-shell` (add `chromium` for the visible browser
that `npm test` opens).

## Project structure

```
src/app/
  core/       api/ (repositories), models/, data/ (change notifications, the import panel), layout/ (the shell,
              sidebar and bottom bar), modules/ (the module registry and the main menu)
  shared/     ui/ (cards, modal, confirm dialog, toasts, tag picker, skeletons...), charts/ (theme, chart helper),
              utils/ (formatting, months, date presets, flows, problem details...)
  features/   today/, capture/, modules/, placeholder/ (Timeline, Search)               (lazy-loaded routes)
              money/ (the Money routes, sub-menu and old-address redirects), and its pages: dashboard/,
              transactions/, budgets/, recurring/ (Subscriptions), net-worth/, review/, rules/, categories/, tags/,
              bank-accounts/ (Accounts)
              account/ is the signed-in user's own account (change password), not a bank account
```

Components are standalone, OnPush and signal-based; the app runs zoneless.
Styling is Bootstrap 5 only: `src/styles.scss` imports just the Bootstrap modules in use, and drops the utility groups
no template uses, so add a module or utility group there before using its classes.

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

`API_UPSTREAM` can also point to the Hestia host, [HestiaBackend](https://github.com/guibilar/HestiaBackend)
(`hestia-api`). The host proxies the finance paths to the finance API unchanged, and serves the Hestia modules.
The app does not change. To use it:

1. Start the finance backend, then HestiaBackend (`docker compose up -d` in each). Both join the `finance` network.
2. Check the host: `curl http://localhost:5097/health/ready` answers `Healthy`.
3. Here, add `API_UPSTREAM=http://hestia-api:8080` to `.env`, then `docker compose up -d`.

To go back, remove the line from `.env` and run `docker compose up -d` again. nginx then calls the finance API directly.

nginx also:

- accepts uploads up to 6 MB on `/api/` (a 5 MB statement plus the form envelope; nginx's default is 1 MB);
- sends security headers on every response (`docker/security-headers.conf`): a Content-Security-Policy that
  only allows this origin's scripts, no framing, `nosniff`, a same-origin referrer policy;
- hides its version, and caches hashed bundles for a year while `index.html`, `theme.js` and the favicon
  are revalidated.

Because of the policy there is no inline script: the early theme switch lives in `public/theme.js`, and
critical-CSS inlining is off in `angular.json` (its `onload` handler would be blocked).
