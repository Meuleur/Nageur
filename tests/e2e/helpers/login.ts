import { expect, type Page } from "@playwright/test";

import { extractOtpCode, latestEmailId, waitForEmail } from "./mailpit";
import { SEED_PASSWORD } from "./users";

/**
 * Connexion complète (mot de passe + OTP e-mail, PN-2/PC-1) — parcours
 * nominal partagé par les suites postérieures à CH2. Rappel : un seul code
 * OTP actif et 60 s entre deux envois par compte → chaque test qui se
 * connecte doit utiliser SON compte seedé (voir users.ts). L'accueil dépend
 * du rôle (RG-03) : /accueil (nageur) par défaut, /coach pour un coach.
 */
export async function seConnecter(
  page: Page,
  email: string,
  accueil: RegExp = /\/accueil/,
  motDePasse: string = SEED_PASSWORD,
): Promise<void> {
  const inboxBefore = await latestEmailId(email);

  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(motDePasse);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/verification-2fa/);

  const otpEmail = await waitForEmail(email, { afterId: inboxBefore });
  await page.getByLabel("Code reçu par e-mail").fill(extractOtpCode(otpEmail));
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page).toHaveURL(accueil);
}
