-- CH1 / E1 — Row Level Security : fonctions utilitaires d'autorisation et
-- politiques par table et par opération, conformes au tableau RLS de E1.
--
-- Principes (E1) :
--   * le client navigateur (clé anon / utilisateur authentifié) n'accède qu'au
--     permis ; les écritures sensibles passent par le serveur (service role,
--     hors RLS) après vérification des règles A2 ;
--   * toutes les policies sont déclarées TO authenticated : le rôle anon n'a
--     aucune policy, donc aucun accès ;
--   * otp_codes, llm_providers et audit_log : RLS sans policy + REVOKE
--     explicite → serveur uniquement.
--
-- Idempotent : rejouable sans erreur sur une base déjà migrée (D3).

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires d'autorisation (E1 : rôle courant + auth.uid()).
-- SECURITY DEFINER : lisent profiles sans déclencher la récursion RLS.
-- ---------------------------------------------------------------------------

-- Rôle applicatif de l'utilisateur courant (null hors session utilisateur).
create or replace function public.current_user_role()
returns public.role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

-- Coach affecté à l'utilisateur courant (null si aucun).
create or replace function public.my_coach_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.coach_id from public.profiles p where p.id = (select auth.uid());
$$;

-- L'utilisateur courant est-il le coach affecté de ce nageur ? (RG-25, RG-43)
create or replace function public.is_coach_of(cible_nageur_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = cible_nageur_id
      and p.coach_id = (select auth.uid())
  );
$$;

revoke all on function public.current_user_role() from public, anon;
revoke all on function public.my_coach_id() from public, anon;
revoke all on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.my_coach_id() to authenticated;
grant execute on function public.is_coach_of(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS activée sur toutes les tables de données (RG-43).
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.swimmer_profiles enable row level security;
alter table public.swimmer_availabilities enable row level security;
alter table public.seances enable row level security;
alter table public.series enable row level security;
alter table public.auto_evaluations enable row level security;
alter table public.llm_providers enable row level security;
alter table public.otp_codes enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   Nageur : lit/écrit son profil ; voit prénom + nom de son coach via la vue
--            dédiée my_coach uniquement (pas d'accès direct à la ligne du
--            coach, e-mail non exposé — ADR-024).
--   Coach  : lit son profil ; lit les profils de ses nageurs affectés.
--   Admin  : lit tout (identités + rôles + affectations) ; écrit affectations
--            et rôles (champs protégés par trigger, cf. migration tables).
--   Insert/Delete : serveur uniquement (création de compte = CH2, suppression
--   en cascade depuis auth.users).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_son_profil on public.profiles;
create policy profiles_select_son_profil
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- ADR-024 : remplacée par la vue my_coach — on s'assure qu'elle n'existe plus.
drop policy if exists profiles_select_nageur_lit_son_coach on public.profiles;

drop policy if exists profiles_select_coach_lit_ses_nageurs on public.profiles;
create policy profiles_select_coach_lit_ses_nageurs
  on public.profiles for select to authenticated
  using (coach_id = (select auth.uid()));

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select to authenticated
  using ((select public.current_user_role()) = 'super_admin');

drop policy if exists profiles_update_son_profil on public.profiles;
create policy profiles_update_son_profil
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using ((select public.current_user_role()) = 'super_admin')
  with check ((select public.current_user_role()) = 'super_admin');

-- ---------------------------------------------------------------------------
-- Vue my_coach (ADR-024) — minimisation du profil coach exposé au nageur.
-- Le nageur n'obtient que id, prenom, nom de SON coach. Vue volontairement
-- non security_invoker : elle s'exécute avec les droits de son propriétaire
-- (postgres) et contourne donc la RLS de profiles de façon contrôlée — elle
-- ne renvoie au plus qu'une ligne (le coach de l'appelant) et 3 colonnes,
-- jamais l'e-mail.
-- ---------------------------------------------------------------------------
create or replace view public.my_coach as
  select p.id, p.prenom, p.nom
  from public.profiles p
  where p.id = public.my_coach_id();

alter view public.my_coach set (security_invoker = false);

-- La vue est techniquement auto-updatable et s'exécute en tant que postgres :
-- on révoque TOUT (y compris les privilèges par défaut de authenticated) puis
-- on ne rend que SELECT — aucune écriture possible à travers la vue.
revoke all on public.my_coach from public, anon, authenticated;
grant select on public.my_coach to authenticated;

-- ---------------------------------------------------------------------------
-- swimmer_profiles
--   Nageur : lit/écrit le sien. Coach : lit ceux de ses nageurs affectés.
--   Admin : pas d'accès au contenu (agrégats côté serveur uniquement).
-- ---------------------------------------------------------------------------
drop policy if exists swimmer_profiles_select_nageur on public.swimmer_profiles;
create policy swimmer_profiles_select_nageur
  on public.swimmer_profiles for select to authenticated
  using (nageur_id = (select auth.uid()));

drop policy if exists swimmer_profiles_select_coach on public.swimmer_profiles;
create policy swimmer_profiles_select_coach
  on public.swimmer_profiles for select to authenticated
  using (public.is_coach_of(nageur_id));

drop policy if exists swimmer_profiles_insert_nageur on public.swimmer_profiles;
create policy swimmer_profiles_insert_nageur
  on public.swimmer_profiles for insert to authenticated
  with check (nageur_id = (select auth.uid()));

drop policy if exists swimmer_profiles_update_nageur on public.swimmer_profiles;
create policy swimmer_profiles_update_nageur
  on public.swimmer_profiles for update to authenticated
  using (nageur_id = (select auth.uid()))
  with check (nageur_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- swimmer_availabilities
--   Nageur : lit/écrit les siennes (la grille se modifie par ajout/retrait de
--   lignes, ADR-016 → insert/update/delete). Coach : lit celles de ses nageurs.
--   Admin : non.
-- ---------------------------------------------------------------------------
drop policy if exists swimmer_availabilities_select_nageur on public.swimmer_availabilities;
create policy swimmer_availabilities_select_nageur
  on public.swimmer_availabilities for select to authenticated
  using (nageur_id = (select auth.uid()));

drop policy if exists swimmer_availabilities_select_coach on public.swimmer_availabilities;
create policy swimmer_availabilities_select_coach
  on public.swimmer_availabilities for select to authenticated
  using (public.is_coach_of(nageur_id));

drop policy if exists swimmer_availabilities_insert_nageur on public.swimmer_availabilities;
create policy swimmer_availabilities_insert_nageur
  on public.swimmer_availabilities for insert to authenticated
  with check (nageur_id = (select auth.uid()));

drop policy if exists swimmer_availabilities_update_nageur on public.swimmer_availabilities;
create policy swimmer_availabilities_update_nageur
  on public.swimmer_availabilities for update to authenticated
  using (nageur_id = (select auth.uid()))
  with check (nageur_id = (select auth.uid()));

drop policy if exists swimmer_availabilities_delete_nageur on public.swimmer_availabilities;
create policy swimmer_availabilities_delete_nageur
  on public.swimmer_availabilities for delete to authenticated
  using (nageur_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- seances
--   Nageur : lit les siennes — tous statuts, marquage côté UI (RG-32) ; le
--   détail (séries) n'est lisible que si la séance est utilisable, cf. series.
--   Coach : lit celles de ses nageurs affectés (RG-25).
--   Écritures (création RG-21, transitions de statut, commentaire) : serveur
--   uniquement (service role) — aucune policy insert/update/delete.
--   Admin : pas d'accès au contenu (agrégats côté serveur, ADR-020).
-- ---------------------------------------------------------------------------
drop policy if exists seances_select_nageur on public.seances;
create policy seances_select_nageur
  on public.seances for select to authenticated
  using (nageur_id = (select auth.uid()));

drop policy if exists seances_select_coach on public.seances;
create policy seances_select_coach
  on public.seances for select to authenticated
  using (public.is_coach_of(nageur_id));

-- ---------------------------------------------------------------------------
-- series
--   Nageur : lit via la séance autorisée = une de ses séances utilisable
--   (validee/modifiee, RG-32).
--   Coach : lit via les séances de ses nageurs affectés (historique, RG-15) ;
--   édite (insert/update/delete) uniquement via une séance en cours de
--   traitement (statut en_attente, transition T3 de A3).
--   Admin : non.
-- ---------------------------------------------------------------------------
drop policy if exists series_select_nageur on public.series;
create policy series_select_nageur
  on public.series for select to authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and s.nageur_id = (select auth.uid())
        and s.statut in ('validee', 'modifiee')
    )
  );

drop policy if exists series_select_coach on public.series;
create policy series_select_coach
  on public.series for select to authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and public.is_coach_of(s.nageur_id)
    )
  );

drop policy if exists series_insert_coach_seance_en_attente on public.series;
create policy series_insert_coach_seance_en_attente
  on public.series for insert to authenticated
  with check (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and public.is_coach_of(s.nageur_id)
        and s.statut = 'en_attente'
    )
  );

drop policy if exists series_update_coach_seance_en_attente on public.series;
create policy series_update_coach_seance_en_attente
  on public.series for update to authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and public.is_coach_of(s.nageur_id)
        and s.statut = 'en_attente'
    )
  )
  with check (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and public.is_coach_of(s.nageur_id)
        and s.statut = 'en_attente'
    )
  );

drop policy if exists series_delete_coach_seance_en_attente on public.series;
create policy series_delete_coach_seance_en_attente
  on public.series for delete to authenticated
  using (
    exists (
      select 1 from public.seances s
      where s.id = seance_id
        and public.is_coach_of(s.nageur_id)
        and s.statut = 'en_attente'
    )
  );

-- ---------------------------------------------------------------------------
-- auto_evaluations
--   Nageur : lit/écrit les siennes (rattachées à ses propres séances).
--   Le rattachement à une séance utilisable (RG-34) : contrôle applicatif (E1).
--   Coach : lit celles de ses nageurs affectés (RG-35).
--   Admin : non.
-- ---------------------------------------------------------------------------
drop policy if exists auto_evaluations_select_nageur on public.auto_evaluations;
create policy auto_evaluations_select_nageur
  on public.auto_evaluations for select to authenticated
  using (nageur_id = (select auth.uid()));

drop policy if exists auto_evaluations_select_coach on public.auto_evaluations;
create policy auto_evaluations_select_coach
  on public.auto_evaluations for select to authenticated
  using (public.is_coach_of(nageur_id));

drop policy if exists auto_evaluations_insert_nageur on public.auto_evaluations;
create policy auto_evaluations_insert_nageur
  on public.auto_evaluations for insert to authenticated
  with check (
    nageur_id = (select auth.uid())
    and exists (
      select 1 from public.seances s
      where s.id = seance_id
        and s.nageur_id = (select auth.uid())
    )
  );

drop policy if exists auto_evaluations_update_nageur on public.auto_evaluations;
create policy auto_evaluations_update_nageur
  on public.auto_evaluations for update to authenticated
  using (nageur_id = (select auth.uid()))
  with check (
    nageur_id = (select auth.uid())
    and exists (
      select 1 from public.seances s
      where s.id = seance_id
        and s.nageur_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- llm_providers, otp_codes, audit_log — serveur uniquement (E1).
-- RLS activée sans aucune policy + REVOKE des privilèges client : ni le rôle
-- anon ni un utilisateur authentifié ne peuvent lire ou écrire ces tables.
-- Le service role (serveur) conserve son accès (hors RLS).
-- ---------------------------------------------------------------------------
revoke all on table public.llm_providers from anon, authenticated;
revoke all on table public.otp_codes from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
