// Rature · Tarif de Rature Sync et pages légales (fr et en), fabriquées par guides/build.js avec le même habillage que les guides.
// Une page = { slug, title, desc, h1, lead, plans?, sections: [[titre, html]] }. Les deux langues dans le même ordre.
const ME = {
  name: 'Léonard Guido', addr: '4 rue Ernest Renan, 12700 Capdenac-Gare, France', siret: '101 401 461 00013', mail: 'contact@rature.app',
  // hébergeur du site : à changer avec l'hébergement (passage chez Cloudflare Pages)
  // médiateur de la consommation (convention signée en octobre 2026, 3 ans renouvelables)
  mediator: 'Société Médiation Professionnelle, Alteritae, 5 rue Salvaing, 12000 Rodez, France', mediatorUrl: 'https://www.mediateur-consommation-smp.fr',
  host: 'Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA (vercel.com)',
};
const UPDATED = { fr: '30 octobre 2026', en: '30 October 2026' };
const mail = `<a href="mailto:${ME.mail}">${ME.mail}</a>`, mediator = `${ME.mediator} (<a href="${ME.mediatorUrl}">mediateur-consommation-smp.fr</a>)`;
// prix TTC (TVA incluse) : mensuel 4,99 €, annuel 49,99 € = 12 mois à 4,99 € (59,88 €) moins 17 %
const PRICE = { month: 4.99, year: 49.99 }, SAVE = Math.round((1 - PRICE.year / (12 * PRICE.month)) * 100);

const fr = [
  {
    slug: 'tarifs', kind: 'pricing',
    title: 'Rature Sync : tes PDF sur tous tes ordinateurs · Tarifs',
    desc: `Rature reste gratuit. Rature Sync synchronise signatures, tampons et documents entre tes ordinateurs, chiffrés de bout en bout : 4,99 € par mois ou 49,99 € par an.`,
    eyebrow: 'Rature Sync', h1: 'Tes documents sur tous tes ordinateurs',
    lead: 'Rature reste gratuit et complet. Rature Sync ajoute un compte pour retrouver tes signatures, tes tampons et tes documents en cours sur chaque ordinateur, chiffrés de bout en bout : personne d’autre que toi ne peut les lire.',
    plans: {
      month: { name: 'Mensuel', price: '4,99 €', per: 'par mois' },
      year: { name: 'Annuel', price: '49,99 €', per: 'par an', note: 'soit 4,17 € par mois', badge: `−${SAVE} % · 2 mois offerts` },
      ttc: 'Prix TTC, TVA incluse.', soon: 'Bientôt disponible',
      perks: ['Signatures, tampons et réglages sur tous tes ordinateurs', 'Documents en cours : tu reprends là où tu t’es arrêté, corrections toujours modifiables',
              'Chiffrement de bout en bout : ni Rature ni l’hébergeur ne peuvent lire tes fichiers', 'Résiliable à tout moment, remboursé sans discussion pendant 14 jours'],
    },
    sections: [
      ['La version gratuite change-t-elle ?', 'Non. Toutes les fonctions de l’éditeur restent gratuites, sans inscription et sans filigrane. Sans compte, tes fichiers ne quittent jamais ton appareil.'],
      ['Qui peut lire mes documents synchronisés ?', 'Personne d’autre que toi. Ils sont chiffrés dans ton navigateur avant d’être envoyés, avec une clé qui ne quitte jamais tes appareils. Pour ouvrir ton compte sur un nouvel ordinateur, tu scannes un QR code avec un appareil déjà connecté, ou tu saisis ta phrase de récupération.'],
      ['Comment résilier ?', 'En quelques clics depuis ton compte, à tout moment. L’abonnement s’arrête à la fin de la période déjà payée. Dans les 14 jours qui suivent ta souscription, tu es remboursé intégralement sur simple demande.'],
      ['Qui encaisse le paiement ?', `Stripe, revendeur officiel de Rature Sync : il encaisse le paiement, émet ta facture et reverse la TVA. Rature ne voit jamais ton numéro de carte. Détails dans les <a href="/cgv/">conditions de vente</a>.`],
    ],
  },
  {
    slug: 'mentions-legales',
    title: 'Mentions légales · Rature', desc: 'Éditeur, hébergement et contact du site Rature (rature.app).',
    h1: 'Mentions légales',
    sections: [
      ['Éditeur', `${ME.name}, entrepreneur individuel (EI)<br>${ME.addr}<br>SIRET : ${ME.siret}<br>Contact : ${mail}<br>Directeur de la publication : ${ME.name}`],
      ['Hébergement', `Site : ${ME.host}.<br>Comptes Rature Sync : Supabase Inc., serveurs situés à Paris (Union européenne).`],
      ['Code source', 'Le code de Rature est public : <a href="https://github.com/Thorn96/EDITPDF">github.com/Thorn96/EDITPDF</a>. Les bibliothèques utilisées gardent leurs propres licences.'],
      ['Médiation de la consommation', `${mediator}.`],
      ['Données personnelles', 'Voir la <a href="/confidentialite/">politique de confidentialité</a>.'],
    ],
  },
  {
    slug: 'confidentialite',
    title: 'Confidentialité · Rature', desc: 'Quelles données Rature traite, où, pourquoi et pour combien de temps. Sans compte, tes fichiers ne quittent jamais ton appareil.',
    h1: 'Politique de confidentialité',
    lead: 'En bref : sans compte, tes fichiers ne quittent jamais ton appareil. Pas de publicité, pas de cookie de pistage, pas de revente de données.',
    sections: [
      ['Responsable du traitement', `${ME.name}, entrepreneur individuel, ${ME.addr}. Contact : ${mail}.`],
      ['Utilisation sans compte', 'Les PDF que tu ouvres sont traités dans ton navigateur et ne sont envoyés nulle part. Tes réglages, signatures, tampons et la sauvegarde automatique de ton travail sont enregistrés dans ton navigateur, sur ton appareil uniquement. Tu peux les effacer à tout moment (menu « Réinitialiser mes préférences », ou en effaçant les données du site dans ton navigateur).'],
      ['Statistiques de visite', 'Nous mesurons la fréquentation sans cookie et sans t’identifier : pages vues, pays, type de navigateur et outils utilisés, comptés de façon agrégée. Cela sert uniquement à améliorer Rature (intérêt légitime).'],
      ['Numériser avec le téléphone', 'La photo passe directement du téléphone à l’ordinateur, chiffrée. Un service de mise en relation (PeerJS) reçoit seulement les identifiants techniques et adresses IP nécessaires pour connecter les deux appareils. Quand le réseau bloque la liaison directe, elle passe par un relais Cloudflare, qui ne peut pas lire son contenu chiffré.'],
      ['Rature Sync (compte payant)', `Nous traitons ton adresse e-mail (connexion), l’état de ton abonnement transmis par Stripe (identifiant client, dates, statut, jamais ton numéro de carte) et tes données synchronisées. Celles-ci (documents, signatures, tampons, réglages) sont chiffrées de bout en bout dans ton navigateur avant l’envoi : ni nous ni l’hébergeur ne pouvons les lire. Base légale : l’exécution du contrat. Hébergement : Supabase, serveurs à Paris. Durée : tant que ton compte existe ; après la fin de l’abonnement, tes données chiffrées sont gardées 30 jours (pour te laisser revenir) puis supprimées. Tu peux tout supprimer immédiatement depuis ton compte ou en écrivant à ${mail}.`],
      ['Prestataires et transferts', 'Hébergement du site (Vercel, États-Unis), relais du téléphone (Cloudflare, États-Unis), paiement (Stripe, Irlande et États-Unis), comptes (Supabase, serveurs dans l’Union européenne). Les transferts hors de l’Union européenne sont encadrés par les garanties prévues par le RGPD (cadre de protection des données UE–États-Unis ou clauses contractuelles types).'],
      ['Cookies', 'Aucun cookie publicitaire ni de mesure d’audience. Avec Rature Sync, un jeton de connexion est gardé dans ton navigateur : il est strictement nécessaire au service.'],
      ['Tes droits', `Tu peux accéder à tes données, les rectifier, les supprimer, les récupérer, t’opposer à un traitement ou le limiter, en écrivant à ${mail}. Tu peux aussi adresser une réclamation à la CNIL (<a href="https://www.cnil.fr">cnil.fr</a>).`],
    ],
  },
  {
    slug: 'cgv',
    title: 'Conditions générales de vente et d’utilisation · Rature', desc: 'Conditions d’utilisation de Rature et conditions de vente de l’abonnement Rature Sync : prix, résiliation, remboursement.',
    h1: 'Conditions générales de vente et d’utilisation',
    sections: [
      ['1. Objet', 'Ces conditions encadrent l’utilisation de Rature, éditeur PDF gratuit accessible sur rature.app, et la vente de l’abonnement payant Rature Sync.'],
      ['2. Prestataire et paiement', `Le service est fourni par ${ME.name}, entrepreneur individuel, ${ME.addr}, SIRET ${ME.siret}, ${mail}. Les paiements sont traités par Stripe, revendeur officiel (« Merchant of Record ») de Rature Sync grâce à son service Managed Payments : il encaisse le paiement, émet la facture et collecte la TVA. Ses conditions d’achat s’appliquent aussi au paiement.`],
      ['3. Rature gratuit', 'L’éditeur est gratuit, sans inscription. Il est fourni en l’état : tu restes responsable de tes documents et de leur usage. Garde toujours une copie de tes fichiers d’origine.'],
      ['4. Rature Sync', 'Rature Sync synchronise entre tes appareils tes signatures, tampons, réglages et documents en cours, chiffrés de bout en bout. Prix TTC : 4,99 € par mois ou 49,99 € par an, TVA incluse. Le prix applicable est celui affiché au moment de la souscription.'],
      ['5. Durée, renouvellement et résiliation', 'L’abonnement se renouvelle automatiquement à la fin de chaque période (mois ou année). Tu peux le résilier à tout moment, en quelques clics depuis ton compte : il s’arrête à la fin de la période déjà payée, sans autre frais. Pour l’abonnement annuel, un e-mail de rappel t’est envoyé avant le renouvellement. En cas de changement de prix, tu es prévenu par e-mail au moins 30 jours à l’avance et tu restes libre de résilier.'],
      ['6. Rétractation et remboursement', `Tu disposes de 14 jours à compter de la souscription pour changer d’avis : sur simple demande à ${mail}, tu es remboursé intégralement, même si tu as déjà utilisé le service. Après ce délai, la période en cours n’est pas remboursée au prorata, mais la résiliation empêche tout nouveau prélèvement.`],
      ['7. Chiffrement et récupération', 'Tes données synchronisées sont chiffrées avec une clé qui ne quitte jamais tes appareils. Si tu perds à la fois tous tes appareils connectés et ta phrase de récupération, personne, pas même Rature, ne peut récupérer ces données.'],
      ['8. Disponibilité et responsabilité', 'Rature fait le nécessaire pour que le service soit disponible et fiable, sans pouvoir garantir une disponibilité permanente (maintenance, pannes). Ces conditions ne limitent pas les garanties légales dont bénéficie le consommateur, notamment la garantie de conformité des contenus et services numériques (articles L224-25-1 et suivants du Code de la consommation).'],
      ['9. Litiges et droit applicable', `Ces conditions sont soumises au droit français. En cas de difficulté, écris d’abord à ${mail} : nous chercherons une solution amiable. Si aucun accord n’est trouvé, ou sans réponse de notre part sous deux mois, le consommateur peut recourir gratuitement au médiateur de la consommation : ${mediator}. La demande se fait en ligne sur son site ou par courrier, en français, dans l’année qui suit la réclamation écrite. Le consommateur peut aussi saisir le tribunal de son lieu de résidence.`],
      ['10. Modification', 'Ces conditions peuvent évoluer. Les abonnés sont prévenus par e-mail de tout changement important avant qu’il ne s’applique.'],
    ],
  },
];

const en = [
  {
    slug: 'pricing', kind: 'pricing',
    title: 'Rature Sync: your PDFs on all your computers · Pricing',
    desc: 'Rature stays free. Rature Sync syncs signatures, stamps and documents across your computers, end-to-end encrypted: €4.99 a month or €49.99 a year.',
    eyebrow: 'Rature Sync', h1: 'Your documents on all your computers',
    lead: 'Rature stays free and complete. Rature Sync adds an account to find your signatures, stamps and work in progress on every computer, end-to-end encrypted: nobody but you can read them.',
    plans: {
      month: { name: 'Monthly', price: '€4.99', per: 'per month' },
      year: { name: 'Yearly', price: '€49.99', per: 'per year', note: 'that is €4.17 a month', badge: `−${SAVE}% · 2 months free` },
      ttc: 'Prices include VAT.', soon: 'Coming soon',
      perks: ['Signatures, stamps and settings on all your computers', 'Work in progress: pick up where you left off, edits still editable',
              'End-to-end encryption: neither Rature nor the host can read your files', 'Cancel anytime, refunded with no questions asked within 14 days'],
    },
    sections: [
      ['Does the free version change?', 'No. Every editor feature stays free, with no sign-up and no watermark. Without an account, your files never leave your device.'],
      ['Who can read my synced documents?', 'Nobody but you. They are encrypted in your browser before they are sent, with a key that never leaves your devices. To use your account on a new computer, you scan a QR code with a device already signed in, or type your recovery phrase.'],
      ['How do I cancel?', 'In a few clicks from your account, at any time. The subscription ends at the end of the period already paid. Within 14 days of subscribing, you get a full refund on request.'],
      ['Who takes the payment?', 'Stripe, the official reseller of Rature Sync: it takes the payment, issues your invoice and pays the VAT. Rature never sees your card number. Details in the <a href="/en/terms/">terms of sale</a>.'],
    ],
  },
  {
    slug: 'legal-notice',
    title: 'Legal notice · Rature', desc: 'Publisher, hosting and contact for the Rature website (rature.app).',
    h1: 'Legal notice',
    sections: [
      ['Publisher', `${ME.name}, sole trader (entrepreneur individuel)<br>${ME.addr}<br>SIRET: ${ME.siret}<br>Contact: ${mail}<br>Publication director: ${ME.name}`],
      ['Hosting', `Website: ${ME.host}.<br>Rature Sync accounts: Supabase Inc., servers in Paris (European Union).`],
      ['Source code', 'Rature’s code is public: <a href="https://github.com/Thorn96/EDITPDF">github.com/Thorn96/EDITPDF</a>. The libraries it uses keep their own licences.'],
      ['Consumer mediation', `${mediator}.`],
      ['Personal data', 'See the <a href="/en/privacy/">privacy policy</a>.'],
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy · Rature', desc: 'What data Rature processes, where, why and for how long. Without an account, your files never leave your device.',
    h1: 'Privacy policy',
    lead: 'In short: without an account, your files never leave your device. No ads, no tracking cookies, no data sold.',
    sections: [
      ['Data controller', `${ME.name}, sole trader, ${ME.addr}. Contact: ${mail}.`],
      ['Using Rature without an account', 'The PDFs you open are processed in your browser and are not sent anywhere. Your settings, signatures, stamps and the autosave of your work are stored in your browser, on your device only. You can erase them at any time (“Reset my preferences”, or by clearing the site data in your browser).'],
      ['Visit statistics', 'We measure traffic without cookies and without identifying you: page views, country, browser type and tools used, counted in aggregate. This is only used to improve Rature (legitimate interest).'],
      ['Scanning with your phone', 'The photo goes straight from the phone to the computer, encrypted. A matchmaking service (PeerJS) only receives the technical identifiers and IP addresses needed to connect the two devices. When the network blocks the direct link, it goes through a Cloudflare relay, which cannot read its encrypted content.'],
      ['Rature Sync (paid account)', `We process your email address (sign-in), your subscription status sent by Stripe (customer ID, dates, status, never your card number) and your synced data. That data (documents, signatures, stamps, settings) is end-to-end encrypted in your browser before it is sent: neither we nor the host can read it. Legal basis: performance of the contract. Hosting: Supabase, servers in Paris. Retention: as long as your account exists; after your subscription ends, your encrypted data is kept for 30 days (so you can come back) and then deleted. You can delete everything immediately from your account or by writing to ${mail}.`],
      ['Providers and transfers', 'Website hosting (Vercel, USA), phone relay (Cloudflare, USA), payment (Stripe, Ireland and USA), accounts (Supabase, servers in the European Union). Transfers outside the European Union are covered by the safeguards provided by the GDPR (EU–US Data Privacy Framework or standard contractual clauses).'],
      ['Cookies', 'No advertising or analytics cookies. With Rature Sync, a sign-in token is kept in your browser: it is strictly necessary for the service.'],
      ['Your rights', `You can access, correct, delete or export your data, object to or restrict its processing, by writing to ${mail}. You can also lodge a complaint with the CNIL, the French data protection authority (<a href="https://www.cnil.fr">cnil.fr</a>).`],
    ],
  },
  {
    slug: 'terms',
    title: 'Terms of sale and use · Rature', desc: 'Terms of use of Rature and terms of sale of the Rature Sync subscription: price, cancellation, refunds.',
    h1: 'Terms of sale and use',
    sections: [
      ['1. Purpose', 'These terms govern the use of Rature, the free PDF editor available at rature.app, and the sale of the paid Rature Sync subscription.'],
      ['2. Provider and payment', `The service is provided by ${ME.name}, sole trader, ${ME.addr}, SIRET ${ME.siret}, ${mail}. Payments are processed by Stripe, the official reseller (“Merchant of Record”) of Rature Sync through its Managed Payments service: it takes the payment, issues the invoice and collects VAT. Its purchase terms also apply to the payment.`],
      ['3. Free Rature', 'The editor is free, with no sign-up. It is provided as is: you remain responsible for your documents and how you use them. Always keep a copy of your original files.'],
      ['4. Rature Sync', 'Rature Sync syncs your signatures, stamps, settings and work in progress between your devices, end-to-end encrypted. Price including VAT: €4.99 a month or €49.99 a year. The applicable price is the one shown when you subscribe.'],
      ['5. Term, renewal and cancellation', 'The subscription renews automatically at the end of each period (month or year). You can cancel at any time, in a few clicks from your account: it ends at the end of the period already paid, with no further charge. For the yearly plan, a reminder email is sent before renewal. If the price changes, you are told by email at least 30 days in advance and remain free to cancel.'],
      ['6. Withdrawal and refunds', `You have 14 days from subscribing to change your mind: on request to ${mail}, you get a full refund, even if you have already used the service. After that, the current period is not refunded pro rata, but cancelling prevents any further charge.`],
      ['7. Encryption and recovery', 'Your synced data is encrypted with a key that never leaves your devices. If you lose both all your signed-in devices and your recovery phrase, nobody, not even Rature, can recover that data.'],
      ['8. Availability and liability', 'Rature does what is needed for the service to be available and reliable, without being able to guarantee permanent availability (maintenance, outages). These terms do not limit the statutory guarantees consumers are entitled to, in particular the conformity guarantee for digital content and services (articles L224-25-1 and following of the French Consumer Code).'],
      ['9. Disputes and governing law', `These terms are governed by French law. If there is a problem, write to ${mail} first: we will look for an amicable solution. If no agreement is reached, or if we have not replied within two months, consumers may refer the dispute free of charge to the consumer mediator: ${mediator}. Requests are made online on its website or by post, in French, within one year of the written complaint. Consumers may also bring the matter before the court of their place of residence.`],
      ['10. Changes', 'These terms may change. Subscribers are told by email about any significant change before it applies.'],
    ],
  },
];
module.exports = { fr, en, UPDATED, PRICE };
