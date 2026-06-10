-- CH1 — Tests de structure : tables E1, RLS activée partout, index, types.
begin;
create extension if not exists pgtap with schema extensions;

select plan(39);

-- Tables E1.
select has_table('public', 'profiles', 'table profiles');
select has_table('public', 'swimmer_profiles', 'table swimmer_profiles');
select has_table('public', 'swimmer_availabilities', 'table swimmer_availabilities');
select has_table('public', 'seances', 'table seances');
select has_table('public', 'series', 'table series');
select has_table('public', 'auto_evaluations', 'table auto_evaluations');
select has_table('public', 'llm_providers', 'table llm_providers');
select has_table('public', 'otp_codes', 'table otp_codes');
select has_table('public', 'audit_log', 'table audit_log');

-- RLS activée sur toutes les tables de données (RG-43).
select ok((select relrowsecurity from pg_class where oid = 'public.profiles'::regclass), 'RLS activée : profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.swimmer_profiles'::regclass), 'RLS activée : swimmer_profiles');
select ok((select relrowsecurity from pg_class where oid = 'public.swimmer_availabilities'::regclass), 'RLS activée : swimmer_availabilities');
select ok((select relrowsecurity from pg_class where oid = 'public.seances'::regclass), 'RLS activée : seances');
select ok((select relrowsecurity from pg_class where oid = 'public.series'::regclass), 'RLS activée : series');
select ok((select relrowsecurity from pg_class where oid = 'public.auto_evaluations'::regclass), 'RLS activée : auto_evaluations');
select ok((select relrowsecurity from pg_class where oid = 'public.llm_providers'::regclass), 'RLS activée : llm_providers');
select ok((select relrowsecurity from pg_class where oid = 'public.otp_codes'::regclass), 'RLS activée : otp_codes');
select ok((select relrowsecurity from pg_class where oid = 'public.audit_log'::regclass), 'RLS activée : audit_log');

-- Index principaux (E1).
select has_index('public', 'seances', 'seances_nageur_id_idx', 'index seances(nageur_id)');
select has_index('public', 'seances', 'seances_coach_id_statut_idx', 'index seances(coach_id, statut)');
select has_index('public', 'seances', 'seances_statut_idx', 'index seances(statut)');
select has_index('public', 'series', 'series_seance_id_idx', 'index series(seance_id)');
select has_index('public', 'swimmer_availabilities', 'swimmer_availabilities_nageur_id_idx', 'index swimmer_availabilities(nageur_id)');
select has_index('public', 'profiles', 'profiles_coach_id_idx', 'index profiles(coach_id)');
select has_index('public', 'profiles', 'profiles_role_idx', 'index profiles(role)');

-- Unicité partielle : un seul fournisseur LLM actif (RG-38).
select ok((select indisunique from pg_index where indexrelid = 'public.llm_providers_un_seul_actif'::regclass),
  'llm_providers_un_seul_actif est unique');
select ok((select indpred is not null from pg_index where indexrelid = 'public.llm_providers_un_seul_actif'::regclass),
  'llm_providers_un_seul_actif est partiel (where is_active)');

-- Types énumérés et domaine (E1).
select has_type('public', 'role', 'type role');
select has_type('public', 'niveau', 'type niveau');
select has_type('public', 'objectif', 'type objectif');
select has_type('public', 'materiel', 'type materiel');
select has_type('public', 'type_nage', 'type type_nage');
select has_type('public', 'moment_journee', 'type moment_journee');
select has_type('public', 'statut_seance', 'type statut_seance');
select has_type('public', 'fournisseur_llm', 'type fournisseur_llm');
select has_domain('public', 'duree_seance', 'domaine duree_seance (liste fermée 30/45/60/75/90/120)');

-- Fonctions utilitaires d'autorisation (E1).
select has_function('public', 'current_user_role', 'fonction current_user_role()');
select has_function('public', 'my_coach_id', 'fonction my_coach_id()');
select has_function('public', 'is_coach_of', array['uuid'], 'fonction is_coach_of(uuid)');

select * from finish();
rollback;
