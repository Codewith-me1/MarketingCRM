# Northstar CRM

React + Vite CRM backed by Supabase (auth, team workspaces, invitations, live sync). Needs Node.js 18 or newer.

## 1. Configure environment

```bash
cp .env.example .env   # then fill in the values
```

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Public anon key. **Never** put the `service_role` key here — every `VITE_` variable ships to the browser. |
| `VITE_APP_URL` | Optional public URL of the deployed app, used in invitation links. Defaults to the current address. |
| `VITE_APP_NAME` | Name shown in invitation emails. |

Restart `npm run dev` after editing `.env`.

## 2. Set up the database

In the Supabase dashboard → **SQL Editor**, run each file in `src/supabase/migrations/` in filename order.
All files are safe to re-run. `20260602000600_fix_team_admin_and_invites.sql` is required for team management:
it makes every workspace owner an Admin, adds invitation acceptance for existing accounts, member removal,
and realtime sync.

### Supabase Auth settings

- **Authentication → URL Configuration**: set *Site URL* to your app URL and add it (plus `http://localhost:5173`) to *Redirect URLs*.
- **Email confirmation**: Supabase's built-in email service only delivers to your own project team's addresses and
  is heavily rate limited. For real users either configure custom SMTP (**Authentication → Emails → SMTP Settings**)
  or turn off *Confirm email* (**Authentication → Sign In / Providers → Email**). Otherwise new users and invitees never
  receive their confirmation email and cannot sign in.

## 3. Run

```bash
npm install
npm run dev        # http://localhost:5173
```

## Team invitations

1. An Admin opens **Team**, enters a name, email and role, and clicks **Add member**. The invite link is copied.
2. Send the link (or click **Email** to open a pre-filled message in your mail app).
3. The invitee opens the link and creates an account with the invited email address, or signs in if they already have one.
   They join the inviter's workspace with the chosen role. Links expire after seven days.

## Build

```bash
npm run build      # lints, then builds to dist/
npm run preview    # preview the built site
```

Upload `dist/` to any static host and set the same `VITE_*` variables in the host's build environment.
