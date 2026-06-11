# Notifications métier (CH7 — C3, ADR-020)

E-mails métier N4–N8 du catalogue C3 (les e-mails d'authentification N1–N3
sont livrés par CH2). Tout part du serveur via le service e-mail commun
(`src/server/email`, pilote `EMAIL_DRIVER` : Resend en production, Mailpit en
dev/E2E — aucun envoi réseau réel en CI).

| #   | Événement (A3)                           | Destinataire          | Point d'appel                           |
| --- | ---------------------------------------- | --------------------- | --------------------------------------- |
| N4  | Séance créée `en_attente` (T1)           | Coach affecté (RG-36) | `genererSeanceAction` (CH5)             |
| N5  | Séance validée (T2)                      | Nageur (RG-37)        | `traiterSeanceAction` (CH6)             |
| N6  | Séance modifiée puis validée (T3)        | Nageur (RG-37)        | `modifierEtValiderSeanceAction` (CH6)   |
| N7  | Séance refusée (T4) — commentaire inclus | Nageur (RG-37)        | `traiterSeanceAction` (CH6)             |
| N8  | Coach affecté au nageur (PA-4)           | Nageur                | **À brancher en CH8** (voir ci-dessous) |

## Architecture

Patron CH2/CH4 : orchestrateur **pur** à dépendances injectées, câblage réel
`server-only` dans `index.ts` — les tests Vitest n'importent que le pur.

- `emails.ts` — gabarits paramétrés (pur). Charte B4, français, données
  minimales : jamais de nom ni d'adresse tierce ; seule exception, le
  commentaire de refus (N7), échappé dans la version HTML.
- `notification.ts` — orchestrateur (pur) : résolution du destinataire,
  envoi avec relances (`DELAIS_RELANCE_MS`), journalisation. **Ne rejette
  jamais** : tout échec est journalisé puis avalé.
- `destinataires.ts` — e-mails coach/nageur lus en service role (ADR-024).
- `audit.ts` — journal `audit_log` best effort, **sans donnée personnelle ni
  contenu** (E2) : type N4–N8, uuid pseudonymes, tentatives, motif.
- `index.ts` — interface serveur : `notifierCoachSeanceEnAttente`,
  `notifierNageurSeanceTraitee`, `notifierNageurCoachAffecte`.

## Non bloquant (ADR-020)

L'e-mail n'est **jamais sur le chemin critique** de la transaction métier :

1. les actions appellent le module via `after()` de `next/server` — l'envoi
   s'exécute après la réponse (la séance est créée/traitée et l'utilisateur
   redirigé, que l'e-mail parte ou non) ;
2. l'orchestrateur n'émet aucune exception, par construction ;
3. l'envoi est retenté (3 tentatives : immédiate, +1 s, +3 s) puis l'échec
   est journalisé (`notification.echec`) et le flux continue.

## Brancher N8 (CH8)

L'affectation coach↔nageur n'existe pas encore. Dans l'action serveur
d'affectation (admin), après l'écriture de `profiles.coach_id` réussie :

```ts
import { after } from "next/server";
import { notifierNageurCoachAffecte } from "@/server/notifications";

// … écriture de l'affectation réussie …
after(() => notifierNageurCoachAffecte(nageurId));
```
