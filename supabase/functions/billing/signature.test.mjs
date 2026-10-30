// Vérifie la signature des webhooks Stripe (verified() de index.ts) : node supabase/functions/billing/signature.test.mjs
import fs from 'fs'; import { createHmac } from 'crypto';
const src = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const fn = src.slice(src.indexOf('async function verified'), src.indexOf('async function webhook'))
  .replace('(req: Request)', '(req)').replace(/: string\)/g, ')');
const SECRET = 'whsec_test_local';
const env = k => k === 'STRIPE_WEBHOOK_SECRET' ? SECRET : '';
const verified = new Function('env', 'TextEncoder', 'crypto', `${fn}; return verified;`)(env, TextEncoder, globalThis.crypto);
const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } }), t = Math.floor(Date.now() / 1000);
const sign = (ts, b, s = SECRET) => createHmac('sha256', s).update(`${ts}.${b}`).digest('hex');
const req = sig => ({ text: async () => body, headers: { get: () => sig } });
const ok = async (name, sig, expect) => { const r = !!(await verified(req(sig))); console.log((r === expect ? '✓' : '✗ ÉCHEC'), name, '→', r ? 'accepté' : 'refusé'); if (r !== expect) process.exitCode = 1; };
await ok('signature valide', `t=${t},v1=${sign(t, body)}`, true);
await ok('valide parmi plusieurs v1 (rotation du secret)', `t=${t},v1=${'0'.repeat(64)},v1=${sign(t, body)}`, true);
await ok('mauvais secret', `t=${t},v1=${sign(t, body, 'whsec_autre')}`, false);
await ok('corps modifié', `t=${t},v1=${sign(t, body + ' ')}`, false);
await ok('trop vieille (10 min)', `t=${t - 600},v1=${sign(t - 600, body)}`, false);
await ok('sans t=', `v1=${sign(t, body)}`, false);
