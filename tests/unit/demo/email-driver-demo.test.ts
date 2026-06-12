import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { sendMail } from "@/server/email";
import { getEmailDriver } from "@/server/env";

// Driver e-mail « demo » (branche demo) : enregistré dans le sélecteur,
// n'émet RIEN — ni réseau, ni clé requise, ni PII journalisée.
describe("EMAIL_DRIVER=demo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("est accepté par le sélecteur de driver", () => {
    vi.stubEnv("EMAIL_DRIVER", "demo");
    expect(getEmailDriver()).toBe("demo");
  });

  it("ne relâche pas la validation des autres valeurs", () => {
    vi.stubEnv("EMAIL_DRIVER", "sendgrid");
    expect(() => getEmailDriver()).toThrow(/Unsupported EMAIL_DRIVER/);
  });

  it("n'émet rien : aucun appel réseau, aucune clé requise, aucune PII tracée", async () => {
    vi.stubEnv("EMAIL_DRIVER", "demo");
    // Pas de clé Resend : le chemin resend échouerait sur required().
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchSpy = vi.fn(() => {
      throw new Error("aucun appel réseau attendu en mode démo");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(
      sendMail({
        to: "lea.nageur@nageur.test",
        subject: "Votre code de connexion",
        text: "Votre code : 123456",
        html: "<b>123456</b>",
      }),
    ).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    // Au plus une trace technique, sans adresse ni contenu (PII / codes).
    for (const appel of infoSpy.mock.calls) {
      const ligne = appel.join(" ");
      expect(ligne).not.toContain("nageur.test");
      expect(ligne).not.toContain("123456");
    }
  });
});
