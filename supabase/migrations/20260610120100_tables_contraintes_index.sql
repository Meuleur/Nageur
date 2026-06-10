-- CH1 / E1 — Tables, contraintes, cascades (RG-41), index et triggers d'intégrité.
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).

-- ---------------------------------------------------------------------------
-- profiles — profil applicatif lié à auth.users (E1).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.role not null,
  prenom text not null constraint profiles_prenom_longueur check (char_length(prenom) between 1 and 50),
  nom text not null constraint profiles_nom_longueur check (char_length(nom) between 1 and 50),
  email text not null unique,
  -- Affectation coach↔nageur (RG-10 : au plus un coach ; RG-13 : nul autorisé).
  -- Suppression du coach → désaffectation, le nageur et ses données restent (RG-15).
  coach_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- swimmer_profiles — profil sportif du nageur, 1–1 avec un profil nageur (E1/A4).
-- ---------------------------------------------------------------------------
create table if not exists public.swimmer_profiles (
  nageur_id uuid primary key references public.profiles (id) on delete cascade,
  niveau public.niveau not null,
  frequence integer not null constraint swimmer_profiles_frequence_1_7 check (frequence between 1 and 7),
  duree public.duree_seance not null,
  bassin integer not null constraint swimmer_profiles_bassin_25_50 check (bassin in (25, 50)),
  objectifs public.objectif[] not null constraint swimmer_profiles_objectifs_min_1 check (cardinality(objectifs) >= 1),
  materiel public.materiel[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- swimmer_availabilities — grille jour × moment, une ligne par créneau (ADR-016).
-- ---------------------------------------------------------------------------
create table if not exists public.swimmer_availabilities (
  id uuid primary key default gen_random_uuid(),
  nageur_id uuid not null references public.profiles (id) on delete cascade,
  jour integer not null constraint swimmer_availabilities_jour_1_7 check (jour between 1 and 7),
  moment public.moment_journee not null,
  constraint swimmer_availabilities_creneau_unique unique (nageur_id, jour, moment)
);

-- ---------------------------------------------------------------------------
-- seances — séance générée, machine à états A3.
-- ---------------------------------------------------------------------------
create table if not exists public.seances (
  id uuid primary key default gen_random_uuid(),
  nageur_id uuid not null references public.profiles (id) on delete cascade,
  -- Coach au moment de la génération ; suppression du coach → la séance reste (RG-15).
  coach_id uuid references public.profiles (id) on delete set null,
  statut public.statut_seance not null default 'en_attente',
  echauffement_distance_m integer constraint seances_echauffement_distance_positive check (echauffement_distance_m >= 0),
  echauffement_consignes text,
  retour_calme_distance_m integer constraint seances_retour_calme_distance_positive check (retour_calme_distance_m >= 0),
  retour_calme_consignes text,
  distance_totale_m integer, -- cohérence avec les séries : contrôle applicatif (E1)
  duree_estimee_min integer,
  commentaire_coach text,
  fournisseur_llm public.fournisseur_llm, -- traçabilité (C2/C4)
  tokens integer constraint seances_tokens_positifs check (tokens >= 0),
  generated_at timestamptz not null default now(),
  processed_at timestamptz,
  -- RG-29 : commentaire obligatoire (et non vide) au refus.
  constraint seances_commentaire_obligatoire_si_refus
    check (statut <> 'refusee' or (commentaire_coach is not null and btrim(commentaire_coach) <> '')),
  -- E1 : processed_at nul tant que la séance est en attente.
  constraint seances_processed_at_nul_si_en_attente
    check (statut <> 'en_attente' or processed_at is null)
);

-- ---------------------------------------------------------------------------
-- series — corps de séance (E1/A4).
-- ---------------------------------------------------------------------------
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null references public.seances (id) on delete cascade,
  ordre integer not null constraint series_ordre_min_1 check (ordre >= 1),
  repetitions integer not null constraint series_repetitions_min_1 check (repetitions >= 1),
  distance_m integer not null constraint series_distance_multiple_25 check (distance_m > 0 and distance_m % 25 = 0),
  type_nage public.type_nage not null,
  recuperation_s integer not null constraint series_recuperation_positive check (recuperation_s >= 0),
  consigne text
);

-- ---------------------------------------------------------------------------
-- auto_evaluations — une par séance (E1/A4).
-- ---------------------------------------------------------------------------
create table if not exists public.auto_evaluations (
  id uuid primary key default gen_random_uuid(),
  seance_id uuid not null unique references public.seances (id) on delete cascade,
  nageur_id uuid not null references public.profiles (id) on delete cascade,
  ressenti integer not null constraint auto_evaluations_ressenti_1_5 check (ressenti between 1 and 5),
  difficulte integer constraint auto_evaluations_difficulte_1_10 check (difficulte between 1 and 10),
  commentaire text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- llm_providers — configuration fournisseurs IA (C4, ADR-007).
-- Clé API chiffrée côté serveur, jamais lue côté client (RLS sans policy + revoke).
-- ---------------------------------------------------------------------------
create table if not exists public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  fournisseur public.fournisseur_llm not null unique,
  api_key_encrypted text not null,
  modele text,
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

-- RG-38 : un seul fournisseur actif à la fois (unicité partielle).
create unique index if not exists llm_providers_un_seul_actif
  on public.llm_providers (is_active)
  where is_active;

-- ---------------------------------------------------------------------------
-- otp_codes — codes 2FA e-mail (C1), serveur uniquement.
-- ---------------------------------------------------------------------------
create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  used boolean not null default false
);

-- ---------------------------------------------------------------------------
-- audit_log — journal léger (C1/D3), sans données personnelles ni secrets.
-- Pas de FK sur actor_id : l'audit survit à la suppression du compte.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Index principaux (E1).
-- ---------------------------------------------------------------------------
create index if not exists seances_nageur_id_idx on public.seances (nageur_id);
create index if not exists seances_coach_id_statut_idx on public.seances (coach_id, statut); -- file d'attente coach
create index if not exists seances_statut_idx on public.seances (statut);
create index if not exists series_seance_id_idx on public.series (seance_id);
create index if not exists swimmer_availabilities_nageur_id_idx on public.swimmer_availabilities (nageur_id);
create index if not exists profiles_coach_id_idx on public.profiles (coach_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- Triggers d'intégrité.
-- Convention : auth.uid() est nul hors session utilisateur (service role,
-- migrations, seed) → les garde-fous "qui peut modifier quoi" ne s'appliquent
-- qu'aux sessions authentifiées ; le serveur garde la main (E1).
-- ---------------------------------------------------------------------------

-- E1/RG-10/RG-13 : coach_id valide uniquement si la cible a role=coach
-- et le porteur role=nageur.
create or replace function public.check_profiles_coach_affectation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_cible public.role;
begin
  if new.coach_id is null then
    return new;
  end if;
  if new.role <> 'nageur' then
    raise exception 'coach_id : seul un profil nageur peut avoir un coach (E1, RG-10)';
  end if;
  select p.role into role_cible from public.profiles p where p.id = new.coach_id;
  if role_cible is distinct from 'coach' then
    raise exception 'coach_id : la cible doit avoir le rôle coach (E1, RG-10)';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_coach_affectation on public.profiles;
create trigger profiles_coach_affectation
  before insert or update of coach_id, role on public.profiles
  for each row execute function public.check_profiles_coach_affectation();

-- RG-01 (rôle fixé), RG-12 (affectation = super admin), email miroir de auth (E1).
-- Le super admin n'écrit que affectations et rôles sur les autres profils (E1).
create or replace function public.check_profiles_champs_proteges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_acteur public.role;
begin
  -- Contexte serveur (service role, migrations, seed) : pas de restriction.
  if auth.uid() is null then
    return new;
  end if;

  select p.role into role_acteur from public.profiles p where p.id = auth.uid();

  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'profiles : id et created_at ne sont pas modifiables';
  end if;
  if new.email is distinct from old.email then
    raise exception 'email : miroir de auth, géré côté serveur uniquement (E1)';
  end if;
  if new.role is distinct from old.role and role_acteur is distinct from 'super_admin' then
    raise exception 'role : fixé à la création, modifiable par le super admin uniquement (RG-01)';
  end if;
  if new.coach_id is distinct from old.coach_id and role_acteur is distinct from 'super_admin' then
    raise exception 'coach_id : affectation gérée par le super admin uniquement (RG-12)';
  end if;
  -- E1 : le super admin écrit affectations et rôles, pas l'identité des autres.
  if role_acteur = 'super_admin' and old.id <> auth.uid()
     and (new.prenom is distinct from old.prenom or new.nom is distinct from old.nom) then
    raise exception 'profiles : le super admin ne modifie que role et coach_id des autres profils (E1)';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_champs_proteges on public.profiles;
create trigger profiles_champs_proteges
  before update on public.profiles
  for each row execute function public.check_profiles_champs_proteges();

-- E1 : swimmer_profiles est en relation 1–1 avec un profil de rôle nageur.
create or replace function public.check_swimmer_profiles_role_nageur()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  role_porteur public.role;
begin
  select p.role into role_porteur from public.profiles p where p.id = new.nageur_id;
  if role_porteur is distinct from 'nageur' then
    raise exception 'swimmer_profiles : le profil porteur doit avoir le rôle nageur (E1)';
  end if;
  return new;
end;
$$;

drop trigger if exists swimmer_profiles_role_nageur on public.swimmer_profiles;
create trigger swimmer_profiles_role_nageur
  before insert or update of nageur_id on public.swimmer_profiles
  for each row execute function public.check_swimmer_profiles_role_nageur();

-- A3/RG-30 : les statuts validee, modifiee, refusee sont terminaux ;
-- aucune transition n'en sort (et donc aucun retour à en_attente).
create or replace function public.check_seances_statut_terminal()
returns trigger
language plpgsql
as $$
begin
  if old.statut <> 'en_attente' and new.statut is distinct from old.statut then
    raise exception 'statut : % est un statut terminal, transition interdite (A3, RG-30)', old.statut;
  end if;
  return new;
end;
$$;

drop trigger if exists seances_statut_terminal on public.seances;
create trigger seances_statut_terminal
  before update of statut on public.seances
  for each row execute function public.check_seances_statut_terminal();

-- Tenue à jour de updated_at (E1 : colonne updated_at sur ces deux tables).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists swimmer_profiles_updated_at on public.swimmer_profiles;
create trigger swimmer_profiles_updated_at
  before update on public.swimmer_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists llm_providers_updated_at on public.llm_providers;
create trigger llm_providers_updated_at
  before update on public.llm_providers
  for each row execute function public.set_updated_at();
