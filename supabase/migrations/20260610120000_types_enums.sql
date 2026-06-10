-- CH1 / E1 — Types énumérés et domaine de durée de séance.
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).

create extension if not exists pgcrypto with schema extensions;

-- role : super_admin | coach | nageur
do $$ begin
  create type public.role as enum ('super_admin', 'coach', 'nageur');
exception when duplicate_object then null;
end $$;

-- niveau : debutant | intermediaire | confirme | competition
do $$ begin
  create type public.niveau as enum ('debutant', 'intermediaire', 'confirme', 'competition');
exception when duplicate_object then null;
end $$;

-- objectif : endurance | competition | perte_poids | technique | loisir
do $$ begin
  create type public.objectif as enum ('endurance', 'competition', 'perte_poids', 'technique', 'loisir');
exception when duplicate_object then null;
end $$;

-- materiel : plaquettes | pull_buoy | palmes | planche | tuba
do $$ begin
  create type public.materiel as enum ('plaquettes', 'pull_buoy', 'palmes', 'planche', 'tuba');
exception when duplicate_object then null;
end $$;

-- type_nage : crawl | dos | brasse | papillon | quatre_nages
do $$ begin
  create type public.type_nage as enum ('crawl', 'dos', 'brasse', 'papillon', 'quatre_nages');
exception when duplicate_object then null;
end $$;

-- moment_journee : matin | midi | soir
do $$ begin
  create type public.moment_journee as enum ('matin', 'midi', 'soir');
exception when duplicate_object then null;
end $$;

-- statut_seance : en_attente | validee | modifiee | refusee (A3)
do $$ begin
  create type public.statut_seance as enum ('en_attente', 'validee', 'modifiee', 'refusee');
exception when duplicate_object then null;
end $$;

-- fournisseur_llm : openai | anthropic
do $$ begin
  create type public.fournisseur_llm as enum ('openai', 'anthropic');
exception when duplicate_object then null;
end $$;

-- duree_seance : liste fermée 30 | 45 | 60 | 75 | 90 | 120 minutes (A4/ADR-015).
-- Domaine entier + CHECK : valeurs fermées tout en restant un nombre de minutes.
do $$ begin
  create domain public.duree_seance as integer
    constraint duree_seance_valeurs_fermees check (value in (30, 45, 60, 75, 90, 120));
exception when duplicate_object then null;
end $$;
