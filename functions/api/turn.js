// Rature · Accès temporaires au relais TURN Cloudflare (téléphone → ordinateur quand le réseau bloque la liaison directe).
// Fonction Cloudflare Pages servie à /api/turn. Variables du projet Pages : TURN_KEY_ID et TURN_KEY_API_TOKEN
// (Cloudflare › Realtime › TURN Server › clé). Sans elles : liste vide, la page se contente de la liaison directe.
// Les documents passent chiffrés de bout en bout, le relais ne les lit pas.
const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export async function onRequest({ env }) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ iceServers: [] });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }), // 2 h : le temps d'une séance de numérisation
    });
    if (!r.ok) throw new Error('Cloudflare ' + r.status);
    const j = await r.json();
    return json({ iceServers: [].concat(j.iceServers || []) }); // un serveur { urls, username, credential } ou une liste
  } catch (e) {
    console.error(e);
    return json({ iceServers: [] });
  }
}
