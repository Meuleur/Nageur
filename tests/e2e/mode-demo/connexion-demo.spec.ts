import { expect, test, type Page } from "@playwright/test";

import { latestEmailId } from "../helpers/mailpit";
import { generationUserFor, loginUserFor, SEED_PASSWORD } from "../helpers/users";

/**
 * MODE DÉMO (branche demo) — le serveur tourne avec DEMO_MODE=true,
 * EMAIL_DRIVER=demo et LLM_DRIVER=simule (playwright.demo.config.ts).
 * Critères d'acceptation : connexion d'un compte seedé en SAUTANT la 2FA,
 * génération de séance simulée, AUCUN e-mail envoyé, bannière DÉMO visible.
 * Un compte seedé par test et par projet (voir users.ts) ; Mailpit reste
 * disponible (pile Supabase) et sert UNIQUEMENT à vérifier qu'aucun e-mail
 * ne part.
 */

const banniereDemo = (page: Page) => page.locator('[data-slot="demo-banner"]');

/** Connexion démo : mot de passe puis « Passer (démo) » — jamais d'OTP. */
async function seConnecterDemo(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/verification-2fa/);
  await page.getByRole("button", { name: "Passer (démo)" }).click();
  await expect(page).toHaveURL(/\/accueil/);
}

test.describe("Mode démo — connexion sans 2FA", () => {
  test("bannière visible, 2FA sautée par le bouton, session établie, aucun e-mail", async ({
    page,
    context,
  }, testInfo) => {
    const user = loginUserFor(testInfo);
    const inboxBefore = await latestEmailId(user.email);

    // Bannière DÉMO dès la page de connexion (layout racine).
    await page.goto("/connexion");
    await expect(banniereDemo(page)).toContainText("DÉMO — 2FA désactivée");

    // Étape 1 — mot de passe (inchangée en démo).
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/verification-2fa/);

    // Le gating C1 tient toujours AVANT le saut : aucune session Supabase,
    // seul le jeton de transition httpOnly existe.
    const cookiesBefore = await context.cookies();
    expect(cookiesBefore.filter((c) => c.name.startsWith("sb-"))).toHaveLength(0);
    expect(cookiesBefore.find((c) => c.name === "an-2fa-en-attente")?.httpOnly).toBe(true);

    // Étape 2 — « Passer (démo) » remplace la saisie du code.
    await expect(
      page.getByText("Mode démo : la 2FA est désactivée — aucun code ne vous a été envoyé", {
        exact: false,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Passer (démo)" }).click();
    await expect(page).toHaveURL(/\/accueil/);
    await expect(page.getByRole("heading", { name: `Bonjour ${user.prenom}` })).toBeVisible();

    // Session pleinement établie, bannière toujours là côté connecté.
    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.some((c) => c.name.startsWith("sb-"))).toBe(true);
    await expect(banniereDemo(page)).toBeVisible();

    // AUCUN e-mail parti : ni OTP émis (loginAction), ni envoi (driver demo).
    expect(await latestEmailId(user.email)).toBe(inboxBefore);
  });

  test("génération de séance simulée : parcours complet, coach jamais notifié par e-mail", async ({
    page,
  }, testInfo) => {
    const user = generationUserFor(testInfo);
    const inboxCoach = await latestEmailId(user.coachEmail);

    await seConnecterDemo(page, user.email);

    // E-12 — génération via le fournisseur simulé (LLM_DRIVER=simule, sans clé).
    await page.getByRole("link", { name: "Générer ma séance" }).click();
    await expect(page).toHaveURL(/\/seances\/generer/);
    await page.getByRole("button", { name: "Générer ma séance" }).click();
    await expect(page).toHaveURL(/\/seances\?generation=envoyee/, { timeout: 20_000 });
    await expect(page.locator('[data-slot="alert"][role="status"]')).toContainText(
      "Votre séance a été générée et envoyée à votre coach pour validation.",
    );

    // N4 part hors chemin critique (after) : on laisse le temps de flusher,
    // puis on vérifie que RIEN n'est arrivé (EMAIL_DRIVER=demo : no-op).
    await page.waitForTimeout(1500);
    expect(await latestEmailId(user.coachEmail)).toBe(inboxCoach);
  });
});
