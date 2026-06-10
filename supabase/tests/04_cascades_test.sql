-- CH1 — Cascades de suppression (RG-41, ADR-012) :
--   * suppression d'un compte nageur → profil, profil sportif, disponibilités,
--     séances, séries et auto-évaluations supprimés ;
--   * suppression d'un coach → désaffectation, les nageurs et séances restent ;
--   * suppression d'une séance → séries et auto-évaluation suivent.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- ---------------------------------------------------------------------------
-- Suppression du compte de Léa (auth.users → cascade complète).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$delete from auth.users where id = '30000000-0000-4000-8000-000000000001'$$,
  'suppression du compte nageur sans erreur');

select results_eq(
  $$select count(*)::int from public.profiles where id = '30000000-0000-4000-8000-000000000001'$$, array[0],
  'cascade : profil supprimé');
select results_eq(
  $$select count(*)::int from public.swimmer_profiles where nageur_id = '30000000-0000-4000-8000-000000000001'$$, array[0],
  'cascade : profil sportif supprimé');
select results_eq(
  $$select count(*)::int from public.swimmer_availabilities where nageur_id = '30000000-0000-4000-8000-000000000001'$$, array[0],
  'cascade : disponibilités supprimées');
select results_eq(
  $$select count(*)::int from public.seances where nageur_id = '30000000-0000-4000-8000-000000000001'$$, array[0],
  'cascade : séances supprimées (RG-41)');
select results_eq(
  $$select count(*)::int from public.series where seance_id in
    ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002')$$, array[0],
  'cascade : séries des séances supprimées');
select results_eq(
  $$select count(*)::int from public.auto_evaluations where nageur_id = '30000000-0000-4000-8000-000000000001'$$, array[0],
  'cascade : auto-évaluations supprimées (RG-41)');

-- ---------------------------------------------------------------------------
-- Suppression du compte du coach Camille : désaffectation, pas de cascade
-- sur les nageurs ni leurs séances (RG-13/RG-15).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$delete from auth.users where id = '20000000-0000-4000-8000-000000000001'$$,
  'suppression du compte coach sans erreur');

select results_eq(
  $$select count(*)::int from public.profiles where id = '20000000-0000-4000-8000-000000000001'$$, array[0],
  'profil du coach supprimé');
select results_eq(
  $$select count(*)::int from public.profiles
    where id = '30000000-0000-4000-8000-000000000002' and coach_id is null$$, array[1],
  'le nageur reste et devient sans coach (RG-13)');
select results_eq(
  $$select count(*)::int from public.seances
    where id = '40000000-0000-4000-8000-000000000003' and coach_id is null$$, array[1],
  'la séance du nageur reste, coach désaffecté (RG-15)');
select results_eq(
  $$select count(*)::int from public.series where seance_id = '40000000-0000-4000-8000-000000000003'$$, array[1],
  'les séries de la séance restent');

-- ---------------------------------------------------------------------------
-- Suppression d'une séance : séries et auto-évaluation suivent (E1).
-- ---------------------------------------------------------------------------
delete from public.seances where id = '40000000-0000-4000-8000-000000000004';
select results_eq(
  $$select count(*)::int from public.series where seance_id = '40000000-0000-4000-8000-000000000004'$$, array[0],
  'cascade séance → séries');

delete from public.seances where id = '40000000-0000-4000-8000-000000000003';
select results_eq(
  $$select count(*)::int from public.series where seance_id = '40000000-0000-4000-8000-000000000003'$$, array[0],
  'cascade séance → séries (séance modifiée)');
select results_eq(
  $$select count(*)::int from public.auto_evaluations where seance_id = '40000000-0000-4000-8000-000000000003'$$, array[0],
  'cascade séance → auto-évaluation');

select * from finish();
rollback;
