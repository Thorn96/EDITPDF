// guides/ : seule la feuille de style sert au site ; les scripts de fabrication (build.js, legal.js, en.js) restent invisibles.
import { notFound } from '../supabase/[[path]].js';
export const onRequest = ({ request, env, next }) => new URL(request.url).pathname.endsWith('.css') ? next() : notFound(request, env);
