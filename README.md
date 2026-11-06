# Northstar CRM

React + Vite marketing CRM backed by Supabase (auth, team workspaces, invitations, live sync). Needs Node.js 18 or newer.

## Features

- **Global search** — press `Ctrl/⌘ + K` or `/` anywhere: leads, companies, deals, tasks, campaigns, invoices, templates, pages and quick actions.
- **Leads** — lead scoring (hot/warm/cold), tags, filters and sorting, bulk email/tag/stage/export/delete, CSV import/export, and a profile with a timeline (notes, calls, meetings, emails), tasks, deals, and Call/WhatsApp/Email buttons.
- **Companies** and **Contacts**, with the people, deals and invoices linked to each company.
- **Deals** — drag-and-drop pipeline board or list view, win probability, weighted forecast, win rate; convert any lead to a deal.
- **Calendar** — tasks, follow-ups, expected closes and invoice due dates.
- **Email templates** — merge fields (`{{first_name}}`, `{{company}}`…), send to one lead or to everyone with a tag through your own mail app, and every email is logged on the lead's timeline.
- **Web forms** — shareable links and an embed code for your website. Submissions become leads automatically.
- **Automations** — rules such as "when a lead is created from Referral, set High priority, tag it, create a call task".
- **Products** and **quotes & invoices** — line items, tax, discount, convert a quote to an invoice, mark paid, print/PDF, email.
- **Team** — invite members, roles, remove members; the dashboard, analytics and lead pipeline.

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
`20260602000700_add_lead_capture_forms.sql` is required for **Web forms** (public lead-capture forms).

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

## Deploying on Vercel

`.env` is not committed to Git, so Vercel never sees it. Do these once:

1. **Environment variables**: Project → Settings → Environment Variables. Add `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` (your public URL) and `VITE_APP_NAME` for **Production** and **Preview**, then redeploy.
   Without them the site shows "Supabase is not configured".
2. **Make the site public**: Project → Settings → **Deployment Protection** → turn **Vercel Authentication** off
   (or set it to "Only Preview Deployments" and share the production domain). While it is on, every visitor is sent to the
   Vercel login page before the app loads. This is a Vercel setting; no code change can bypass it.
3. **Supabase redirect URLs**: in Supabase → Authentication → URL Configuration, set *Site URL* to the Vercel URL and add it to
   *Redirect URLs*, so confirmation, password-reset and invitation links return to the app.

`vercel.json` already configures the Vite build, the SPA fallback and long-term caching of hashed assets.
