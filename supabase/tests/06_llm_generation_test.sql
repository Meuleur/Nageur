-- CH4 — Couche LLM (C2/ADR-007) :
--   * set_llm_api_key / get_active_llm_config : clé chiffrée dans Vault,
--     EXECUTE réservé au service_role, rotation journalisée ;
--   * insert_generated_seance : insertion atomique séance en_attente +
--     séries (RG-21), garde-fous RG-14/RG-17, coach dérivé à la génération.
-- Dépend du seed de référence (Léa avec coach+profil, Lucas sans coach,
-- Mia avec coach sans profil sportif, fournisseur actif = anthropic).
begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Existence et nature des fonctions.
-- ---------------------------------------------------------------------------
select has_function('public', 'set_llm_api_key',
  array['public.fournisseur_llm', 'text'], 'set_llm_api_key existe');
select has_function('public', 'get_active_llm_config',
  array[]::text[], 'get_active_llm_config existe');
select has_function('public', 'insert_generated_seance',
  array['uuid', 'integer', 'text', 'integer', 'text', 'integer', 'integer',
        'public.fournisseur_llm', 'integer', 'jsonb'],
  'insert_generated_seance existe');

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname in ('set_llm_api_key', 'get_active_llm_config', 'insert_generated_seance')
     and p.prosecdef),
  3::bigint, 'les trois fonctions LLM sont SECURITY DEFINER');

-- ---------------------------------------------------------------------------
-- Privilèges : serveur uniquement (E1 — llm_providers jamais lu côté client).
-- ---------------------------------------------------------------------------
select ok(not has_function_privilege('anon',
  'public.set_llm_api_key(public.fournisseur_llm, text)', 'execute'),
  'anon ne peut pas écrire une clé LLM');
select ok(not has_function_privilege('authenticated',
  'public.set_llm_api_key(public.fournisseur_llm, text)', 'execute'),
  'authenticated ne peut pas écrire une clé LLM');
select ok(not has_function_privilege('anon',
  'public.get_active_llm_config()', 'execute'),
  'anon ne peut pas lire la configuration LLM');
select ok(not has_function_privilege('authenticated',
  'public.get_active_llm_config()', 'execute'),
  'authenticated ne peut pas lire la configuration LLM (clé déchiffrée)');
select ok(not has_function_privilege('authenticated',
  'public.insert_generated_seance(uuid, integer, text, integer, text, integer, integer, public.fournisseur_llm, integer, jsonb)',
  'execute'),
  'authenticated ne peut pas insérer de séance générée (service role uniquement)');
select ok(has_function_privilege('service_role',
  'public.get_active_llm_config()', 'execute'),
  'service_role peut lire la configuration LLM');

-- ---------------------------------------------------------------------------
-- Configuration active (RG-38) et rotation de clé via Vault (ADR-007).
-- ---------------------------------------------------------------------------
select results_eq(
  $$select fournisseur::text, modele, api_key from public.get_active_llm_config()$$,
  $$values ('anthropic', 'claude-sonnet-4-6', 'sk-ant-seed-cle-factice')$$,
  'la configuration active expose le fournisseur seedé et la clé déchiffrée');

select lives_ok(
  $$select public.set_llm_api_key('anthropic', 'sk-ant-cle-tournee')$$,
  'rotation de la clé du fournisseur actif');

select is(
  (select api_key from public.get_active_llm_config()),
  'sk-ant-cle-tournee', 'la clé déchiffrée reflète la rotation');

select ok(
  (select api_key_encrypted not like '%sk-ant-%'
   from public.llm_providers where fournisseur = 'anthropic'),
  'llm_providers ne stocke jamais la clé en clair (référence Vault)');

select throws_ok(
  $$select public.set_llm_api_key('anthropic', '  ')$$,
  'cle API vide pour anthropic', 'clé vide refusée');

select ok(
  exists (select 1 from public.audit_log
          where event_type = 'llm.cle_definie'
            and metadata ->> 'fournisseur' = 'anthropic'),
  'la rotation de clé est journalisée (E1 audit_log, sans contenu de clé)');

-- ---------------------------------------------------------------------------
-- insert_generated_seance — cas nominal (Léa : coach + profil complet).
-- ---------------------------------------------------------------------------
create temp table resultat_seance as
select public.insert_generated_seance(
  '30000000-0000-4000-8000-000000000001',
  300, 'Échauffement progressif', 200, 'Retour au calme souple',
  1300, 60, 'anthropic', 1234,
  '[{"repetitions":4,"distance_m":100,"type_nage":"crawl","recuperation_s":30,"consigne":"Allure régulière"},
    {"repetitions":8,"distance_m":50,"type_nage":"dos","recuperation_s":20,"consigne":null}]'::jsonb
) as seance_id;

select results_eq(
  $$select s.statut::text, s.coach_id, s.fournisseur_llm::text, s.tokens, s.processed_at
    from public.seances s join resultat_seance r on r.seance_id = s.id$$,
  $$values ('en_attente', '20000000-0000-4000-8000-000000000001'::uuid, 'anthropic', 1234, null::timestamptz)$$,
  'séance créée en_attente, coach affecté au moment de la génération, fournisseur et tokens tracés (RG-21/RG-22)');

select results_eq(
  $$select se.ordre, se.repetitions, se.distance_m, se.type_nage::text
    from public.series se join resultat_seance r on r.seance_id = se.seance_id
    order by se.ordre$$,
  $$values (1, 4, 100, 'crawl'), (2, 8, 50, 'dos')$$,
  'les séries sont créées dans l''ordre du corps de séance');

-- ---------------------------------------------------------------------------
-- Préconditions au plus près des données (défense en profondeur).
-- ---------------------------------------------------------------------------
select throws_ok(
  $$select public.insert_generated_seance('30000000-0000-4000-8000-000000000004',
      300, 'x', 200, 'y', 600, 75, 'anthropic', 10,
      '[{"repetitions":1,"distance_m":100,"type_nage":"crawl","recuperation_s":0,"consigne":null}]'::jsonb)$$,
  'nageur sans coach (RG-14) : 30000000-0000-4000-8000-000000000004',
  'pas de séance pour un nageur sans coach (RG-14)');

select throws_ok(
  $$select public.insert_generated_seance('30000000-0000-4000-8000-000000000005',
      300, 'x', 200, 'y', 600, 60, 'anthropic', 10,
      '[{"repetitions":1,"distance_m":100,"type_nage":"crawl","recuperation_s":0,"consigne":null}]'::jsonb)$$,
  'profil sportif manquant (RG-17) : 30000000-0000-4000-8000-000000000005',
  'pas de séance sans profil sportif (RG-17)');

select throws_ok(
  $$select public.insert_generated_seance('20000000-0000-4000-8000-000000000001',
      300, 'x', 200, 'y', 600, 60, 'anthropic', 10,
      '[{"repetitions":1,"distance_m":100,"type_nage":"crawl","recuperation_s":0,"consigne":null}]'::jsonb)$$,
  'nageur inconnu : 20000000-0000-4000-8000-000000000001',
  'un coach n''est pas un nageur : insertion refusée');

select throws_ok(
  $$select public.insert_generated_seance('30000000-0000-4000-8000-000000000001',
      300, 'x', 200, 'y', 500, 60, 'anthropic', 10, '[]'::jsonb)$$,
  'corps de seance vide : au moins une serie est requise (A4)',
  'au moins une série exigée (A4)');

-- ---------------------------------------------------------------------------
-- Atomicité (C2) : une série invalide annule TOUTE la séance.
-- ---------------------------------------------------------------------------
create temp table seances_avant as
select count(*) as n from public.seances
where nageur_id = '30000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.insert_generated_seance('30000000-0000-4000-8000-000000000001',
      300, 'x', 200, 'y', 630, 60, 'anthropic', 10,
      '[{"repetitions":1,"distance_m":130,"type_nage":"crawl","recuperation_s":0,"consigne":null}]'::jsonb)$$,
  '23514', null,
  'série à distance non multiple de 25 refusée par la contrainte E1');

select is(
  (select count(*) from public.seances
   where nageur_id = '30000000-0000-4000-8000-000000000001'),
  (select n from seances_avant),
  'aucune séance partielle persistée après l''échec (C2)');

select * from finish();
rollback;
