import "server-only";

import { chargerContexteGeneration } from "@/server/data/nageurs";
import { insererSeanceGeneree } from "@/server/data/seances";
import { getLlmDriver } from "@/server/env";

import { journaliserEvenementLlm } from "./audit";
import { chargerConfigLlmActive } from "./config";
import { genererSeanceAvecDeps } from "./generation";
import { createClientLlm } from "./providers";
import { createClientLlmSimule } from "./providers/simule";
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
        // LLM_DRIVER=simule (dev sans clé réelle / E2E) : séance déterministe
        // sans réseau ; le reste du flux (validation, persistance) est réel.
        getLlmDriver() === "simule"
          ? createClientLlmSimule()
          : createClientLlm(config.fournisseur, {
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
