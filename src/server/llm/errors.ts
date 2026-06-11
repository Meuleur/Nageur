/**
 * Erreurs typées de la génération de séance (C2/RG-23) — module pur,
 * importable par les tests. Les messages sont destinés à l'utilisateur
 * (CH5) ; ils ne contiennent jamais de donnée personnelle ni de secret.
 */

export type CodeErreurGeneration =
  | "nageur_sans_coach" // RG-14
  | "profil_incomplet" // RG-17
  | "configuration_manquante" // aucun fournisseur actif ou clé absente
  | "cle_invalide" // 401/403 fournisseur — alerte admin (C2)
  | "quota_depasse" // 429 fournisseur — alerte admin (C2)
  | "fournisseur_indisponible" // erreur/indisponibilité fournisseur
  | "delai_depasse" // timeout ADR-019 (30–60 s)
  | "sortie_invalide" // sortie non conforme après la relance unique
  | "persistance_echouee"; // séance valide mais écriture refusée — rien créé

type ProprietesErreur = {
  message: string;
  /** RG-23 : le nageur peut relancer immédiatement (RG-24, aucune limite). */
  relancePossible: boolean;
  /** C2 : signalement côté admin via le journal (quota, clé, configuration). */
  alerteAdmin: boolean;
};

const ERREURS: Record<CodeErreurGeneration, ProprietesErreur> = {
  nageur_sans_coach: {
    message: "Vous n'avez pas encore de coach : la génération de séance est indisponible.",
    relancePossible: false,
    alerteAdmin: false,
  },
  profil_incomplet: {
    message: "Complétez votre profil sportif avant de générer une séance.",
    relancePossible: false,
    alerteAdmin: false,
  },
  configuration_manquante: {
    message: "La génération est momentanément indisponible. Réessayez plus tard.",
    relancePossible: false,
    alerteAdmin: true,
  },
  cle_invalide: {
    message: "La génération a échoué. Réessayez dans quelques instants.",
    relancePossible: true,
    alerteAdmin: true,
  },
  quota_depasse: {
    message: "Le service de génération est saturé. Réessayez dans quelques instants.",
    relancePossible: true,
    alerteAdmin: true,
  },
  fournisseur_indisponible: {
    message: "Le service de génération est indisponible. Réessayez dans quelques instants.",
    relancePossible: true,
    alerteAdmin: false,
  },
  delai_depasse: {
    message: "La génération a pris trop de temps. Réessayez dans quelques instants.",
    relancePossible: true,
    alerteAdmin: false,
  },
  sortie_invalide: {
    message: "La séance générée était invalide. Relancez une génération.",
    relancePossible: true,
    alerteAdmin: false,
  },
  persistance_echouee: {
    message: "La séance n'a pas pu être enregistrée. Relancez une génération.",
    relancePossible: true,
    alerteAdmin: true,
  },
};

export class GenerationSeanceError extends Error {
  readonly code: CodeErreurGeneration;
  readonly relancePossible: boolean;
  readonly alerteAdmin: boolean;

  constructor(code: CodeErreurGeneration) {
    super(ERREURS[code].message);
    this.name = "GenerationSeanceError";
    this.code = code;
    this.relancePossible = ERREURS[code].relancePossible;
    this.alerteAdmin = ERREURS[code].alerteAdmin;
  }
}
