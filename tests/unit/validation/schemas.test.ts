import { describe, expect, it } from "vitest";

import {
  COMMENTAIRE_REFUS_REQUIS,
  formatErreursModification,
  modificationSeanceSchema,
  parseModificationFormData,
  parseTraitementFormData,
  traitementSchema,
} from "@/features/validation/schemas";

describe("traitementSchema (E-22, RG-26)", () => {
  it("accepte une validation sans commentaire (facultatif, T2)", () => {
    const resultat = traitementSchema.safeParse({
      decision: "valider",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "",
    });
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.commentaire).toBeNull();
    }
  });

  it("accepte une validation avec commentaire, épuré des espaces", () => {
    const resultat = traitementSchema.safeParse({
      decision: "valider",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "  Bonne séance.  ",
    });
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.commentaire).toBe("Bonne séance.");
    }
  });

  it("refuse un refus sans commentaire (RG-29)", () => {
    const resultat = traitementSchema.safeParse({
      decision: "refuser",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "",
    });
    expect(resultat.success).toBe(false);
  });

  it("refuse un refus avec commentaire composé d'espaces (RG-29)", () => {
    const resultat = traitementSchema.safeParse({
      decision: "refuser",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "   ",
    });
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      expect(resultat.error.issues[0]?.message).toBe(COMMENTAIRE_REFUS_REQUIS);
    }
  });

  it("accepte un refus commenté (T4)", () => {
    const resultat = traitementSchema.safeParse({
      decision: "refuser",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "Trop intense cette semaine.",
    });
    expect(resultat.success).toBe(true);
  });

  it("refuse une décision hors valider/refuser", () => {
    const resultat = traitementSchema.safeParse({
      decision: "supprimer",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "x",
    });
    expect(resultat.success).toBe(false);
  });

  it("refuse un identifiant de séance non UUID", () => {
    const resultat = traitementSchema.safeParse({
      decision: "valider",
      seanceId: "pas-un-uuid",
      commentaire: "",
    });
    expect(resultat.success).toBe(false);
  });

  it("extrait décision, séance et commentaire du FormData", () => {
    const formData = new FormData();
    formData.set("decision", "refuser");
    formData.set("seance_id", "40000000-0000-4000-8000-000000000001");
    formData.set("commentaire", "Trop long.");
    expect(parseTraitementFormData(formData)).toEqual({
      decision: "refuser",
      seanceId: "40000000-0000-4000-8000-000000000001",
      commentaire: "Trop long.",
    });
  });
});

const modificationValide = () => ({
  seanceId: "40000000-0000-4000-8000-000000000001",
  echauffement: { distance_m: 300, consignes: "Crawl souple." },
  series: [
    {
      repetitions: 4,
      distance_m: 100,
      type_nage: "crawl",
      recuperation_s: 30,
      consigne: "Allure régulière.",
    },
    { repetitions: 6, distance_m: 50, type_nage: "dos", recuperation_s: 20, consigne: null },
  ],
  retour_au_calme: { distance_m: 200, consignes: "Dos souple." },
  commentaire: "",
});

describe("modificationSeanceSchema (E-23, T3/RG-28)", () => {
  it("accepte une modification conforme", () => {
    const resultat = modificationSeanceSchema.safeParse(modificationValide());
    expect(resultat.success).toBe(true);
  });

  it("refuse un corps de séance vide (au moins une série)", () => {
    const resultat = modificationSeanceSchema.safeParse({
      ...modificationValide(),
      series: [],
    });
    expect(resultat.success).toBe(false);
  });

  it("refuse une distance de série non multiple de 25 m", () => {
    const modification = modificationValide();
    modification.series[0].distance_m = 130;
    expect(modificationSeanceSchema.safeParse(modification).success).toBe(false);
  });

  it("refuse une distance d'échauffement non multiple de 25 m", () => {
    const modification = modificationValide();
    modification.echauffement.distance_m = 310;
    expect(modificationSeanceSchema.safeParse(modification).success).toBe(false);
  });

  it("refuse un type de nage hors énumération", () => {
    const modification = modificationValide();
    modification.series[0].type_nage = "nage_libre";
    expect(modificationSeanceSchema.safeParse(modification).success).toBe(false);
  });

  it("refuse des répétitions nulles ou une récupération négative", () => {
    const sansRepetition = modificationValide();
    sansRepetition.series[0].repetitions = 0;
    expect(modificationSeanceSchema.safeParse(sansRepetition).success).toBe(false);

    const recuperationNegative = modificationValide();
    recuperationNegative.series[0].recuperation_s = -5;
    expect(modificationSeanceSchema.safeParse(recuperationNegative).success).toBe(false);
  });

  it("transforme un commentaire vide en null (facultatif, RG-28)", () => {
    const resultat = modificationSeanceSchema.safeParse(modificationValide());
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.commentaire).toBeNull();
    }
  });
});

describe("parseModificationFormData (E-23)", () => {
  const formDataDeBase = () => {
    const formData = new FormData();
    formData.set("seance_id", "40000000-0000-4000-8000-000000000001");
    formData.set("echauffement_distance_m", "300");
    formData.set("echauffement_consignes", "Crawl souple.");
    formData.set("series.0.repetitions", "4");
    formData.set("series.0.distance_m", "100");
    formData.set("series.0.type_nage", "crawl");
    formData.set("series.0.recuperation_s", "30");
    formData.set("series.0.consigne", "Allure régulière.");
    formData.set("series.1.repetitions", "6");
    formData.set("series.1.distance_m", "50");
    formData.set("series.1.type_nage", "dos");
    formData.set("series.1.recuperation_s", "20");
    formData.set("series.1.consigne", "");
    formData.set("retour_calme_distance_m", "200");
    formData.set("retour_calme_consignes", "Dos souple.");
    formData.set("commentaire", "Adapté.");
    return formData;
  };

  it("reconstruit les séries dans l'ordre des index, nombres convertis", () => {
    const resultat = modificationSeanceSchema.safeParse(
      parseModificationFormData(formDataDeBase()),
    );
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.series).toEqual([
        {
          repetitions: 4,
          distance_m: 100,
          type_nage: "crawl",
          recuperation_s: 30,
          consigne: "Allure régulière.",
        },
        { repetitions: 6, distance_m: 50, type_nage: "dos", recuperation_s: 20, consigne: null },
      ]);
      expect(resultat.data.commentaire).toBe("Adapté.");
    }
  });

  it("laisse Zod signaler un champ numérique vide ou invalide", () => {
    const champVide = formDataDeBase();
    champVide.set("series.0.distance_m", "");
    expect(modificationSeanceSchema.safeParse(parseModificationFormData(champVide)).success).toBe(
      false,
    );

    const nonNumerique = formDataDeBase();
    nonNumerique.set("series.0.repetitions", "beaucoup");
    expect(
      modificationSeanceSchema.safeParse(parseModificationFormData(nonNumerique)).success,
    ).toBe(false);
  });

  it("s'arrête à la première série absente (index contigus)", () => {
    const formData = formDataDeBase();
    formData.delete("series.1.repetitions");
    const parsed = parseModificationFormData(formData);
    expect(parsed.series).toHaveLength(1);
  });
});

describe("formatErreursModification (E-23)", () => {
  it("localise les erreurs par série et par section", () => {
    const modification = modificationValide();
    modification.series[1].distance_m = 130;
    modification.echauffement.distance_m = 310;
    const resultat = modificationSeanceSchema.safeParse(modification);
    expect(resultat.success).toBe(false);
    if (!resultat.success) {
      const erreurs = formatErreursModification(resultat.error);
      expect(erreurs).toContain("Série 2 : Les distances doivent être des multiples de 25 m.");
      expect(erreurs).toContain("Échauffement : Les distances doivent être des multiples de 25 m.");
    }
  });
});
