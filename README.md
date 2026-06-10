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

La page d'accueil est une démonstration de la charte (B4) : palette, typographie Inter,
boutons, badges de statut, cartes et micro-animations. Aucune logique métier (chantier CH0).

## Scripts

| Script              | Rôle                                     |
| ------------------- | ---------------------------------------- |
| `pnpm dev`          | serveur de développement                 |
| `pnpm build`        | build de production                      |
| `pnpm start`        | sert le build de production              |
| `pnpm lint`         | ESLint                                   |
| `pnpm typecheck`    | vérification TypeScript (`tsc --noEmit`) |
| `pnpm test`         | tests unitaires (Vitest)                 |
| `pnpm test:e2e`     | tests E2E (Playwright)¹                  |
| `pnpm format`       | formatage Prettier (écriture)            |
| `pnpm format:check` | vérification du formatage                |

¹ Nécessite une fois `pnpm exec playwright install`. Aucun scénario en CH0 (config de base).

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

GitHub Actions (`.github/workflows/ci.yml`) : lint, typecheck, tests unitaires et build
à chaque push et pull request.

## Workflow Git (F3)

`main` = référence déployée en production, jamais de push direct. Un chantier = une branche
`chantier/CHx-…` → Pull Request vers `main` → revue → merge (décision humaine).
Commits courts en anglais au format `type: sujet` (`feat`, `fix`, `chore`, `test`, `docs`, `refactor`).
