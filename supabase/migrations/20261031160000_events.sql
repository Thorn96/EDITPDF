-- Statistiques d'utilisation (outil choisi, signature créée, téléphone connecté…), sans cookie ni adresse IP.
-- N'importe quelle page peut ajouter un événement ; personne ne peut les relire par l'API (consultation : tableau de bord Supabase).
create table public.events (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  data jsonb check (data is null or pg_column_size(data) < 1000),
  lang text check (lang in ('fr', 'en')),
  created_at timestamptz not null default now()
);
alter table public.events enable row level security;
create policy "tout le monde ajoute un événement" on public.events
  for insert to anon, authenticated with check (true);
