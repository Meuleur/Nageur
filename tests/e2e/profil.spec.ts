import { expect, test, type Page } from "@playwright/test";

import { seConnecter } from "./helpers/login";
import { profilUserFor, sansCoachUserFor } from "./helpers/users";

/**
 * CH3 — E-10 (accueil nageur) et E-11 (Mon profil), parcours PN-3/PN-4 :
 * renseigner un profil complet, blocage sur champ obligatoire manquant,
 * modification (ajout/retrait de créneaux, unicité E1), état sans coach
 * (RG-13/RG-14) et affichage du coach via la vue `my_coach` (ADR-024).
 */

const succes = (page: Page) => page.locator('[data-slot="alert"][role="status"]');
const erreur = (page: Page) => page.locator('[data-slot="alert"][role="alert"]');

test.describe("Profil nageur (E-11) & accueil (E-10)", () => {
  test("renseigner puis modifier le profil ; champs obligatoires bloquants ; coach via my_coach", async ({
    page,
  }, testInfo) => {
    const user = profilUserFor(testInfo);
    await seConnecter(page, user.email);

    // E-10 : coach affiché via la vue my_coach — prénom + nom, jamais l'e-mail (ADR-024).
    await expect(page.getByText(`Votre coach : ${user.coach}`)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(user.coachEmail);

    // CH5 — E-12 : profil non renseigné → précondition RG-17 bloquante,
    // renvoi vers E-11 (B2).
    await page.goto("/seances/generer");
    await expect(page.getByText("votre profil n'est pas encore renseigné")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer ma séance" })).toBeDisabled();
    await page.getByRole("link", { name: "Compléter mon profil" }).click();
    await expect(page).toHaveURL(/\/profil/);
    await page.goto("/accueil");

    // Accès rapide vers le profil (profil vierge → « Renseigner »).
    await page.getByRole("link", { name: "Renseigner mon profil" }).click();
    await expect(page).toHaveURL(/\/profil/);
    await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();

    // PN-4 : champs obligatoires manquants → blocage, messages ciblés (ADR-016).
    await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
    await expect(erreur(page)).toContainText("corrigez les champs signalés");
    await expect(page.getByText("Choisissez votre niveau.")).toBeVisible();
    await expect(page.getByText("Choisissez votre fréquence d'entraînement.")).toBeVisible();
    await expect(page.getByText("Choisissez votre durée habituelle de séance.")).toBeVisible();
    await expect(page.getByText("Choisissez au moins un objectif.")).toBeVisible();
    await expect(page.getByText("Choisissez votre bassin habituel.")).toBeVisible();
    await expect(succes(page)).toHaveCount(0);

    // Profil complet (E-11) : niveau, fréquence, durée, objectifs, bassin
    // + matériel et disponibilités (grille 7 × 3) facultatifs.
    await page.getByRole("radio", { name: "Intermédiaire" }).check({ force: true });
    await page.getByRole("radio", { name: "3 séances par semaine" }).check({ force: true });
    await page.getByRole("radio", { name: "1 h", exact: true }).check({ force: true });
    await page.getByRole("checkbox", { name: "Endurance" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Technique" }).check({ force: true });
    await page.getByRole("radio", { name: "25 m" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Pull-buoy" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Lundi matin" }).check();
    await page.getByRole("checkbox", { name: "Mercredi soir" }).check();
    await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
    await expect(succes(page)).toContainText("Profil enregistré");

    // Régression React 19 : le reset automatique post-action ne doit pas
    // désynchroniser les cases du DOM (sinon la soumission suivante perd des
    // coches) — l'état doit survivre SANS rechargement.
    await expect(page.getByRole("checkbox", { name: "Lundi matin" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Pull-buoy" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Intermédiaire" })).toBeChecked();

    // Persistance : rechargement → valeurs restituées depuis la base (RLS).
    await page.reload();
    await expect(page.getByRole("radio", { name: "Intermédiaire" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "3 séances par semaine" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "1 h", exact: true })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Endurance" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Technique" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "25 m" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Pull-buoy" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Lundi matin" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Mercredi soir" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Mardi midi" })).not.toBeChecked();

    // RG-16 : modification — niveau changé, créneau retiré + créneau ajouté
    // (ajout/retrait propres, unicité nageur/jour/moment).
    await page.getByRole("radio", { name: "Confirmé" }).check({ force: true });
    await page.getByRole("checkbox", { name: "Lundi matin" }).uncheck();
    await page.getByRole("checkbox", { name: "Dimanche midi" }).check();
    await page.getByRole("button", { name: "Enregistrer mon profil" }).click();
    await expect(succes(page)).toContainText("Profil enregistré");

    await page.reload();
    await expect(page.getByRole("radio", { name: "Confirmé" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Lundi matin" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Dimanche midi" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Mercredi soir" })).toBeChecked();

    // E-10 : le profil existe désormais → libellé « Modifier ».
    await page.getByRole("link", { name: "Retour à l'accueil" }).click();
    await expect(page.getByRole("link", { name: "Modifier mon profil" })).toBeVisible();
  });

  test("sans coach : bandeau dédié, génération indisponible, profil accessible", async ({
    page,
  }, testInfo) => {
    const email = sansCoachUserFor(testInfo);
    await seConnecter(page, email);

    // RG-14 / ADR-014 : écran « sans coach », génération indisponible.
    await expect(page.getByText("Vous n'avez pas encore de coach")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer ma séance" })).toBeDisabled();

    // CH5 — E-12 : précondition coach manquante (RG-14), renvoi E-10 (B2).
    await page.goto("/seances/generer");
    await expect(page.getByText("vous n'avez pas encore de coach")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer ma séance" })).toBeDisabled();
    await page.goto("/accueil");

    // PN-3 : le profil reste accessible et modifiable.
    await page.getByRole("link", { name: "Renseigner mon profil" }).click();
    await expect(page).toHaveURL(/\/profil/);
    await expect(page.getByRole("heading", { name: "Mon profil" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer mon profil" })).toBeEnabled();
  });
});
