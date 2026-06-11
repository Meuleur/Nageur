import { expect, test, type Page } from "@playwright/test";

import { seConnecter } from "./helpers/login";
import {
  coachModifierFor,
  coachNageursFor,
  coachRefuserFor,
  coachValiderFor,
} from "./helpers/users";

/**
 * CH6 — cycle de validation coach (E-20 à E-24, PC-2 à PC-5).
 * Un compte COACH seedé par test ET par projet (OTP à usage unique, voir
 * users.ts) ; les séances consommées sont remises à zéro par global-setup
 * (reseed_ch6_e2e). Les transitions passent par le serveur : ces tests
 * vérifient le résultat visible (badges B4, retours visuels B2) et
 * l'isolation inter-coach (RG-25, RG-43).
 */

const ACCUEIL_COACH = /\/coach$/;
const succes = (page: Page) => page.locator('[data-slot="alert"][role="status"]');
const badgeStatut = (page: Page) => page.locator('[data-slot="badge"]');

/** Séance et nageur seedés pour Camille (CH1) — étrangers à tous les coachs CH6. */
const SEANCE_AUTRE_COACH = "40000000-0000-4000-8000-000000000001";
const NAGEUR_AUTRE_COACH = "30000000-0000-4000-8000-000000000001";

test.describe("Parcours coach — cycle de validation (E-20 à E-24)", () => {
  test("tableau de bord, file d'attente et validation (E-20/E-21/E-22, T2) ; isolation inter-coach (RG-25)", async ({
    page,
  }, testInfo) => {
    const user = coachValiderFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_COACH);

    // E-20 : indicateur de séances en attente + nageur suivi.
    await expect(page.getByText("1 séance en attente de votre validation.")).toBeVisible();
    await expect(page.getByRole("link", { name: user.nageur }).first()).toBeVisible();

    // E-21 : la file liste la séance du nageur affecté.
    await page.getByRole("link", { name: "Relire les séances" }).click();
    await expect(page).toHaveURL(/\/coach\/seances$/);
    await page.getByRole("link", { name: new RegExp(user.nageur) }).click();

    // E-22 : détail complet de la proposition + trois actions exclusives.
    await expect(page.getByRole("heading", { name: `Séance de ${user.nageur}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Échauffement" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Corps de séance" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Retour au calme" })).toBeVisible();
    await expect(badgeStatut(page)).toHaveText("En attente");
    await expect(page.getByRole("button", { name: "Valider la séance" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Modifier puis valider" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Refuser" })).toBeVisible();

    // T2 : valider → retour visuel + badge Validée + actions retirées (A3).
    await page.getByRole("button", { name: "Valider la séance" }).click();
    await expect(page).toHaveURL(/traitement=validee/, { timeout: 20_000 });
    await expect(succes(page)).toContainText("La séance a été validée");
    await expect(badgeStatut(page)).toHaveText("Validée");
    await expect(page.getByRole("button", { name: "Valider la séance" })).toHaveCount(0);

    // E-21 : la file est désormais vide.
    await page.goto("/coach/seances");
    await expect(page.getByText("Aucune séance en attente de validation.")).toBeVisible();

    // RG-25/RG-43 : la séance et le nageur d'un autre coach sont introuvables.
    await page.goto(`/coach/seances/${SEANCE_AUTRE_COACH}`);
    await expect(page.getByText("Séance introuvable")).toBeVisible();
    await page.goto(`/coach/seances/${SEANCE_AUTRE_COACH}/modifier`);
    await expect(page.getByText("Séance introuvable")).toBeVisible();
    await page.goto(`/coach/nageurs/${NAGEUR_AUTRE_COACH}`);
    await expect(page.getByText("Nageur introuvable")).toBeVisible();
  });

  test("modifier puis valider : édition des séries et contenu mis à jour (E-23, T3)", async ({
    page,
  }, testInfo) => {
    const user = coachModifierFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_COACH);

    await page.goto("/coach/seances");
    await page.getByRole("link", { name: new RegExp(user.nageur) }).click();
    await page.getByRole("link", { name: "Modifier puis valider" }).click();
    await expect(page).toHaveURL(/\/modifier$/);

    // ADR-018 : « Annuler » abandonne tout — la séance reste en attente.
    await page.locator("#echauffement_distance_m").fill("200");
    await page.getByRole("link", { name: "Annuler" }).click();
    await expect(page).toHaveURL(/\/coach\/seances\/[0-9a-f-]+$/);
    await expect(badgeStatut(page)).toHaveText("En attente");

    await page.getByRole("link", { name: "Modifier puis valider" }).click();
    await expect(page.locator("#echauffement_distance_m")).toHaveValue("300");

    // Édition : échauffement, série 1, ajout d'une série puis remontée.
    await page.locator("#echauffement_distance_m").fill("200");
    await page.locator("#series-0-distance").fill("150");
    await page.getByRole("button", { name: "Ajouter une série" }).click();
    await page
      .locator("#series-2-consigne")
      .fill("Nouvelle série ajoutée par le coach.");
    await page.getByRole("button", { name: "Monter la série 3" }).click();

    // Garde Zod client : distance non multiple de 25 m → blocage sur place.
    await page.locator("#series-0-distance").fill("130");
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(
      page.getByText("Série 1 : Les distances doivent être des multiples de 25 m."),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/modifier$/);

    // Correction puis validation : distance totale recalculée en direct.
    await page.locator("#series-0-distance").fill("150");
    await expect(page.getByText(/Distance totale recalculée/)).toContainText(/1\s*350 m/);
    await page.getByRole("button", { name: "Valider", exact: true }).click();

    // T3 : statut Modifiée + contenu mis à jour dans l'ordre choisi (RG-28).
    await expect(page).toHaveURL(/traitement=modifiee/, { timeout: 20_000 });
    await expect(succes(page)).toContainText("La séance a été modifiée et validée");
    await expect(badgeStatut(page)).toHaveText("Modifiée par le coach");
    await expect(page.getByText(/1\s*350 m/).first()).toBeVisible();

    const series = page.locator("ol > li");
    await expect(series).toHaveCount(3);
    await expect(series.nth(0)).toContainText("4 × 150 m — Crawl");
    await expect(series.nth(1)).toContainText("Nouvelle série ajoutée par le coach.");
    await expect(series.nth(2)).toContainText("6 × 50 m — Dos");
  });

  test("refuser : commentaire obligatoire puis refus effectif (E-22, T4, RG-29)", async ({
    page,
  }, testInfo) => {
    const user = coachRefuserFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_COACH);

    await page.goto("/coach/seances");
    await page.getByRole("link", { name: new RegExp(user.nageur) }).click();

    // RG-29 : refus sans commentaire → bloqué, la séance reste en attente.
    await page.getByRole("button", { name: "Refuser" }).click();
    await expect(
      page.getByText("Le commentaire est obligatoire pour refuser une séance", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page).not.toHaveURL(/traitement=/);
    await expect(badgeStatut(page)).toHaveText("En attente");

    // T4 : refus commenté → badge Refusée + commentaire conservé.
    await page
      .getByLabel(/Commentaire pour le nageur/)
      .fill("Séance trop intense pour cette semaine, on allège.");
    await page.getByRole("button", { name: "Refuser" }).click();
    await expect(page).toHaveURL(/traitement=refusee/, { timeout: 20_000 });
    await expect(succes(page)).toContainText("La séance a été refusée");
    await expect(badgeStatut(page)).toHaveText("Refusée");
    await expect(
      page.getByText("Séance trop intense pour cette semaine, on allège."),
    ).toBeVisible();
  });

  test("mes nageurs : profil, historique et auto-évaluations (E-24, RG-35)", async ({
    page,
  }, testInfo) => {
    const user = coachNageursFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_COACH);

    // E-20 → E-24 : liste des nageurs affectés.
    await page.getByRole("link", { name: "Voir mes nageurs" }).click();
    await expect(page).toHaveURL(/\/coach\/nageurs$/);
    await page.getByRole("link", { name: new RegExp(user.nageur) }).click();

    // Profil sportif du nageur (RG-25 : lecture du coach affecté).
    await expect(page.getByRole("heading", { name: user.nageur })).toBeVisible();
    await expect(page.getByText(/^Niveau/)).toContainText(user.niveau);
    await expect(page.getByText(/^Disponibilités/)).toBeVisible();

    // Historique : une séance par statut terminal, badges B4.
    for (const statut of ["Validée", "Modifiée par le coach", "Refusée"]) {
      await expect(badgeStatut(page).filter({ hasText: statut })).toHaveCount(1);
    }

    // RG-35 : l'auto-évaluation du nageur est visible par son coach.
    await expect(page.getByText(/Auto-évaluation/).first()).toContainText(user.ressenti);
    await expect(page.getByText(user.autoEvaluation)).toBeVisible();

    // Le détail d'une séance traitée reste consultable (sans action, A3).
    await page
      .getByRole("link")
      .filter({ has: badgeStatut(page).filter({ hasText: "Validée" }) })
      .click();
    await expect(page).toHaveURL(/\/coach\/seances\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { name: "Auto-évaluation du nageur" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Valider la séance" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Corps de séance" })).toBeVisible();
  });
});
