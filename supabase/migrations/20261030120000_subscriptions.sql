-- Rature Sync · état des abonnements. Écrit seulement par la fonction billing (webhook Stripe, clé de service),
-- lu par l'abonné lui-même : aucune écriture possible depuis le navigateur.
create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  customer text not null,                 -- client Stripe (cus_…)
  subscription text not null unique,      -- abonnement Stripe (sub_…)
  status text not null,                   -- statut Stripe : active, trialing, past_due, canceled, unpaid, incomplete…
  plan text,                              -- month | year
  period_end timestamptz,                 -- fin de la période payée
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "chacun lit son abonnement" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Abonné en règle ? Servira aux règles d'accès des données synchronisées.
-- past_due : paiement en échec, Stripe réessaie quelques jours avant de résilier ; on laisse l'accès pendant ce temps.
create function public.is_subscriber() returns boolean
  language sql stable security invoker set search_path = ''
as $$
  select exists (select 1 from public.subscriptions
                 where user_id = (select auth.uid()) and status in ('active', 'trialing', 'past_due'));
$$;
revoke execute on function public.is_subscriber() from public, anon;
grant execute on function public.is_subscriber() to authenticated;
