-- CH1 — Isolation RLS par rôle et par relation coach↔nageur (E1, RG-43) :
--   * un nageur ne voit que ses données (et le profil de son coach) ;
--   * un coach ne voit que ses nageurs affectés ;
--   * le super admin n'accède pas au contenu (séances, profils sportifs…) ;
--   * otp_codes / llm_providers / audit_log inaccessibles côté client ;
--   * la réaffectation déplace les accès (RG-12, RG-15).
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

-- Simulation d'une session Supabase authentifiée (jeton JWT → auth.uid()).
create function pg_temp.connecter(p_user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.connecter_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Nageur Léa (coach : Camille) — ne voit que ses données.
-- ---------------------------------------------------------------------------
select pg_temp.connecter('30000000-0000-4000-8000-000000000001');

select results_eq('select count(*)::int from public.profiles', array[2],
  'nageur : voit son profil et celui de son coach uniquement');
select results_eq($$select count(*)::int from public.profiles where id = '30000000-0000-4000-8000-000000000002'$$, array[0],
  'nageur : ne voit pas le profil d''un autre nageur');
select results_eq('select count(*)::int from public.seances', array[2],
  'nageur : voit toutes ses séances (tous statuts, RG-32) et rien d''autre');
select results_eq('select count(*)::int from public.series', array[2],
  'nageur : ne lit les séries que d''une séance utilisable (RG-32)');
select results_eq($$select count(*)::int from public.series where seance_id = '40000000-0000-4000-8000-000000000001'$$, array[0],
  'nageur : séries d''une séance en_attente invisibles');
select results_eq(
  $$with u as (update public.seances set statut = 'validee', processed_at = now()
               where id = '40000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$, array[0],
  'nageur : ne peut pas modifier le statut d''une séance (serveur uniquement)');
select throws_ok(
  $$insert into public.seances (nageur_id) values ('30000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'nageur : création de séance interdite côté client (RG-21)');
select lives_ok(
  $$update public.profiles set prenom = 'Léa-Maj' where id = '30000000-0000-4000-8000-000000000001'$$,
  'nageur : peut modifier son identité (prénom)');
select throws_ok(
  $$update public.profiles set role = 'coach' where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'nageur : ne peut pas changer son rôle (RG-01)');
select throws_ok(
  $$update public.profiles set coach_id = null where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'nageur : ne peut pas changer son affectation (RG-12)');
select results_eq('select count(*)::int from public.auto_evaluations', array[1],
  'nageur : ne voit que ses auto-évaluations');
select throws_ok(
  $$insert into public.auto_evaluations (seance_id, nageur_id, ressenti)
    values ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001', 3)$$,
  '42501', null, 'nageur : auto-évaluation sur la séance d''un autre interdite');
select results_eq('select count(*)::int from public.swimmer_profiles', array[1],
  'nageur : ne voit que son profil sportif');
select lives_ok(
  $$update public.swimmer_profiles set frequence = 4 where nageur_id = '30000000-0000-4000-8000-000000000001'$$,
  'nageur : peut modifier son profil sportif (RG-16)');
select results_eq(
  $$with d as (delete from public.swimmer_availabilities
               where nageur_id = '30000000-0000-4000-8000-000000000001' and jour = 1 and moment = 'matin' returning 1)
    select count(*)::int from d$$, array[1],
  'nageur : peut retirer un créneau de sa grille');
select results_eq('select count(*)::int from public.swimmer_availabilities', array[2],
  'nageur : voit ses disponibilités restantes');
select throws_ok('select count(*) from public.llm_providers', '42501', null,
  'nageur : llm_providers inaccessible (clés jamais exposées)');
select throws_ok('select count(*) from public.otp_codes', '42501', null,
  'nageur : otp_codes inaccessible (serveur uniquement)');
select throws_ok('select count(*) from public.audit_log', '42501', null,
  'nageur : audit_log inaccessible (lecture via serveur)');

-- ---------------------------------------------------------------------------
-- Nageur Lucas — sans coach (RG-13).
-- ---------------------------------------------------------------------------
select pg_temp.connecter('30000000-0000-4000-8000-000000000004');

select results_eq('select count(*)::int from public.profiles', array[1],
  'nageur sans coach : ne voit que son propre profil');
select results_eq('select count(*)::int from public.seances', array[0],
  'nageur sans coach : aucune séance visible');

-- ---------------------------------------------------------------------------
-- Coach Camille — nageurs affectés : Léa et Noah (RG-25).
-- ---------------------------------------------------------------------------
select pg_temp.connecter('20000000-0000-4000-8000-000000000001');

select results_eq('select count(*)::int from public.profiles', array[3],
  'coach : voit son profil et ceux de ses nageurs affectés uniquement');
select results_eq('select count(*)::int from public.swimmer_profiles', array[2],
  'coach : voit les profils sportifs de ses nageurs uniquement');
select results_eq('select count(*)::int from public.seances', array[3],
  'coach : voit les séances de ses nageurs uniquement');
select results_eq(
  $$select count(*)::int from public.seances where id in
    ('40000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000005')$$, array[0],
  'coach : les séances des nageurs d''un autre coach sont invisibles');
select results_eq('select count(*)::int from public.series', array[5],
  'coach : voit les séries des séances de ses nageurs (historique inclus, RG-15)');
select results_eq(
  $$with u as (update public.series set consigne = 'Allure modérée.'
               where id = '41000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$, array[1],
  'coach : édite les séries d''une séance en cours de traitement (T3)');
select results_eq(
  $$with u as (update public.series set consigne = 'Tentative.'
               where id = '41000000-0000-4000-8000-000000000003' returning 1)
    select count(*)::int from u$$, array[0],
  'coach : ne peut plus éditer les séries d''une séance terminale (A3)');
select throws_ok(
  $$insert into public.series (seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s)
    values ('40000000-0000-4000-8000-000000000005', 9, 4, 50, 'crawl', 30)$$,
  '42501', null, 'coach : ne peut pas écrire dans la séance d''un nageur non affecté');
select results_eq(
  $$with d as (delete from public.series where id = '41000000-0000-4000-8000-000000000002' returning 1)
    select count(*)::int from d$$, array[1],
  'coach : peut supprimer une série d''une séance en cours de traitement');
select results_eq(
  $$with u as (update public.seances set statut = 'validee', processed_at = now()
               where id = '40000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$, array[0],
  'coach : les transitions de statut passent par le serveur uniquement (E1)');
select results_eq('select count(*)::int from public.auto_evaluations', array[2],
  'coach : voit les auto-évaluations de ses nageurs (RG-35)');
select results_eq(
  $$with u as (update public.profiles set prenom = 'Pirate'
               where id = '30000000-0000-4000-8000-000000000001' returning 1)
    select count(*)::int from u$$, array[0],
  'coach : ne peut pas modifier le profil d''un nageur');

-- ---------------------------------------------------------------------------
-- Coach Alex — nageuse affectée : Emma.
-- ---------------------------------------------------------------------------
select pg_temp.connecter('20000000-0000-4000-8000-000000000002');

select results_eq('select count(*)::int from public.profiles', array[2],
  'coach 2 : voit son profil et celui d''Emma uniquement');
select results_eq('select count(*)::int from public.seances', array[2],
  'coach 2 : voit les séances d''Emma uniquement');
select results_eq('select count(*)::int from public.auto_evaluations', array[0],
  'coach 2 : aucune auto-évaluation d''un nageur non affecté');

-- ---------------------------------------------------------------------------
-- Super admin Dominique — identités/affectations oui, contenu non (ADR-020).
-- ---------------------------------------------------------------------------
select pg_temp.connecter('10000000-0000-4000-8000-000000000001');

select results_eq('select count(*)::int from public.profiles', array[7],
  'admin : lit toutes les identités, rôles et affectations');
select results_eq('select count(*)::int from public.swimmer_profiles', array[0],
  'admin : pas d''accès aux profils sportifs');
select results_eq('select count(*)::int from public.seances', array[0],
  'admin : pas d''accès au contenu des séances');
select results_eq('select count(*)::int from public.series', array[0],
  'admin : pas d''accès aux séries');
select results_eq('select count(*)::int from public.auto_evaluations', array[0],
  'admin : pas d''accès aux auto-évaluations');
select lives_ok(
  $$update public.profiles set role = 'coach' where id = '30000000-0000-4000-8000-000000000004'$$,
  'admin : peut changer un rôle (RG-01)');
select lives_ok(
  $$update public.profiles set coach_id = '20000000-0000-4000-8000-000000000002'
    where id = '30000000-0000-4000-8000-000000000001'$$,
  'admin : peut réaffecter un nageur à un autre coach (RG-12)');
select throws_ok(
  $$update public.profiles set prenom = 'Renommée' where id = '30000000-0000-4000-8000-000000000001'$$,
  'P0001', null, 'admin : n''écrit pas l''identité des autres profils (E1)');

-- ---------------------------------------------------------------------------
-- Après réaffectation de Léa vers Alex : les accès suivent (RG-15).
-- ---------------------------------------------------------------------------
select pg_temp.connecter('20000000-0000-4000-8000-000000000002');

select results_eq('select count(*)::int from public.profiles', array[3],
  'réaffectation : le nouveau coach voit le profil de Léa');
select results_eq('select count(*)::int from public.seances', array[4],
  'réaffectation : le nouveau coach accède à l''historique de Léa (RG-15)');

select pg_temp.connecter('20000000-0000-4000-8000-000000000001');

select results_eq('select count(*)::int from public.profiles', array[2],
  'réaffectation : l''ancien coach ne voit plus le profil de Léa');
select results_eq('select count(*)::int from public.seances', array[1],
  'réaffectation : l''ancien coach n''accède plus aux séances de Léa');

-- ---------------------------------------------------------------------------
-- Client anonyme (clé anon) : aucun accès.
-- ---------------------------------------------------------------------------
select pg_temp.connecter_anon();

select results_eq('select count(*)::int from public.profiles', array[0],
  'anon : aucune ligne visible');
select throws_ok(
  $$insert into public.profiles (id, role, prenom, nom, email)
    values (gen_random_uuid(), 'nageur', 'X', 'Y', 'x@y.test')$$,
  '42501', null, 'anon : aucune écriture possible');

select * from finish();
rollback;
