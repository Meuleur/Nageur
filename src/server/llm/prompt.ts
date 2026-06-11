import {
  BASSIN_LABELS,
  DUREE_LABELS,
  MATERIEL_LABELS,
  NIVEAU_LABELS,
  OBJECTIF_LABELS,
} from "@/features/profil/labels";

import type { ProfilPseudonymise } from "./types";

/**
 * Stratégie de prompt (C2/ADR-019) — langue de génération : français.
 * Deux parties : prompt système (rôle, structure, contraintes dures, format)
 * et prompt utilisateur (attributs pseudonymisés uniquement — la référence
 * opaque reste hors LLM, C2).
 */

export const PROMPT_SYSTEME = `Tu es un entraîneur de natation expert. Tu conçois une séance d'entraînement individuelle, complète et réaliste, adaptée au profil fourni.

Structure imposée de la séance :
1. un échauffement (distance en mètres + consignes) ;
2. un corps de séance composé d'au moins une série (répétitions, distance unitaire en mètres, type de nage, récupération en secondes entre répétitions, consigne) ;
3. un retour au calme (distance en mètres + consignes).

Contraintes dures, toutes obligatoires :
- respecter le niveau du nageur, la durée cible et la taille du bassin ;
- n'utiliser AUCUN matériel autre que celui listé comme disponible (si la liste est vide, aucune mention de matériel) ;
- toutes les distances (échauffement, séries, retour au calme) sont des multiples de 25 mètres ;
- la distance totale est exactement la somme : échauffement + (répétitions × distance de chaque série) + retour au calme ;
- la durée estimée correspond au volume proposé et reste proche de la durée cible ;
- le type de nage de chaque série est exactement l'une de ces valeurs : crawl, dos, brasse, papillon, quatre_nages ;
- adapter le contenu aux objectifs du nageur ;
- rédiger toutes les consignes en français.

Format de réponse : uniquement le JSON suivant, sans texte autour, sans bloc de code :
{
  "echauffement": { "distance_m": entier, "consignes": "texte" },
  "corps": [
    { "repetitions": entier, "distance_m": entier, "type_nage": "crawl|dos|brasse|papillon|quatre_nages", "recuperation_s": entier, "consigne": "texte (chaîne vide si aucune)" }
  ],
  "retour_au_calme": { "distance_m": entier, "consignes": "texte" },
  "distance_totale_m": entier,
  "duree_estimee_min": entier
}`;

export function buildPromptUtilisateur(profil: ProfilPseudonymise): string {
  const objectifs = profil.objectifs.map((o) => OBJECTIF_LABELS[o]).join(", ");
  const materiel =
    profil.materiel.length > 0
      ? profil.materiel.map((m) => MATERIEL_LABELS[m]).join(", ")
      : "aucun";

  return `Profil du nageur :
- Niveau : ${NIVEAU_LABELS[profil.niveau]}
- Fréquence d'entraînement : ${profil.frequenceParSemaine} séance(s) par semaine
- Durée cible de la séance : ${DUREE_LABELS[profil.dureeCibleMin] ?? `${profil.dureeCibleMin} min`} (${profil.dureeCibleMin} minutes)
- Objectifs : ${objectifs}
- Bassin : ${BASSIN_LABELS[profil.bassinM] ?? `${profil.bassinM} m`}
- Matériel disponible : ${materiel}

Génère la séance.`;
}

/**
 * Relance unique après sortie non conforme (C2) : même profil, avec le
 * détail des non-conformités pour corriger la nouvelle proposition.
 */
export function buildPromptRelance(profil: ProfilPseudonymise, problemes: string[]): string {
  return `${buildPromptUtilisateur(profil)}

Ta proposition précédente était invalide :
${problemes.map((p) => `- ${p}`).join("\n")}

Génère une nouvelle séance entièrement conforme aux contraintes et au format JSON demandé.`;
}
