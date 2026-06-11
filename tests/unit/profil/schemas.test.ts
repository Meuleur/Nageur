import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseProfilFormData, profilSportifSchema } from "@/features/profil/schemas";

/** Valeurs complètes et valides, telles que soumises par le formulaire E-11. */
function formDataComplet(): FormData {
  const formData = new FormData();
  formData.set("niveau", "intermediaire");
  formData.set("frequence", "3");
  formData.set("duree", "60");
  formData.append("objectifs", "endurance");
  formData.append("objectifs", "technique");
  formData.set("bassin", "25");
  formData.append("materiel", "pull_buoy");
  formData.append("disponibilites", "1-matin");
  formData.append("disponibilites", "3-soir");
  return formData;
}

function fieldErrors(formData: FormData) {
  const parsed = profilSportifSchema.safeParse(parseProfilFormData(formData));
  if (parsed.success) {
    throw new Error("La validation aurait dû échouer.");
  }
  return z.flattenError(parsed.error).fieldErrors;
}

describe("profilSportifSchema — mapping formulaire ↔ données (E-11/E1)", () => {
  it("accepte un profil complet et convertit les champs numériques", () => {
    const parsed = profilSportifSchema.parse(parseProfilFormData(formDataComplet()));
    expect(parsed).toEqual({
      niveau: "intermediaire",
      frequence: 3,
      duree: 60,
      objectifs: ["endurance", "technique"],
      bassin: 25,
      materiel: ["pull_buoy"],
      disponibilites: [
        { jour: 1, moment: "matin" },
        { jour: 3, moment: "soir" },
      ],
    });
  });

  it("matériel et disponibilités sont facultatifs (ADR-016)", () => {
    const formData = formDataComplet();
    formData.delete("materiel");
    formData.delete("disponibilites");
    const parsed = profilSportifSchema.parse(parseProfilFormData(formData));
    expect(parsed.materiel).toEqual([]);
    expect(parsed.disponibilites).toEqual([]);
  });

  it("dédoublonne objectifs et créneaux (unicité E1)", () => {
    const formData = formDataComplet();
    formData.append("objectifs", "endurance");
    formData.append("disponibilites", "1-matin");
    const parsed = profilSportifSchema.parse(parseProfilFormData(formData));
    expect(parsed.objectifs).toEqual(["endurance", "technique"]);
    expect(parsed.disponibilites).toEqual([
      { jour: 1, moment: "matin" },
      { jour: 3, moment: "soir" },
    ]);
  });

  it.each([
    ["niveau", "Choisissez votre niveau."],
    ["frequence", "Choisissez votre fréquence d'entraînement."],
    ["duree", "Choisissez votre durée habituelle de séance."],
    ["bassin", "Choisissez votre bassin habituel."],
  ] as const)("champ obligatoire manquant : %s → message ciblé (ADR-016)", (champ, message) => {
    const formData = formDataComplet();
    formData.delete(champ);
    expect(fieldErrors(formData)[champ]).toEqual([message]);
  });

  it("objectifs vides → message ciblé (au moins 1, A4)", () => {
    const formData = formDataComplet();
    formData.delete("objectifs");
    expect(fieldErrors(formData).objectifs).toEqual(["Choisissez au moins un objectif."]);
  });

  it.each([
    ["niveau", "expert"],
    ["frequence", "0"],
    ["frequence", "8"],
    ["duree", "50"],
    ["bassin", "33"],
    ["objectifs", "vitesse"],
    ["materiel", "bonnet"],
  ] as const)("valeur hors énum refusée : %s = %s", (champ, valeur) => {
    const formData = formDataComplet();
    formData.delete(champ);
    formData.append(champ, valeur);
    expect(fieldErrors(formData)[champ]).toBeDefined();
  });

  it.each(["0-matin", "8-matin", "1-nuit", "matin", "1-matin-2"])(
    "créneau malformé refusé : %s",
    (cle) => {
      const formData = formDataComplet();
      formData.append("disponibilites", cle);
      expect(fieldErrors(formData).disponibilites).toBeDefined();
    },
  );

  it("accepte les 21 créneaux de la grille (7 jours × 3 moments)", () => {
    const formData = formDataComplet();
    formData.delete("disponibilites");
    for (let jour = 1; jour <= 7; jour += 1) {
      for (const moment of ["matin", "midi", "soir"]) {
        formData.append("disponibilites", `${jour}-${moment}`);
      }
    }
    const parsed = profilSportifSchema.parse(parseProfilFormData(formData));
    expect(parsed.disponibilites).toHaveLength(21);
  });
});
