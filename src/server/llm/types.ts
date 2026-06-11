import type { Materiel, Niveau, Objectif } from "@/features/profil/schemas";

/** Fournisseurs LLM supportés (E1 : enum fournisseur_llm). */
export type FournisseurLlm = "openai" | "anthropic";

/**
 * Payload pseudonymisé transmis à la couche LLM (ADR-008/RG-20) :
 * uniquement des attributs sportifs non identifiants. Jamais de nom,
 * d'e-mail ni de disponibilités (ADR-019).
 */
export type ProfilPseudonymise = {
  /**
   * ID opaque (RG-20) : uuid aléatoire tiré à chaque génération, sans lien
   * exploitable avec le nageur. Conservé hors du prompt envoyé au LLM (C2 :
   * « référence interne par ID opaque conservée hors LLM »).
   */
  reference: string;
  niveau: Niveau;
  frequenceParSemaine: number;
  dureeCibleMin: number;
  objectifs: Objectif[];
  bassinM: number;
  materiel: Materiel[];
};

/** Résultat d'une génération réussie (séance persistée en_attente, RG-21). */
export type ResultatGeneration = {
  seanceId: string;
  fournisseur: FournisseurLlm;
  /** Tokens consommés (entrée + sortie, toutes tentatives, RG-22). */
  tokens: number;
};
