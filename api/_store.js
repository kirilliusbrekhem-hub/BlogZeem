'use strict';
// Storage over the Upstash Redis REST API (Vercel Marketplace: KV_REST_API_URL / KV_REST_API_TOKEN, or Upstash's own names).
// When no storage is configured, store() returns null and callers fall back to soft in-memory limits.
const url = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || process.env.STORE_URL || '';
const token = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || process.env.STORE_TOKEN || '';

function configured() { return !!(url() && token()); }

// Runs commands in one round trip. Each command is an array like ['INCR', 'key'].
async function pipe(cmds) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    const r = await fetch(url().replace(/\/$/, '') + '/pipeline', {
      method: 'POST', signal: ac.signal,
      headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' },
      body: JSON.stringify(cmds)
    });
    if (!r.ok) { const e = new Error('store ' + r.status); e.code = 'store'; throw e; }
    const j = await r.json();
    return j.map((x) => { if (x && x.error) { const e = new Error('store: ' + x.error); e.code = 'store'; throw e; } return x.result; });
  } catch (e) { if (!e.code) e.code = 'store'; throw e; } finally { clearTimeout(timer); }
}

module.exports = { configured, pipe };
