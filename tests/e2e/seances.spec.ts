import { expect, test, type Page } from "@playwright/test";

import { seConnecter } from "./helpers/login";
import {
  detailUserFor,
  generationUserFor,
  listeUserFor,
  regenerationUserFor,
} from "./helpers/users";

/**
 * CH5 — parcours nageur autour de la séance (E-12 à E-15, PN-5 à PN-9).
 * La génération utilise le fournisseur simulé : le serveur Playwright tourne
 * avec LLM_DRIVER=simule (playwright.config.ts) — aucun appel réseau, séance
 * déterministe persistée en_attente par la vraie chaîne CH4 (RG-21).
 * Un compte seedé par test ET par projet (OTP à usage unique, voir users.ts).
 */

const succes = (page: Page) => page.locator('[data-slot="alert"][role="status"]');
const carteSeance = (page: Page) => page.getByRole("link").filter({ hasText: "Séance du" });

test.describe("Parcours nageur — séances (E-12 à E-15)", () => {
  test("générer une séance : envoyée au coach, visible en attente (E-12, PN-5)", async ({
    page,
  }, testInfo) => {
    await seConnecter(page, generationUserFor(testInfo));

    // E-10 → E-12 : accès rapide actif (coach affecté).
    await page.getByRole("link", { name: "Générer ma séance" }).click();
    await expect(page).toHaveURL(/\/seances\/generer/);

    // Rappel des préconditions remplies (RG-14/RG-17).
    await expect(page.getByText("votre coach est")).toBeVisible();
    await expect(page.getByText("votre profil est renseigné")).toBeVisible();

    await page.getByRole("button", { name: "Générer ma séance" }).click();

    // PN-5 : succès → message « envoyée à votre coach » + renvoi vers E-13.
    await expect(page).toHaveURL(/\/seances\?generation=envoyee/, { timeout: 20_000 });
    await expect(succes(page)).toContainText(
      "Votre séance a été générée et envoyée à votre coach pour validation.",
    );

    // RG-21 : la séance créée est en attente, jamais utilisable directement.
    await expect(carteSeance(page).filter({ hasText: "En attente" }).first()).toBeVisible();
  });

  test("séance refusée : commentaire du coach puis régénération immédiate (PN-8, RG-33)", async ({
    page,
  }, testInfo) => {
    const user = regenerationUserFor(testInfo);
    await seConnecter(page, user.email);

    await page.getByRole("link", { name: "Voir mes séances" }).click();
    await expect(page).toHaveURL(/\/seances/);

    // E-14 en mode refus : commentaire obligatoire (RG-29) affiché.
    await carteSeance(page).filter({ hasText: "Refusée" }).first().click();
    await expect(page.getByText(user.commentaireRefus)).toBeVisible();

    // Refusée = non utilisable : ni contenu détaillé ni auto-évaluation (RG-32).
    await expect(page.getByRole("heading", { name: "Corps de séance" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "S'auto-évaluer" })).toHaveCount(0);

    // RG-33/RG-24 : nouvelle génération immédiate (nouvelle instance via T1).
    await page.getByRole("link", { name: "Générer une nouvelle séance" }).click();
    await expect(page).toHaveURL(/\/seances\/generer/);
    await page.getByRole("button", { name: "Générer ma séance" }).click();
    await expect(page).toHaveURL(/\/seances\?generation=envoyee/, { timeout: 20_000 });
    await expect(succes(page)).toContainText("envoyée à votre coach");
    await expect(carteSeance(page).filter({ hasText: "En attente" }).first()).toBeVisible();
  });

  test("mes séances : badges, filtre par statut, séance en attente non utilisable (E-13, RG-32)", async ({
    page,
  }, testInfo) => {
    const user = listeUserFor(testInfo);
    await seConnecter(page, user.email);
    await page.goto("/seances");

    // Les 4 statuts seedés, chacun avec son badge (B4).
    await expect(carteSeance(page)).toHaveCount(4);
    for (const libelle of ["En attente", "Validée", "Modifiée par le coach", "Refusée"]) {
      await expect(carteSeance(page).filter({ hasText: libelle })).toHaveCount(1);
    }

    // Filtre par statut (ADR-018) — les pastilles sont des liens exacts.
    await page.getByRole("link", { name: "Validée", exact: true }).click();
    await expect(page).toHaveURL(/statut=validee/);
    await expect(carteSeance(page)).toHaveCount(1);
    await expect(carteSeance(page).first()).toContainText("Validée");

    await page.getByRole("link", { name: "Refusée", exact: true }).click();
    await expect(page).toHaveURL(/statut=refusee/);
    await expect(carteSeance(page)).toHaveCount(1);
    await expect(carteSeance(page).first()).toContainText("Refusée");

    await page.getByRole("link", { name: "Toutes", exact: true }).click();
    await expect(carteSeance(page)).toHaveCount(4);

    // E-14 en attente : aperçu limité, non utilisable (A3).
    await carteSeance(page).filter({ hasText: "En attente" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/seances/${user.seanceEnAttenteId}`));
    await expect(page.getByText("En attente de validation")).toBeVisible();
    await expect(page.getByText("pas encore utilisable")).toBeVisible();

    // Le contenu détaillé reste invisible (aperçu limité + RLS séries).
    await expect(page.getByRole("heading", { name: "Échauffement" })).toHaveCount(0);
    await expect(page.getByText(user.consigneSerieEnAttente)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "S'auto-évaluer" })).toHaveCount(0);

    // RG-34 : l'auto-évaluation d'une séance non utilisable est refusée.
    await page.goto(`/seances/${user.seanceEnAttenteId}/auto-evaluation`);
    await expect(page).toHaveURL(new RegExp(`/seances/${user.seanceEnAttenteId}$`));
  });

  test("détail utilisable puis auto-évaluation créée et modifiée (PN-7/PN-9, ADR-018)", async ({
    page,
  }, testInfo) => {
    const user = detailUserFor(testInfo);
    await seConnecter(page, user.email);
    await page.goto("/seances");
    await carteSeance(page).filter({ hasText: "Validée" }).first().click();

    // PN-7 : contenu complet — échauffement, séries, retour au calme, totaux,
    // commentaire du coach.
    await expect(page.getByRole("heading", { name: "Échauffement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corps de séance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Retour au calme" })).toBeVisible();
    await expect(page.getByText(user.serie)).toBeVisible();
    await expect(page.getByText(user.distanceTotale)).toBeVisible();
    await expect(page.getByText(/Durée estimée/)).toBeVisible();
    await expect(page.getByText(user.commentaireCoach)).toBeVisible();

    // E-15 : création — le ressenti (1–5) est obligatoire.
    await page.getByRole("link", { name: "S'auto-évaluer" }).click();
    await expect(page).toHaveURL(/auto-evaluation/);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Indiquez votre ressenti global (1 à 5).")).toBeVisible();

    await page.getByRole("radio", { name: "Ressenti 4 sur 5" }).check({ force: true });
    await page.getByRole("radio", { name: "Difficulté 6 sur 10" }).check({ force: true });
    await page.getByLabel(/Commentaire/).fill("Bonne séance, fin un peu dure.");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    // Retour au détail avec confirmation + valeurs enregistrées.
    await expect(page).toHaveURL(/evaluation=enregistree/, { timeout: 20_000 });
    await expect(succes(page)).toContainText("Votre auto-évaluation a été enregistrée.");
    await expect(page.getByText(/Ressenti global/)).toContainText("4 / 5");
    await expect(page.getByText(/Difficulté perçue/)).toContainText("6 / 10");
    await expect(page.getByText("Bonne séance, fin un peu dure.")).toBeVisible();

    // ADR-018 : une seule auto-évaluation par séance, modifiable — le
    // formulaire revient pré-rempli et l'enregistrement remplace la première.
    await page.getByRole("link", { name: "Modifier mon auto-évaluation" }).click();
    await expect(page.getByText("Une auto-évaluation existe déjà")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Ressenti 4 sur 5" })).toBeChecked();
    await expect(page.getByRole("radio", { name: "Difficulté 6 sur 10" })).toBeChecked();

    await page.getByRole("radio", { name: "Ressenti 2 sur 5" }).check({ force: true });
    await page.getByRole("radio", { name: "Non précisée" }).check({ force: true });
    await page.getByLabel(/Commentaire/).fill("Finalement très fatigué.");
    await page.getByRole("button", { name: "Enregistrer" }).click();

    await expect(page).toHaveURL(/evaluation=enregistree/, { timeout: 20_000 });
    await expect(page.getByText(/Ressenti global/)).toContainText("2 / 5");
    await expect(page.getByText(/Difficulté perçue/)).toHaveCount(0);
    await expect(page.getByText("Finalement très fatigué.")).toBeVisible();
  });
});
