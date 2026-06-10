-- CH2 / C1 — Authentification & comptes : objets base de données.
--
--   1. handle_new_user : création automatique du profil applicatif à la
--      création d'un compte Supabase Auth (RG-02) ;
--   2. otp_codes : created_at + index du code actif (C1, 2FA e-mail) ;
--   3. auth_rate_limits : compteurs de limitation de débit et de
--      verrouillage temporaire (C1 — rate limiting, ~10 échecs) ;
--   4. revoke_all_sessions : invalidation de toutes les sessions d'un
--      utilisateur après changement de mot de passe (ADR-018) ;
--   5. recovery_token_issued_at : âge d'un lien de réinitialisation, pour
--      imposer la validité 1 h (ADR-018) alors que GoTrue n'expose qu'une
--      seule expiration globale des liens e-mail (24 h, alignée sur la
--      vérification d'inscription — voir supabase/config.toml).
--
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).

-- ---------------------------------------------------------------------------
-- 1. Profil applicatif automatique (RG-01, RG-02).
--    Le rôle vient EXCLUSIVEMENT de raw_app_meta_data (modifiable uniquement
--    côté serveur / service role) — jamais de raw_user_meta_data, que le
--    client contrôle. L'inscription publique ne produit donc que des nageurs ;
--    les comptes coach/admin seront créés par le serveur avec app_metadata
--    explicite (C4, CH8).
--    Les comptes créés sans métadonnées prenom/nom (seed, outillage) sont
--    ignorés : leur profil est inséré explicitement par l'outillage concerné.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta_prenom text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'prenom', '')), '');
  meta_nom    text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'nom', '')), '');
  meta_role   text := coalesce(new.raw_app_meta_data ->> 'role', 'nageur');
begin
  if meta_prenom is null or meta_nom is null then
    return new;
  end if;

  if meta_role not in ('nageur', 'coach', 'super_admin') then
    meta_role := 'nageur';
  end if;

  insert into public.profiles (id, role, prenom, nom, email)
  values (new.id, meta_role::public.role, left(meta_prenom, 50), left(meta_nom, 50), new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. otp_codes — horodatage de création (résolution du code actif, purge C1).
-- ---------------------------------------------------------------------------
alter table public.otp_codes
  add column if not exists created_at timestamptz not null default now();

create index if not exists otp_codes_user_actif_idx
  on public.otp_codes (user_id, created_at desc)
  where not used;

-- ---------------------------------------------------------------------------
-- 3. auth_rate_limits — limitation de débit applicative (C1).
--    bucket = HMAC(scope:identifiant) calculé côté serveur : aucune adresse
--    e-mail ni IP en clair en base (E2 / D3). Fenêtre fixe + verrouillage
--    optionnel (locked_until). Serveur uniquement : RLS sans policy + REVOKE,
--    comme otp_codes et audit_log (E1).
-- ---------------------------------------------------------------------------
create table if not exists public.auth_rate_limits (
  bucket text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now(),
  locked_until timestamptz
);

alter table public.auth_rate_limits enable row level security;
revoke all on table public.auth_rate_limits from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. revoke_all_sessions — invalidation des sessions après reset (ADR-018).
--    Supprimer auth.sessions révoque les refresh tokens en cascade ; les
--    access tokens déjà émis expirent en ≤ 1 h (jwt_expiry, C1 « sessions
--    courtes »). Appelable uniquement par le serveur (service role).
-- ---------------------------------------------------------------------------
create or replace function public.revoke_all_sessions(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.sessions where user_id = target_user_id;
  -- Ceinture et bretelles : refresh tokens orphelins (anciens schémas GoTrue).
  delete from auth.refresh_tokens
   where user_id = target_user_id::text and session_id is null;
end;
$$;

revoke all on function public.revoke_all_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_all_sessions(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. recovery_token_issued_at — date d'émission d'un lien de réinitialisation.
--    GoTrue n'a qu'une expiration globale pour tous les liens e-mail
--    (otp_expiry = 24 h, requise pour la vérification d'inscription) ; le
--    serveur applicatif impose en plus la fenêtre d'1 h du lien de reset
--    (ADR-018) en consultant l'horodatage du jeton. Serveur uniquement.
-- ---------------------------------------------------------------------------
create or replace function public.recovery_token_issued_at(p_token_hash text)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select created_at
  from auth.one_time_tokens
  where token_hash = p_token_hash
    and token_type = 'recovery_token'
  order by created_at desc
  limit 1;
$$;

revoke all on function public.recovery_token_issued_at(text) from public, anon, authenticated;
grant execute on function public.recovery_token_issued_at(text) to service_role;
