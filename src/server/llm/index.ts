import "server-only";

import { chargerContexteGeneration } from "@/server/data/nageurs";
import { insererSeanceGeneree } from "@/server/data/seances";

import { journaliserEvenementLlm } from "./audit";
import { chargerConfigLlmActive } from "./config";
import { genererSeanceAvecDeps } from "./generation";
import { createClientLlm } from "./providers";
import type { ResultatGeneration } from "./types";

export { GenerationSeanceError } from "./errors";
export type { ResultatGeneration } from "./types";

/**
 * Interface serveur unique de génération (C2) :
 * `genererSeance(nageurId) → séance persistée en_attente` (RG-19/RG-21).
 * Tout s'exécute côté serveur : lecture de la clé (Vault), appel
 * fournisseur, validation Zod, persistance service role. À brancher sur
 * l'écran nageur en CH5 (E-12).
 */
export async function genererSeance(nageurId: string): Promise<ResultatGeneration> {
  return genererSeanceAvecDeps(
    {
      chargerContexte: chargerContexteGeneration,
      chargerConfig: chargerConfigLlmActive,
      creerClient: (config) =>
        createClientLlm(config.fournisseur, {
          apiKey: config.apiKey,
          modele: config.modele,
        }),
      persister: insererSeanceGeneree,
      journaliser: journaliserEvenementLlm,
      genererReference: () => crypto.randomUUID(),
    },
    nageurId,
  );
}
