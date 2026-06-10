-- CH1 — Contraintes métier au niveau base (contexte serveur, hors RLS) :
-- états terminaux (A3/RG-30), commentaire obligatoire au refus (RG-29),
-- un seul fournisseur actif (RG-38), unicités, listes fermées, triggers.
begin;
create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- Machine à états (A3) : terminaux non régressables, pas de retour en_attente.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.seances set statut = 'en_attente' where id = '40000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'validee → en_attente interdit (RG-30)');

select throws_ok(
  $$update public.seances set statut = 'refusee', commentaire_coach = 'x' where id = '40000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'validee → refusee interdit (statut terminal)');

select throws_ok(
  $$update public.seances set statut = 'validee' where id = '40000000-0000-4000-8000-000000000004'$$,
  'P0001', null, 'refusee → validee interdit (statut terminal)');

select lives_ok(
  $$update public.seances set statut = 'validee', processed_at = now() where id = '40000000-0000-4000-8000-000000000005'$$,
  'en_attente → validee autorisé (T2)');

select throws_ok(
  $$update public.seances set statut = 'en_attente', processed_at = null where id = '40000000-0000-4000-8000-000000000005'$$,
  'P0001', null, 'pas de retour à en_attente après traitement (RG-30)');

-- ---------------------------------------------------------------------------
-- RG-29 : commentaire obligatoire (et non vide) au refus.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.seances (nageur_id, coach_id, statut, processed_at)
    values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'refusee', now())$$,
  '23514', null, 'refus sans commentaire interdit (RG-29)');

select throws_ok(
  $$insert into public.seances (nageur_id, coach_id, statut, commentaire_coach, processed_at)
    values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'refusee', '   ', now())$$,
  '23514', null, 'refus avec commentaire blanc interdit (RG-29)');

select lives_ok(
  $$insert into public.seances (nageur_id, coach_id, statut, commentaire_coach, processed_at)
    values ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'refusee', 'Séance trop dense.', now())$$,
  'refus avec commentaire accepté');

-- ---------------------------------------------------------------------------
-- E1 : processed_at nul tant que la séance est en attente.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.seances set processed_at = now() where id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'processed_at interdit sur séance en_attente');

select throws_ok(
  $$insert into public.seances (nageur_id, statut, processed_at)
    values ('30000000-0000-4000-8000-000000000001', 'en_attente', now())$$,
  '23514', null, 'insertion en_attente avec processed_at interdite');

-- ---------------------------------------------------------------------------
-- RG-38 : un seul fournisseur LLM actif à la fois ; la rotation reste possible.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.llm_providers set is_active = true where fournisseur = 'openai'$$,
  '23505', null, 'deux fournisseurs actifs interdits (RG-38)');

select lives_ok(
  $$update public.llm_providers set is_active = false where fournisseur = 'anthropic'$$,
  'désactivation du fournisseur actif autorisée');

select lives_ok(
  $$update public.llm_providers set is_active = true where fournisseur = 'openai'$$,
  'rotation : activation d''un autre fournisseur autorisée');

-- ---------------------------------------------------------------------------
-- Unicités (E1).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$insert into public.swimmer_availabilities (nageur_id, jour, moment)
    values ('30000000-0000-4000-8000-000000000001', 1, 'matin')$$,
  '23505', null, 'créneau (nageur, jour, moment) unique');

select throws_ok(
  $$insert into public.auto_evaluations (seance_id, nageur_id, ressenti)
    values ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 3)$$,
  '23505', null, 'une seule auto-évaluation par séance');

-- ---------------------------------------------------------------------------
-- Listes fermées et bornes (E1/A4).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.swimmer_profiles set duree = 50 where nageur_id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'durée hors liste fermée (50) refusée');

select throws_ok(
  $$update public.swimmer_profiles set frequence = 0 where nageur_id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'fréquence hors bornes (0) refusée');

select throws_ok(
  $$update public.swimmer_profiles set bassin = 33 where nageur_id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'bassin hors liste (33) refusé');

select throws_ok(
  $$update public.swimmer_profiles set objectifs = '{}' where nageur_id = '30000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'objectifs : au moins un choix requis');

select throws_ok(
  $$insert into public.series (seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s)
    values ('40000000-0000-4000-8000-000000000001', 3, 4, 30, 'crawl', 30)$$,
  '23514', null, 'distance non multiple de 25 refusée');

select throws_ok(
  $$insert into public.series (seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s)
    values ('40000000-0000-4000-8000-000000000001', 3, 0, 100, 'crawl', 30)$$,
  '23514', null, 'répétitions < 1 refusées');

select throws_ok(
  $$insert into public.swimmer_availabilities (nageur_id, jour, moment)
    values ('30000000-0000-4000-8000-000000000001', 8, 'matin')$$,
  '23514', null, 'jour hors 1..7 refusé');

select throws_ok(
  $$insert into public.auto_evaluations (seance_id, nageur_id, ressenti)
    values ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 6)$$,
  '23514', null, 'ressenti hors 1..5 refusé');

select throws_ok(
  $$update public.auto_evaluations set difficulte = 11 where seance_id = '40000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'difficulté hors 1..10 refusée');

-- ---------------------------------------------------------------------------
-- Triggers d'intégrité sur profiles et swimmer_profiles (E1).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.profiles set coach_id = '30000000-0000-4000-8000-000000000002' where id = '30000000-0000-4000-8000-000000000004'$$,
  'P0001', null, 'coach_id vers un profil non coach refusé');

select throws_ok(
  $$update public.profiles set coach_id = '20000000-0000-4000-8000-000000000001' where id = '20000000-0000-4000-8000-000000000002'$$,
  'P0001', null, 'coach_id porté par un non-nageur refusé');

select throws_ok(
  $$insert into public.swimmer_profiles (nageur_id, niveau, frequence, duree, bassin, objectifs)
    values ('20000000-0000-4000-8000-000000000001', 'confirme', 3, 60, 25, array['technique']::public.objectif[])$$,
  'P0001', null, 'profil sportif pour un non-nageur refusé');

-- ---------------------------------------------------------------------------
-- Unicité de l'e-mail dans profiles (RG-04).
-- ---------------------------------------------------------------------------
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'authenticated', 'authenticated',
   'doublon@nageur.test', extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

select throws_ok(
  $$insert into public.profiles (id, role, prenom, nom, email)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'nageur', 'Double', 'Email', 'lea.nageur@nageur.test')$$,
  '23505', null, 'e-mail unique dans profiles (RG-04)');

select * from finish();
rollback;
