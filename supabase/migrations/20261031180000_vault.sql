-- Rature Sync · coffre chiffré : tout ce qui est synchronisé, chiffré de bout en bout dans le navigateur (AES-GCM).
-- Le serveur ne voit que des données illisibles. Une ligne = un élément :
--   check     contrôle de la clé (vérifie le code de récupération saisi sur un nouvel appareil)
--   sig       une signature        stamp   un tampon        prefs   réglages (couleurs favorites, police…)
--   doc       fiche d'un document en cours (nom, date, pièces)    docstate  son contenu (pages, corrections)
--   src       un PDF d'origine (partagé par les documents qui l'utilisent)
-- deleted : élément supprimé sur un appareil (les autres le retirent à leur tour), data vidé.
create table public.vault (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('check', 'sig', 'stamp', 'prefs', 'doc', 'docstate', 'src')),
  id text not null check (char_length(id) between 1 and 80),
  data text not null default '' check (char_length(data) < 40000000),
  size integer generated always as (octet_length(data)) stored,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);
create index vault_changes on public.vault (user_id, updated_at);
alter table public.vault enable row level security;

-- Lecture : ses propres données, même après l'abonnement (le temps de les récupérer). Écriture : abonné en règle.
-- Suppression : toujours possible (« effacer mes données »).
create policy "chacun lit son coffre" on public.vault for select to authenticated
  using (user_id = (select auth.uid()));
create policy "un abonné ajoute dans son coffre" on public.vault for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_subscriber()));
create policy "un abonné modifie son coffre" on public.vault for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_subscriber()))
  with check (user_id = (select auth.uid()) and (select public.is_subscriber()));
create policy "chacun vide son coffre" on public.vault for delete to authenticated
  using (user_id = (select auth.uid()));

-- Date de modification donnée par le serveur (les appareils récupèrent ce qui a changé depuis leur dernier passage)
create function public.vault_touch() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger vault_touch before insert or update on public.vault for each row execute function public.vault_touch();

-- Place par compte : 200 Mo de données chiffrées
create function public.vault_quota() returns trigger language plpgsql set search_path = '' as $$
begin
  if (select coalesce(sum(size), 0) from public.vault where user_id = new.user_id and not (kind = new.kind and id = new.id))
     + octet_length(new.data) > 200 * 1024 * 1024 then
    raise exception 'quota' using errcode = 'P0001', hint = 'Espace Rature Sync plein (200 Mo)';
  end if;
  return new;
end $$;
create trigger vault_quota before insert or update on public.vault for each row execute function public.vault_quota();

-- 30 jours après la fin de l'abonnement, les données chiffrées sont effacées (CGV, politique de confidentialité)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('rature-purge-vault', '30 3 * * *', $purge$
  delete from public.vault v
  where not exists (select 1 from public.subscriptions s
                    where s.user_id = v.user_id
                      and (s.status in ('active', 'trialing', 'past_due') or s.period_end > now() - interval '30 days'))
$purge$);
