// Code serveur de Rature (fonction de paiement, migrations) : rien de secret, mais rien à servir non plus → page 404 du site.
export const onRequest = ({ request, env }) => notFound(request, env);
export const notFound = async (request, env) => new Response((await env.ASSETS.fetch(new URL('/404.html', request.url))).body, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
