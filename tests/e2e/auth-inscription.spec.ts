import { expect, test } from "@playwright/test";

import { extractConfirmLink, extractOtpCode, latestEmailId, waitForEmail } from "./helpers/mailpit";

const PASSWORD = "Cascade!Bleu7";

/**
 * PN-1 — Inscription nageur (RG-02), vérification d'e-mail (RG-05) puis
 * première connexion complète (2FA). Adresse unique à chaque exécution.
 */
test("inscription, blocage avant vérification, lien de vérification, première connexion", async ({
  page,
}, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@nageur.test`;

  // Inscription (E-01).
  await page.goto("/inscription");
  await page.getByLabel("Prénom").fill("Esteban");
  await page.getByLabel("Nom", { exact: true }).fill("Testeur");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page).toHaveURL(/\/verification-email/);

  // RG-05 : tant que l'adresse n'est pas vérifiée, la connexion est refusée
  // (même avec le bon mot de passe) et renvoie vers E-03.
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/verification-email\?motif=non-verifie/);
  await expect(page.locator('[data-slot="alert"][role="status"]')).toContainText("pas encore vérifiée");

  // Lien de vérification (e-mail GoTrue, gabarit français → /auth/confirm).
  const confirmEmail = await waitForEmail(email, { afterId: null });
  expect(confirmEmail.subject).toBe("Confirmez votre adresse e-mail");
  await page.goto(extractConfirmLink(confirmEmail));
  await expect(page).toHaveURL(/\/connexion\?motif=email-verifie/);
  await expect(page.locator('[data-slot="alert"][role="status"]')).toContainText("Adresse e-mail vérifiée");

  // Première connexion complète : mot de passe + OTP.
  const inboxAfterConfirm = await latestEmailId(email);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/verification-2fa/);

  const otpEmail = await waitForEmail(email, { afterId: inboxAfterConfirm });
  await page.getByLabel("Code reçu par e-mail").fill(extractOtpCode(otpEmail));
  await page.getByRole("button", { name: "Valider" }).click();

  // Nouveau nageur : rôle nageur (RG-02), sans coach (RG-13/RG-14).
  await expect(page).toHaveURL(/\/accueil/);
  await expect(page.getByRole("heading", { name: "Bonjour Esteban" })).toBeVisible();
  await expect(page.getByText("Vous n'avez pas encore de coach")).toBeVisible();
});
