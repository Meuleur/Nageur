import { describe, expect, it } from "vitest";

import { formatDateSeance, formatDistance, formatDuree } from "@/features/seances/labels";
import {
  estStatutSeance,
  estUtilisable,
  STATUT_BADGE_VARIANTS,
  STATUT_LABELS,
  STATUTS_SEANCE,
} from "@/features/seances/statuts";

describe("statuts de séance (A3/RG-32)", () => {
  it("couvre exactement les quatre statuts de l'énum E1", () => {
    expect(STATUTS_SEANCE).toEqual(["en_attente", "validee", "modifiee", "refusee"]);
  });

  it("associe les libellés français de A3", () => {
    expect(STATUT_LABELS.en_attente).toBe("En attente");
    expect(STATUT_LABELS.validee).toBe("Validée");
    expect(STATUT_LABELS.modifiee).toBe("Modifiée par le coach");
    expect(STATUT_LABELS.refusee).toBe("Refusée");
  });

  it("associe chaque statut à sa couleur sémantique B4", () => {
    expect(STATUT_BADGE_VARIANTS).toEqual({
      en_attente: "pending",
      validee: "valid",
      modifiee: "modified",
      refusee: "refused",
    });
  });

  it("RG-32 : seules validée et modifiée sont utilisables", () => {
    expect(estUtilisable("validee")).toBe(true);
    expect(estUtilisable("modifiee")).toBe(true);
    expect(estUtilisable("en_attente")).toBe(false);
    expect(estUtilisable("refusee")).toBe(false);
  });

  it("estStatutSeance rejette les valeurs hors énum (filtre E-13)", () => {
    expect(estStatutSeance("validee")).toBe(true);
    expect(estStatutSeance("supprimee")).toBe(false);
    expect(estStatutSeance(undefined)).toBe(false);
    expect(estStatutSeance(["validee", "refusee"])).toBe(false);
  });
});

describe("formats d'affichage (B2/B4)", () => {
  it("formatDistance affiche les mètres en français", () => {
    expect(formatDistance(800)).toBe("800 m");
    // Séparateur de milliers français (espace insécable étroite).
    expect(formatDistance(1300)).toBe("1 300 m");
  });

  it("formatDuree suit la convention des durées E-11", () => {
    expect(formatDuree(30)).toBe("30 min");
    expect(formatDuree(45)).toBe("45 min");
    expect(formatDuree(60)).toBe("1 h");
    expect(formatDuree(75)).toBe("1 h 15");
    expect(formatDuree(90)).toBe("1 h 30");
    expect(formatDuree(120)).toBe("2 h");
  });

  it("formatDateSeance rend une date longue en français", () => {
    expect(formatDateSeance("2026-06-08T10:00:00+02:00")).toBe("lundi 8 juin 2026");
  });
});
