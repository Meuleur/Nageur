-- CH1 — Jeu de données de test (dev/staging uniquement, jamais en production).
-- Couvre : 1 super admin, 2 coachs, 4 nageurs (dont un sans coach),
-- des séances aux 4 statuts, des séries et des auto-évaluations.
-- UUID fixes → seed reproductible ; inserts idempotents (on conflict do nothing).
-- Mot de passe commun de dev : Password123!

-- ---------------------------------------------------------------------------
-- Comptes auth (Supabase Auth).
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin@nageur.test',      extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'camille.coach@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'alex.coach@nageur.test',    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'lea.nageur@nageur.test',    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'noah.nageur@nageur.test',   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'emma.nageur@nageur.test',   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'lucas.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  -- Comptes E2E CH3 (profil) : un couple avec/sans coach PAR PROJET Playwright,
  -- sans profil sportif seedé (le parcours E-11 le crée ; global-setup le purge).
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'mia.nageur@nageur.test',    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'tom.nageur@nageur.test',    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'zoe.nageur@nageur.test',    extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'theo.nageur@nageur.test',   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profils applicatifs. Les coachs d'abord (le trigger d'affectation vérifie
-- que la cible de coach_id a déjà le rôle coach).
-- ---------------------------------------------------------------------------
insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('10000000-0000-4000-8000-000000000001', 'super_admin', 'Dominique', 'Admin',  'admin@nageur.test',         null),
  ('20000000-0000-4000-8000-000000000001', 'coach',       'Camille',   'Durand', 'camille.coach@nageur.test', null),
  ('20000000-0000-4000-8000-000000000002', 'coach',       'Alex',      'Martin', 'alex.coach@nageur.test',    null)
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('30000000-0000-4000-8000-000000000001', 'nageur', 'Léa',   'Petit',   'lea.nageur@nageur.test',   '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002', 'nageur', 'Noah',  'Bernard', 'noah.nageur@nageur.test',  '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000003', 'nageur', 'Emma',  'Roux',    'emma.nageur@nageur.test',  '20000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000004', 'nageur', 'Lucas', 'Moreau',  'lucas.nageur@nageur.test', null), -- nageur sans coach (RG-13)
  -- Comptes E2E CH3 (profil) — pas de ligne swimmer_profiles seedée.
  ('30000000-0000-4000-8000-000000000005', 'nageur', 'Mia',   'Lefevre',  'mia.nageur@nageur.test',  '20000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000006', 'nageur', 'Tom',   'Garcia',   'tom.nageur@nageur.test',   null), -- sans coach (RG-13)
  ('30000000-0000-4000-8000-000000000007', 'nageur', 'Zoé',   'Lambert',  'zoe.nageur@nageur.test',  '20000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000008', 'nageur', 'Théo',  'Fontaine', 'theo.nageur@nageur.test',  null) -- sans coach (RG-13)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Profils sportifs.
-- ---------------------------------------------------------------------------
insert into public.swimmer_profiles (nageur_id, niveau, frequence, duree, bassin, objectifs, materiel) values
  ('30000000-0000-4000-8000-000000000001', 'intermediaire', 3, 60, 25, array['endurance', 'technique']::public.objectif[],            array['pull_buoy', 'planche']::public.materiel[]),
  ('30000000-0000-4000-8000-000000000002', 'debutant',      2, 45, 25, array['perte_poids', 'loisir']::public.objectif[],             array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000003', 'competition',   5, 90, 50, array['competition', 'endurance']::public.objectif[],          array['plaquettes', 'pull_buoy', 'palmes']::public.materiel[]),
  ('30000000-0000-4000-8000-000000000004', 'confirme',      4, 75, 50, array['technique']::public.objectif[],                         array['tuba']::public.materiel[])
on conflict (nageur_id) do nothing;

-- ---------------------------------------------------------------------------
-- Disponibilités (grille jour 1..7 × moment).
-- ---------------------------------------------------------------------------
insert into public.swimmer_availabilities (nageur_id, jour, moment) values
  ('30000000-0000-4000-8000-000000000001', 1, 'matin'),
  ('30000000-0000-4000-8000-000000000001', 3, 'soir'),
  ('30000000-0000-4000-8000-000000000001', 6, 'matin'),
  ('30000000-0000-4000-8000-000000000002', 2, 'midi'),
  ('30000000-0000-4000-8000-000000000002', 4, 'soir'),
  ('30000000-0000-4000-8000-000000000003', 1, 'soir'),
  ('30000000-0000-4000-8000-000000000003', 5, 'matin'),
  ('30000000-0000-4000-8000-000000000003', 7, 'matin'),
  ('30000000-0000-4000-8000-000000000004', 2, 'matin')
on conflict (nageur_id, jour, moment) do nothing;

-- ---------------------------------------------------------------------------
-- Séances — les 4 statuts (A3). processed_at nul tant que en_attente.
-- ---------------------------------------------------------------------------
insert into public.seances
  (id, nageur_id, coach_id, statut, echauffement_distance_m, echauffement_consignes,
   retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min,
   commentaire_coach, fournisseur_llm, tokens, generated_at, processed_at)
values
  -- s1 : Léa, en attente chez Camille
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'en_attente', 300, 'Nage libre souple, 50 m jambes planche.', 200, 'Dos très souple, respiration ample.',
   1300, 60, null, 'anthropic', 1240, now() - interval '1 day', null),
  -- s2 : Léa, validée par Camille
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
   'validee', 400, 'Échauffement progressif, 100 m éducatifs.', 200, 'Brasse souple.',
   1400, 60, 'Bonne progression, garde un rythme régulier sur les 100 m.', 'anthropic', 1180,
   now() - interval '7 days', now() - interval '6 days'),
  -- s3 : Noah, modifiée puis validée par Camille
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001',
   'modifiee', 200, 'Crawl très progressif.', 100, 'Nage au choix, relâchement.',
   800, 45, 'J''ai réduit la distance des séries pour rester sur du confort.', 'openai', 980,
   now() - interval '5 days', now() - interval '4 days'),
  -- s4 : Emma, refusée par Alex (commentaire obligatoire, RG-29)
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002',
   'refusee', 600, 'Quatre nages progressif.', 300, 'Souplesse, travail de respiration.',
   2900, 90, 'Trop intense cette semaine après ta compétition, on repart sur une base plus légère.', 'anthropic', 1430,
   now() - interval '3 days', now() - interval '2 days'),
  -- s5 : Emma, en attente chez Alex
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002',
   'en_attente', 400, 'Crawl + éducatifs plaquettes.', 200, 'Dos souple.',
   2200, 75, null, 'anthropic', 1320, now() - interval '12 hours', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Séries (distances multiples de 25).
-- ---------------------------------------------------------------------------
insert into public.series (id, seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne) values
  ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 4, 100, 'crawl', 30, 'Allure régulière, respiration 3 temps.'),
  ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 8, 50, 'dos', 20, 'Travail de roulis.'),
  ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 1, 6, 100, 'crawl', 30, 'Négative split : seconde moitié plus rapide.'),
  ('41000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', 2, 4, 50, 'brasse', 25, 'Glisse longue.'),
  ('41000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000003', 1, 10, 50, 'crawl', 30, 'Focus amplitude, compte tes coups de bras.'),
  ('41000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000004', 1, 8, 200, 'quatre_nages', 45, 'Enchaînement complet, allure soutenue.'),
  ('41000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000004', 2, 8, 50, 'papillon', 30, 'Technique ondulation.'),
  ('41000000-0000-4000-8000-000000000008', '40000000-0000-4000-8000-000000000005', 1, 8, 100, 'crawl', 30, 'Plaquettes, appuis fermes.'),
  ('41000000-0000-4000-8000-000000000009', '40000000-0000-4000-8000-000000000005', 2, 8, 100, 'dos', 30, 'Souplesse épaules.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Auto-évaluations (une par séance utilisable, RG-34).
-- ---------------------------------------------------------------------------
insert into public.auto_evaluations (id, seance_id, nageur_id, ressenti, difficulte, commentaire) values
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 4, 6, 'Bien passé, dernière série un peu dure.'),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 2, 8, 'Très fatigué, j''ai écourté la récupération.')
on conflict (seance_id) do nothing;

-- ---------------------------------------------------------------------------
-- Fournisseurs LLM — un seul actif (RG-38). Clés factices, jamais de vraie clé
-- dans le dépôt (chiffrement réel géré côté serveur, ADR-007).
-- ---------------------------------------------------------------------------
insert into public.llm_providers (id, fournisseur, api_key_encrypted, modele, is_active) values
  ('60000000-0000-4000-8000-000000000001', 'anthropic', 'SEED_FAKE_CIPHERTEXT_ANTHROPIC', 'claude-sonnet-4-6', true),
  ('60000000-0000-4000-8000-000000000002', 'openai',    'SEED_FAKE_CIPHERTEXT_OPENAI',    'gpt-4o',            false)
on conflict (fournisseur) do nothing;

-- CH4 : clés factices enregistrées via Vault (set_llm_api_key remplace le
-- placeholder par l'id du secret chiffré). Déchiffrables en dev/CI, sans
-- valeur réelle — la vraie clé s'injecte avec `pnpm llm:set-key` (CH4) puis
-- via l'UI Super Admin (CH8). Idempotent : rotation du même secret au rejeu.
select public.set_llm_api_key('anthropic', 'sk-ant-seed-cle-factice');
select public.set_llm_api_key('openai',    'sk-seed-cle-factice');

-- ---------------------------------------------------------------------------
-- Journal d'audit (léger, sans données personnelles).
-- ---------------------------------------------------------------------------
insert into public.audit_log (id, event_type, actor_id, metadata) values
  ('70000000-0000-4000-8000-000000000001', 'seed.applied', null, '{"env": "dev"}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CH5 — Comptes et séances E2E (parcours nageur, E-12 à E-15).
-- Un compte par test ET par projet Playwright (OTP à usage unique + anti-spam
-- 60 s). Tous affectés à un coach dédié (Sacha) pour ne pas toucher aux
-- contextes RLS de Camille/Alex dans les tests pgTAP.
--   * Inès / Eva    : génération nominale (E-12) — aucune séance seedée,
--     global-setup purge celles créées par les tests.
--   * Maël / Yanis  : refus → régénération (E-14/PN-8) — une séance refusée.
--   * Jade / Lina   : liste + filtre + en attente non utilisable (E-13) —
--     les 4 statuts ; tests en lecture seule.
--   * Louis / Hugo  : détail utilisable + auto-évaluation (E-14/E-15) — une
--     séance validée ; global-setup purge leurs auto-évaluations.
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'sacha.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'ines.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'eva.nageur@nageur.test',   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'mael.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'yanis.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'jade.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'lina.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'louis.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'hugo.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('20000000-0000-4000-8000-000000000003', 'coach', 'Sacha', 'Royer', 'sacha.coach@nageur.test', null)
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('30000000-0000-4000-8000-000000000009', 'nageur', 'Inès',  'Marchand', 'ines.nageur@nageur.test',  '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000010', 'nageur', 'Eva',   'Perrot',   'eva.nageur@nageur.test',   '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000011', 'nageur', 'Maël',  'Girard',   'mael.nageur@nageur.test',  '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000012', 'nageur', 'Yanis', 'Dupuis',   'yanis.nageur@nageur.test', '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000013', 'nageur', 'Jade',  'Leroy',    'jade.nageur@nageur.test',  '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000014', 'nageur', 'Lina',  'Besson',   'lina.nageur@nageur.test',  '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000015', 'nageur', 'Louis', 'Carlier',  'louis.nageur@nageur.test', '20000000-0000-4000-8000-000000000003'),
  ('30000000-0000-4000-8000-000000000016', 'nageur', 'Hugo',  'Renard',   'hugo.nageur@nageur.test',  '20000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- Profils sportifs complets (RG-17) — la génération E2E doit être possible.
insert into public.swimmer_profiles (nageur_id, niveau, frequence, duree, bassin, objectifs, materiel) values
  ('30000000-0000-4000-8000-000000000009', 'intermediaire', 3, 60, 25, array['endurance', 'technique']::public.objectif[], array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000010', 'debutant',      2, 45, 25, array['loisir']::public.objectif[],                  array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000011', 'confirme',      4, 60, 50, array['technique']::public.objectif[],               array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000012', 'intermediaire', 3, 45, 25, array['endurance']::public.objectif[],               array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000013', 'intermediaire', 3, 60, 25, array['endurance']::public.objectif[],               array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000014', 'confirme',      4, 75, 50, array['competition']::public.objectif[],             array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000015', 'intermediaire', 3, 60, 25, array['technique', 'endurance']::public.objectif[],  array[]::public.materiel[]),
  ('30000000-0000-4000-8000-000000000016', 'debutant',      2, 45, 25, array['perte_poids']::public.objectif[],             array[]::public.materiel[])
on conflict (nageur_id) do nothing;

insert into public.seances
  (id, nageur_id, coach_id, statut, echauffement_distance_m, echauffement_consignes,
   retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min,
   commentaire_coach, fournisseur_llm, tokens, generated_at, processed_at)
values
  -- Maël / Yanis : séance refusée (commentaire obligatoire RG-29, test PN-8).
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000003',
   'refusee', 300, 'Crawl souple.', 200, 'Dos souple.', 1500, 60,
   'Trop de volume cette semaine, on repart sur plus léger.', 'anthropic', 1200,
   now() - interval '2 days', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003',
   'refusee', 200, 'Brasse souple.', 100, 'Nage au choix.', 1100, 45,
   'On revoit la technique avant d''enchaîner ce type de séance.', 'openai', 950,
   now() - interval '2 days', now() - interval '1 day'),
  -- Jade : les 4 statuts (filtre E-13).
  ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003',
   'en_attente', 300, 'Échauffement crawl progressif.', 200, 'Dos très souple.', 1500, 60,
   null, 'anthropic', 1180, now() - interval '2 hours', null),
  ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003',
   'validee', 400, 'Crawl + éducatifs.', 200, 'Brasse souple.', 1400, 60,
   'Très bonne base, continue comme ça.', 'anthropic', 1210,
   now() - interval '9 days', now() - interval '8 days'),
  ('40000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003',
   'modifiee', 200, 'Crawl très progressif.', 100, 'Relâchement.', 900, 45,
   'J''ai allégé le corps de séance.', 'openai', 990,
   now() - interval '6 days', now() - interval '5 days'),
  ('40000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003',
   'refusee', 400, 'Quatre nages progressif.', 200, 'Souplesse.', 2400, 75,
   'Séance trop intense pour cette semaine, on allège la prochaine.', 'anthropic', 1350,
   now() - interval '4 days', now() - interval '3 days'),
  -- Lina : les 4 statuts (filtre E-13, projet mobile).
  ('40000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003',
   'en_attente', 400, 'Crawl progressif.', 200, 'Dos souple.', 2100, 75,
   null, 'anthropic', 1290, now() - interval '3 hours', null),
  ('40000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003',
   'validee', 400, 'Crawl progressif.', 200, 'Dos souple.', 2200, 75,
   'Belle régularité.', 'anthropic', 1320,
   now() - interval '10 days', now() - interval '9 days'),
  ('40000000-0000-4000-8000-000000000014', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003',
   'modifiee', 300, 'Échauffement au choix.', 100, 'Relâchement complet.', 1400, 60,
   'Volume réduit après ta compétition.', 'openai', 1010,
   now() - interval '7 days', now() - interval '6 days'),
  ('40000000-0000-4000-8000-000000000015', '30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003',
   'refusee', 400, 'Quatre nages.', 200, 'Souplesse, respiration.', 2600, 90,
   'Trop long cette semaine, on repartira sur plus court.', 'anthropic', 1400,
   now() - interval '5 days', now() - interval '4 days'),
  -- Louis / Hugo : séance validée complète (détail E-14 + auto-évaluation E-15).
  ('40000000-0000-4000-8000-000000000016', '30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000003',
   'validee', 400, 'Crawl progressif + éducatifs.', 200, 'Dos très souple, respiration ample.', 1400, 60,
   'Belle séance, garde le rythme sur les cent mètres.', 'anthropic', 1150,
   now() - interval '2 days', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000017', '30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000003',
   'validee', 200, 'Échauffement nage libre.', 100, 'Nage au choix, relâchement.', 1000, 45,
   'Bon volume pour reprendre en douceur.', 'anthropic', 980,
   now() - interval '2 days', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.series (id, seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne) values
  ('41000000-0000-4000-8000-000000000010', '40000000-0000-4000-8000-000000000006', 1, 10, 100, 'crawl', 30, 'Allure régulière.'),
  ('41000000-0000-4000-8000-000000000011', '40000000-0000-4000-8000-000000000007', 1, 8, 100, 'crawl', 30, 'Respiration 3 temps.'),
  ('41000000-0000-4000-8000-000000000012', '40000000-0000-4000-8000-000000000008', 1, 10, 100, 'crawl', 30, 'Respiration 3 temps.'),
  ('41000000-0000-4000-8000-000000000013', '40000000-0000-4000-8000-000000000009', 1, 6, 100, 'crawl', 30, 'Allure régulière.'),
  ('41000000-0000-4000-8000-000000000014', '40000000-0000-4000-8000-000000000009', 2, 4, 50, 'brasse', 25, 'Glisse longue.'),
  ('41000000-0000-4000-8000-000000000015', '40000000-0000-4000-8000-000000000010', 1, 6, 100, 'dos', 30, 'Souplesse épaules.'),
  ('41000000-0000-4000-8000-000000000016', '40000000-0000-4000-8000-000000000011', 1, 6, 300, 'quatre_nages', 45, 'Enchaînement complet.'),
  ('41000000-0000-4000-8000-000000000017', '40000000-0000-4000-8000-000000000012', 1, 15, 100, 'crawl', 30, 'Allure régulière.'),
  ('41000000-0000-4000-8000-000000000018', '40000000-0000-4000-8000-000000000013', 1, 12, 100, 'crawl', 30, 'Négative split.'),
  ('41000000-0000-4000-8000-000000000019', '40000000-0000-4000-8000-000000000013', 2, 8, 50, 'papillon', 30, 'Technique ondulation.'),
  ('41000000-0000-4000-8000-000000000020', '40000000-0000-4000-8000-000000000014', 1, 10, 100, 'quatre_nages', 40, 'Enchaînement souple.'),
  ('41000000-0000-4000-8000-000000000021', '40000000-0000-4000-8000-000000000015', 1, 10, 200, 'crawl', 30, 'Allure soutenue.'),
  ('41000000-0000-4000-8000-000000000022', '40000000-0000-4000-8000-000000000016', 1, 6, 100, 'crawl', 30, 'Allure régulière, négative split.'),
  ('41000000-0000-4000-8000-000000000023', '40000000-0000-4000-8000-000000000016', 2, 4, 50, 'brasse', 25, 'Glisse longue.'),
  ('41000000-0000-4000-8000-000000000024', '40000000-0000-4000-8000-000000000017', 1, 5, 100, 'crawl', 35, 'Respiration tous les 3 mouvements.'),
  ('41000000-0000-4000-8000-000000000025', '40000000-0000-4000-8000-000000000017', 2, 4, 50, 'dos', 30, 'Épaules relâchées.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CH6 — Comptes et séances E2E (parcours coach, E-20 à E-24).
-- Un COACH par test ET par projet Playwright (OTP à usage unique + anti-spam
-- 60 s) ; chaque coach suit son propre nageur pour ne toucher ni aux comptes
-- CH5 (coach Sacha) ni aux contextes pgTAP de Camille/Alex.
--   * Rémi / Lucie  : tableau de bord + valider (T2) + isolation inter-coach
--     — nageur avec une séance en_attente (remise à zéro par reseed_ch6_e2e).
--   * David / Sara  : modifier puis valider (T3, E-23) — une séance
--     en_attente à deux séries (remise à zéro par reseed_ch6_e2e).
--   * Marc / Nina   : refuser (T4, RG-29) — une séance en_attente (remise à
--     zéro par reseed_ch6_e2e).
--   * Iris / Loïc   : mes nageurs + historique + auto-évaluations (E-24) —
--     un nageur avec profil complet et séances validée/modifiée/refusée,
--     tests en lecture seule.
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'remi.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'lucie.coach@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'david.coach@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'sara.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'marc.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'nina.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'iris.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'loic.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'anna.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000018', 'authenticated', 'authenticated', 'elio.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000019', 'authenticated', 'authenticated', 'maya.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', 'nino.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000021', 'authenticated', 'authenticated', 'leon.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000022', 'authenticated', 'authenticated', 'rose.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000023', 'authenticated', 'authenticated', 'timo.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000024', 'authenticated', 'authenticated', 'cleo.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('20000000-0000-4000-8000-000000000004', 'coach', 'Rémi',  'Caron',  'remi.coach@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000005', 'coach', 'Lucie', 'Munoz',  'lucie.coach@nageur.test', null),
  ('20000000-0000-4000-8000-000000000006', 'coach', 'David', 'Lopez',  'david.coach@nageur.test', null),
  ('20000000-0000-4000-8000-000000000007', 'coach', 'Sara',  'Blanc',  'sara.coach@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000008', 'coach', 'Marc',  'Henry',  'marc.coach@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000009', 'coach', 'Nina',  'Joly',   'nina.coach@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000010', 'coach', 'Iris',  'Morel',  'iris.coach@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000011', 'coach', 'Loïc',  'Devaux', 'loic.coach@nageur.test',  null)
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('30000000-0000-4000-8000-000000000017', 'nageur', 'Anna', 'Faure', 'anna.nageur@nageur.test', '20000000-0000-4000-8000-000000000004'),
  ('30000000-0000-4000-8000-000000000018', 'nageur', 'Élio', 'Brun',  'elio.nageur@nageur.test', '20000000-0000-4000-8000-000000000005'),
  ('30000000-0000-4000-8000-000000000019', 'nageur', 'Maya', 'Robin', 'maya.nageur@nageur.test', '20000000-0000-4000-8000-000000000006'),
  ('30000000-0000-4000-8000-000000000020', 'nageur', 'Nino', 'Costa', 'nino.nageur@nageur.test', '20000000-0000-4000-8000-000000000007'),
  ('30000000-0000-4000-8000-000000000021', 'nageur', 'Léon', 'Pages', 'leon.nageur@nageur.test', '20000000-0000-4000-8000-000000000008'),
  ('30000000-0000-4000-8000-000000000022', 'nageur', 'Rose', 'Vidal', 'rose.nageur@nageur.test', '20000000-0000-4000-8000-000000000009'),
  ('30000000-0000-4000-8000-000000000023', 'nageur', 'Timo', 'Adam',  'timo.nageur@nageur.test', '20000000-0000-4000-8000-000000000010'),
  ('30000000-0000-4000-8000-000000000024', 'nageur', 'Cléo', 'Bodin', 'cleo.nageur@nageur.test', '20000000-0000-4000-8000-000000000011')
on conflict (id) do nothing;

-- Profils sportifs des nageurs consultés en E-24 (Timo / Cléo).
insert into public.swimmer_profiles (nageur_id, niveau, frequence, duree, bassin, objectifs, materiel) values
  ('30000000-0000-4000-8000-000000000023', 'confirme',      3, 60, 25, array['technique', 'endurance']::public.objectif[], array['pull_buoy']::public.materiel[]),
  ('30000000-0000-4000-8000-000000000024', 'intermediaire', 2, 45, 50, array['loisir']::public.objectif[],                  array[]::public.materiel[])
on conflict (nageur_id) do nothing;

insert into public.swimmer_availabilities (nageur_id, jour, moment) values
  ('30000000-0000-4000-8000-000000000023', 2, 'soir'),
  ('30000000-0000-4000-8000-000000000023', 6, 'matin'),
  ('30000000-0000-4000-8000-000000000024', 3, 'midi')
on conflict (nageur_id, jour, moment) do nothing;

-- Historique en lecture seule d'Iris/Timo et Loïc/Cléo (E-24) : une séance
-- par statut terminal + auto-évaluation sur la validée (RG-35).
insert into public.seances
  (id, nageur_id, coach_id, statut, echauffement_distance_m, echauffement_consignes,
   retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min,
   commentaire_coach, fournisseur_llm, tokens, generated_at, processed_at)
values
  ('40000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000010',
   'validee', 300, 'Crawl progressif.', 200, 'Dos souple.', 1300, 60,
   'Très bonne base, continue.', 'anthropic', 1100,
   now() - interval '8 days', now() - interval '7 days'),
  ('40000000-0000-4000-8000-000000000025', '30000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000010',
   'modifiee', 200, 'Échauffement au choix.', 100, 'Relâchement.', 900, 45,
   'J''ai allégé la séance après ta semaine chargée.', 'openai', 940,
   now() - interval '5 days', now() - interval '4 days'),
  ('40000000-0000-4000-8000-000000000026', '30000000-0000-4000-8000-000000000023', '20000000-0000-4000-8000-000000000010',
   'refusee', 400, 'Quatre nages progressif.', 200, 'Souplesse.', 2200, 75,
   'Trop intense cette semaine, on repart sur plus léger.', 'anthropic', 1280,
   now() - interval '2 days', now() - interval '1 day'),
  ('40000000-0000-4000-8000-000000000027', '30000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000011',
   'validee', 200, 'Brasse souple.', 100, 'Nage au choix.', 900, 45,
   'Bon volume de reprise.', 'anthropic', 920,
   now() - interval '8 days', now() - interval '7 days'),
  ('40000000-0000-4000-8000-000000000028', '30000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000011',
   'modifiee', 200, 'Crawl très progressif.', 100, 'Relâchement.', 800, 45,
   'Volume réduit pour la reprise.', 'openai', 900,
   now() - interval '5 days', now() - interval '4 days'),
  ('40000000-0000-4000-8000-000000000029', '30000000-0000-4000-8000-000000000024', '20000000-0000-4000-8000-000000000011',
   'refusee', 300, 'Crawl souple.', 100, 'Dos souple.', 1200, 60,
   'On revoit d''abord la technique ensemble.', 'anthropic', 1010,
   now() - interval '2 days', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.series (id, seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne) values
  ('41000000-0000-4000-8000-000000000026', '40000000-0000-4000-8000-000000000024', 1, 8, 100, 'crawl', 30, 'Allure régulière.'),
  ('41000000-0000-4000-8000-000000000027', '40000000-0000-4000-8000-000000000025', 1, 6, 100, 'dos', 30, 'Souplesse épaules.'),
  ('41000000-0000-4000-8000-000000000028', '40000000-0000-4000-8000-000000000026', 1, 8, 200, 'quatre_nages', 45, 'Enchaînement complet.'),
  ('41000000-0000-4000-8000-000000000029', '40000000-0000-4000-8000-000000000027', 1, 6, 100, 'crawl', 35, 'Respiration 3 temps.'),
  ('41000000-0000-4000-8000-000000000030', '40000000-0000-4000-8000-000000000028', 1, 5, 100, 'crawl', 30, 'Amplitude.'),
  ('41000000-0000-4000-8000-000000000031', '40000000-0000-4000-8000-000000000029', 1, 8, 100, 'crawl', 30, 'Allure soutenue.')
on conflict (id) do nothing;

insert into public.auto_evaluations (id, seance_id, nageur_id, ressenti, difficulte, commentaire) values
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000024', '30000000-0000-4000-8000-000000000023', 4, 6, 'Très bonne séance, fin un peu dure.'),
  ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000027', '30000000-0000-4000-8000-000000000024', 3, 5, 'Reprise correcte.')
on conflict (seance_id) do nothing;

-- ---------------------------------------------------------------------------
-- reseed_ch6_e2e — remet à zéro les séances CONSOMMÉES par les tests E2E
-- coach (valider / modifier / refuser) : le trigger seances_statut_terminal
-- interdit tout retour à en_attente (RG-30), on supprime donc et on
-- réinsère (les séries suivent par cascade). Outillage de dev/CI uniquement,
-- appelé par le global-setup Playwright (rôle postgres local) et par le seed
-- lui-même ; aucun GRANT — jamais exposé aux rôles applicatifs.
-- ---------------------------------------------------------------------------
create or replace function public.reseed_ch6_e2e() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.seances where id in (
    '40000000-0000-4000-8000-000000000018',
    '40000000-0000-4000-8000-000000000019',
    '40000000-0000-4000-8000-000000000020',
    '40000000-0000-4000-8000-000000000021',
    '40000000-0000-4000-8000-000000000022',
    '40000000-0000-4000-8000-000000000023');

  insert into public.seances
    (id, nageur_id, coach_id, statut, echauffement_distance_m, echauffement_consignes,
     retour_calme_distance_m, retour_calme_consignes, distance_totale_m, duree_estimee_min,
     commentaire_coach, fournisseur_llm, tokens, generated_at, processed_at)
  values
    -- Anna / Élio : tableau de bord + valider (T2).
    ('40000000-0000-4000-8000-000000000018', '30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000004',
     'en_attente', 300, 'Crawl progressif, amplitude.', 200, 'Dos très souple.', 1300, 60,
     null, 'anthropic', 1150, now() - interval '6 hours', null),
    ('40000000-0000-4000-8000-000000000019', '30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000005',
     'en_attente', 300, 'Nage libre souple.', 200, 'Brasse souple.', 1300, 60,
     null, 'anthropic', 1170, now() - interval '6 hours', null),
    -- Maya / Nino : modifier puis valider (T3) — deux séries à éditer.
    ('40000000-0000-4000-8000-000000000020', '30000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000006',
     'en_attente', 300, 'Crawl progressif.', 200, 'Dos souple.', 1200, 60,
     null, 'anthropic', 1230, now() - interval '5 hours', null),
    ('40000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000007',
     'en_attente', 300, 'Crawl progressif.', 200, 'Dos souple.', 1200, 60,
     null, 'anthropic', 1240, now() - interval '5 hours', null),
    -- Léon / Rose : refuser (T4, commentaire obligatoire RG-29).
    ('40000000-0000-4000-8000-000000000022', '30000000-0000-4000-8000-000000000021', '20000000-0000-4000-8000-000000000008',
     'en_attente', 400, 'Quatre nages progressif.', 200, 'Souplesse.', 2200, 75,
     null, 'anthropic', 1300, now() - interval '4 hours', null),
    ('40000000-0000-4000-8000-000000000023', '30000000-0000-4000-8000-000000000022', '20000000-0000-4000-8000-000000000009',
     'en_attente', 400, 'Quatre nages progressif.', 200, 'Souplesse.', 2200, 75,
     null, 'anthropic', 1310, now() - interval '4 hours', null);

  insert into public.series (id, seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne) values
    ('41000000-0000-4000-8000-000000000032', '40000000-0000-4000-8000-000000000018', 1, 8, 100, 'crawl', 30, 'Allure régulière.'),
    ('41000000-0000-4000-8000-000000000033', '40000000-0000-4000-8000-000000000019', 1, 8, 100, 'crawl', 30, 'Respiration 3 temps.'),
    ('41000000-0000-4000-8000-000000000034', '40000000-0000-4000-8000-000000000020', 1, 4, 100, 'crawl', 30, 'Allure régulière.'),
    ('41000000-0000-4000-8000-000000000035', '40000000-0000-4000-8000-000000000020', 2, 6, 50, 'dos', 20, 'Souplesse épaules.'),
    ('41000000-0000-4000-8000-000000000036', '40000000-0000-4000-8000-000000000021', 1, 4, 100, 'crawl', 30, 'Allure régulière.'),
    ('41000000-0000-4000-8000-000000000037', '40000000-0000-4000-8000-000000000021', 2, 6, 50, 'dos', 20, 'Souplesse épaules.'),
    ('41000000-0000-4000-8000-000000000038', '40000000-0000-4000-8000-000000000022', 1, 8, 200, 'quatre_nages', 45, 'Enchaînement complet.'),
    ('41000000-0000-4000-8000-000000000039', '40000000-0000-4000-8000-000000000023', 1, 8, 200, 'quatre_nages', 45, 'Enchaînement complet.');
end;
$$;

revoke all on function public.reseed_ch6_e2e() from public, anon, authenticated;

-- Bloc DO : le CLI Supabase parse tout le seed en un lot AVANT exécution —
-- un `select reseed_ch6_e2e()` nu échouerait (fonction créée dans ce même
-- lot) ; le corps d'un DO n'est résolu qu'à l'exécution.
do $$ begin perform public.reseed_ch6_e2e(); end $$;

-- ---------------------------------------------------------------------------
-- Comptes E2E CH8 (espace admin) — un compte par TEST et par PROJET
-- Playwright (codes OTP à usage unique, voir tests/e2e/helpers/users.ts) :
--   * Gaël / Kenza   : tableau de bord métriques (E-30) ;
--   * Hana / Lior    : fournisseurs LLM (E-31 — exécuté sur chromium seul,
--     le fournisseur actif est un état GLOBAL, RG-38) ;
--   * Igor / Milo    : affectations + N8 (E-32) — affectent Lou / Maé,
--     nageurs SANS coach (remis à zéro par reseed_ch8_e2e) ;
--   * Jana / Nora    : invitation coach (E-33) — invite.chromium@ /
--     invite.mobile@ (supprimés par reseed_ch8_e2e) ;
--   * Nour / Sam (nageurs) et Oscar / Prune (coachs) : l'espace admin leur
--     est inaccessible (RG-03/RG-40).
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'gael.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'hana.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'igor.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'jana.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'kenza.admin@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000016', 'authenticated', 'authenticated', 'lior.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000017', 'authenticated', 'authenticated', 'milo.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000018', 'authenticated', 'authenticated', 'nora.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000025', 'authenticated', 'authenticated', 'lou.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000026', 'authenticated', 'authenticated', 'mae.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000027', 'authenticated', 'authenticated', 'nour.nageur@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-4000-8000-000000000028', 'authenticated', 'authenticated', 'sam.nageur@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'oscar.coach@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000013', 'authenticated', 'authenticated', 'prune.coach@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('10000000-0000-4000-8000-000000000011', 'super_admin', 'Gaël',  'Admin',   'gael.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000012', 'super_admin', 'Hana',  'Admin',   'hana.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000013', 'super_admin', 'Igor',  'Admin',   'igor.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000014', 'super_admin', 'Jana',  'Admin',   'jana.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000015', 'super_admin', 'Kenza', 'Admin',   'kenza.admin@nageur.test', null),
  ('10000000-0000-4000-8000-000000000016', 'super_admin', 'Lior',  'Admin',   'lior.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000017', 'super_admin', 'Milo',  'Admin',   'milo.admin@nageur.test',  null),
  ('10000000-0000-4000-8000-000000000018', 'super_admin', 'Nora',  'Admin',   'nora.admin@nageur.test',  null),
  ('30000000-0000-4000-8000-000000000025', 'nageur',      'Lou',   'Marin',   'lou.nageur@nageur.test',  null),
  ('30000000-0000-4000-8000-000000000026', 'nageur',      'Maé',   'Garnier', 'mae.nageur@nageur.test',  null),
  ('30000000-0000-4000-8000-000000000027', 'nageur',      'Nour',  'Petit',   'nour.nageur@nageur.test', null),
  ('30000000-0000-4000-8000-000000000028', 'nageur',      'Sam',   'Dubois',  'sam.nageur@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000012', 'coach',       'Oscar', 'Blanc',   'oscar.coach@nageur.test', null),
  ('20000000-0000-4000-8000-000000000013', 'coach',       'Prune', 'Morel',   'prune.coach@nageur.test', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- reseed_ch8_e2e — suites E2E admin rejouables (appelée par global-setup) :
-- affectations E2E remises à « sans coach », coachs invités supprimés
-- (cascade auth.users → profiles), fournisseurs LLM remis à l'état seed.
-- ---------------------------------------------------------------------------
create or replace function public.reseed_ch8_e2e() returns void
language plpgsql
as $$
begin
  update public.profiles set coach_id = null
  where email in ('lou.nageur@nageur.test', 'mae.nageur@nageur.test');

  delete from auth.users
  where email in ('invite.chromium@nageur.test', 'invite.mobile@nageur.test');

  perform public.set_llm_api_key('anthropic', 'sk-ant-seed-cle-factice');
  perform public.set_llm_api_key('openai',    'sk-seed-cle-factice');
  -- Ordre imposé par l'index « un seul actif » : désactivation d'abord.
  update public.llm_providers set is_active = false, modele = 'gpt-4o'
  where fournisseur = 'openai';
  update public.llm_providers set is_active = true, modele = 'claude-sonnet-4-6'
  where fournisseur = 'anthropic';
end;
$$;

revoke all on function public.reseed_ch8_e2e() from public, anon, authenticated;

do $$ begin perform public.reseed_ch8_e2e(); end $$;

-- ---------------------------------------------------------------------------
-- Comptes E2E CH9 (parcours critiques bout-en-bout) — un jeu par PROJET
-- Playwright (tests/e2e/parcours-critiques.spec.ts) :
--   * Wanda / Yael (admins)    : affectent le coach au nageur créé par le
--     test (inscription dynamique e2e-parcours-…@nageur.test) ;
--   * Ugo / Vera (coachs)      : cibles d'affectation + test d'isolation
--     coach → espaces nageur/admin (RG-03).
-- Les nageurs du parcours sont créés par le test lui-même et purgés par
-- reseed_ch9_e2e() (ci-dessous).
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000019', 'authenticated', 'authenticated', 'wanda.admin@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000020', 'authenticated', 'authenticated', 'yael.admin@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000014', 'authenticated', 'authenticated', 'ugo.coach@nageur.test',   extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-4000-8000-000000000015', 'authenticated', 'authenticated', 'vera.coach@nageur.test',  extensions.crypt('Password123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

insert into public.profiles (id, role, prenom, nom, email, coach_id) values
  ('10000000-0000-4000-8000-000000000019', 'super_admin', 'Wanda', 'Admin', 'wanda.admin@nageur.test', null),
  ('10000000-0000-4000-8000-000000000020', 'super_admin', 'Yael',  'Admin', 'yael.admin@nageur.test',  null),
  ('20000000-0000-4000-8000-000000000014', 'coach',       'Ugo',   'Vidal', 'ugo.coach@nageur.test',   null),
  ('20000000-0000-4000-8000-000000000015', 'coach',       'Vera',  'Munoz', 'vera.coach@nageur.test',  null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- reseed_ch9_e2e — purge les comptes créés dynamiquement par les suites E2E
-- (inscription CH2 « e2e-… », parcours CH9 « e2e-parcours-… ») pour éviter
-- l'accumulation entre exécutions ; cascade auth.users → profiles → séances,
-- disponibilités, auto-évaluations. Appelée par le global-setup Playwright.
-- ---------------------------------------------------------------------------
create or replace function public.reseed_ch9_e2e() returns void
language plpgsql
as $$
begin
  delete from auth.users where email like 'e2e-%@nageur.test';
end;
$$;

revoke all on function public.reseed_ch9_e2e() from public, anon, authenticated;

do $$ begin perform public.reseed_ch9_e2e(); end $$;
