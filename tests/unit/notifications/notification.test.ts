import { describe, expect, it } from "vitest";

import type { MailMessage } from "@/server/email";
import {
  DELAIS_RELANCE_MS,
  notifierCoachSeanceEnAttenteAvecDeps,
  notifierNageurCoachAffecteAvecDeps,
  notifierNageurSeanceTraiteeAvecDeps,
  type DepsNotification,
  type EvenementNotification,
  type SeancePourNotification,
} from "@/server/notifications/notification";

const SEANCE_ID = "40000000-0000-4000-8000-00000000abcd";
const NAGEUR_ID = "30000000-0000-4000-8000-000000000001";
const COACH_ID = "20000000-0000-4000-8000-000000000001";

const SEANCE: SeancePourNotification = {
  nageurId: NAGEUR_ID,
  coachId: COACH_ID,
  commentaireCoach: null,
};

const EMAILS: Record<string, string> = {
  [NAGEUR_ID]: "nageur@exemple.test",
  [COACH_ID]: "coach@exemple.test",
};

type Comportement = "ok" | "echec";

/**
 * Doubles injectés (patron des tests CH4) : la file `envois` décrit le sort
 * de chaque tentative d'envoi ; tout est enregistré pour les assertions.
 */
function fakeDeps(options?: {
  envois?: Comportement[];
  seance?: SeancePourNotification | null;
  emails?: Record<string, string>;
  journaliserEchoue?: boolean;
  chargerSeanceEchoue?: boolean;
}) {
  const envois = [...(options?.envois ?? ["ok"])];
  const messages: MailMessage[] = [];
  const journal: EvenementNotification[] = [];
  const attentes: number[] = [];

  const deps: DepsNotification = {
    chargerSeance: async () => {
      if (options?.chargerSeanceEchoue) {
        throw new Error("base injoignable");
      }
      return options?.seance === undefined ? SEANCE : options.seance;
    },
    chargerEmail: async (profilId) => (options?.emails ?? EMAILS)[profilId] ?? null,
    envoyer: async (message) => {
      const sort = envois.shift() ?? "ok";
      if (sort === "echec") {
        messages.push(message);
        throw new Error("fournisseur e-mail indisponible");
      }
      messages.push(message);
    },
    journaliser: async (evenement) => {
      if (options?.journaliserEchoue) {
        throw new Error("audit_log indisponible");
      }
      journal.push(evenement);
    },
    attendre: async (ms) => {
      attentes.push(ms);
    },
    appUrl: "https://app-natation.test",
  };

  return { deps, messages, journal, attentes };
}

describe("notifierCoachSeanceEnAttenteAvecDeps — N4 (RG-36)", () => {
  it("envoie au coach affecté et journalise le succès en pseudonymes (E2)", async () => {
    const { deps, messages, journal } = fakeDeps();

    await notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID);

    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe("coach@exemple.test");
    expect(messages[0].subject).toBe("Une séance attend votre validation");
    expect(journal).toEqual([
      {
        type: "notification.envoyee",
        metadata: {
          notification: "N4",
          seance_id: SEANCE_ID,
          destinataire_id: COACH_ID,
          tentatives: 1,
        },
      },
    ]);
    // Jamais d'adresse e-mail ni de contenu dans le journal (E2).
    expect(JSON.stringify(journal)).not.toContain("@exemple.test");
  });

  it("retente après un échec transitoire puis aboutit (ADR-020)", async () => {
    const { deps, messages, journal, attentes } = fakeDeps({ envois: ["echec", "echec", "ok"] });

    await notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID);

    expect(messages).toHaveLength(3);
    expect(attentes).toEqual(DELAIS_RELANCE_MS);
    expect(journal[0].type).toBe("notification.envoyee");
    expect(journal[0].metadata.tentatives).toBe(3);
  });

  it("échec persistant : abandonne après les tentatives, journalise, ne rejette JAMAIS (ADR-020)", async () => {
    const { deps, messages, journal } = fakeDeps({
      envois: ["echec", "echec", "echec", "echec"],
    });

    await expect(notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID)).resolves.toBeUndefined();

    expect(messages).toHaveLength(DELAIS_RELANCE_MS.length + 1);
    expect(journal).toEqual([
      {
        type: "notification.echec",
        metadata: {
          notification: "N4",
          seance_id: SEANCE_ID,
          destinataire_id: COACH_ID,
          tentatives: DELAIS_RELANCE_MS.length + 1,
          motif: "envoi_echoue",
        },
      },
    ]);
  });

  it("séance introuvable : aucun envoi, échec journalisé", async () => {
    const { deps, messages, journal } = fakeDeps({ seance: null });

    await notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID);

    expect(messages).toHaveLength(0);
    expect(journal[0]).toEqual({
      type: "notification.echec",
      metadata: { notification: "N4", seance_id: SEANCE_ID, motif: "seance_introuvable" },
    });
  });

  it("nageur sans coach (RG-15 : coach supprimé) : aucun envoi, échec journalisé", async () => {
    const { deps, messages, journal } = fakeDeps({ seance: { ...SEANCE, coachId: null } });

    await notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID);

    expect(messages).toHaveLength(0);
    expect(journal[0].metadata.motif).toBe("destinataire_introuvable");
  });

  it("e-mail du coach introuvable : aucun envoi, échec journalisé", async () => {
    const { deps, messages, journal } = fakeDeps({ emails: {} });

    await notifierCoachSeanceEnAttenteAvecDeps(deps, SEANCE_ID);

    expect(messages).toHaveLength(0);
    expect(journal[0].metadata).toEqual({
      notification: "N4",
      seance_id: SEANCE_ID,
      destinataire_id: COACH_ID,
      motif: "destinataire_introuvable",
    });
  });

  it("même le journal et la lecture en panne ne font jamais rejeter (dernier filet)", async () => {
    const lectureEnPanne = fakeDeps({ chargerSeanceEchoue: true });
    await expect(
      notifierCoachSeanceEnAttenteAvecDeps(lectureEnPanne.deps, SEANCE_ID),
    ).resolves.toBeUndefined();

    const journalEnPanne = fakeDeps({
      envois: ["echec", "echec", "echec"],
      journaliserEchoue: true,
    });
    await expect(
      notifierCoachSeanceEnAttenteAvecDeps(journalEnPanne.deps, SEANCE_ID),
    ).resolves.toBeUndefined();
  });
});

describe("notifierNageurSeanceTraiteeAvecDeps — N5/N6/N7 (RG-37)", () => {
  it("validée → N5 au nageur, lien vers sa séance", async () => {
    const { deps, messages, journal } = fakeDeps();

    await notifierNageurSeanceTraiteeAvecDeps(deps, { seanceId: SEANCE_ID, statut: "validee" });

    expect(messages[0].to).toBe("nageur@exemple.test");
    expect(messages[0].subject).toBe("Votre séance est disponible");
    expect(messages[0].text).toContain(`/seances/${SEANCE_ID}`);
    expect(journal[0].metadata).toMatchObject({
      notification: "N5",
      destinataire_id: NAGEUR_ID,
    });
  });

  it("modifiée puis validée → N6 au nageur", async () => {
    const { deps, messages, journal } = fakeDeps();

    await notifierNageurSeanceTraiteeAvecDeps(deps, { seanceId: SEANCE_ID, statut: "modifiee" });

    expect(messages[0].subject).toBe("Votre séance ajustée est disponible");
    expect(journal[0].metadata.notification).toBe("N6");
  });

  it("refusée → N7 avec le commentaire du coach lu en base (RG-29)", async () => {
    const { deps, messages, journal } = fakeDeps({
      seance: { ...SEANCE, commentaireCoach: "On allège la semaine prochaine." },
    });

    await notifierNageurSeanceTraiteeAvecDeps(deps, { seanceId: SEANCE_ID, statut: "refusee" });

    expect(messages[0].subject).toBe("Votre séance a été refusée");
    expect(messages[0].text).toContain("On allège la semaine prochaine.");
    expect(messages[0].text).toContain("/seances/generer");
    expect(journal[0].metadata.notification).toBe("N7");
    // Le commentaire (contenu) ne fuit jamais dans le journal (E2).
    expect(JSON.stringify(journal)).not.toContain("On allège");
  });

  it("échec persistant d'envoi : la promesse résout quand même (ADR-020)", async () => {
    const { deps, journal } = fakeDeps({ envois: ["echec", "echec", "echec"] });

    await expect(
      notifierNageurSeanceTraiteeAvecDeps(deps, { seanceId: SEANCE_ID, statut: "validee" }),
    ).resolves.toBeUndefined();

    expect(journal[0].type).toBe("notification.echec");
  });
});

describe("notifierNageurCoachAffecteAvecDeps — N8 (PA-4, branché en CH8)", () => {
  it("envoie au nageur affecté et journalise", async () => {
    const { deps, messages, journal } = fakeDeps();

    await notifierNageurCoachAffecteAvecDeps(deps, NAGEUR_ID);

    expect(messages[0].to).toBe("nageur@exemple.test");
    expect(messages[0].subject).toBe("Un coach vous a été affecté");
    expect(journal[0]).toEqual({
      type: "notification.envoyee",
      metadata: { notification: "N8", destinataire_id: NAGEUR_ID, tentatives: 1 },
    });
  });

  it("profil sans e-mail : échec journalisé sans envoi, sans rejet", async () => {
    const { deps, messages, journal } = fakeDeps({ emails: {} });

    await expect(notifierNageurCoachAffecteAvecDeps(deps, NAGEUR_ID)).resolves.toBeUndefined();

    expect(messages).toHaveLength(0);
    expect(journal[0].metadata.motif).toBe("destinataire_introuvable");
  });
});
