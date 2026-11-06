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
- **Success.ai outreach** — see below.

## 1. Configure environment

```bash
cp .env.example .env   # then fill in the values
```

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) from Supabase → Project Settings → **API Keys**. Safe in the browser. |
| `VITE_SUPABASE_ANON_KEY` | *Legacy* anon key. It's only used while the publishable key is empty; remove it once you've switched. |
| `VITE_APP_URL` | Optional public URL of the deployed app, used in invitation links. Defaults to the current address. |
| `VITE_APP_NAME` | Name shown in invitation emails. |
| `SUPABASE_SECRET_KEY` | **Server only**: no `VITE_` prefix, so it's never bundled. It's the secret key (`sb_secret_…`) from Project Settings → API Keys → Secret keys, and the Success.ai proxy needs it. The legacy `SUPABASE_SERVICE_ROLE_KEY` still works as a fallback. |

Supabase's new keys aren't JWTs. The server sends the secret key only in the `apikey` header, as Supabase requires.
If a secret key (or a legacy `service_role` key) is ever put in a `VITE_` variable, the app refuses to start and tells
you to rotate the key, because `VITE_` values are published to every visitor.

The **Success.ai API key is not an environment variable**. An Admin pastes it into the app (see below), and it's stored
for that workspace only.

Restart `npm run dev` after editing `.env`.

## 2. Set up the database

In the Supabase dashboard → **SQL Editor**, run each file in `src/supabase/migrations/` in filename order.
All files are safe to re-run. `20260602000600_fix_team_admin_and_invites.sql` is required for team management:
it makes every workspace owner an Admin, adds invitation acceptance for existing accounts, member removal,
and realtime sync.
`20260602000700_add_lead_capture_forms.sql` is required for **Web forms** (public lead-capture forms).
`20260602000800_add_integration_secrets.sql` is required for the **Success.ai** integration.

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

## Success.ai outreach integration

Connects [Success.ai](https://api.success.ai/api/docs) cold-email campaigns to the CRM.

**Setup:** run migration `000800`, set `SUPABASE_SECRET_KEY` (in `.env` locally and in Vercel), then an Admin opens
**Campaigns → Success.ai outreach** and pastes a **V2 API key** (Success.ai → Settings → Integrations → API, Growth plan or above).
The key is verified and stored server-side for that workspace only; browsers never see it.

**What it does**

- **Campaigns:** campaign status (Active/Paused/Draft/Completed) and stats (leads, contacted, opened, replied, bounced). These show on the
  Campaigns page and in the **Outreach campaigns** card on the dashboard.
- **Manage from the CRM:** create campaigns, launch or pause them, and add CRM leads to a campaign. You can add them from
  the Leads bulk bar (**Success.ai**), from a lead's profile, or by stage/tag from a campaign card. Only Admins and Managers can do this.
- **Lead matching:** each sync looks up a few leads in Success.ai (searching all campaigns), so leads that are already in a campaign
  list get linked automatically.
- **Local effects:**
  - Queued leads are tagged `in-sequence`.
  - Contacted → the stage moves to **Contacted**.
  - An opened email is logged on the lead's timeline.
  - Replied → the stage moves to **Interested**, priority becomes High, and a "respond" task is created.
  - Bounced and unsubscribed leads are tagged.

  Stages only ever move forward, and Converted/Lost leads are never touched. Stage changes also trigger your Automations.
- **Two-way:** when a linked lead becomes Converted or Lost in the CRM, the next sync sets it to Closed / Not Interested in Success.ai,
  so the sequence stops.

**API quota:** Success.ai's default limits are 20 requests/min, 50/hour and 100/day per workspace, and it has no webhooks.
The CRM therefore syncs within a budget. A default sync uses about 15 calls: the campaign list, details for 3 campaigns
(active ones first), 6 lead lookups (oldest first), and up to 2 status pushes. It runs automatically every 4 hours
while the CRM is open, and you can press **Sync now** at any time. Results are saved to the shared workspace, so
teammates don't spend extra quota. On a 429 the sync stops and waits for the window to reset. Admins can change these
numbers under *Sync settings & API budget*.

The proxy lives in `server/successai.js`. It's served by `api/successai.js` on Vercel, and by the Vite dev server during `npm run dev`.
It only allows a fixed list of actions, each with a minimum role.

## Build

```bash
npm run build      # lints, then builds to dist/
npm run preview    # preview the built site
```

Upload `dist/` to any static host and set the same `VITE_*` variables in the host's build environment.

## Deploying on Vercel

`.env` is not committed to Git, so Vercel never sees it. Do these once:

1. **Environment variables**: Project → Settings → Environment Variables. Add `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL` (your public URL), `VITE_APP_NAME` and the server-only `SUPABASE_SECRET_KEY`
   for **Production** and **Preview**, then redeploy.
   Without them the site shows "Supabase is not configured".
2. **Make the site public**: Project → Settings → **Deployment Protection** → turn **Vercel Authentication** off
   (or set it to "Only Preview Deployments" and share the production domain). While it is on, every visitor is sent to the
   Vercel login page before the app loads. This is a Vercel setting; no code change can bypass it.
3. **Supabase redirect URLs**: in Supabase → Authentication → URL Configuration, set *Site URL* to the Vercel URL and add it to
   *Redirect URLs*, so confirmation, password-reset and invitation links return to the app.

`vercel.json` already configures the Vite build, the SPA fallback (excluding `/api`) and long-term caching of hashed assets.
The `api/` folder is deployed automatically as a Vercel serverless function.
