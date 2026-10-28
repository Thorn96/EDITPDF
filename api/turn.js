// Rature · Accès temporaires au relais TURN Cloudflare (téléphone → ordinateur quand le réseau bloque la liaison directe).
// Variables d'environnement Vercel : TURN_KEY_ID et TURN_KEY_API_TOKEN (Cloudflare > Realtime > TURN Server > clé).
// Sans elles : liste vide, la page se contente de la liaison directe. Les documents passent chiffrés de bout en bout, le relais ne les lit pas.
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { TURN_KEY_ID: id, TURN_KEY_API_TOKEN: token } = process.env;
  if (!id || !token) return res.status(200).json({ iceServers: [] });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 7200 }), // 2 h : le temps d'une séance de numérisation
    });
    if (!r.ok) throw new Error('Cloudflare ' + r.status);
    const j = await r.json();
    res.status(200).json({ iceServers: [].concat(j.iceServers || []) }); // un serveur { urls, username, credential } ou une liste
  } catch (e) {
    console.error(e);
    res.status(200).json({ iceServers: [] });
  }
};
