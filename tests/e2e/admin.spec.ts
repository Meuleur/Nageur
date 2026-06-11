import { expect, test, type Locator, type Page } from "@playwright/test";

import { seConnecter } from "./helpers/login";
import { extractConfirmLink, latestEmailId, waitForEmail } from "./helpers/mailpit";
import {
  accesRefuseFor,
  adminAffectationFor,
  adminFournisseursFor,
  adminInvitationFor,
  adminMetriquesFor,
} from "./helpers/users";

/** Conforme à la politique C1 — le coach invité définit un VRAI mot de passe. */
const MOT_DE_PASSE_COACH_INVITE = "Invitation!Bassin7";

/**
 * CH8 — espace Super Admin (E-30 à E-33, PA-2 à PA-5).
 * Un compte ADMIN seedé par test ET par projet (OTP à usage unique, voir
 * users.ts) ; reseed_ch8_e2e() remet affectations, comptes invités et
 * fournisseurs à l'état seed. Les opérations sensibles passent par le
 * serveur : ces tests vérifient le résultat visible et les e-mails Mailpit
 * (driver simulé — aucun envoi ni appel fournisseur réel).
 */

const ACCUEIL_ADMIN = /\/admin$/;
const succes = (page: Page) => page.locator('[data-slot="alert"][role="status"]');

const carteFournisseur = (page: Page, nom: "Anthropic" | "OpenAI"): Locator =>
  page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: nom, exact: true }) });

/** Badge Actif/Inactif d'une carte (un seul badge par carte fournisseur). */
const badgeFournisseur = (carte: Locator): Locator => carte.locator('[data-slot="badge"]');

async function seDeconnecter(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion/);
}

test.describe("Espace Super Admin (E-30 à E-33)", () => {
  test("tableau de bord : métriques agrégées, filtre de période, jamais de contenu (E-30, RG-39)", async ({
    page,
  }, testInfo) => {
    await seConnecter(page, adminMetriquesFor(testInfo), ACCUEIL_ADMIN);

    // Cartes de métriques (C4) — agrégats uniquement.
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
    await expect(page.getByText(/Tokens consommés/)).toBeVisible();
    await expect(page.getByText("Taux de validation")).toBeVisible();
    await expect(page.getByText("Nageurs sans coach")).toBeVisible();
    await expect(page.getByText("Séances en attente")).toBeVisible();

    // Graphiques sobres (B4) — rendus avec un libellé accessible.
    await expect(page.getByRole("img", { name: /Séances par statut/ })).toBeVisible();
    await expect(page.getByRole("img", { name: /générées par jour sur 30 jours/ })).toBeVisible();

    // Filtre de période (fenêtres glissantes).
    await page.getByRole("link", { name: "7 jours" }).click();
    await expect(page).toHaveURL(/periode=semaine/);
    await expect(page.getByText(/Tokens consommés \(7 jours\)/)).toBeVisible();

    // ADR-020 : le périmètre est rappelé, aucun contenu de séance à l'écran.
    await expect(page.getByText(/jamais au contenu des séances/)).toBeVisible();
  });

  test("fournisseurs LLM : clé jamais réaffichée, test de clé, modèle, activation exclusive (E-31, RG-38)", async ({
    page,
  }, testInfo) => {
    // Le fournisseur actif est un état GLOBAL unique (RG-38) : un seul
    // projet Playwright exécute ce test pour éviter toute course.
    test.skip(testInfo.project.name !== "chromium", "état global RG-38 — chromium uniquement");

    await seConnecter(page, adminFournisseursFor(testInfo), ACCUEIL_ADMIN);
    await page.getByRole("link", { name: "Fournisseurs LLM" }).click();
    await expect(page).toHaveURL(/\/admin\/fournisseurs$/);

    const anthropic = carteFournisseur(page, "Anthropic");
    const openai = carteFournisseur(page, "OpenAI");
    await expect(badgeFournisseur(anthropic)).toHaveText("Fournisseur actif");
    await expect(badgeFournisseur(openai)).toHaveText("Inactif");

    // Rotation de clé (ADR-007) : enregistrée, jamais réaffichée.
    const cleFactice = "sk-test-e2e-rotation-cle-openai-0001";
    await openai.getByLabel(/clé API/i).fill(cleFactice);
    await openai.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(openai.getByText("Clé enregistrée et chiffrée")).toBeVisible();
    await expect(page.getByText(cleFactice)).toHaveCount(0);

    // Test de clé : appel minimal simulé (LLM_DRIVER=simule, aucun réseau).
    await openai.getByRole("button", { name: "Tester la clé" }).click();
    await expect(openai.getByText("Clé valide : le fournisseur a répondu.")).toBeVisible();

    // Choix du modèle.
    await openai.getByLabel("Modèle").fill("gpt-4o-mini");
    await openai.getByRole("button", { name: "Enregistrer le modèle" }).click();
    await expect(openai.getByText("Modèle enregistré.")).toBeVisible();

    // Activation EXCLUSIVE (RG-38) : un seul fournisseur actif à la fois.
    await openai.getByRole("button", { name: "Activer ce fournisseur" }).click();
    await expect(badgeFournisseur(openai)).toHaveText("Fournisseur actif");
    await expect(badgeFournisseur(anthropic)).toHaveText("Inactif");

    // Retour à l'état seed (les suites parallèles génèrent des séances).
    await anthropic.getByRole("button", { name: "Activer ce fournisseur" }).click();
    await expect(badgeFournisseur(anthropic)).toHaveText("Fournisseur actif");
    await expect(badgeFournisseur(openai)).toHaveText("Inactif");
  });

  test("affectations : affecter (N8), puis désaffecter — RG-10 à RG-15 (E-32)", async ({
    page,
  }, testInfo) => {
    const user = adminAffectationFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_ADMIN);
    await page.getByRole("link", { name: "Affectations" }).click();
    await expect(page).toHaveURL(/\/admin\/affectations$/);

    // Recherche puis ligne du nageur seedé sans coach (RG-13).
    await page.getByLabel("Rechercher un nageur").fill(user.nageur);
    const ligne = page.locator("li").filter({ hasText: user.nageur });
    const badge = ligne.locator('[data-slot="badge"]');
    await expect(badge).toHaveText("Sans coach");

    // Affectation → confirmation + notification N8 du nageur (PA-4, CH7).
    const inboxNageur = await latestEmailId(user.nageurEmail);
    await ligne.getByRole("combobox").selectOption({ label: user.coach });
    await ligne.getByRole("button", { name: "Enregistrer" }).click();
    await expect(succes(page)).toContainText("Affectation enregistrée");
    await expect(badge).toHaveText("Avec coach");

    const emailN8 = await waitForEmail(user.nageurEmail, { afterId: inboxNageur });
    expect(emailN8.subject).toBe("Un coach vous a été affecté");
    expect(emailN8.html).toContain("/seances/generer");

    // Désaffectation (RG-13) : retour à « sans coach ».
    await ligne.getByRole("combobox").selectOption({ label: "Sans coach" });
    await ligne.getByRole("button", { name: "Enregistrer" }).click();
    await expect(succes(page).filter({ hasText: "désaffecté" })).toBeVisible();
    await expect(badge).toHaveText("Sans coach");
  });

  test("invitation coach de bout en bout : e-mail → mot de passe → connexion 2FA (E-33, RG-02)", async ({
    page,
  }, testInfo) => {
    const user = adminInvitationFor(testInfo);
    await seConnecter(page, user.email, ACCUEIL_ADMIN);
    await page.getByRole("link", { name: "Coachs" }).click();
    await expect(page).toHaveURL(/\/admin\/coachs$/);

    // L'admin saisit l'identité — jamais de mot de passe (C4).
    const inboxInvite = await latestEmailId(user.inviteEmail);
    await page.getByLabel("Prénom").fill(user.invitePrenom);
    await page.getByLabel("Nom", { exact: true }).fill(user.inviteNom);
    await page.getByLabel("Adresse e-mail").fill(user.inviteEmail);
    await page.getByRole("button", { name: "Envoyer l'invitation" }).click();
    await expect(succes(page)).toContainText(`Invitation envoyée à ${user.inviteEmail}`);

    // Le coach apparaît dans la liste (rôle fixé côté serveur, RG-02).
    await expect(
      page.getByText(`${user.invitePrenom} ${user.inviteNom}`),
    ).toBeVisible();

    // E-mail d'invitation (B4) avec lien d'activation /auth/confirm.
    const emailInvitation = await waitForEmail(user.inviteEmail, { afterId: inboxInvite });
    expect(emailInvitation.subject).toBe("Activez votre compte coach");
    const lien = extractConfirmLink(emailInvitation);
    expect(lien).toContain("type=invite");

    // Le coach suit le lien (hors session admin) et définit SON mot de passe.
    await seDeconnecter(page);
    await page.goto(lien);
    await expect(page).toHaveURL(/\/reinitialisation\?contexte=invitation/);
    // CardTitle shadcn rend un div, pas un heading (piège vu au CH5).
    await expect(page.getByText("Activer votre compte coach")).toBeVisible();
    await page.getByLabel("Nouveau mot de passe").fill(MOT_DE_PASSE_COACH_INVITE);
    await page.getByLabel("Confirmer le mot de passe").fill(MOT_DE_PASSE_COACH_INVITE);
    await page.getByRole("button", { name: "Définir ce mot de passe" }).click();
    await expect(page).toHaveURL(/\/connexion\?motif=mot-de-passe-modifie/);

    // Connexion normale avec 2FA (CH2) → accueil coach (RG-03). Rôle heading :
    // le route announcer Next peut répéter le h1 (voir note CH2).
    await seConnecter(page, user.inviteEmail, /\/coach$/, MOT_DE_PASSE_COACH_INVITE);
    await expect(
      page.getByRole("heading", { name: `Bonjour ${user.invitePrenom}` }),
    ).toBeVisible();
  });

  test("l'espace admin est inaccessible sans session, aux nageurs et aux coachs (RG-03/RG-40)", async ({
    page,
  }, testInfo) => {
    const user = accesRefuseFor(testInfo);

    // Sans session : retour à la connexion (RG-08).
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/connexion/);

    // Nageur connecté : renvoyé vers SON accueil (RG-03).
    await seConnecter(page, user.nageurEmail);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/accueil$/);
    await page.goto("/admin/fournisseurs");
    await expect(page).toHaveURL(/\/accueil$/);
    await seDeconnecter(page);

    // Coach connecté : même refus (RG-40).
    await seConnecter(page, user.coachEmail, /\/coach$/);
    await page.goto("/admin/affectations");
    await expect(page).toHaveURL(/\/coach$/);
  });
});
