# Couche LLM — génération de séance (CH4, réf. C2)

Capacité serveur livrée au CH4 : `genererSeance(nageurId)` ([index.ts](index.ts))
produit une séance via le fournisseur LLM actif et la persiste **en attente de
validation** (RG-21). Aucun écran ici — le branchement nageur (E-12) arrive en CH5.

## Flux

1. **Préconditions** (RG-14/RG-17) : coach affecté + profil sportif complet,
   sinon erreur explicite sans appel fournisseur.
2. **Configuration active** (RG-38) : fournisseur, modèle et clé lus par la
   fonction SQL `get_active_llm_config()` — la clé est déchiffrée par Vault
   côté Postgres et ne quitte jamais le serveur.
3. **Payload pseudonymisé** (ADR-008/019) : liste blanche stricte — niveau,
   fréquence, durée, objectifs, bassin, matériel. Jamais de nom/e-mail ; les
   **disponibilités ne sont pas transmises** ; la référence opaque (uuid
   aléatoire par génération) reste hors des prompts (C2).
4. **Appel fournisseur** ([providers/](providers/)) : SDK officiels OpenAI et
   Anthropic derrière l'interface unique `ClientLlm`, sorties structurées
   (json_schema) + validation Zod applicative. Paramètres ADR-019 :
   température 0,7, timeout 45 s, 2048 tokens de sortie max, prompts en
   français.
5. **Validation stricte** ([../../features/seances/schemas.ts](../../features/seances/schemas.ts)) :
   structure A4, distances multiples de 25 m, distance totale = somme, durée
   estimée à ±20 % de la cible, matériel mentionné ⊆ matériel du profil,
   type de nage dans l'énum E1. **Une** relance automatique avec le détail
   des non-conformités, puis échec sans séance (C2).
6. **Persistance** : `insert_generated_seance(...)` (SECURITY DEFINER,
   service role uniquement) — séance `en_attente` + séries en une
   transaction, coach dérivé au moment de la génération, `fournisseur_llm`
   et `tokens` (entrée + sortie, toutes tentatives, RG-22) tracés.

## Erreurs (RG-23)

`GenerationSeanceError` ([errors.ts](errors.ts)) porte un `code`, un message
utilisateur, `relancePossible` (RG-24) et `alerteAdmin` (quota, clé invalide,
configuration). Les échecs sont journalisés dans `audit_log`
(`llm.generation_echouee`, métadonnées = code + fournisseur, **jamais** de
donnée personnelle, de prompt ni de clé).

## Clés API — mécanisme Vault (ADR-007) et dépendance CH8

- Les clés vivent **chiffrées** dans `vault.secrets` (extension
  `supabase_vault`) ; `llm_providers.api_key_encrypted` ne stocke que
  l'identifiant du secret. Migration : `20260611100000_llm_cles_generation.sql`.
- Écriture/rotation : `set_llm_api_key(fournisseur, cle)` — journalisée
  (`llm.cle_definie`). Lecture : `get_active_llm_config()`. EXECUTE réservé à
  `service_role` sur les deux (revoke anon/authenticated/public).
- **CH8** branchera l'UI Super Admin (saisie, rotation, fournisseur actif,
  modèle) sur **les mêmes fonctions** — rien à re-concevoir côté crypto.
- En attendant CH8, injection d'une clé réelle en dev :

  ```sh
  # clé via variable d'environnement (évite l'historique du shell)
  LLM_API_KEY=sk-ant-... pnpm llm:set-key anthropic --model claude-sonnet-4-6 --activate
  ```

  Le seed installe des clés **factices** (`sk-ant-seed-cle-factice`) pour que
  dev/CI aient une configuration déchiffrable sans secret réel.

## Pilote simulé (CH5, dev/E2E)

`LLM_DRIVER=simule` remplace l'appel fournisseur par une séance déterministe
([providers/simule.ts](providers/simule.ts)) — valide pour le schéma C2,
dimensionnée sur la durée cible du prompt, sans réseau. Tout le reste du flux
(préconditions, validation Zod, persistance, audit) reste réel. Usage : dev
local sans clé réelle et tests E2E (Playwright démarre son serveur avec cette
variable). Jamais en production — défaut : `fournisseur`.

## Tests (D2 : fournisseurs simulés, pas de réseau en CI)

- `tests/unit/llm/providers.test.ts` — transport `fetch` simulé des SDK :
  inspection du **payload réellement émis** (aucune identité, pas de
  disponibilités, référence hors LLM), mapping 401/429/5xx/timeout, tokens.
- `tests/unit/llm/generation.test.ts` — orchestration : relance unique,
  échec fournisseur sans séance, préconditions, cumul des tokens.
- `tests/unit/llm/payload.test.ts`, `tests/unit/seances/schemas.test.ts` —
  pseudonymisation et règles de validation.
- `supabase/tests/06_llm_generation_test.sql` — privilèges, rotation Vault,
  insertion atomique (aucune séance partielle).

## Note modèles (C2)

Le modèle par défaut est configurable par l'admin (`llm_providers.modele`).
Seed : `claude-sonnet-4-6` (Anthropic, actif) et `gpt-4o` (OpenAI). La
température 0,7 (ADR-019) est supportée par ces modèles ; les Opus 4.7+
d'Anthropic rejettent les paramètres d'échantillonnage — à revisiter en CH8
si l'admin doit pouvoir choisir ces modèles.
