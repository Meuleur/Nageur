import { expect, test } from "@playwright/test";

import { extractConfirmLink, extractOtpCode, latestEmailId, waitForEmail } from "./helpers/mailpit";
import { resetUserFor } from "./helpers/users";

/** Mot de passe cible constant → suite rejouable à l'identique. */
const NEW_PASSWORD = "Nouveau!Rivage8";
const OLD_PASSWORD = "Password123!";

/**
 * RG-09 — Réinitialisation complète : demande (réponse générique), lien
 * e-mail (1 h), nouveau mot de passe, ancien mot de passe refusé, puis
 * reconnexion complète avec 2FA.
 */
test("réinitialisation du mot de passe de bout en bout", async ({ page }, testInfo) => {
  const email = resetUserFor(testInfo);

  // Demande de réinitialisation (E-04) — réponse générique (C1).
  const inboxBefore = await latestEmailId(email);
  await page.goto("/mot-de-passe-oublie");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Envoyer le lien de réinitialisation" }).click();
  await expect(page.locator('[data-slot="alert"][role="status"]')).toContainText("Si un compte existe pour cette adresse");

  // Lien de réinitialisation (e-mail GoTrue) → écran nouveau mot de passe.
  const resetEmail = await waitForEmail(email, { afterId: inboxBefore });
  expect(resetEmail.subject).toBe("Réinitialisation de votre mot de passe");
  await page.goto(extractConfirmLink(resetEmail));
  await expect(page).toHaveURL(/\/reinitialisation/);

  // Nouveau mot de passe conforme à la politique (ADR-018).
  await page.getByLabel("Nouveau mot de passe").fill(NEW_PASSWORD);
  await page.getByLabel("Confirmer le mot de passe").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Définir ce mot de passe" }).click();
  await expect(page).toHaveURL(/\/connexion\?motif=mot-de-passe-modifie/);
  await expect(page.locator('[data-slot="alert"][role="status"]')).toContainText("Mot de passe modifié");

  // L'ancien mot de passe ne fonctionne plus.
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(OLD_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator('[data-slot="alert"][role="alert"]')).toContainText("Identifiants invalides");

  // Le nouveau mot de passe ouvre le parcours 2FA complet.
  // (React 19 réinitialise le formulaire après l'action : tout re-remplir.)
  const inboxBeforeLogin = await latestEmailId(email);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/verification-2fa/);

  const otpEmail = await waitForEmail(email, { afterId: inboxBeforeLogin });
  await page.getByLabel("Code reçu par e-mail").fill(extractOtpCode(otpEmail));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(/\/accueil/);
});
