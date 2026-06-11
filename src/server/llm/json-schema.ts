import { TYPES_NAGE } from "@/features/seances/schemas";

/**
 * Schéma JSON structurel de la séance, passé aux modes « sorties
 * structurées » des fournisseurs (C2). Volontairement réduit aux types,
 * énums et clés requises : les contraintes numériques (multiples de 25,
 * bornes, cohérences) ne sont pas supportées par ces modes et restent
 * validées côté application par le schéma Zod partagé (D2).
 */

const BLOC = {
  type: "object",
  additionalProperties: false,
  required: ["distance_m", "consignes"],
  properties: {
    distance_m: { type: "integer" },
    consignes: { type: "string" },
  },
} as const;

const SERIE = {
  type: "object",
  additionalProperties: false,
  required: ["repetitions", "distance_m", "type_nage", "recuperation_s", "consigne"],
  properties: {
    repetitions: { type: "integer" },
    distance_m: { type: "integer" },
    type_nage: { type: "string", enum: [...TYPES_NAGE] },
    recuperation_s: { type: "integer" },
    consigne: { type: "string", description: "Chaîne vide si aucune consigne." },
  },
} as const;

export const SCHEMA_JSON_SEANCE: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "echauffement",
    "corps",
    "retour_au_calme",
    "distance_totale_m",
    "duree_estimee_min",
  ],
  properties: {
    echauffement: BLOC,
    corps: { type: "array", items: SERIE },
    retour_au_calme: BLOC,
    distance_totale_m: { type: "integer" },
    duree_estimee_min: { type: "integer" },
  },
};
