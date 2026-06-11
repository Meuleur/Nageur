import { describe, expect, it } from "vitest";

import {
  buildEmailCoachAffecte,
  buildEmailSeanceEnAttente,
  buildEmailSeanceModifiee,
  buildEmailSeanceRefusee,
  buildEmailSeanceValidee,
} from "@/server/notifications/emails";

const APP_URL = "https://app-natation.test";
const SEANCE_ID = "40000000-0000-4000-8000-00000000abcd";

describe("gabarits des e-mails métier (C3, B4)", () => {
  it("N4 : objet clair, action vers la relecture coach, aucune identité du nageur (RG-36, E2)", () => {
    const email = buildEmailSeanceEnAttente({
      to: "coach@exemple.test",
      appUrl: APP_URL,
      seanceId: SEANCE_ID,
    });

    expect(email.to).toBe("coach@exemple.test");
    expect(email.subject).toBe("Une séance attend votre validation");
    expect(email.text).toContain("Un de vos nageurs");
    expect(email.text).toContain(`${APP_URL}/coach/seances/${SEANCE_ID}`);
    expect(email.html).toContain(`${APP_URL}/coach/seances/${SEANCE_ID}`);
    // Données minimales : ni nom, ni adresse du nageur, ni contenu de séance.
    expect(email.text).not.toMatch(/@(?!exemple\.test)/);
  });

  it("N5 : séance validée → action vers le détail nageur (RG-37)", () => {
    const email = buildEmailSeanceValidee({
      to: "nageur@exemple.test",
      appUrl: APP_URL,
      seanceId: SEANCE_ID,
    });

    expect(email.subject).toBe("Votre séance est disponible");
    expect(email.text).toContain("validé");
    expect(email.text).toContain(`${APP_URL}/seances/${SEANCE_ID}`);
    expect(email.html).toContain(`${APP_URL}/seances/${SEANCE_ID}`);
  });

  it("N6 : séance ajustée puis validée → message distinct de N5 (RG-37, T3)", () => {
    const email = buildEmailSeanceModifiee({
      to: "nageur@exemple.test",
      appUrl: APP_URL,
      seanceId: SEANCE_ID,
    });

    expect(email.subject).toBe("Votre séance ajustée est disponible");
    expect(email.text).toContain("ajusté");
    expect(email.text).toContain(`${APP_URL}/seances/${SEANCE_ID}`);
  });

  it("N7 : refus → commentaire du coach inclus + action de regénération (RG-29/RG-33)", () => {
    const email = buildEmailSeanceRefusee({
      to: "nageur@exemple.test",
      appUrl: APP_URL,
      commentaire: "Trop de volume cette semaine, on allège.",
    });

    expect(email.subject).toBe("Votre séance a été refusée");
    expect(email.text).toContain("Trop de volume cette semaine, on allège.");
    expect(email.html).toContain("Trop de volume cette semaine, on allège.");
    expect(email.text).toContain(`${APP_URL}/seances/generer`);
    expect(email.html).toContain(`${APP_URL}/seances/generer`);
  });

  it("N7 : le commentaire (texte libre du coach) est échappé dans la version HTML", () => {
    const email = buildEmailSeanceRefusee({
      to: "nageur@exemple.test",
      appUrl: APP_URL,
      commentaire: 'Séance <trop> "dure" & longue',
    });

    expect(email.html).not.toContain("<trop>");
    expect(email.html).toContain("Séance &lt;trop&gt; &quot;dure&quot; &amp; longue");
    // La version texte reste lisible telle quelle.
    expect(email.text).toContain('Séance <trop> "dure" & longue');
  });

  it("N8 : coach affecté → action vers la génération (PA-4)", () => {
    const email = buildEmailCoachAffecte({ to: "nageur@exemple.test", appUrl: APP_URL });

    expect(email.subject).toBe("Un coach vous a été affecté");
    expect(email.text).toContain(`${APP_URL}/seances/generer`);
    expect(email.html).toContain(`${APP_URL}/seances/generer`);
  });

  it("tous les gabarits portent l'identité produit et la mention transactionnelle (C3)", () => {
    const emails = [
      buildEmailSeanceEnAttente({ to: "a@b.test", appUrl: APP_URL, seanceId: SEANCE_ID }),
      buildEmailSeanceValidee({ to: "a@b.test", appUrl: APP_URL, seanceId: SEANCE_ID }),
      buildEmailSeanceModifiee({ to: "a@b.test", appUrl: APP_URL, seanceId: SEANCE_ID }),
      buildEmailSeanceRefusee({ to: "a@b.test", appUrl: APP_URL, commentaire: "RAS." }),
      buildEmailCoachAffecte({ to: "a@b.test", appUrl: APP_URL }),
    ];

    for (const email of emails) {
      expect(email.text).toContain("App Natation");
      expect(email.text).toContain("désinscription");
      expect(email.html).toContain("App Natation");
      expect(email.html).toContain('lang="fr"');
    }
  });
});
