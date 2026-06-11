import type { ClientLlm, ReponseFournisseur, RequeteFournisseur } from "./types";

/**
 * Fournisseur simulé (LLM_DRIVER=simule — dev local sans clé réelle et E2E,
 * D2 : « fournisseurs simulés, pas de réseau en CI »). Produit une séance
 * déterministe, valide pour le schéma C2 : distances multiples de 25 m,
 * distance totale = somme exacte, durée estimée = durée cible, aucune
 * mention de matériel (compatible avec tout profil). Jamais utilisé en
 * production — le pilote se choisit par variable d'environnement, comme
 * EMAIL_DRIVER=mailpit.
 */

/** Durée cible extraite du prompt utilisateur (« (60 minutes) », C2). */
export function extraireDureeCibleMin(promptUtilisateur: string): number | null {
  const match = promptUtilisateur.match(/\((\d+)\s+minutes\)/);
  return match ? Number(match[1]) : null;
}

const arrondi25 = (distanceM: number) => Math.max(25, Math.round(distanceM / 25) * 25);

/**
 * Séance simulée dimensionnée sur la durée cible (~50 m par minute) :
 * échauffement ≈ 20 %, retour au calme ≈ 10 %, corps en séries de 100 m
 * (reliquat en dos). Module exporté pour vérifier en test unitaire que la
 * sortie passe le schéma de validation réel.
 */
export function construireSeanceSimulee(dureeCibleMin: number) {
  const distanceTotale = arrondi25(dureeCibleMin * 50);
  const echauffement = arrondi25(distanceTotale * 0.2);
  const retourAuCalme = arrondi25(distanceTotale * 0.1);
  const corpsTotal = distanceTotale - echauffement - retourAuCalme;

  const repetitionsCrawl = Math.floor(corpsTotal / 100);
  const reliquat = corpsTotal - repetitionsCrawl * 100;

  const corps = [];
  if (repetitionsCrawl > 0) {
    corps.push({
      repetitions: repetitionsCrawl,
      distance_m: 100,
      type_nage: "crawl",
      recuperation_s: 30,
      consigne: "Allure régulière, respiration tous les 3 mouvements.",
    });
  }
  if (reliquat > 0 || corps.length === 0) {
    corps.push({
      repetitions: 1,
      distance_m: Math.max(25, reliquat),
      type_nage: "dos",
      recuperation_s: 20,
      consigne: "Nage souple, épaules relâchées.",
    });
  }

  const sommeCorps = corps.reduce((total, s) => total + s.repetitions * s.distance_m, 0);

  return {
    echauffement: {
      distance_m: echauffement,
      consignes: "Nage libre progressive, quelques longueurs d'éducatifs.",
    },
    corps,
    retour_au_calme: {
      distance_m: retourAuCalme,
      consignes: "Dos très souple, respiration ample.",
    },
    distance_totale_m: echauffement + sommeCorps + retourAuCalme,
    duree_estimee_min: dureeCibleMin,
  };
}

export function createClientLlmSimule(): ClientLlm {
  return {
    async generer(requete: RequeteFournisseur): Promise<ReponseFournisseur> {
      // 60 min par défaut si le format du prompt évoluait sans cette regex.
      const dureeCibleMin = extraireDureeCibleMin(requete.utilisateur) ?? 60;
      return {
        texte: JSON.stringify(construireSeanceSimulee(dureeCibleMin)),
        tokensEntree: 420,
        tokensSortie: 380,
      };
    },
  };
}
