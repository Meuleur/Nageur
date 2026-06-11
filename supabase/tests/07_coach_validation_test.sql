-- CH6 — Traitement d'une séance par le coach (A3, RG-25 à RG-30) :
--   * traiter_seance est une opération serveur (EXECUTE service_role only) ;
--   * T2 valider / T3 modifier+valider / T4 refuser ;
--   * garde-fous : relation coach↔nageur (RG-25), statut en_attente requis
--     (RG-30), commentaire obligatoire au refus (RG-29), contenu requis (T3).
-- S'appuie sur le seed de référence (Camille/Léa, Alex/Emma, Rémi/Anna).
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- ---------------------------------------------------------------------------
-- Surface : fonction présente, réservée au serveur (E1).
-- ---------------------------------------------------------------------------
select has_function('public', 'traiter_seance',
  array['uuid', 'uuid', 'statut_seance', 'text', 'jsonb'],
  'fonction traiter_seance(uuid, uuid, statut_seance, text, jsonb)');
select ok(not has_function_privilege('anon',
  'public.traiter_seance(uuid, uuid, public.statut_seance, text, jsonb)', 'execute'),
  'anon ne peut pas exécuter traiter_seance');
select ok(not has_function_privilege('authenticated',
  'public.traiter_seance(uuid, uuid, public.statut_seance, text, jsonb)', 'execute'),
  'authenticated ne peut pas exécuter traiter_seance (transitions serveur uniquement)');
select ok(has_function_privilege('service_role',
  'public.traiter_seance(uuid, uuid, public.statut_seance, text, jsonb)', 'execute'),
  'service_role peut exécuter traiter_seance');

-- ---------------------------------------------------------------------------
-- T2 — Valider : Camille valide la séance en attente de Léa (s1), sans
-- commentaire (facultatif à la validation).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', 'validee', null)$$,
  'T2 : le coach affecté valide une séance en attente');
select is(
  (select statut::text from public.seances where id = '40000000-0000-4000-8000-000000000001'),
  'validee', 'T2 : la séance passe au statut validee (RG-27)');
select ok(
  (select commentaire_coach is null from public.seances where id = '40000000-0000-4000-8000-000000000001'),
  'T2 : le commentaire reste facultatif à la validation');
select ok(
  (select processed_at is not null from public.seances where id = '40000000-0000-4000-8000-000000000001'),
  'T2 : processed_at est renseigné au traitement (E1)');

-- ---------------------------------------------------------------------------
-- Garde-fous.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001', 'refusee', 'Tentative.')$$,
  'P0001', null, 'RG-30 : une séance déjà traitée ne se retraite pas (statut terminal)');
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000001', 'validee', null)$$,
  'P0001', null, 'RG-25 : un coach non affecté au nageur ne peut pas traiter sa séance');
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000002', 'refusee', '   ')$$,
  'P0001', null, 'RG-29 : le refus sans commentaire (ou blanc) est rejeté');
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000002', 'en_attente', null)$$,
  'P0001', null, 'A3 : en_attente n''est pas un statut cible de traitement');
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000099',
      '20000000-0000-4000-8000-000000000002', 'validee', null)$$,
  'P0001', null, 'une séance inconnue est rejetée');

-- ---------------------------------------------------------------------------
-- T4 — Refuser : Alex refuse la séance en attente d'Emma (s5) avec
-- commentaire (RG-29).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000002', 'refusee', 'Trop dense cette semaine.')$$,
  'T4 : le coach affecté refuse avec un commentaire');
select is(
  (select statut::text from public.seances where id = '40000000-0000-4000-8000-000000000005'),
  'refusee', 'T4 : la séance passe au statut refusee (RG-29)');
select is(
  (select commentaire_coach from public.seances where id = '40000000-0000-4000-8000-000000000005'),
  'Trop dense cette semaine.', 'T4 : le commentaire de refus est conservé');

-- ---------------------------------------------------------------------------
-- T3 — Modifier puis valider : Rémi (CH6) sur la séance d'Anna.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000018',
      '20000000-0000-4000-8000-000000000004', 'modifiee', null, null)$$,
  'P0001', null, 'T3 : la modification sans contenu (séries) est rejetée');
select lives_ok(
  $$select public.traiter_seance('40000000-0000-4000-8000-000000000018',
      '20000000-0000-4000-8000-000000000004', 'modifiee', 'Adapté à ta semaine.',
      '{"echauffement": {"distance_m": 200, "consignes": "Souple."},
        "series": [
          {"repetitions": 2, "distance_m": 150, "type_nage": "brasse", "recuperation_s": 40, "consigne": "Glisse."},
          {"repetitions": 1, "distance_m": 100, "type_nage": "crawl", "recuperation_s": 0, "consigne": null}],
        "retour_au_calme": {"distance_m": 100, "consignes": "Relâchement."}}'::jsonb)$$,
  'T3 : le coach affecté modifie puis valide avec un contenu complet');
select is(
  (select statut::text from public.seances where id = '40000000-0000-4000-8000-000000000018'),
  'modifiee', 'T3 : la séance passe au statut modifiee (RG-28)');
select results_eq(
  $$select ordre, repetitions, distance_m, type_nage::text, recuperation_s
    from public.series where seance_id = '40000000-0000-4000-8000-000000000018'
    order by ordre$$,
  $$values (1, 2, 150, 'brasse', 40), (2, 1, 100, 'crawl', 0)$$,
  'T3 : les séries sont remplacées dans l''ordre fourni');
select is(
  (select distance_totale_m from public.seances where id = '40000000-0000-4000-8000-000000000018'),
  700, 'T3 : la distance totale est recalculée du contenu écrit (E1)');

-- ---------------------------------------------------------------------------
-- Journal d'audit (E1/D3) : un événement par traitement, sans contenu
-- personnel.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.audit_log where event_type = 'seance.traitee'),
  3, 'audit : chaque traitement journalise un événement seance.traitee');

select * from finish();
rollback;
