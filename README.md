# Lists

A simple, fast, multi-list to-do app with magic-link auth and cross-device sync.
Built with React + Vite + Supabase, deploys to Vercel.

## Stack

- **Vite + React 18** (no TypeScript)
- **Tailwind CSS** for styling
- **Supabase** for auth (magic links) and Postgres database with row-level security
- **Vercel** for hosting

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project. Pick any region near you. Save the database password somewhere (you will not need it for this app, but Supabase requires one).

### 3. Run the schema

In the Supabase dashboard, go to **SQL Editor** and paste the contents of `supabase/schema.sql`, then click Run. This creates the `lists` and `tasks` tables and applies row-level security policies so each user can only see their own data.

### 4. Configure auth redirect URL

Still in Supabase, go to **Authentication → URL Configuration** and add the following to **Site URL** and **Redirect URLs**:

- `http://localhost:5173` (for local dev)
- Your eventual Vercel URL, e.g. `https://lists.vercel.app` (add this after you deploy)

Email confirmations are on by default for magic links, which is what we want.

### 5. Add env vars

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

In Supabase, go to **Project Settings → API** and copy:

- **Project URL** into `VITE_SUPABASE_URL`
- **anon / public key** into `VITE_SUPABASE_ANON_KEY`

Your `.env.local` should look like:

```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 6. Run it

```bash
npm run dev
```

Open `http://localhost:5173`. Enter your email, click the magic link in your inbox, and you are in.

## Deploy to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-user>/lists.git
git push -u origin main
```

### 2. Import to Vercel

Go to [vercel.com](https://vercel.com), click **Add New → Project**, import your GitHub repo. Vercel auto-detects Vite, no config needed.

### 3. Add env vars in Vercel

In the import flow (or later under **Project Settings → Environment Variables**), add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use the same values from your `.env.local`.

### 4. Add the production URL to Supabase

Once deployed, copy your Vercel URL (e.g. `https://lists-abc123.vercel.app` or your custom domain). Back in Supabase **Authentication → URL Configuration**, add it to **Site URL** and **Redirect URLs**, otherwise magic-link redirects will fail in production.

That is the whole deployment loop. Future pushes to `main` auto-deploy.

## How data is stored

Two tables:

- `lists`: a list belongs to one user (`user_id`)
- `tasks`: a task belongs to one list and one user

Row-level security policies ensure users can only read and write their own rows. The anon key is safe to expose in the browser, RLS is what protects the data.

## Notes on syncing

- On window/tab focus, the app refetches from Supabase. So if you edit on your phone and switch back to the laptop tab, you will see fresh data within a second.
- Operations like checking off a task or starring use optimistic updates: the UI changes instantly, then writes to the DB in the background. If a write fails, the change reverts and an alert appears.
- For true real-time push (changes from another device appearing without focusing the tab), you can swap in Supabase Realtime subscriptions on the `lists` and `tasks` tables. Not included by default to keep this lean.

## Features

- Multiple lists with counts of incomplete tasks
- Add tasks, check them off, delete them
- Edit task text by clicking on it
- Star tasks to float them to the top
- Edit list names (pencil icon next to the list in the sidebar)
- Per-list priority mode: flip the flag icon on a list to enable high/medium/low priorities on its tasks. Prioritized lists sort by priority first, then star, then creation order.
- Confirm dialogs for destructive actions
- Responsive design: persistent sidebar on desktop, drawer on mobile
- Magic-link auth (no passwords)
- Returns you to the last list you were viewing

## Database migrations

The `supabase/schema.sql` file is the canonical schema for a fresh install. When the schema evolves, additive migrations live in `supabase/migrations/` and need to be applied to existing databases manually via the Supabase SQL editor. Migrations are written to be idempotent (safe to re-run).

Applied migrations:

- `001_priorities.sql` — adds `lists.prioritized` (boolean) and `tasks.priority` (text, nullable). Apply if your existing database predates the priority feature.
