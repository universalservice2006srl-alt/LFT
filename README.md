# FleetPulse

Fleet mileage and vehicle administration app built with Next.js, Drizzle and PostgreSQL.

The application keeps its existing database role values for compatibility:
`super_admin` displays as **Admin**, `branch_manager` displays as **Branch Manager**, and `driver` displays as **Driver**.

## Production deployment

### 1. Create the Supabase database

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings > Database** and copy the **Session pooler** connection string. Use the pooler string for Vercel, with its password URL-encoded if it contains special characters.
3. Open **SQL Editor**, paste `docs/supabase-rls.sql`, and run it once.

For an existing database, run `docs/seed-branches.sql` in Supabase SQL Editor to populate or refresh the branch list.

For Vercel, use the Supabase **Session pooler** `DATABASE_URL`, not the direct `db.<project>.supabase.co` host. URL-encode special characters in the database password.

The application uses Supabase Auth for all admin and user passwords and sessions. Set the public project URL and anon key for the browser/SSR client, and set the service-role key only as a server-side Vercel secret. Never expose either the database URL or service-role key to the browser.

### 2. Create the first admin

Install dependencies and create a local `.env` file from `.env.example`:

```powershell
Copy-Item .env.example .env
npm install
```

Set `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_NAME`, and a strong `ADMIN_PASSWORD` in `.env`, then run:

```powershell
npm run db:create-admin
```

The command refuses to overwrite an existing profile and prints the created login once. Remove `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` from the environment after setup; they are only needed by this command.

Existing installations using the old local password system need a one-time account migration: create each user in Supabase Auth, update the matching profile `id` to that Auth user ID, and clear the legacy password columns before deploying this version. Existing local password hashes cannot be imported into Supabase Auth.

### 3. Deploy to Vercel

1. Push the repository to GitHub and import it into Vercel.
2. In **Vercel > Project Settings > Environment Variables**, add `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` for Production, Preview, and Development as needed.
3. Add `SHOW_DEMO_CREDENTIALS=false` for Production. This hides seeded/demo credentials from the login screen.
4. Deploy. Vercel detects Next.js and uses `npm run build` automatically.

The production URL should use HTTPS. The app sets secure, HTTP-only session cookies automatically when `NODE_ENV=production`.

## Local development

```powershell
npm install
npm run dev
```

Useful checks:

```powershell
npm run typecheck
npm run lint
npm run build
```

`drizzle.config.json` is intended for local Drizzle tooling; production setup is the Supabase SQL script above. The image capture feature currently stores compressed data URLs in PostgreSQL, so no Supabase Storage bucket is required.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Supabase PostgreSQL connection string, server-only |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only key for admin/user provisioning |
| `SHOW_DEMO_CREDENTIALS` | Recommended | Set to `false` in production |
| `ADMIN_EMAIL` | Bootstrap only | First admin email for `npm run db:create-admin` |
| `ADMIN_NAME` | Bootstrap only | First admin display name |
| `ADMIN_PASSWORD` | Bootstrap only | First admin password |
