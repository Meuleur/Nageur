-- CH8 — Espace Super Admin (C4, RG-38 à RG-40) :
--   * admin_metrics : agrégats justes sur le seed de référence (RG-39),
--     filtre de période, AUCUN contenu de séance (ADR-020) ;
--   * fournisseurs LLM : modèle, clé (Vault), activation EXCLUSIVE (RG-38) ;
--   * set_coach_assignment : affecter/réaffecter/désaffecter + garde-fous
--     (RG-10 à RG-13), séances conservées (RG-15) ;
--   * toutes les fonctions réservées au service_role (RG-40).
-- S'appuie sur le seed de référence ; transactionnel (rollback final).
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- ---------------------------------------------------------------------------
-- Surface : fonctions présentes, réservées au serveur (E1/RG-40).
-- ---------------------------------------------------------------------------
select has_function('public', 'admin_metrics', array['timestamptz'],
  'fonction admin_metrics(timestamptz)');
select has_function('public', 'set_llm_model', array['fournisseur_llm', 'text', 'uuid'],
  'fonction set_llm_model(fournisseur_llm, text, uuid)');
select has_function('public', 'set_active_llm_provider', array['fournisseur_llm', 'uuid'],
  'fonction set_active_llm_provider(fournisseur_llm, uuid)');
select has_function('public', 'get_llm_api_key', array['fournisseur_llm'],
  'fonction get_llm_api_key(fournisseur_llm)');
select has_function('public', 'set_coach_assignment', array['uuid', 'uuid', 'uuid'],
  'fonction set_coach_assignment(uuid, uuid, uuid)');

select ok(not has_function_privilege('authenticated', 'public.admin_metrics(timestamptz)', 'execute'),
  'authenticated ne peut pas exécuter admin_metrics (RG-40)');
select ok(not has_function_privilege('anon', 'public.get_llm_api_key(public.fournisseur_llm)', 'execute'),
  'anon ne peut pas lire une clé API (ADR-007)');
select ok(not has_function_privilege('authenticated', 'public.get_llm_api_key(public.fournisseur_llm)', 'execute'),
  'authenticated ne peut pas lire une clé API (ADR-007)');
select ok(not has_function_privilege('authenticated', 'public.set_coach_assignment(uuid, uuid, uuid)', 'execute'),
  'authenticated ne peut pas écrire une affectation (RG-12)');
select ok(has_function_privilege('service_role', 'public.admin_metrics(timestamptz)', 'execute'),
  'service_role peut exécuter admin_metrics');

-- ---------------------------------------------------------------------------
-- Métriques (RG-39) : justes sur le seed — comparées aux comptages réels,
-- pas à des constantes (robuste aux évolutions du seed).
-- ---------------------------------------------------------------------------
select is(
  (public.admin_metrics(null) -> 'comptes' ->> 'coachs')::int,
  (select count(*)::int from public.profiles where role = 'coach'),
  'métriques : nombre de coachs');
select is(
  (public.admin_metrics(null) -> 'comptes' ->> 'nageurs')::int,
  (select count(*)::int from public.profiles where role = 'nageur'),
  'métriques : nombre de nageurs');
select is(
  (public.admin_metrics(null) -> 'comptes' ->> 'nageurs_sans_coach')::int,
  (select count(*)::int from public.profiles where role = 'nageur' and coach_id is null),
  'métriques : nageurs sans coach');
select is(
  (public.admin_metrics(null) -> 'seances' ->> 'generees')::int,
  (select count(*)::int from public.seances),
  'métriques : séances générées (total)');
select is(
  (public.admin_metrics(null) -> 'seances' ->> 'en_attente')::int,
  (select count(*)::int from public.seances where statut = 'en_attente'),
  'métriques : séances en attente (stock courant)');
select is(
  (public.admin_metrics(null) -> 'seances' ->> 'validees')::int,
  (select count(*)::int from public.seances where statut = 'validee' and processed_at is not null),
  'métriques : séances validées (traitées)');
select is(
  (public.admin_metrics(null) -> 'tokens' ->> 'total')::int,
  (select coalesce(sum(tokens), 0)::int from public.seances),
  'métriques : tokens consommés (total)');
select is(
  (public.admin_metrics(null) -> 'tokens' ->> 'anthropic')::int,
  (select coalesce(sum(tokens), 0)::int from public.seances where fournisseur_llm = 'anthropic'),
  'métriques : tokens Anthropic');
select is(
  (public.admin_metrics(null) -> 'par_fournisseur' ->> 'openai')::int,
  (select count(*)::int from public.seances where fournisseur_llm = 'openai'),
  'métriques : répartition par fournisseur');
select is(
  jsonb_array_length(public.admin_metrics(null) -> 'serie_generees_30j'),
  30, 'métriques : série de 30 jours complète (graphe E-30)');

-- Filtre de période : une borne future → plus aucune génération comptée,
-- mais le stock en attente (point dans le temps) reste inchangé.
select is(
  (public.admin_metrics(now() + interval '1 day') -> 'seances' ->> 'generees')::int,
  0, 'métriques : le filtre de période s''applique aux générations');
select is(
  (public.admin_metrics(now() + interval '1 day') -> 'seances' ->> 'en_attente')::int,
  (select count(*)::int from public.seances where statut = 'en_attente'),
  'métriques : le stock en attente ignore la période (A3)');

-- ADR-020 : les agrégats n'embarquent AUCUN contenu de séance.
select ok(
  public.admin_metrics(null)::text not like '%consigne%'
  and public.admin_metrics(null)::text not like '%Crawl%',
  'métriques : aucun contenu de séance dans les agrégats (ADR-020)');

-- ---------------------------------------------------------------------------
-- Fournisseurs LLM (RG-38, ADR-007).
-- ---------------------------------------------------------------------------
select is(
  public.get_llm_api_key('anthropic'), 'sk-ant-seed-cle-factice',
  'get_llm_api_key déchiffre la clé Vault du seed (serveur uniquement)');

select lives_ok($$select public.set_llm_model('anthropic', 'claude-opus-4-8')$$,
  'set_llm_model accepte un modèle valide');
select is(
  (select modele from public.llm_providers where fournisseur = 'anthropic'),
  'claude-opus-4-8', 'le modèle choisi est enregistré');
select throws_like($$select public.set_llm_model('anthropic', '  ')$$, '%modele vide%',
  'set_llm_model refuse un modèle vide');

select lives_ok($$select public.set_active_llm_provider('openai')$$,
  'set_active_llm_provider bascule le fournisseur actif');
select is(
  (select count(*)::int from public.llm_providers where is_active),
  1, 'RG-38 : un seul fournisseur actif après bascule');
select is(
  (select fournisseur::text from public.llm_providers where is_active),
  'openai', 'le fournisseur activé est bien le demandé');

-- ---------------------------------------------------------------------------
-- Affectations (RG-10 à RG-15) — Léa (nageuse de Camille) et Alex (coach).
-- ---------------------------------------------------------------------------
select lives_ok(
  $$select public.set_coach_assignment('30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002')$$,
  'réaffectation : Léa passe de Camille à Alex');
select is(
  (select coach_id from public.profiles where id = '30000000-0000-4000-8000-000000000001'),
  '20000000-0000-4000-8000-000000000002'::uuid,
  'la réaffectation est enregistrée (RG-10 : un seul coach)');
select is(
  (select coach_id from public.seances where id = '40000000-0000-4000-8000-000000000001'),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'RG-15 : les séances existantes restent attachées au coach de génération');

select lives_ok(
  $$select public.set_coach_assignment('30000000-0000-4000-8000-000000000001', null)$$,
  'désaffectation : coach_id repasse à null (RG-13)');

select throws_like(
  $$select public.set_coach_assignment('30000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002')$$,
  '%coach inconnu (RG-12)%',
  'un nageur ne peut pas devenir coach d''un autre nageur (RG-12)');
select throws_like(
  $$select public.set_coach_assignment('20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002')$$,
  '%nageur inconnu (RG-12)%',
  'la cible d''une affectation doit être un nageur (RG-12)');

select * from finish();
rollback;
