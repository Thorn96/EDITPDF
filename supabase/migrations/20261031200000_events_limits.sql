-- Statistiques : n'importe qui peut ajouter un événement, donc un robot pourrait en envoyer des millions et remplir la base.
-- Sans adresse IP (promise dans la politique de confidentialité), on borne le total : 600 événements par minute pour tout le site,
-- les suivants sont ignorés sans erreur ; et rien n'est gardé plus de 90 jours.
-- ponytail: plafond global, un robot peut priver les vrais visiteurs de statistiques pendant son attaque (pas de fuite ni de panne) ;
--           limite par visiteur via la règle de limitation Cloudflare ou une fonction serveur si ça arrive
create index events_created on public.events (created_at);

-- security definer : le visiteur ne peut pas lire la table (RLS), le comptage doit pourtant tout voir
create function public.events_cap() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.events where created_at > now() - interval '1 minute') >= 600 then
    return null; -- ignoré
  end if;
  return new;
end $$;
revoke execute on function public.events_cap() from public, anon, authenticated;
create trigger events_cap before insert on public.events for each row execute function public.events_cap();

select cron.schedule('rature-purge-events', '45 3 * * *', $purge$
  delete from public.events where created_at < now() - interval '90 days'
$purge$);
