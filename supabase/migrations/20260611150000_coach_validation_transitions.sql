-- CH6 / A3 — Traitement d'une séance par le coach : transitions T2 (valider),
-- T3 (modifier puis valider) et T4 (refuser), appliquées atomiquement.
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).
--
-- Garde-fous au plus près des données (A2/A3) :
--   * RG-25 : seul le coach AFFECTÉ AU MOMENT du traitement agit — la relation
--     coach↔nageur est relue ici même, sous verrou de la séance ;
--   * RG-30/A3 : seule une séance en_attente est traitable (les statuts
--     terminaux restent de toute façon protégés par le trigger
--     seances_statut_terminal, CH1) ;
--   * RG-29 : commentaire obligatoire (et non vide) au refus — doublé par la
--     contrainte CHECK seances_commentaire_obligatoire_si_refus (CH1) ;
--   * T3 : le contenu (échauffement, séries, retour au calme) et la distance
--     totale recalculée sont remplacés dans la MÊME transaction que le
--     changement de statut — aucune séance modifiée à moitié.

create or replace function public.traiter_seance(
  p_seance_id uuid,
  p_coach_id uuid,
  p_statut_cible public.statut_seance,
  p_commentaire text,
  p_modification jsonb default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_statut public.statut_seance;
  v_nageur_id uuid;
  v_commentaire text := nullif(btrim(coalesce(p_commentaire, '')), '');
begin
  if p_statut_cible not in ('validee', 'modifiee', 'refusee') then
    raise exception 'statut cible invalide : % (A3)', p_statut_cible;
  end if;

  -- Verrou : sérialise deux traitements concurrents de la même séance.
  select s.statut, s.nageur_id into v_statut, v_nageur_id
  from public.seances s
  where s.id = p_seance_id
  for update of s;

  if not found then
    raise exception 'seance inconnue : %', p_seance_id;
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_nageur_id and p.coach_id = p_coach_id
  ) then
    raise exception 'coach non affecte a ce nageur (RG-25)';
  end if;

  if v_statut <> 'en_attente' then
    raise exception 'seance deja traitee : statut % terminal (RG-30)', v_statut;
  end if;

  if p_statut_cible = 'refusee' and v_commentaire is null then
    raise exception 'commentaire obligatoire au refus (RG-29)';
  end if;

  if p_statut_cible = 'modifiee' then
    if p_modification is null
       or jsonb_typeof(p_modification -> 'series') <> 'array'
       or jsonb_array_length(p_modification -> 'series') < 1 then
      raise exception 'contenu de modification invalide : au moins une serie est requise (T3)';
    end if;

    delete from public.series where seance_id = p_seance_id;

    insert into public.series
      (seance_id, ordre, repetitions, distance_m, type_nage, recuperation_s, consigne)
    select
      p_seance_id,
      row_number() over (),
      (s ->> 'repetitions')::integer,
      (s ->> 'distance_m')::integer,
      (s ->> 'type_nage')::public.type_nage,
      (s ->> 'recuperation_s')::integer,
      s ->> 'consigne'
    from jsonb_array_elements(p_modification -> 'series') as s;

    update public.seances
    set echauffement_distance_m = (p_modification -> 'echauffement' ->> 'distance_m')::integer,
        echauffement_consignes  = p_modification -> 'echauffement' ->> 'consignes',
        retour_calme_distance_m = (p_modification -> 'retour_au_calme' ->> 'distance_m')::integer,
        retour_calme_consignes  = p_modification -> 'retour_au_calme' ->> 'consignes',
        -- E1 : distance totale cohérente — recalculée du contenu réellement écrit.
        distance_totale_m =
          (p_modification -> 'echauffement' ->> 'distance_m')::integer
          + (p_modification -> 'retour_au_calme' ->> 'distance_m')::integer
          + (select sum(se.repetitions * se.distance_m)::integer
             from public.series se where se.seance_id = p_seance_id),
        statut = 'modifiee',
        commentaire_coach = v_commentaire,
        processed_at = now()
    where id = p_seance_id;
  else
    update public.seances
    set statut = p_statut_cible,
        commentaire_coach = v_commentaire,
        processed_at = now()
    where id = p_seance_id;
  end if;

  -- Traitement = événement métier sensible (E1/D3), sans contenu personnel.
  insert into public.audit_log (event_type, actor_id, metadata)
  values ('seance.traitee', p_coach_id,
          jsonb_build_object('seance_id', p_seance_id, 'statut', p_statut_cible));
end;
$$;

-- EXECUTE est accordé à PUBLIC par défaut (piège vu au CH1/CH2) → révocation
-- systématique : le traitement est une opération serveur (service role), la
-- relecture côté client reste couverte par la RLS (E1).
revoke all on function public.traiter_seance(
    uuid, uuid, public.statut_seance, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.traiter_seance(
    uuid, uuid, public.statut_seance, text, jsonb)
  to service_role;
