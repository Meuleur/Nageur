import { expect, test } from "@playwright/test";

import { extractOtpCode, latestEmailId, waitForEmail } from "./helpers/mailpit";
import { loginUserFor, SEED_PASSWORD } from "./helpers/users";

/**
 * PN-2 — Connexion avec 2FA e-mail (RG-06 à RG-08) et EXIGENCE CENTRALE C1 :
 * aucune session Supabase exploitable côté navigateur tant que le code OTP
 * n'est pas validé.
 */
test.describe("Connexion + 2FA", () => {
  test("parcours nominal : gating avant OTP, code erroné, succès, déconnexion", async ({
    page,
    context,
  }, testInfo) => {
    const user = loginUserFor(testInfo);
    const inboxBefore = await latestEmailId(user.email);

    // Étape 1 — mot de passe.
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/verification-2fa/);

    // GATING C1 : aucun cookie de session Supabase (sb-*) avant l'OTP —
    // seul le jeton de transition httpOnly existe.
    const cookiesBefore = await context.cookies();
    expect(cookiesBefore.filter((c) => c.name.startsWith("sb-"))).toHaveLength(0);
    const pending = cookiesBefore.find((c) => c.name === "an-2fa-en-attente");
    expect(pending?.httpOnly).toBe(true);

    // RG-08 : l'accès protégé reste refusé tant que l'OTP n'est pas validé.
    await page.goto("/accueil");
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto("/verification-2fa");

    // Étape 2 — code OTP reçu par e-mail (Mailpit local).
    const otpEmail = await waitForEmail(user.email, { afterId: inboxBefore });
    const code = extractOtpCode(otpEmail);

    // Code erroné d'abord : tentatives restantes décomptées (RG-07).
    const wrongCode = code === "000000" ? "111111" : "000000";
    await page.getByLabel("Code reçu par e-mail").fill(wrongCode);
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page.locator('[data-slot="alert"][role="alert"]')).toContainText(
      "Il vous reste 4 tentatives",
    );

    // Bon code : la session est ENFIN établie, redirection selon le rôle.
    await page.getByLabel("Code reçu par e-mail").fill(code);
    await page.getByRole("button", { name: "Valider" }).click();
    await expect(page).toHaveURL(/\/accueil/);
    await expect(page.getByRole("heading", { name: `Bonjour ${user.prenom}` })).toBeVisible();

    // RG-14 / ADR-024 : coach affiché via my_coach, ou bandeau « sans coach ».
    if (user.coach) {
      await expect(page.getByText(`Votre coach : ${user.coach}`)).toBeVisible();
    } else {
      await expect(page.getByText("Vous n'avez pas encore de coach")).toBeVisible();
      await expect(page.getByRole("button", { name: "Générer ma séance" })).toBeDisabled();
    }

    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.some((c) => c.name.startsWith("sb-"))).toBe(true);

    // Déconnexion : cookies de session effacés, retour à la connexion.
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL(/\/connexion/);
    const cookiesLoggedOut = await context.cookies();
    expect(cookiesLoggedOut.filter((c) => c.name.startsWith("sb-") && c.value !== "")).toHaveLength(
      0,
    );
  });

  test("identifiants invalides : message d'erreur, pas d'étape 2", async ({ page }, testInfo) => {
    const user = loginUserFor(testInfo);
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(user.email);
    await page.getByLabel("Mot de passe").fill("MauvaisMotDePasse1!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator('[data-slot="alert"][role="alert"]')).toContainText(
      "Identifiants invalides",
    );
    await expect(page).toHaveURL(/\/connexion/);
  });
});
