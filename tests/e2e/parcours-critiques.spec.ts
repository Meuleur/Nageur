import { expect, test, type Page } from "@playwright/test";

import { seConnecter } from "./helpers/login";
import { extractConfirmLink, latestEmailId, waitForEmail } from "./helpers/mailpit";
import { parcoursFor, seanceAutreNageurFor } from "./helpers/users";

/**
 * CH9 — parcours critiques bout-en-bout (F1). Enchaîne en UN test la chaîne
 * complète nageur (PN-1 → PN-7) avec l'affectation réalisée par l'admin via
 * l'UI (E-32, second contexte navigateur), puis vérifie les invariants
 * d'isolation (RG-03, RG-43). Le nageur est créé dynamiquement (adresse
 * unique par exécution, purgée par reseed_ch9_e2e au global-setup) ; admin et
 * coach sont seedés par projet (users.ts). LLM simulé (playwright.config.ts).
 */

const PASSWORD = "Cascade!Bleu7";
const ACCUEIL_ADMIN = /\/admin$/;

const succes = (page: Page) => page.locator('[data-slot="alert"][role="status"]');
const carteSeance = (page: Page) => page.getByRole("link").filter({ hasText: "Séance du" });

test.describe("CH9 — parcours critiques bout-en-bout", () => {
  test("nageur : inscription → vérification → 2FA → profil → affectation (admin) → génération → consultation ; isolation des espaces", async ({
    page,
    browser,
  }, testInfo) => {
    const compte = parcoursFor(testInfo);
    const horodatage = Date.now();
    // Le nom inclut le projet : les deux projets Playwright peuvent démarrer
    // dans la même milliseconde, et l'admin voit les nageurs des deux.
    const projet = testInfo.project.name.replace(/[^a-z]/gi, "");
    const nom = `Parcours${projet}${horodatage}`;
    const email = `e2e-parcours-${testInfo.project.name}-${horodatage}@nageur.test`;

    // — Inscription (E-01, RG-02) puis lien de vérification (E-03, RG-05).
    await page.goto("/inscription");
    await page.getByLabel("Prénom").fill("Maud");
    await page.getByLabel("Nom", { exact: true }).fill(nom);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Créer mon compte" }).click();
    await expect(page).toHaveURL(/\/verification-email/);

    const emailConfirmation = await waitForEmail(email, { afterId: null });
    await page.goto(extractConfirmLink(emailConfirmation));
    await expect(page).toHaveURL(/\/connexion\?motif=email-verifie/);

    // — Première connexion complète (2FA, RG-06/RG-08) : sans coach (RG-13).
    await seConnecter(page, email, /\/accueil/, PASSWORD);
    await expect(page.getByText("Vous n'avez pas encore de coach")).toBeVisible();

    // — Profil sportif (E-11, RG-16) : champs obligatoires.
    await page.getByRole("link", { name: "Renseigner mon profil" }).click();
    await expect(page).toHaveURL(/\/profil/);
    await page.getByRole("radio", { name: "Intermédiaire" }).check({ force: true });
    await page.getByRole("radio", { name: "3 séances par semaine" }).check({ force: true });
    await page.getByRole("radio", { name: "1 h", exact: true }).check({ force: true });
    await page.getByRole("checkbox", { name: "Endurance" }).check({ force: true });
    await page.getByRole("radio", { name: "25 m" }).check({ force: true });
    await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
    await expect(succes(page)).toContainText("Profil enregistré");

    // — Précondition de génération : toujours pas de coach (RG-14).
    await page.goto("/seances/generer");
    await expect(page.getByText("vous n'avez pas encore de coach")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer ma séance" })).toBeDisabled();

    // — L'admin affecte le coach via l'UI (E-32, RG-10) → notification N8.
    const contexteAdmin = await browser.newContext();
    const pageAdmin = await contexteAdmin.newPage();
    await seConnecter(pageAdmin, compte.adminEmail, ACCUEIL_ADMIN);
    await pageAdmin.goto("/admin/affectations");
    await pageAdmin.getByLabel("Rechercher un nageur").fill(nom);
    const ligne = pageAdmin.locator("li").filter({ hasText: nom });
    await expect(ligne.locator('[data-slot="badge"]')).toHaveText("Sans coach");

    const inboxNageur = await latestEmailId(email);
    await ligne.getByRole("combobox").selectOption({ label: compte.coach });
    await ligne.getByRole("button", { name: "Enregistrer" }).click();
    await expect(succes(pageAdmin)).toContainText("Affectation enregistrée");
    await expect(ligne.locator('[data-slot="badge"]')).toHaveText("Avec coach");

    // RG-03 : l'admin n'accède pas aux écrans nageur.
    await pageAdmin.goto("/accueil");
    await expect(pageAdmin).toHaveURL(ACCUEIL_ADMIN);
    await contexteAdmin.close();

    const emailN8 = await waitForEmail(email, { afterId: inboxNageur });
    expect(emailN8.subject).toBe("Un coach vous a été affecté");

    // — Préconditions réunies (RG-14/RG-17) → génération (E-12, RG-21).
    const inboxCoach = await latestEmailId(compte.coachEmail);
    await page.goto("/seances/generer");
    await expect(page.getByText("votre coach est")).toBeVisible();
    await expect(page.getByText("votre profil est renseigné")).toBeVisible();
    await page.getByRole("button", { name: "Générer ma séance" }).click();
    await expect(page).toHaveURL(/\/seances\?generation=envoyee/, { timeout: 20_000 });

    // — Consultation (E-13/E-14) : en attente, aperçu limité (RG-32).
    await expect(carteSeance(page).filter({ hasText: "En attente" }).first()).toBeVisible();
    await carteSeance(page).first().click();
    await expect(page).toHaveURL(/\/seances\/[0-9a-f-]+$/);
    await expect(page.getByText("pas encore utilisable")).toBeVisible();

    // — Le coach affecté est notifié (N4, RG-36) : chaîne complète.
    const emailN4 = await waitForEmail(compte.coachEmail, { afterId: inboxCoach });
    expect(emailN4.subject).toBe("Une séance attend votre validation");

    // — Cas négatifs avec la session nageur (RG-03, RG-43) : espaces coach
    //   et admin interdits, séance d'un AUTRE nageur invisible (RLS).
    await page.goto("/coach");
    await expect(page).toHaveURL(/\/accueil/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/accueil/);
    await page.goto(`/seances/${seanceAutreNageurFor(testInfo)}`);
    await expect(page.getByText("Séance introuvable")).toBeVisible();
  });

  test("isolation coach : les espaces nageur et admin sont inaccessibles (RG-03)", async ({
    page,
  }, testInfo) => {
    const compte = parcoursFor(testInfo);
    await seConnecter(page, compte.coachEmail, /\/coach$/);

    await page.goto("/accueil");
    await expect(page).toHaveURL(/\/coach$/);
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/coach$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/coach$/);
  });
});
