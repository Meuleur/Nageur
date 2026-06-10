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

-- ---------------------------------------------------------------------------
-- Journal d'audit (léger, sans données personnelles).
-- ---------------------------------------------------------------------------
insert into public.audit_log (id, event_type, actor_id, metadata) values
  ('70000000-0000-4000-8000-000000000001', 'seed.applied', null, '{"env": "dev"}')
on conflict (id) do nothing;
