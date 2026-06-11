-- CH4 / C2 — Couche LLM : clés API chiffrées (Vault, ADR-007) et insertion
-- atomique des séances générées (RG-21).
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).
--
-- Mécanisme clés API (ADR-007, cohérent E1 « pgsodium/Vault ») :
--   * le chiffré vit dans vault.secrets (extension supabase_vault, présente
--     par défaut sur les projets Supabase et la pile locale) ;
--   * llm_providers.api_key_encrypted stocke l'identifiant (uuid) du secret
--     Vault — jamais la clé en clair ;
--   * lecture/écriture exclusivement via les fonctions SECURITY DEFINER
--     ci-dessous, EXECUTE réservé au service_role (serveur uniquement).
-- CH8 (UI admin) réutilisera set_llm_api_key tel quel pour la saisie/rotation.

-- ---------------------------------------------------------------------------
-- set_llm_api_key — chiffre et enregistre la clé API d'un fournisseur.
-- Côté CH4 : injection d'une configuration de dev/test (seed, script pnpm).
-- Côté CH8 : écriture par le Super Admin (RG-38) — même mécanisme.
-- ---------------------------------------------------------------------------
create or replace function public.set_llm_api_key(
  p_fournisseur public.fournisseur_llm,
  p_cle text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom_secret text := 'llm_api_key_' || p_fournisseur::text;
  v_secret_id uuid;
begin
  if p_cle is null or btrim(p_cle) = '' then
    raise exception 'cle API vide pour %', p_fournisseur;
  end if;

  select s.id into v_secret_id
  from vault.secrets s
  where s.name = v_nom_secret;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(p_cle, v_nom_secret,
      'Cle API fournisseur LLM, geree par le Super Admin (ADR-007).');
  else
    perform vault.update_secret(v_secret_id, p_cle);
  end if;

  update public.llm_providers
  set api_key_encrypted = v_secret_id::text
  where fournisseur = p_fournisseur;

  if not found then
    raise exception 'fournisseur LLM inconnu : %', p_fournisseur;
  end if;

  -- Rotation de clé = événement sensible (E1/D3), sans contenu de clé.
  insert into public.audit_log (event_type, actor_id, metadata)
  values ('llm.cle_definie', null, jsonb_build_object('fournisseur', p_fournisseur));
end;
$$;

-- ---------------------------------------------------------------------------
-- get_active_llm_config — fournisseur actif (RG-38) + modèle + clé déchiffrée.
-- Appelée uniquement par le serveur (service role) au moment de générer ;
-- la clé ne transite jamais vers le client ni vers les journaux.
-- api_key vaut null si aucune clé n'a encore été enregistrée via Vault.
-- ---------------------------------------------------------------------------
create or replace function public.get_active_llm_config()
returns table (
  fournisseur public.fournisseur_llm,
  modele text,
  api_key text
)
language sql
security definer
set search_path = ''
as $$
  select p.fournisseur, p.modele, s.decrypted_secret
  from public.llm_providers p
  left join vault.decrypted_secrets s on s.id::text = p.api_key_encrypted
  where p.is_active;
$$;

-- ---------------------------------------------------------------------------
-- insert_generated_seance — création atomique d'une séance générée (RG-21) :
-- la séance et TOUTES ses séries réussissent ou échouent ensemble — aucune
-- séance partielle persistée (C2). Garde-fous au plus près des données :
--   * RG-14 : le nageur doit avoir un coach (coach_id dérivé ici même =
--     « coach affecté au moment de la génération », E1) ;
--   * RG-17 : profil sportif requis ;
--   * statut en_attente par défaut de colonne, jamais paramétrable.
-- ---------------------------------------------------------------------------
create or replace function public.insert_generated_seance(
  p_nageur_id uuid,
  p_echauffement_distance_m integer,
  p_echauffement_consignes text,
  p_retour_calme_distance_m integer,
  p_retour_calme_consignes text,
  p_distance_totale_m integer,
  p_duree_estimee_min integer,
  p_fournisseur public.fournisseur_llm,
  p_tokens integer,
  p_series jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coach_id uuid;
  v_seance_id uuid;
begin
  select coach_id into v_coach_id
  from public.profiles
  where id = p_nageur_id and role = 'nageur';

  if not found then
    raise exception 'nageur inconnu : %', p_nageur_id;
  end if;

  if v_coach_id is null then
    raise exception 'nageur sans coach (RG-14) : %', p_nageur_id;
  end if;

  if not exists (select 1 from public.swimmer_profiles where nageur_id = p_nageur_id) then
    raise exception 'profil sportif manquant (RG-17) : %', p_nageur_id;
  end if;

  if p_series is null or jsonb_typeof(p_series) <> 'array'
     or jsonb_array_length(p_series) < 1 then
    raise exception 'corps de seance vide : au moins une serie est requise (A4)';
  end if;

  insert into public.seances
    (nageur_id, coach_id,
     echauffement_distance_m, echauffement_consignes,
     retour_calme_distance_m, retour_calme_consignes,
     distance_totale_m, duree_estimee_min,
     fournisseur_llm, tokens)
  values
    (p_nageur_id, v_coach_id,
     p_echauffement_distance_m, p_echauffement_consignes,
     p_retour_calme_distance_m, p_retour_calme_consignes,
     p_distance_totale_m, p_duree_estimee_min,
     p_fournisseur, p_tokens)
  returning id into v_seance_id;

  insert into public.series
    (seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne)
  select
    v_seance_id,
    row_number() over (),
    (s ->> 'repetitions')::integer,
    (s ->> 'distance_m')::integer,
    (s ->> 'type_nage')::public.type_nage,
    (s ->> 'recuperation_s')::integer,
    s ->> 'consigne'
  from jsonb_array_elements(p_series) as s;

  return v_seance_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilèges : EXECUTE est accordé à PUBLIC par défaut sur toute fonction
-- (piège vu au CH1/CH2) → révocation systématique, puis grant minimal.
-- Ces trois fonctions sont des opérations serveur (service role) uniquement.
-- ---------------------------------------------------------------------------
revoke all on function public.set_llm_api_key(public.fournisseur_llm, text)
  from public, anon, authenticated;
revoke all on function public.get_active_llm_config()
  from public, anon, authenticated;
revoke all on function public.insert_generated_seance(
    uuid, integer, text, integer, text, integer, integer,
    public.fournisseur_llm, integer, jsonb)
  from public, anon, authenticated;

grant execute on function public.set_llm_api_key(public.fournisseur_llm, text)
  to service_role;
grant execute on function public.get_active_llm_config()
  to service_role;
grant execute on function public.insert_generated_seance(
    uuid, integer, text, integer, text, integer, integer,
    public.fournisseur_llm, integer, jsonb)
  to service_role;
