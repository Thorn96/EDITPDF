-- Stripe envoie checkout.session.completed et customer.subscription.created au même instant : deux écritures simultanées.
-- L'upsert sur user_id (clé primaire) les absorbe ; la contrainte d'unicité sur subscription en faisait échouer une (erreur 23505).
alter table public.subscriptions drop constraint subscriptions_subscription_key;
