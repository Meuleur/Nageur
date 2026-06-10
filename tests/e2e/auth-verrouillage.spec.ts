import { expect, test, type Page } from "@playwright/test";

import { lockoutUserFor, SEED_PASSWORD } from "./helpers/users";

/**
 * C1/ADR-018 — Verrouillage temporaire après ~10 échecs de connexion.
 * Le verrou doit répondre la MÊME chose au bon et au mauvais mot de passe
 * (pas d'oracle). Le globalSetup remet les compteurs à zéro avant la suite.
 */
async function tentativeDeConnexion(page: Page, email: string, password: string): Promise<string> {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  return (await page.locator('[data-slot="alert"]').textContent()) ?? "";
}

test("après 10 échecs, le compte est temporairement verrouillé — même avec le bon mot de passe", async ({
  page,
}, testInfo) => {
  const email = lockoutUserFor(testInfo);

  // 10 échecs autorisés à être comptés ; le 11e doit déclencher le verrou.
  let message = "";
  for (let attempt = 1; attempt <= 11; attempt++) {
    message = await tentativeDeConnexion(page, email, "MauvaisMotDePasse1!");
    if (message.includes("Trop de tentatives")) {
      break;
    }
    expect(message).toContain("Identifiants invalides");
  }
  expect(message).toContain("Trop de tentatives");

  // Verrou réel : le BON mot de passe reçoit la même réponse générique,
  // aucune étape 2FA n'est ouverte.
  const lockedMessage = await tentativeDeConnexion(page, email, SEED_PASSWORD);
  expect(lockedMessage).toContain("Trop de tentatives");
  await expect(page).toHaveURL(/\/connexion/);
});
