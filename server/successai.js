/**
 * Server-side Success.ai proxy (https://api.success.ai/api/docs).
 *
 * Why a proxy: the Success.ai API key grants full control of the outreach account, so it must
 * never reach the browser. Each CRM workspace stores its own key in Supabase
 * (crm_integrations_20260602000800, readable only with the Supabase secret key). This handler:
 *   1. verifies the caller's Supabase session (Bearer token),
 *   2. resolves their workspace and role from crm_team_members,
 *   3. runs one allow-listed action with that workspace's key.
 *
 * Used by api/successai.js (Vercel) and the Vite dev server middleware (vite.config.js).
 */

const SUCCESS_AI_BASE = 'https://api.success.ai';
const PROVIDER = 'successai';
const INTEGRATIONS = 'crm_integrations_20260602000800';
const MEMBERS = 'crm_team_members_20260602000400';
const ROLE_RANK = { Employee: 1, Manager: 2, Admin: 3 };

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Removes the quotes/whitespace/newlines that often sneak in when pasting into Vercel or .env. */
const clean = value => String(value || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();

const projectRef = url => /^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/i.exec(url)?.[1] || '';

/** Project ref encoded in a legacy JWT key, if any (new sb_ keys carry no ref). */
const keyRef = key => {
  if (!key.startsWith('eyJ')) return '';
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'))?.ref || '';
  } catch {
    return '';
  }
};

const config = env => {
  const url = clean(env.SUPABASE_URL || env.VITE_SUPABASE_URL).replace(/\/+$/, '');
  // New Supabase secret key (sb_secret_…) preferred; the legacy service_role JWT still works as a fallback.
  const secretVar = clean(env.SUPABASE_SECRET_KEY) ? 'SUPABASE_SECRET_KEY' : 'SUPABASE_SERVICE_ROLE_KEY';
  const serviceKey = clean(env[secretVar]);
  // Public key, used only to verify the caller's session (keeps that check independent of the secret key).
  const publicKey = clean(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY);
  if (!url || !serviceKey) {
    throw new HttpError(503, 'The Success.ai integration is not set up on the server. Add SUPABASE_SECRET_KEY (Supabase → Project Settings → API Keys → Secret keys) to the server environment — Vercel → Settings → Environment Variables, or .env for local development — then redeploy/restart.', { code: 'SERVER_NOT_CONFIGURED' });
  }
  if (serviceKey.startsWith('sb_publishable_')) {
    throw new HttpError(503, `${secretVar} contains a publishable key. Use a secret key (sb_secret_…) from Project Settings → API Keys.`, { code: 'SERVER_NOT_CONFIGURED' });
  }
  const urlRef = projectRef(url);
  const secretRef = keyRef(serviceKey);
  if (urlRef && secretRef && urlRef !== secretRef) {
    throw new HttpError(503, `${secretVar} belongs to Supabase project "${secretRef}", but the app uses project "${urlRef}". Copy the secret key from the same project.`, { code: 'SERVER_KEY_INVALID' });
  }
  return { url, serviceKey, secretVar, publicKey, base: clean(env.SUCCESS_AI_BASE_URL || SUCCESS_AI_BASE).replace(/\/+$/, '') };
};

const UA = 'northstar-crm-server/1.0';

/**
 * Headers that authenticate the server to Supabase.
 * New keys (sb_secret_…) are not JWTs: Supabase requires them in the `apikey` header only
 * (a Bearer token would be verified as a JWT and rejected). Legacy service_role keys are JWTs
 * and are also sent as the Bearer token, as before.
 */
const serverHeaders = cfg => ({
  apikey: cfg.serviceKey,
  'User-Agent': UA,
  ...(cfg.serviceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${cfg.serviceKey}` })
});

const keyRejected = cfg => new HttpError(503, `Supabase rejected the server key (${cfg.secretVar}). In Supabase → Project Settings → API Keys, copy a secret key (sb_secret_…) from project "${projectRef(cfg.url) || cfg.url}", paste it into Vercel → Settings → Environment Variables without quotes or spaces, then redeploy. If you disabled legacy keys, the old service_role key no longer works.`, { code: 'SERVER_KEY_INVALID' });
const isInvalidApiKey = body => /invalid api key/i.test(body?.message || body?.msg || '');

// ---- Supabase helpers -------------------------------------------------------------------------
async function supabaseUser(cfg, token) {
  if (!token) throw new HttpError(401, 'Sign in to use the Success.ai integration.', { code: 'SESSION_EXPIRED' });
  // apikey only identifies the project; the Bearer token is the signed-in user's own JWT.
  const tryKey = async apikey => {
    const res = await fetch(`${cfg.url}/auth/v1/user`, { headers: { apikey, 'User-Agent': UA, Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => null);
    return { res, body };
  };
  let { res, body } = await tryKey(cfg.publicKey || cfg.serviceKey);
  if (!res.ok && isInvalidApiKey(body) && cfg.publicKey) ({ res, body } = await tryKey(cfg.serviceKey));
  if (res.ok && body?.id) return body;
  if (isInvalidApiKey(body)) throw keyRejected(cfg);
  if (res.status >= 500) throw new HttpError(502, `Supabase Auth is unavailable (${res.status}). Try again shortly.`);
  throw new HttpError(401, 'Your sign-in session is no longer valid. Sign out and sign in again.', { code: 'SESSION_EXPIRED' });
}

async function rest(cfg, path, init = {}) {
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...serverHeaders(cfg), 'Content-Type': 'application/json', ...(init.headers || {}) }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { message: text.slice(0, 200) }; }
  if (!res.ok) {
    if (res.status === 401 && isInvalidApiKey(body)) throw keyRejected(cfg);
    if (/permission denied/i.test(body?.message || '')) {
      throw new HttpError(503, `${cfg.secretVar} is not a secret/service_role key (permission denied). Use the sb_secret_… key from Project Settings → API Keys.`, { code: 'SERVER_KEY_INVALID' });
    }
    const missing = /does not exist|schema cache|PGRST20/i.test(body?.message || '');
    throw new HttpError(missing ? 503 : 500, missing
      ? 'The integration table is missing. Apply src/supabase/migrations/20260602000800_add_integration_secrets.sql in the Supabase SQL editor.'
      : `Database error: ${body?.message || res.status}`);
  }
  return body;
}

async function membership(cfg, userId) {
  const rows = await rest(cfg, `${MEMBERS}?select=workspace_owner_id,role&member_user_id=eq.${encodeURIComponent(userId)}`);
  const row = rows?.[0];
  const ownerId = row?.workspace_owner_id || userId;
  return { ownerId, role: ownerId === userId ? 'Admin' : (row?.role || 'Employee') };
}

async function storedKey(cfg, ownerId) {
  const rows = await rest(cfg, `${INTEGRATIONS}?select=api_key,key_hint,account_name,updated_at&workspace_owner_id=eq.${ownerId}&provider=eq.${PROVIDER}`);
  return rows?.[0] || null;
}

// ---- Success.ai helpers ----------------------------------------------------------------------
async function successAi(cfg, apiKey, method, path, { query, body } = {}) {
  const url = new URL(`${cfg.base}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => value !== undefined && value !== '' && url.searchParams.set(key, String(value)));
  const res = await fetch(url, {
    method,
    headers: { 'x-api-key': apiKey, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { message: text.slice(0, 300) }; }
  if (!res.ok || json?.success === false) {
    const message = json?.message || json?.error || `Success.ai request failed (${res.status})`;
    if (res.status === 429) throw new HttpError(429, `Success.ai rate limit: ${message}`, { code: 'RATE_LIMITED' });
    if (res.status === 401 || /ERR_AUTH_FAILED/.test(message)) throw new HttpError(401, 'Success.ai rejected the API key. Use a V2 API key from Success.ai → Settings → Integrations → API (Growth plan or above).', { code: 'BAD_KEY' });
    throw new HttpError(res.status === 404 ? 404 : 502, message, { code: res.status === 404 ? 'NOT_FOUND' : 'UPSTREAM' });
  }
  return json?.data;
}

/** Runs tasks with limited parallelism; stops starting new ones after a rate-limit error. */
async function pool(items, limit, task) {
  const results = new Array(items.length);
  let index = 0;
  let rateLimited = null;
  const worker = async () => {
    while (index < items.length && !rateLimited) {
      const current = index++;
      try {
        results[current] = await task(items[current]);
      } catch (error) {
        if (error.status === 429) rateLimited = error.message;
        results[current] = { error: error.message, status: error.status };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return { results, rateLimited };
}

const str = (value, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const requireId = value => {
  const id = str(value, 64);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new HttpError(400, 'A valid campaignId is required.');
  return id;
};

const normalizeContact = contact => ({
  campaignId: contact.campaign || contact.campaignId || '',
  status: contact.status || 'not contacted',
  isRead: Boolean(contact.isRead || contact.open),
  interested: Boolean(contact.interest_status),
  updatedAt: contact.updatedAt || contact.createdAt || null
});

// ---- Actions -----------------------------------------------------------------------------------
const ACTIONS = {
  /** Connection info for the settings card; costs no Success.ai quota. */
  connection: { role: 'Employee', needsKey: false, run: async ({ key, role }) => ({ configured: Boolean(key), keyHint: key?.key_hint || '', accountName: key?.account_name || '', updatedAt: key?.updated_at || null, role }) },

  saveKey: {
    role: 'Admin', needsKey: false,
    run: async ({ cfg, params, ownerId, userId }) => {
      const apiKey = str(params.apiKey, 200);
      if (apiKey.length < 10) throw new HttpError(400, 'Paste the full Success.ai API key.');
      const info = await successAi(cfg, apiKey, 'GET', '/v2/authenticate');
      const row = { workspace_owner_id: ownerId, provider: PROVIDER, api_key: apiKey, key_hint: `…${apiKey.slice(-4)}`, account_name: str(info?.workspaceName, 120), connected_by: userId, updated_at: new Date().toISOString() };
      await rest(cfg, `${INTEGRATIONS}?on_conflict=workspace_owner_id,provider`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
      return { configured: true, keyHint: row.key_hint, accountName: row.account_name, updatedAt: row.updated_at };
    }
  },

  removeKey: {
    role: 'Admin', needsKey: false,
    run: async ({ cfg, ownerId }) => {
      await rest(cfg, `${INTEGRATIONS}?workspace_owner_id=eq.${ownerId}&provider=eq.${PROVIDER}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      return { configured: false };
    }
  },

  testConnection: { role: 'Employee', run: async ({ cfg, apiKey }) => ({ accountName: (await successAi(cfg, apiKey, 'GET', '/v2/authenticate'))?.workspaceName || '' }) },

  rateLimits: { role: 'Employee', run: async ({ cfg, apiKey }) => (await successAi(cfg, apiKey, 'GET', '/v2/ratelimit/limits'))?.limits || null },

  /**
   * Lists campaigns (up to 3 pages of 50) and fetches status + summary for at most
   * `maxDetails` campaigns, preferring `detailIds` chosen by the client. Cost: pages + 2 × details.
   */
  syncCampaigns: {
    role: 'Employee',
    run: async ({ cfg, apiKey, params }) => {
      const campaigns = [];
      for (let page = 0; page < 3; page += 1) {
        const batch = await successAi(cfg, apiKey, 'GET', '/v2/campaign/list', { query: { skip: page * 50, limit: 50 } });
        if (!Array.isArray(batch) || !batch.length) break;
        campaigns.push(...batch.map(item => ({ id: item._id, name: item.name })));
        if (batch.length < 50) break;
      }
      const maxDetails = Math.max(0, Math.min(Number(params.maxDetails) || 6, 15));
      const preferred = Array.isArray(params.detailIds) ? params.detailIds.filter(id => campaigns.some(item => item.id === id)) : [];
      const detailIds = [...new Set([...preferred, ...campaigns.map(item => item.id)])].slice(0, maxDetails);
      const { results, rateLimited } = await pool(detailIds, 3, async id => {
        const [status, summary] = await Promise.all([
          successAi(cfg, apiKey, 'GET', '/v2/campaign/get/status', { query: { campaignId: id } }),
          successAi(cfg, apiKey, 'GET', '/v2/analytics/campaign/summary', { query: { campaignId: id } })
        ]);
        return { id, status: status?.status || 'draft', summary: summary || {} };
      });
      const details = Object.fromEntries(results.filter(item => item && !item.error).map(item => [item.id, item]));
      return { campaigns, details, rateLimited, syncedAt: new Date().toISOString() };
    }
  },

  campaignCount: {
    role: 'Employee',
    run: async ({ cfg, apiKey, params }) => successAi(cfg, apiKey, 'GET', '/v2/analytics/campaign/count', {
      query: { campaignId: requireId(params.campaignId), startDate: str(params.startDate, 10), endDate: str(params.endDate, 10) }
    })
  },

  /** Looks up up to 10 emails. Without campaignId Success.ai searches every campaign. */
  lookupContacts: {
    role: 'Employee',
    run: async ({ cfg, apiKey, params }) => {
      const emails = [...new Set((Array.isArray(params.emails) ? params.emails : []).map(item => str(item, 254).toLowerCase()).filter(isEmail))].slice(0, 10);
      const campaignId = params.campaignId ? requireId(params.campaignId) : undefined;
      const { results, rateLimited } = await pool(emails, 2, async email => {
        try {
          const data = await successAi(cfg, apiKey, 'GET', '/v2/contact/get', { query: { email, campaignId } });
          const list = (Array.isArray(data) ? data : data ? [data] : []).map(normalizeContact);
          return { email, found: list.length > 0, contacts: list };
        } catch (error) {
          if (error.status === 404) return { email, found: false, contacts: [] };
          throw error;
        }
      });
      return { results: results.filter(Boolean), rateLimited, checkedAt: new Date().toISOString() };
    }
  },

  launch: { role: 'Manager', run: async ({ cfg, apiKey, params }) => successAi(cfg, apiKey, 'POST', '/v2/campaign/launch', { body: { campaignId: requireId(params.campaignId) } }) },
  pause: { role: 'Manager', run: async ({ cfg, apiKey, params }) => successAi(cfg, apiKey, 'POST', '/v2/campaign/pause', { body: { campaignId: requireId(params.campaignId) } }) },

  createCampaign: {
    role: 'Manager',
    run: async ({ cfg, apiKey, params }) => {
      const name = str(params.name, 120);
      if (!name) throw new HttpError(400, 'Campaign name is required.');
      return successAi(cfg, apiKey, 'POST', '/v2/campaign/create', { body: { name, timezone: str(params.timezone, 60) || 'UTC' } });
    }
  },

  addContacts: {
    role: 'Manager',
    run: async ({ cfg, apiKey, params }) => {
      const contacts = (Array.isArray(params.contacts) ? params.contacts : [])
        .map(item => ({
          email: str(item.email, 254).toLowerCase(),
          firstName: str(item.firstName, 80), lastName: str(item.lastName, 80), companyName: str(item.companyName, 160),
          location: str(item.location, 160), website: str(item.website, 200), iceBreaker: str(item.iceBreaker, 500)
        }))
        .filter(item => isEmail(item.email));
      if (!contacts.length) throw new HttpError(400, 'No leads with a valid email address were selected.');
      if (contacts.length > 500) throw new HttpError(400, 'Success.ai accepts at most 500 contacts per upload.');
      return successAi(cfg, apiKey, 'POST', '/v2/contact/add', { body: { campaignId: requireId(params.campaignId), contacts } });
    }
  },

  updateContactStatus: {
    role: 'Manager',
    run: async ({ cfg, apiKey, params }) => {
      const email = str(params.email, 254).toLowerCase();
      const status = str(params.newStatus, 60);
      if (!isEmail(email) || !status) throw new HttpError(400, 'email and newStatus are required.');
      return successAi(cfg, apiKey, 'POST', '/v2/contact/update/status', { body: { campaign_id: requireId(params.campaignId), email, new_status: status } });
    }
  }
};

/**
 * @returns {Promise<{status:number, body:object}>}
 */
export async function handleSuccessAi({ method, authorization, body, env }) {
  try {
    if (method !== 'POST') throw new HttpError(405, 'Use POST.');
    const action = ACTIONS[body?.action];
    if (!action) throw new HttpError(400, 'Unknown action.');
    const cfg = config(env);
    const token = /^Bearer\s+(.+)$/i.exec(authorization || '')?.[1];
    const user = await supabaseUser(cfg, token);
    const { ownerId, role } = await membership(cfg, user.id);
    if ((ROLE_RANK[role] || 0) < ROLE_RANK[action.role]) {
      throw new HttpError(403, `Only ${action.role === 'Admin' ? 'Admins' : 'Admins and Managers'} can do this.`);
    }
    const key = await storedKey(cfg, ownerId);
    if (action.needsKey !== false && !key) {
      throw new HttpError(409, 'Success.ai is not connected for this workspace. An Admin can add the API key on the Campaigns page.', { code: 'NOT_CONNECTED' });
    }
    const data = await action.run({ cfg, params: body.params || {}, ownerId, userId: user.id, role, key, apiKey: key?.api_key });
    return { status: 200, body: { ok: true, data } };
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (!(error instanceof HttpError)) console.error('Success.ai proxy error:', error);
    return { status, body: { ok: false, error: error instanceof HttpError ? error.message : 'Unexpected server error.', ...(error.extra || {}) } };
  }
}
