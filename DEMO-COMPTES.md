# Comptes de démonstration (branche `demo` uniquement)

> Document de la **branche `demo`** — version de démonstration client : IA simulée,
> e-mails non envoyés, 2FA sautable. **Ne jamais merger dans `main`, ne jamais
> utiliser cette configuration en production.**

Tous les comptes ci-dessous proviennent de `supabase/seed.sql`, sont **déjà
vérifiés** (e-mail confirmé) et partagent le même mot de passe :

> **Mot de passe commun : `Password123!`**

En mode démo (`DEMO_MODE=true`), après le mot de passe, l'écran « Vérification
en deux étapes » affiche un bouton **« Passer (démo) »** : aucun code OTP n'est
envoyé ni exigé.

## Un compte par rôle (parcours principal)

| Rôle        | E-mail                      | Identité        | Remarques               |
| ----------- | --------------------------- | --------------- | ----------------------- |
| Nageur      | `lea.nageur@nageur.test`    | Léa Petit       | Coach : Camille Durand  |
| Coach       | `camille.coach@nageur.test` | Camille Durand  | Suit Léa, Noah et Mia   |
| Super admin | `admin@nageur.test`         | Dominique Admin | Espace `/admin` complet |

## Comptes utiles pour des scénarios précis

| Scénario                            | E-mail                     | Détail                                                           |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| Générer une séance (IA simulée)     | `ines.nageur@nageur.test`  | Profil sportif complet, coach Sacha Royer — génération immédiate |
| Liste de séances aux 4 statuts      | `jade.nageur@nageur.test`  | Séances en attente / validée / modifiée / refusée seedées        |
| Séance validée + auto-évaluation    | `louis.nageur@nageur.test` | Détail utilisable, commentaire coach                             |
| Nageur sans coach (parcours bloqué) | `lucas.nageur@nageur.test` | Génération désactivée (RG-13/RG-14)                              |
| Coach avec séance à valider         | `remi.coach@nageur.test`   | File de relecture non vide (nageur Anna Faure)                   |

L'inscription d'un **nouveau** compte nageur fonctionne aussi : en mode démo, le
compte est auto-confirmé côté serveur — connexion possible immédiatement, sans
e-mail de vérification (le mot de passe choisi doit respecter la politique C1 ;
`Password123!` y est refusé comme « trop courant »).

## Variables d'environnement du déploiement de démo (Vercel)

| Variable                                                     | Valeur                     | Rôle                                              |
| ------------------------------------------------------------ | -------------------------- | ------------------------------------------------- |
| `DEMO_MODE`                                                  | `true`                     | Active bannière DÉMO, saut 2FA, auto-confirmation |
| `EMAIL_DRIVER`                                               | `demo`                     | Aucun e-mail applicatif envoyé (no-op)            |
| `LLM_DRIVER`                                                 | `simule`                   | Séances déterministes, aucune clé LLM requise     |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | projet Supabase de démo    | Jamais le projet de production                    |
| `SUPABASE_SERVICE_ROLE_KEY`                                  | clé du projet de démo      | Server only                                       |
| `AUTH_SECRET`                                                | ≥ 32 caractères aléatoires | Jetons de transition, rate limiting               |
| `APP_URL`                                                    | URL Vercel de la démo      | Liens des e-mails métier (inutilisés en démo)     |

Inutiles en démo : `RESEND_API_KEY`, `EMAIL_FROM`, `MAILPIT_URL`, clés LLM.

## Lancer la démo en local

```bash
pnpm supabase:start          # pile locale (Postgres + GoTrue + Mailpit)
pnpm db:reset                # migrations + seed (comptes ci-dessus)
DEMO_MODE=true EMAIL_DRIVER=demo LLM_DRIVER=simule pnpm dev
```

Tests dédiés : `pnpm test:e2e:demo` (suite `tests/e2e/mode-demo/`, serveur
lancé automatiquement avec les variables de démo — aucun serveur dev ne doit
déjà occuper le port 3000). La suite standard `pnpm test:e2e` vérifie à
l'inverse que **rien** de tout cela n'existe sans `DEMO_MODE`.
