# App Natation

Web app de génération de séances de natation assistée par IA, validées par un coach.
Conception complète dans le dossier `App Nageur/conception/` (documents A–F) ; ce dépôt
applique strictement la stack D1, l'architecture D2, l'infrastructure D3 et la charte B4.

## Stack (D1)

Next.js (App Router) · TypeScript strict · Tailwind CSS v4 · shadcn/ui (Radix) ·
Framer Motion · React Hook Form · Zod · TanStack Query · Supabase (Postgres, Auth, Storage) ·
Vitest · Playwright · pnpm.

## Prérequis

- Node.js ≥ 22
- pnpm ≥ 10 (`corepack enable pnpm` si besoin)

## Installation

```bash
pnpm install
cp .env.example .env.local   # puis renseigner les valeurs (projet Supabase de dev)
pnpm dev                     # http://localhost:3000
```

Pour travailler sur l'authentification (et tout ce qui suit), la **pile Supabase locale
complète** doit tourner (Auth, API, boîte e-mail Mailpit) : `pnpm supabase:start` puis
`pnpm db:reset`. En local, `EMAIL_DRIVER=mailpit` route tous les e-mails (vérification,
réinitialisation, codes 2FA) vers Mailpit — http://127.0.0.1:54324, aucun envoi réel.

## Scripts

| Script                | Rôle                                                |
| --------------------- | --------------------------------------------------- |
| `pnpm dev`            | serveur de développement                            |
| `pnpm build`          | build de production                                 |
| `pnpm start`          | sert le build de production                         |
| `pnpm lint`           | ESLint                                              |
| `pnpm typecheck`      | vérification TypeScript (`tsc --noEmit`)            |
| `pnpm test`           | tests unitaires (Vitest)                            |
| `pnpm test:e2e`       | tests E2E (Playwright)¹                             |
| `pnpm format`         | formatage Prettier (écriture)                       |
| `pnpm format:check`   | vérification du formatage                           |
| `pnpm supabase:start` | pile Supabase locale complète (Auth, API, Mailpit)² |
| `pnpm supabase:stop`  | arrête les conteneurs Supabase locaux               |
| `pnpm db:start`       | base Postgres locale seule (Docker)²                |
| `pnpm db:reset`       | rejoue migrations + seed (base propre)              |
| `pnpm db:test`        | tests SQL pgTAP (RLS, contraintes)                  |
| `pnpm db:stop`        | arrête les conteneurs Supabase locaux               |

¹ Nécessite une fois `pnpm exec playwright install`, la pile complète (`pnpm supabase:start`)
et un `.env.local` avec `EMAIL_DRIVER=mailpit`. Les suites remettent à zéro les compteurs de
rate limiting au démarrage et lisent les e-mails dans Mailpit. Après une suite E2E, exécuter
`pnpm db:reset` avant `pnpm db:test` (les tests pgTAP supposent le seed de référence).
² Nécessite Docker. Le premier démarrage télécharge les images Supabase.

## Structure (D2)

```
src/
  app/                  # routes Next.js (App Router) + groupes (auth)/(nageur)/(coach)/(admin)
    api/                # Route Handlers (opérations serveur)
  features/             # logique métier par domaine (auth, profil, seances, validation, admin, evaluation)
  server/               # services serveur uniquement : llm/, email/, otp/, metrics/, data/
  lib/                  # utilitaires, clients Supabase, config
  components/ui/        # primitives shadcn/ui adaptées à la charte B4
  styles/               # tokens de design B4 (tokens.css) + styles globaux
tests/                  # unit/ (Vitest) + e2e/ (Playwright)
```

Séparation stricte client/serveur : `src/lib/supabase/client.ts` (clé anon, soumise à la RLS)
côté navigateur ; `src/lib/supabase/server.ts` (clé service role, protégée par `server-only`)
réservé aux opérations privilégiées. Aucun secret côté client.

## Base de données & RLS (CH1)

Le schéma (E1) est géré **comme du code** via les migrations Supabase versionnées (D3) :

```
supabase/
  config.toml           # config du projet local (Postgres 17)
  migrations/           # migrations SQL idempotentes, ordonnées par horodatage
    …_types_enums.sql                 # enums E1 + domaine duree_seance (liste fermée)
    …_tables_contraintes_index.sql    # 9 tables, contraintes, cascades RG-41, triggers, index
    …_rls_policies.sql                # fonctions d'autorisation + policies par table/opération
  seed.sql              # jeu de données de test (dev/staging) — jamais en production
  tests/                # tests pgTAP : schéma, contraintes métier, isolation RLS, cascades
```

Principes (E1) : RLS activée sur **toutes** les tables ; un nageur n'accède qu'à ses données
(et au prénom/nom de son coach via la vue dédiée `my_coach` — jamais son e-mail, ADR-024) ;
un coach qu'à ses nageurs affectés ; le super admin gère identités/rôles/affectations mais
n'accède **pas** au contenu (séances, profils sportifs, auto-évaluations) ; `otp_codes`,
`llm_providers` et `audit_log` sont réservés au serveur (aucune policy + privilèges révoqués).
Les écritures sensibles (création de séance, transitions de statut) passent par le serveur.

Comptes du seed (mot de passe commun `Password123!`) : `admin@nageur.test`,
`camille.coach@nageur.test`, `alex.coach@nageur.test`, et 4 nageurs
(`lea.nageur`, `noah.nageur`, `emma.nageur`, `lucas.nageur` — ce dernier sans coach).

## Authentification & comptes (CH2)

Identité conforme à C1 / ADR-018 : inscription nageur avec **vérification d'e-mail**
(lien 24 h, RG-05), connexion **e-mail + mot de passe puis code OTP à 6 chiffres envoyé
par e-mail** (2FA sur mesure), réinitialisation de mot de passe (lien 1 h, réponse
générique, sessions invalidées), politique de mot de passe (≥ 10 caractères, 3 catégories
sur 4, rejet des mots de passe courants), rate limiting applicatif et verrouillage
temporaire après ~10 échecs de connexion.

**Gating du second facteur (exigence centrale C1)** — aucune session Supabase n'est
exposée au navigateur tant que le code OTP n'est pas validé :

1. `loginAction` vérifie le mot de passe **côté serveur** via un client sans persistance ;
   la session technique est révoquée immédiatement (`admin.signOut`) — seul un **jeton de
   transition signé** (cookie httpOnly `an-2fa-en-attente`, 10 min) revient au navigateur ;
2. le code OTP (haché HMAC, 10 min, 5 tentatives, usage unique, renvoi 60 s) est envoyé
   par notre serveur (`src/server/otp`, `src/server/email`) ;
3. `verifyOtpAction` valide le code puis — **seulement là** — établit la session Supabase
   (cookies via les helpers SSR) et redirige selon le rôle (nageur → `/accueil`,
   coach → `/coach`, admin → `/admin`) ;
4. `src/proxy.ts` (Next 16) protège les routes : session validée par `getUser()` + rôle lu
   sous RLS ; vérifier un e-mail ou ouvrir un lien de reset n'authentifie jamais
   (`/auth/confirm` consomme les jetons sans poser de cookie de session).

Les e-mails de vérification/réinitialisation partent de **Supabase Auth** (gabarits
français dans `supabase/templates/`, réglages ADR-018 dans `supabase/config.toml`) ; en
production, configurer le **SMTP Resend** et recopier ces gabarits dans le dashboard
Supabase (bloc commenté dans `config.toml`). Le code OTP part de notre serveur via
**Resend** (`RESEND_API_KEY`, `EMAIL_FROM`) — ou Mailpit en local. `audit_log` trace les
événements sensibles **sans aucune donnée personnelle ni secret**.

## Environnements & secrets (D3)

Trois environnements isolés : **dev** (local, `.env.local`), **staging** et **production**
(variables d'environnement Vercel par environnement). Un projet Supabase distinct par
environnement. **Aucun secret n'est committé** : `.env.example` liste les variables sans
valeurs ; `.gitignore` exclut tous les `.env*`.

## Déploiement (à configurer au moment du déploiement)

- **Vercel — région UE obligatoire** (ADR-021) : forcer l'exécution des fonctions serveur
  en UE (ex. `fra1`) dans les réglages du projet Vercel.
- **Supabase — région UE (Frankfurt)** (ADR-006), un projet par environnement.
- Variables d'environnement Vercel à renseigner par environnement (cf. `.env.example`).
- Protection de la branche `main` recommandée (PR obligatoire, pas de push direct — F3).

## Intégration continue

GitHub Actions (`.github/workflows/ci.yml`) à chaque push et pull request :

- **quality** — formatage (`prettier --check`), lint, typecheck, tests unitaires, build ;
- **database** — démarrage d'une base Supabase propre, application des migrations + seed,
  rejeu des migrations (preuve d'idempotence) et tests pgTAP (isolation RLS, contraintes
  métier, cascades).

Assurance continue de sécurité (audit v1 → CH10) :

- **CodeQL** (`.github/workflows/codeql.yml`) — analyse statique de sécurité du
  TypeScript (requêtes `security-and-quality`) sur chaque PR, sur `main` et chaque
  semaine ; résultats dans l'onglet _Security → Code scanning_ du dépôt ;
- **Dependabot** (`.github/dependabot.yml`) — veille hebdomadaire des dépendances npm
  (mineures/correctifs groupés) et des actions GitHub ;
- `pnpm audit` est exécuté à chaque chantier ; le garde-fou anti-abus de la génération
  (ADR-027, `RATE_LIMITS.generationByUser`) borne le coût LLM sans contredire RG-24.

## Workflow Git (F3)

`main` = référence déployée en production, jamais de push direct. Un chantier = une branche
`chantier/CHx-…` → Pull Request vers `main` → revue → merge (décision humaine).
Commits courts en anglais au format `type: sujet` (`feat`, `fix`, `chore`, `test`, `docs`, `refactor`).
