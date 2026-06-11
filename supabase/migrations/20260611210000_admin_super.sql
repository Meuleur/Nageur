-- CH8 / C4 — Espace Super Admin : agrégats de métriques (RG-39), gestion des
-- fournisseurs LLM (RG-38, ADR-007) et affectations coach↔nageur (RG-10 à
-- RG-15). Toutes les fonctions sont SECURITY DEFINER, EXECUTE réservé au
-- service_role : les server actions revérifient le rôle super_admin avant
-- de les appeler (RG-40), la RLS reste la barrière côté client.
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).

-- ---------------------------------------------------------------------------
-- admin_metrics — agrégats du tableau de bord (E-30, RG-39, ADR-020).
-- AUCUN contenu de séance ni d'auto-évaluation : uniquement des comptages et
-- des sommes. p_depuis filtre la période (null = depuis toujours) :
--   * « générées » et tokens : par generated_at ;
--   * « validées/modifiées/refusées » : par processed_at (traitées sur la
--     période) ;
--   * « en attente » : stock courant (A3 : EN_ATTENTE en cours), hors filtre ;
--   * série « générées par jour » : 30 derniers jours, hors filtre (graphe).
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics(p_depuis timestamptz default null)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with bornes as (
    select coalesce(p_depuis, '-infinity'::timestamptz) as depuis
  ),
  generees as (
    select s.tokens, s.fournisseur_llm
    from public.seances s, bornes b
    where s.generated_at >= b.depuis
  ),
  traitees as (
    select s.statut
    from public.seances s, bornes b
    where s.processed_at is not null and s.processed_at >= b.depuis
  )
  select jsonb_build_object(
    'comptes', jsonb_build_object(
      'coachs', (select count(*) from public.profiles where role = 'coach'),
      'nageurs', (select count(*) from public.profiles where role = 'nageur'),
      'nageurs_sans_coach',
        (select count(*) from public.profiles where role = 'nageur' and coach_id is null)
    ),
    'seances', jsonb_build_object(
      'generees', (select count(*) from generees),
      'validees', (select count(*) from traitees where statut = 'validee'),
      'modifiees', (select count(*) from traitees where statut = 'modifiee'),
      'refusees', (select count(*) from traitees where statut = 'refusee'),
      'en_attente', (select count(*) from public.seances where statut = 'en_attente')
    ),
    'tokens', jsonb_build_object(
      'total', (select coalesce(sum(tokens), 0) from generees),
      'anthropic',
        (select coalesce(sum(tokens), 0) from generees where fournisseur_llm = 'anthropic'),
      'openai',
        (select coalesce(sum(tokens), 0) from generees where fournisseur_llm = 'openai')
    ),
    'par_fournisseur', jsonb_build_object(
      'anthropic', (select count(*) from generees where fournisseur_llm = 'anthropic'),
      'openai', (select count(*) from generees where fournisseur_llm = 'openai')
    ),
    'serie_generees_30j', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'jour', to_char(j.jour, 'YYYY-MM-DD'),
            'generees', coalesce(c.n, 0)
          ) order by j.jour
        ),
        '[]'::jsonb
      )
      from generate_series(
        date_trunc('day', now()) - interval '29 days',
        date_trunc('day', now()),
        interval '1 day'
      ) as j(jour)
      left join (
        select date_trunc('day', generated_at) as jour, count(*) as n
        from public.seances
        where generated_at >= date_trunc('day', now()) - interval '29 days'
        group by 1
      ) c on c.jour = j.jour
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- set_llm_api_key — version CH8 : même signature et même mécanisme Vault que
-- CH4 (les grants existants restent valides), avec en plus updated_at, pour
-- afficher la date de dernière rotation en E-31 (jamais la clé, ADR-007).
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
  set api_key_encrypted = v_secret_id::text,
      updated_at = now()
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
-- set_llm_model — choix du modèle d'un fournisseur (E-31, C4).
-- ---------------------------------------------------------------------------
create or replace function public.set_llm_model(
  p_fournisseur public.fournisseur_llm,
  p_modele text,
  p_actor uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_modele is null or btrim(p_modele) = '' then
    raise exception 'modele vide pour %', p_fournisseur;
  end if;

  update public.llm_providers
  set modele = btrim(p_modele),
      updated_at = now()
  where fournisseur = p_fournisseur;

  if not found then
    raise exception 'fournisseur LLM inconnu : %', p_fournisseur;
  end if;

  -- Le nom de modèle est une donnée de configuration, pas personnelle (E2).
  insert into public.audit_log (event_type, actor_id, metadata)
  values ('llm.modele_choisi', p_actor,
          jsonb_build_object('fournisseur', p_fournisseur, 'modele', btrim(p_modele)));
end;
$$;

-- ---------------------------------------------------------------------------
-- set_active_llm_provider — fournisseur actif UNIQUE (RG-38) : désactivation
-- puis activation dans la même transaction (l'index partiel
-- llm_providers_un_seul_actif reste la garantie finale).
-- ---------------------------------------------------------------------------
create or replace function public.set_active_llm_provider(
  p_fournisseur public.fournisseur_llm,
  p_actor uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.llm_providers
  set is_active = false
  where is_active and fournisseur <> p_fournisseur;

  update public.llm_providers
  set is_active = true
  where fournisseur = p_fournisseur;

  if not found then
    raise exception 'fournisseur LLM inconnu : %', p_fournisseur;
  end if;

  insert into public.audit_log (event_type, actor_id, metadata)
  values ('llm.fournisseur_active', p_actor,
          jsonb_build_object('fournisseur', p_fournisseur));
end;
$$;

-- ---------------------------------------------------------------------------
-- get_llm_api_key — clé déchiffrée d'un fournisseur (actif ou non), pour le
-- « test de clé » E-31 (appel minimal côté serveur, C4). Comme
-- get_active_llm_config : la clé ne quitte jamais le serveur, n'est jamais
-- journalisée ni renvoyée au client. Null si aucune clé enregistrée.
-- ---------------------------------------------------------------------------
create or replace function public.get_llm_api_key(p_fournisseur public.fournisseur_llm)
returns text
language sql
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.llm_providers p
  left join vault.decrypted_secrets s on s.id::text = p.api_key_encrypted
  where p.fournisseur = p_fournisseur;
$$;

-- ---------------------------------------------------------------------------
-- set_coach_assignment — affectation / réaffectation / désaffectation (E-32,
-- RG-10 à RG-13) : p_coach_id null = désaffectation. Garde-fous au plus près
-- des données : cible nageur, coach effectif. RG-15 : les séances existantes
-- ne sont pas touchées (coach_id de seances = coach au moment de la
-- génération). RG-12 : seule cette fonction (service role) écrit l'affectation.
-- ---------------------------------------------------------------------------
create or replace function public.set_coach_assignment(
  p_nageur_id uuid,
  p_coach_id uuid,
  p_actor uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.role;
begin
  select role into v_role from public.profiles where id = p_nageur_id;
  if not found or v_role <> 'nageur' then
    raise exception 'nageur inconnu (RG-12) : %', p_nageur_id;
  end if;

  if p_coach_id is not null then
    select role into v_role from public.profiles where id = p_coach_id;
    if not found or v_role <> 'coach' then
      raise exception 'coach inconnu (RG-12) : %', p_coach_id;
    end if;
  end if;

  update public.profiles set coach_id = p_coach_id where id = p_nageur_id;

  -- Identifiants pseudonymes uniquement (E2).
  insert into public.audit_log (event_type, actor_id, metadata)
  values ('affectation.modifiee', p_actor,
          jsonb_build_object('nageur_id', p_nageur_id, 'coach_id', p_coach_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Privilèges : EXECUTE est accordé à PUBLIC par défaut (piège vu au CH1/CH2)
-- → révocation systématique puis grant minimal au service_role.
-- ---------------------------------------------------------------------------
revoke all on function public.admin_metrics(timestamptz)
  from public, anon, authenticated;
revoke all on function public.set_llm_model(public.fournisseur_llm, text, uuid)
  from public, anon, authenticated;
revoke all on function public.set_active_llm_provider(public.fournisseur_llm, uuid)
  from public, anon, authenticated;
revoke all on function public.get_llm_api_key(public.fournisseur_llm)
  from public, anon, authenticated;
revoke all on function public.set_coach_assignment(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.admin_metrics(timestamptz) to service_role;
grant execute on function public.set_llm_model(public.fournisseur_llm, text, uuid)
  to service_role;
grant execute on function public.set_active_llm_provider(public.fournisseur_llm, uuid)
  to service_role;
grant execute on function public.get_llm_api_key(public.fournisseur_llm) to service_role;
grant execute on function public.set_coach_assignment(uuid, uuid, uuid) to service_role;
