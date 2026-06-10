-- CH2 — Objets d'authentification (C1) :
--   * trigger handle_new_user : profil applicatif automatique, rôle sûr
--     (jamais issu des métadonnées contrôlées par le client, RG-01/RG-02) ;
--   * otp_codes : created_at + index du code actif ;
--   * auth_rate_limits : serveur uniquement (RLS sans policy + REVOKE) ;
--   * revoke_all_sessions : invalidation des sessions (reset, ADR-018) ;
--   * recovery_token_issued_at : fenêtre d'1 h du lien de reset (ADR-018).
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- Simulation d'une session Supabase authentifiée (cf. 03_rls_isolation_test).
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

-- Retour au contexte serveur (postgres, BYPASSRLS).
create function pg_temp.connecter_serveur() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- Insertion d'un compte auth minimal, dans le style du seed.
create function pg_temp.creer_compte_auth(p_id uuid, p_email text, p_user_meta jsonb, p_app_meta jsonb)
returns void
language plpgsql as $$
begin
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    ('00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
     extensions.crypt('Password123!', extensions.gen_salt('bf')), now(),
     p_app_meta, p_user_meta, now(), now(), '', '', '', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Schéma : nouveaux objets CH2.
-- ---------------------------------------------------------------------------
select has_table('public', 'auth_rate_limits', 'auth_rate_limits existe');
select has_column('public', 'otp_codes', 'created_at', 'otp_codes.created_at existe');
select has_index('public', 'otp_codes', 'otp_codes_user_actif_idx',
  'index du code OTP actif présent');
select trigger_is('auth', 'users', 'on_auth_user_created', 'public', 'handle_new_user',
  'trigger de création de profil branché sur auth.users');

-- ---------------------------------------------------------------------------
-- handle_new_user : profil automatique, rôle sûr (RG-01/RG-02).
-- ---------------------------------------------------------------------------
select pg_temp.creer_compte_auth('90000000-0000-4000-8000-000000000001',
  'trigger.nageur@nageur.test', '{"prenom":"Trig","nom":"Gère"}', '{"provider":"email","providers":["email"]}');

select is((select role::text from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'nageur', 'trigger : rôle nageur par défaut (RG-02)');
select is((select prenom || ' ' || nom from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'Trig Gère', 'trigger : prénom et nom repris des métadonnées');
select is((select email from public.profiles where id = '90000000-0000-4000-8000-000000000001'),
  'trigger.nageur@nageur.test', 'trigger : e-mail miroir de auth.users');

-- Un rôle glissé dans raw_user_meta_data (contrôlé par le client) est ignoré.
select pg_temp.creer_compte_auth('90000000-0000-4000-8000-000000000002',
  'trigger.malicieux@nageur.test',
  '{"prenom":"Mal","nom":"Icieux","role":"super_admin"}', '{"provider":"email","providers":["email"]}');
select is((select role::text from public.profiles where id = '90000000-0000-4000-8000-000000000002'),
  'nageur', 'trigger : un rôle dans user_metadata (client) est ignoré (RG-01)');

-- Un rôle posé par le serveur dans raw_app_meta_data est respecté (C4/CH8).
select pg_temp.creer_compte_auth('90000000-0000-4000-8000-000000000003',
  'trigger.coach@nageur.test',
  '{"prenom":"Coa","nom":"Che"}', '{"provider":"email","providers":["email"],"role":"coach"}');
select is((select role::text from public.profiles where id = '90000000-0000-4000-8000-000000000003'),
  'coach', 'trigger : un rôle app_metadata (serveur) est respecté');

-- Sans métadonnées prenom/nom (seed, outillage) : aucun profil créé.
select pg_temp.creer_compte_auth('90000000-0000-4000-8000-000000000004',
  'trigger.sansmeta@nageur.test', '{}', '{"provider":"email","providers":["email"]}');
select is((select count(*)::int from public.profiles where id = '90000000-0000-4000-8000-000000000004'),
  0, 'trigger : pas de profil sans métadonnées (cas seed)');

-- ---------------------------------------------------------------------------
-- auth_rate_limits : serveur uniquement (comme otp_codes / audit_log, E1).
-- ---------------------------------------------------------------------------
select pg_temp.connecter('30000000-0000-4000-8000-000000000001');
select throws_ok('select count(*) from public.auth_rate_limits', '42501', null,
  'authenticated : lecture de auth_rate_limits refusée');
select throws_ok($$insert into public.auth_rate_limits (bucket) values ('x')$$, '42501', null,
  'authenticated : écriture de auth_rate_limits refusée');
select throws_ok($$select public.revoke_all_sessions('30000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'authenticated : revoke_all_sessions inappelable');
select throws_ok($$select public.recovery_token_issued_at('abc')$$, '42501', null,
  'authenticated : recovery_token_issued_at inappelable');

select pg_temp.connecter_anon();
select throws_ok('select count(*) from public.auth_rate_limits', '42501', null,
  'anon : lecture de auth_rate_limits refusée');

select pg_temp.connecter_serveur();

-- ---------------------------------------------------------------------------
-- revoke_all_sessions : toutes les sessions de l'utilisateur tombent.
-- ---------------------------------------------------------------------------
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', now(), now()),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', now(), now());

select is((select count(*)::int from auth.sessions
           where user_id = '90000000-0000-4000-8000-000000000001'),
  2, 'préparation : deux sessions actives');

select public.revoke_all_sessions('90000000-0000-4000-8000-000000000001');

select is((select count(*)::int from auth.sessions
           where user_id = '90000000-0000-4000-8000-000000000001'),
  0, 'revoke_all_sessions : plus aucune session (ADR-018)');

-- ---------------------------------------------------------------------------
-- recovery_token_issued_at : horodatage du jeton de reset (fenêtre 1 h).
-- ---------------------------------------------------------------------------
insert into auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to, created_at, updated_at)
values ('92000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001',
        'recovery_token', 'hash_de_test_ch2', 'trigger.nageur@nageur.test',
        '2026-06-10 00:00:00', '2026-06-10 00:00:00');

select is(public.recovery_token_issued_at('hash_de_test_ch2'),
  '2026-06-10 00:00:00+00'::timestamptz,
  'recovery_token_issued_at : renvoie la date d''émission du jeton');
select is(public.recovery_token_issued_at('hash_inconnu'), null,
  'recovery_token_issued_at : null pour un jeton inconnu');

select * from finish();
rollback;
