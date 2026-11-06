// guides/ : seuls la feuille de style et le script de la zone de dépôt servent au site ; les scripts de fabrication (build.js, legal.js, en.js) restent invisibles.
import { notFound } from '../supabase/[[path]].js';
export const onRequest = ({ request, env, next }) => { const p = new URL(request.url).pathname; return p.endsWith('.css') || p === '/guides/drop.js' ? next() : notFound(request, env); };
