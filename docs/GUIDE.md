# LIFE OS: technical guide

A private, local-first life execution system: Command Center, Today (3 capacity modes), Vision Board, 2026–2035 Roadmap, Habits & Health, Career pipeline, Finances (actuals + scenarios).

Stack: Next.js 15 · React 19 · TypeScript · Tailwind · Recharts · SQLite (better-sqlite3). No cloud account, no API keys.

## 1. Run it locally

Requires **Node.js 20 or newer** (`node -v`).

```bash
cd life-os
npm install
npm run build
npm start            # http://localhost:3000
```

For development with hot reload: `npm run dev`.

On first start the database is created at `data/life-os.db` and seeded with **plans only**: 9 pillars, 23 roadmap milestones, the Days 1–7 tasks, recurring routines and 6 starter habits. No balances, applications, metrics or achievements are pre-filled.

Run the tests: `npm test` (21 unit tests: ages, dates, recurrence, runway, amortisation, avalanche/snowball, planner capacity).

## 2. Environment variables

Copy `.env.example` to `.env.local` if you need either:

| Variable | Default | Purpose |
|---|---|---|
| `LIFEOS_DB_PATH` | `./data/life-os.db` | Where the SQLite file lives (e.g. an encrypted volume) |
| `ANTHROPIC_API_KEY` | empty | Optional. Key for the in-app Coach. You can also paste it in Settings → Coach (stored only in the local database, never sent to the browser or included in backups). |
| `LIFEOS_PASSCODE` | empty | If set, every page and API call requires HTTP Basic auth (any username, this password). Set it before exposing the app beyond your own machine. |

## 3. Database

- One SQLite file. Schema is defined in `lib/schema.ts`; tables and new columns are created automatically on start (additive migrations only).
- Every record has `created_at`, `updated_at` and `archived` (archive instead of delete where offered).
- Financial rows carry `provenance` (`actual` / `estimate`). Projections are computed on the fly and never stored as actuals.
- `balance_snapshots` records cash and debt totals each day you change balances; the net-worth trend uses only these.

## 4. Backup and restore

- **Settings → Export JSON backup** downloads everything (all tables + settings).
- **Settings → Restore from backup** replaces all data with a backup file (single transaction).
- Or copy `data/life-os.db` while the app is stopped.
- The export contains financial data: keep copies on an encrypted drive or in a password-protected archive.

## 5. Deployment options

1. **Recommended: keep it local.** Run `npm start` on your laptop. Optionally add a login item / launch agent so it starts automatically.
2. **Phone access at home:** `npx next start -H 0.0.0.0 -p 3000` with `LIFEOS_PASSCODE` set, then open `http://<laptop-ip>:3000` on the same Wi-Fi.
3. **Small VPS** (e.g. a $5 Linux server): install Node 20, copy the repo, set `LIFEOS_PASSCODE`, run `npm ci && npm run build && npm start` behind Caddy or Nginx with HTTPS, and back up `data/`.
4. **Not suitable for Vercel/Netlify serverless** as-is: their file systems are ephemeral so SQLite would reset. Moving to Supabase/Postgres means replacing `lib/db.ts`; the API shape can stay the same.

## 6. User guide

**Navigation:** Home · Today (Morning, Plan, Check-ins) · Vision (Vision, Roadmap) · Career · Money · Growth (Learning, Health, Relationships). Settings is at the bottom of the sidebar.

**Dashboard:** your current roadmap stage, "This week" donuts (today's plan, habits, mornings, applications, book, energy), "Life areas" donuts (progress of milestones open to you now; later areas show a lock), top 3, what needs attention and the next 7 days.

**Every morning (5 min):** open **Today** → pick the mode that matches your energy → check the plan → star your top 3.
- *Minimum Day*: essentials only, max 3 tasks / 60 min. Habits show their minimum version.
- *Standard Day*: max 5 tasks / 240 min, one focus block.
- *Deep Work Day*: max 6 tasks / 360 min, up to 3 focus blocks.
- Anything that doesn't fit goes to **Later**, never deleted. Hover a task to see why it was ranked (priority, life-stage weight, due date, essential).
- Missed something? `⋯` → *Move to tomorrow*, *next week*, *pick date*, or *Skip today* for recurring tasks. The roadmap is unchanged. Tasks moved 3+ times get flagged to shrink or drop.

**During the day:** log spending (Today → Spent today), tick habits, update applications in **Career**.

**Evening:** daily check-in (energy, one win, what got in the way).

**Any day:** Home shows your week at a glance (routines, mornings, applications, reading, energy). The old Review tab was retired; /review now opens Home.

**First week:** complete **Finances → Actuals** (balances, each debt with APR and minimum, monthly costs, one-off obligations with dates). Until then, runway and payoff dates are deliberately blank.

**Scenarios:** Finances → Scenarios. Move the job start, salary, cost cuts and extra repayments; see cash, debt-free date, lowest cash point and net worth at 30 under conservative/baseline/optimistic bands. All assumptions are listed on the page.

**Priorities:** Settings → Life-stage weights controls how much each pillar pulls on your day. Business, content, home and travel start low on purpose.

**Morning:** verse of the day (public-domain WEB or KJV text from bible-api.com, cached locally), a Bible reading plan (Gospels, New Testament, Psalms & Proverbs, or whole Bible in a year) that continues from where you stopped, and a meditation timer with box-breathing. Both tick your habits.

**Check-ins:** log as many as you like per day (energy, mood, feelings, win, blocker, gratitude, notes). The Check-ins page shows history, search and energy/mood trends.

**Life Roadmap → Map:** six stages (Stabilize, Income, Financial footing, Grow, Assets, Freedom). Only the current stage is open; later stages stay locked until it is stable. Progress fills in automatically from linked tasks. The "consistent vs drifting" chart is an illustration based on your last 14 days of habits and routines.

**Coach:** the chat button (bottom right) answers questions using a summary of your LIFE OS data and can add tasks or log spending. Needs your own Anthropic API key (pay-as-you-go). Each message sends your question and that summary to Anthropic.

**Learning:** Overview, Books, Certifications, Languages and Skills & courses. Each item has a status, an estimated effort, a cost gate (start now vs after income is stable), a next step, and time you log. Paid exams are deliberately gated behind stable income. **Books:** one book per month on a 12-month shelf (a suggested plan is pre-filled; swap freely). Log the page you reached; it calculates the pages a day needed to finish by month end and ticks your reading habit. Finish with a rating and 3 takeaways.

**Goals & Projects:** each project has an outcome, a weekly commitment and linked tasks. Goal tree shows pillar → milestone → project → task.

**Relationships:** people, a gentle contact rhythm, birthdays, plans, a moments timeline, and your values and boundaries. No scores.

**Vision Board:** hover a card → upload/replace image (resized locally). Click a card to see its milestones, weekly commitments and next tasks.

## 7. Calculation rules (also shown in the app)

- Age = completed years from the full birth date (for example 14 March 1997), not birth year.
- Dates are calendar dates in the configured time zone (default Asia/Dubai). Weeks run Monday–Sunday; "weekdays" = Mon–Fri.
- Runway simulation: monthly steps; income − essential − discretionary − one-off obligations; then debt interest (balance × APR ÷ 12) and minimums, paid only from available cash. Shortfalls are flagged, not hidden.
- Avalanche = highest rate first, snowball = smallest balance first; freed minimums roll over; extra payments only from cash above the buffer.
- No inflation, raises or investment returns are assumed.
- Accounts not in the base currency are excluded from totals (no conversion rates are invented).

## 8. Known limitations (honest list)

- **Not yet built** (shown greyed in the sidebar): Business idea portfolio, Content Studio, Analytics page, travel planner, home construction planner, progress-photo gallery.
- The Coach needs internet and an API key; replies are not streamed (you see the full answer when ready).
- Single user, no multi-device sync. Phone access needs option 2 or 3 above.
- Skipped recurring tasks disappear from today without an undo button (delete the completion via a backup edit or re-add the occurrence manually).
- Habit streaks and analytics use whatever you log; gaps in logging look like gaps in behaviour.
- Fitness and career checkpoint guidance (e.g. "response rate < 10%") are rules of thumb, not market data.
- Tested on Chromium (desktop 1440px, mobile 390px) and via API/unit tests. Not tested on Safari or Windows.

## 9. Project structure

```
app/                 pages (one folder per screen) and API routes (app/api)
components/          UI primitives, forms, task rows, shared hooks
lib/schema.ts        data model (single source of truth)
lib/db.ts            SQLite connection, migrations, (de)serialisation
lib/seed.ts          first-run plan templates
lib/dates.ts         age / date maths
lib/recurrence.ts    recurring task rules
lib/finance.ts       cash flow, runway, debt simulation, TCO
lib/priority.ts      priority engine and day planner
tests/core.test.ts   unit tests
middleware.ts        optional passcode
```
