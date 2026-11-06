// Vercel Serverless Function: POST /api/successai  (see server/successai.js)
import { handleSuccessAi } from '../server/successai.js';

export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const result = await handleSuccessAi({
    method: req.method,
    authorization: req.headers.authorization,
    body,
    env: process.env
  });
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}
