/*
# Integration secrets (Success.ai API keys)

Run this whole file once in the Supabase dashboard -> SQL Editor (it is idempotent).

1. New table
- `crm_integrations_20260602000800`: one API key per workspace and provider.

2. Security
- RLS is enabled with NO policies and all client privileges are revoked, so browsers
  (anon and authenticated roles) can never read or write a key, not even an Admin's own.
- Only the server-side proxy (`api/successai.js`), which uses the service_role key, reads
  and writes this table after checking the caller's session and workspace role.
*/

CREATE TABLE IF NOT EXISTS public.crm_integrations_20260602000800 (
  workspace_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text NOT NULL,
  key_hint text NOT NULL DEFAULT '',
  account_name text NOT NULL DEFAULT '',
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_owner_id, provider)
);

ALTER TABLE public.crm_integrations_20260602000800 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crm_integrations_20260602000800 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.crm_integrations_20260602000800 TO service_role;

NOTIFY pgrst, 'reload schema';
