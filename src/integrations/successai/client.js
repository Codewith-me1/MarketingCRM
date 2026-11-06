import supabase from '../../supabase/supabase';

export class SuccessAiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Calls the server proxy (/api/successai); the Success.ai API key never reaches the browser. */
export async function callSuccessAi(action, params = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  let response;
  try {
    response = await fetch('/api/successai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, params })
    });
  } catch {
    throw new SuccessAiError('Cannot reach the Success.ai proxy. Check your connection.', 0, 'NETWORK');
  }
  const body = await response.json().catch(() => null);
  if (!body) {
    throw new SuccessAiError(response.status === 404
      ? 'The /api/successai endpoint is not deployed. Deploy to Vercel (api/ folder) or run the app with `npm run dev`.'
      : `Unexpected response from the Success.ai proxy (${response.status}).`, response.status, 'NO_PROXY');
  }
  if (!body.ok) throw new SuccessAiError(body.error, response.status, body.code);
  return body.data;
}
