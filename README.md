# ⚔ Life RPG

**Turn real life into an epic quest.** Life RPG is a full-stack gamified
productivity app: your daily tasks become quests, completing them pays XP and
gold, streaks make you stronger, and the Guild Emporium lets you spend your
loot on themes, titles, and relics.

> Built with Next.js (App Router), SQLite/Supabase, Tailwind CSS, and Framer Motion.

## 🎮 Try it in 30 seconds (zero config)

```bash
npm install
npm run dev
```

That's it. With **no environment variables set**, the app runs in **local mode**:

- A **SQLite database** is created automatically at `.data/liferpg.db` — real
  server-side persistence (survives restarts; this is *not* localStorage).
- Accounts use **scrypt-hashed passwords** with HTTP-only session cookies.
- All game logic (XP curve, streaks, shop economy) runs server-side and is
  shared with the Supabase engine.
- A demo account is seeded on first run — click **“🎭 Try the demo
  character”** on the login page (`demo@liferpg.dev` / `demo1234`).

Want hosted, multi-device, production-grade persistence instead? Follow
[Supabase setup](#-setup) below and set the two `NEXT_PUBLIC_SUPABASE_*`
variables — the app auto-detects them and switches to Supabase mode.

---

---

## ✨ Features

| System | Details |
| --- | --- |
| 🔐 **Auth & Security** | Email/password signup & login via Supabase Auth. Session persistence, middleware route guards, and **Row Level Security** so users can only ever touch their own rows. |
| 📜 **Quest CRUD** | Create / read / update / delete quests with category, difficulty, notes, and optional due date. Server-side validation with friendly error messages. |
| 📈 **Non-linear leveling** | XP to advance grows as `100 × level^1.5` — computed **only on the server** (Postgres function), so the client can never cheat. Overflow XP carries over for multi-level-ups. |
| 💪 **Attributes** | Five stats — Strength, Intellect, Vitality, Creativity, Focus. Every quest trains the matching attribute on its own curve. |
| 🔥 **Streaks** | Consecutive-day tracking with a rising XP bonus (+2%/day, capped at +50%). Miss a day and it resets — brutal, but fair. |
| 🪙 **Economy & Shop** | Earn gold from quests; spend it in the Guild Emporium on **themes** (repaint the app), **titles**, and **relics**. Purchases are atomic transactions with a full gold ledger. |
| ⚡ **Alive & tactile** | Spring-animated XP bars, level-up particle celebration, optimistic UI everywhere, loading skeletons, and toast notifications. |
| ♿ **Accessible** | Full keyboard navigation (Tab / Enter / Space), focus traps in dialogs, skip link, ARIA roles/labels, `aria-live` toasts, `prefers-reduced-motion` support. |
| 📱 **Responsive** | Mobile-first layout that scales to desktop; touch-friendly targets, adaptive HUD. |

## 🧱 Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + custom RPG design tokens
- **Animation:** Framer Motion
- **Database:** Supabase Postgres
- **Auth:** Supabase Auth (`@supabase/ssr` cookie sessions)
- **Validation:** Zod (all API inputs)
- **Deployment:** Vercel-ready

## 🚀 Setup (Supabase, for production)

### 1. Create a Supabase project

1. Go to [database.new](https://database.new) and create a project (free tier works).
2. Open **SQL Editor** and run the two migration files in order:
   - `supabase/migrations/20260913000000_init.sql` (tables + RLS + new-user trigger)
   - `supabase/migrations/20260913010000_game_functions.sql` (shop catalog + game engine functions)
3. Copy **Settings → API → Project URL** and **anon public key**.

### 2. Configure the app

```bash
cp .env.example .env.local
# then edit .env.local with your Supabase URL + anon key
```

`.env.local` needs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), forge a character, and
accept your first quest.

### 4. (Optional) Seed a demo account

```bash
SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
node scripts/seed-demo.mjs
```

Creates `demo@liferpg.dev` / `demo1234` with quest history, a 4-day streak,
level 5, and a purchased relic — great for judges and screenshots.

## 🚢 Deploy to Vercel

1. Push this repo to GitHub (public).
2. [Import it on Vercel](https://vercel.com/new) — Next.js is auto-detected.
3. Add the environment variables from `.env.example` in
   **Project → Settings → Environment Variables** (`NEXT_PUBLIC_SITE_URL`
   should be your production URL).
4. Deploy, then verify:
   - Signup works in an **incognito** window (no cached state),
   - A completed quest survives a **hard refresh** (data lives in Supabase,
     never localStorage),
   - The app still works after logging out and back in on another device.

## 🗃 Two Backends, One Contract

The app supports two interchangeable persistence layers with identical API
shapes (choose by env, not code changes):

| | Local mode (default) | Supabase mode |
| --- | --- | --- |
| **Database** | SQLite (`.data/liferpg.db`) via `node:sqlite` | Postgres (Supabase) |
| **Auth** | scrypt hashes + server-side sessions in HTTP-only cookies | Supabase Auth |
| **Game engine** | TypeScript transactions in `src/lib/local/engine.ts` | `security definer` Postgres functions |
| **Row security** | Ownership enforced in every SQL statement | Row Level Security policies |
| **Config** | none | `NEXT_PUBLIC_SUPABASE_URL` + anon key |

Both enforce the same rules: server-side XP math, duplicate-completion
protection, insufficient-gold guards, and per-user data isolation.

```
profiles(id → auth.users, username, level, xp, total_xp, gold, title, avatar_theme)
quests(id, user_id → auth.users, title, description, category, difficulty,
       xp_reward, gold_reward, completed, completed_at, due_date, created_at)
attributes(user_id, key, xp, level)            -- pk (user_id, key)
streaks(user_id, current, best, last_active_date)
inventory(id, user_id, item_key, equipped)     -- unique (user_id, item_key)
transactions(id, user_id, kind, amount, reason, created_at)
shop_items(key, name, kind, price, description, icon)  -- public catalog
```

**RLS:** every table has `USING (auth.uid () = user_id)` policies (the shop
catalog is world-readable). A database trigger (`handle_new_user`) bootstraps
each new auth user with a profile, five attribute rows, and a zeroed streak.

**Game engine:** `complete_quest`, `purchase_item`, and `equip_item` are
Postgres functions marked `security definer`. The API routes only pass IDs —
all reward math, streak logic, and gold movement happen inside one atomic
transaction per call. This is what makes stat-cheating impossible.

## 🎮 Game Rules (design decisions)

- **XP curve:** level `n → n+1` costs `round(100 · n^1.5)` XP
  (L1→2: 100 XP, L2→3: 283 XP, L10→11: 3162 XP…).
- **Quest rewards:** Common 10 XP / 5g · Rare 25 / 12 · Epic 50 / 25 · Legendary 100 / 50.
- **Streak bonus:** +2% XP per current-streak day, capped at +50%.
- **Attributes:** gain the quest's base XP on their own curve (`40 · level^1.35`).
- **Max level:** 60 (XP bar caps full at max).

## 📜 Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `node scripts/seed-demo.mjs` | Seed the demo account (requires service role key) |

## 🧪 Smoke Test (the 60-second tour)

1. Sign up with a fresh email → land on the Quest Board with an empty board.
2. Forge a quest (try submitting an empty name — inline error appears).
3. Complete it → toast shows `+10 XP · +5 gold · streak reignited 🔥`.
4. Complete 9 more commons → **LEVEL UP** celebration at level 2 (100 XP).
5. Refresh the page → everything persists (it's in Postgres, not localStorage).
6. Log in on another browser with the same account → same character.
7. Visit the Emporium → buy *The Night Owl* title (80g) → equip it → your
   character sheet shows the new title.

---

Made with ⚔, ☕, and obsessive attention to dopamine loops.
