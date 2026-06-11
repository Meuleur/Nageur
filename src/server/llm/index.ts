import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { chargerContexteGeneration } from "@/server/data/nageurs";
import { insererSeanceGeneree } from "@/server/data/seances";
import { getLlmDriver } from "@/server/env";

import { journaliserEvenementLlm } from "./audit";
import { chargerConfigLlmActive } from "./config";
import { genererSeanceAvecDeps } from "./generation";
import { createClientLlm } from "./providers";
import { createClientLlmSimule } from "./providers/simule";
import { testerCleFournisseur, type ResultatTestCle } from "./test-cle";
import type { FournisseurLlm, ResultatGeneration } from "./types";

export { GenerationSeanceError } from "./errors";
export type { ResultatGeneration } from "./types";
export type { ResultatTestCle } from "./test-cle";

/**
 * Interface serveur unique de génération (C2) :
 * `genererSeance(nageurId) → séance persistée en_attente` (RG-19/RG-21).
 * Tout s'exécute côté serveur : lecture de la clé (Vault), appel
 * fournisseur, validation Zod, persistance service role. À brancher sur
 * l'écran nageur en CH5 (E-12).
 */
/** Résultat du test de clé E-31 — « cle_absente » : rien à tester (C4). */
export type ResultatTestCleAdmin = ResultatTestCle | { ok: false; code: "cle_absente" };

/**
 * Test de validité de la clé ENREGISTRÉE d'un fournisseur (E-31, C4) :
 * lecture Vault côté serveur (get_llm_api_key, service role) puis appel
 * minimal — aucune séance générée, aucun token consommé. Avec
 * LLM_DRIVER=simule (dev/E2E), le test réussit sans réseau dès qu'une clé
 * est enregistrée (aucun appel réel en CI, D2).
 */
export async function testerCleLlm(fournisseur: FournisseurLlm): Promise<ResultatTestCleAdmin> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_llm_api_key", {
    p_fournisseur: fournisseur,
  });

  if (error) {
    console.error("llm: lecture de la clé à tester impossible");
    return { ok: false, code: "fournisseur_injoignable" };
  }
  if (!data || typeof data !== "string") {
    return { ok: false, code: "cle_absente" };
  }
  if (getLlmDriver() === "simule") {
    return { ok: true };
  }
  return testerCleFournisseur(fournisseur, { apiKey: data });
}

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
