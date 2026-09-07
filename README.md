# A'rest Bukit Jalil — Central Kitchen Stock Tracker

Lightweight stock in / stock out tracker for the Bukit Jalil Central Kitchen store.
Sister app to `juta-batu-pahat-stock` — same UX, same data model, separate database.

**Stack:** Next.js 14 (App Router, JavaScript) · Tailwind · Supabase (Postgres + RLS) · Vercel

---

## How it works

**Staff side** — no login. Pick your name → Stock In or Stock Out → key quantities against
the item list → review screen → confirm. Stock Out asks for the destination branch first.
If a stock-out would take an item below zero you get a *warning*, never a block.

**Manager side** — one shared code (`MANAGER_PASSWORD`). Five tabs:
Overview (live balances) · Items · Staff · Branches · History.

**The ledger is append-only.** There is no UPDATE or DELETE policy on `stock_movements`
anywhere in the database — not hidden in the UI, genuinely absent. A mistake is corrected
with a new, offsetting entry. That is deliberate: an inventory log you can quietly edit is
an inventory log nobody can audit.

---

## Setup — do these in order

### 1. Supabase

1. supabase.com → **New project** → name `juta-bukit-jalil-stock`, region **Southeast Asia (Singapore)**.
   Save the database password somewhere safe.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run.
3. **SQL Editor** → paste all of `supabase/seed.sql` → Run.
   ⚠️ The item list in `seed.sql` is a placeholder. Replace it with the real list before go-live.
4. **Project Settings → API**, copy three values:
   - Project URL
   - `anon` `public` key
   - `service_role` `secret` key ← never put this in a `NEXT_PUBLIC_` variable

### 2. Run it locally (optional but worth 5 minutes)

```bash
npm install
cp .env.example .env.local     # then paste your three keys + pick a manager code
npm run dev                    # http://localhost:3000
```

### 3. GitHub

⚠️ **Set your git identity before the first commit.** Vercel blocked the Batu Pahat deploy
with *"commit author did not have contributing access"* because the local git email didn't
match the `jutafnbsdnbhd` account.

```bash
git config user.name  "jutafnbsdnbhd"
git config user.email "<the email on the jutafnbsdnbhd GitHub account>"

git init
git add .
git commit -m "Bukit Jalil CK stock tracker v1"
git branch -M main
git remote add origin https://github.com/jutafnbsdnbhd/juta-bukit-jalil-stock.git
git push -u origin main
```

If you hit that Vercel error anyway: fix the email, then `git commit --amend --reset-author`
and force-push.

### 4. Vercel

1. vercel.com → **Add New → Project** → import `juta-bukit-jalil-stock`.
2. Add four Environment Variables (Production + Preview + Development):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `MANAGER_PASSWORD` | **not** `8888` |

3. Deploy. Every push to `main` redeploys automatically.

### 5. Before handing it to the store

- **Manager → Branches** — replace "Branch 1" with the real stock-out destinations.
- **Manager → Staff** — add everyone who will log movements.
- **Manager → Items** — check every item, category and UOM against what the store holds.
- Do one real Stock In and one real Stock Out and check them in **History**.

---

## Environment variables

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public; RLS is what protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | bypasses RLS; also signs the manager cookie |
| `MANAGER_PASSWORD` | **server only** | shared manager code |

## Security model

- The anon key can **SELECT** the four tables and **INSERT** into `stock_movements`. Nothing else.
  No UPDATE or DELETE policy exists, so neither is possible from the browser at any point.
- Manager writes go through `/api/manager/*` with the service role key server-side, gated by an
  httpOnly, signed cookie set by `/api/manager/login`. The service key never reaches the browser.
- The manager cookie is an HMAC-signed timestamp, not the password — it can't be forged
  client-side and expires after 12 hours.
- Deleting an item, staff member or branch **deactivates** it (`is_active = false`). History stays intact.

## Project layout

```
supabase/schema.sql            tables, item_balances view, RLS policies
supabase/seed.sql              starter staff / branch / items   ← replace the items
src/app/page.js                staff name picker + Manager button
src/app/menu/                  Stock In / Stock Out choice
src/app/stock-in|stock-out/    thin wrappers over MovementFlow
src/components/MovementFlow.js the whole entry → review → warn → done flow
src/app/manager/page.js        password gate + 5 tabs
src/app/api/manager/*          service-role CRUD, cookie-gated
src/lib/constants.js           category order lives here
```

## Keeping in sync with Batu Pahat

These two apps are deliberate twins in separate repos. Any fix worth making is worth making
twice — patch it here and in `juta-batu-pahat-stock`, and keep both `schema.sql` files
identical. When a third central kitchen appears, stop cloning and merge them into one
multi-location app instead.
