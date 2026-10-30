// Rature Sync · paiement par Stripe Managed Payments (Stripe vend à la place de Rature et gère la TVA).
//   POST /billing/checkout  { plan: 'month' | 'year', lang? }  → { url } page de paiement Stripe     (utilisateur connecté)
//   POST /billing/portal    { lang? }                          → { url } gérer ou résilier l'abonnement (utilisateur connecté)
//   POST /billing/webhook   événements Stripe signés           → met à jour public.subscriptions
// Secrets (Supabase › Edge Functions › Secrets) : STRIPE_SECRET_KEY (clé restreinte rk_…), STRIPE_WEBHOOK_SECRET (whsec_…),
// STRIPE_PRICE_MONTH et STRIPE_PRICE_YEAR (price_…). SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.
// Déployée sans vérification JWT par Supabase (Stripe n'en envoie pas) : checkout et portal vérifient eux-mêmes l'utilisateur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const SITE = 'https://rature.app', ORIGINS = [SITE, 'http://localhost:8765'];
const ACTIVE = ['active', 'trialing', 'past_due']; // même liste que public.is_subscriber()
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const origin = (req: Request) => { const o = req.headers.get('Origin') ?? ''; return ORIGINS.includes(o) ? o : SITE; };
const cors = (req: Request) => ({
  'Access-Control-Allow-Origin': origin(req), 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
});
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

// API Stripe en formulaire, sans SDK : trois appels suffisent
async function stripe(path: string, params?: Record<string, string>) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: params ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + env('STRIPE_SECRET_KEY'), ...(params && { 'Content-Type': 'application/x-www-form-urlencoded' }) },
    body: params && new URLSearchParams(params),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${path} : ${j.error?.message ?? r.status}`);
  return j;
}

async function currentUser(req: Request) {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user;
}
const subscriptionOf = async (userId: string) =>
  (await admin.from('subscriptions').select('customer, subscription, status').eq('user_id', userId).maybeSingle()).data;

async function checkout(req: Request, user: { id: string; email?: string }) {
  const { plan, lang } = await req.json().catch(() => ({}));
  const price = ({ month: env('STRIPE_PRICE_MONTH'), year: env('STRIPE_PRICE_YEAR') } as Record<string, string>)[plan];
  if (!price) return json(req, { error: 'plan' }, 400);
  const sub = await subscriptionOf(user.id);
  if (sub && ACTIVE.includes(sub.status)) return json(req, { error: 'deja_abonne' }, 409); // pas de second abonnement
  const site = origin(req) + (lang === 'en' ? '/en' : '');
  const s = await stripe('checkout/sessions', {
    mode: 'subscription', 'line_items[0][price]': price, 'line_items[0][quantity]': '1', 'managed_payments[enabled]': 'true',
    client_reference_id: user.id, 'subscription_data[metadata][user_id]': user.id, // retrouver le compte dans le webhook
    ...(sub?.customer ? { customer: sub.customer } : user.email ? { customer_email: user.email } : {}),
    success_url: site + '/?sync=merci', cancel_url: site + (lang === 'en' ? '/pricing/' : '/tarifs/'),
  });
  return json(req, { url: s.url });
}

async function portal(req: Request, user: { id: string }) {
  const { lang } = await req.json().catch(() => ({}));
  const sub = await subscriptionOf(user.id);
  if (!sub) return json(req, { error: 'pas_abonne' }, 404);
  const s = await stripe('billing_portal/sessions', { customer: sub.customer, return_url: origin(req) + (lang === 'en' ? '/en/' : '/') });
  return json(req, { url: s.url });
}

// Signature Stripe : en-tête « t=…,v1=… », HMAC-SHA256 de « t.corps » avec le secret du webhook, moins de 5 minutes
async function verified(req: Request) {
  const secret = env('STRIPE_WEBHOOK_SECRET'), body = await req.text(), sig = req.headers.get('Stripe-Signature') ?? '';
  const t = sig.match(/(?:^|,)t=(\d+)/)?.[1], v1 = [...sig.matchAll(/(?:^|,)v1=([0-9a-f]+)/g)].map(m => m[1]);
  if (!secret || !t || !v1.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return null;
  const enc = new TextEncoder(), key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const same = (a: string) => a.length === mac.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mac.charCodeAt(i)), 0) === 0; // temps constant
  return v1.some(same) ? JSON.parse(body) : null;
}

async function webhook(req: Request) {
  const ev = await verified(req);
  if (!ev) return new Response('signature invalide', { status: 400 });
  const o = ev.data.object;
  let subId: string | undefined, userId: string | undefined;
  if (ev.type === 'checkout.session.completed' && o.mode === 'subscription') [subId, userId] = [o.subscription, o.client_reference_id];
  else if (ev.type.startsWith('customer.subscription.')) [subId, userId] = [o.id, o.metadata?.user_id];
  else return new Response('ignoré');
  if (!subId || !userId) return new Response('sans compte Rature');
  const s = await stripe('subscriptions/' + subId); // état à jour : les événements peuvent arriver dans le désordre
  const old = await subscriptionOf(userId);
  // événement tardif d'un ancien abonnement : il ne doit pas écraser le nouvel abonnement en cours
  if (old && old.subscription !== s.id && ACTIVE.includes(old.status) && !ACTIVE.includes(s.status)) return new Response('ancien abonnement');
  const item = s.items?.data?.[0], end = item?.current_period_end ?? s.current_period_end; // fin de période : sur l'article depuis l'API 2025-03-31
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId, customer: s.customer, subscription: s.id, status: s.status, plan: item?.price?.recurring?.interval ?? null,
    period_end: end ? new Date(end * 1000).toISOString() : null, cancel_at_period_end: !!(s.cancel_at_period_end || s.cancel_at),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error; // Stripe réessaiera
  return new Response('ok');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'méthode' }, 405);
  const route = new URL(req.url).pathname.split('/').pop();
  try {
    if (route === 'webhook') return await webhook(req);
    const user = await currentUser(req);
    if (!user) return json(req, { error: 'connexion' }, 401);
    if (route === 'checkout') return await checkout(req, user);
    if (route === 'portal') return await portal(req, user);
    return json(req, { error: 'route' }, 404);
  } catch (e) {
    console.error(e);
    return json(req, { error: 'serveur' }, 500);
  }
});
