import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GenererForm } from "@/features/seances/components/generer-form";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Demander une séance — App Natation" };

/** Ligne du rappel des préconditions (B2) — état lisible au-delà de la couleur (B4). */
function Precondition({ remplie, children }: { remplie: boolean; children: React.ReactNode }) {
  const Icon = remplie ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={`mt-0.5 size-4 shrink-0 ${remplie ? "text-status-valid" : "text-status-refused"}`}
        aria-hidden
      />
      <span>
        {children}
        <span className="sr-only">{remplie ? " — condition remplie" : " — condition manquante"}</span>
      </span>
    </li>
  );
}

/**
 * E-12 — Demander une séance (PN-5, RG-19) : rappel des préconditions
 * (coach RG-14 + profil complet RG-17) et déclencheur de génération branché
 * sur la couche CH4. Sans coach → renvoi E-10 ; profil incomplet → renvoi
 * E-11 (B2). Aucune limite de fréquence (RG-24).
 */
export default async function GenererSeancePage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const [{ data: coach }, { data: profilSportif }] = await Promise.all([
    // Vue dédiée my_coach (ADR-024) : prénom + nom du coach affecté, ou vide.
    supabase.from("my_coach").select("prenom, nom").maybeSingle(),
    // L'existence de la ligne suffit : les contraintes E1 garantissent que
    // tous les champs obligatoires (ADR-016) y sont renseignés.
    supabase.from("swimmer_profiles").select("nageur_id").eq("nageur_id", user.id).maybeSingle(),
  ]);

  const preconditionsRemplies = Boolean(coach) && Boolean(profilSportif);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/accueil"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Demander une séance</h1>
        <p className="text-caption text-muted-foreground">
          L&apos;IA prépare une séance adaptée à votre profil ; votre coach la relit et la valide
          avant qu&apos;elle ne soit utilisable.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Avant de générer</CardTitle>
          <CardDescription>Deux conditions sont nécessaires :</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            <Precondition remplie={Boolean(coach)}>
              Avoir un coach —{" "}
              {coach ? (
                <>
                  votre coach est <strong>{coach.prenom} {coach.nom}</strong>.
                </>
              ) : (
                <>
                  vous n&apos;avez pas encore de coach.{" "}
                  <Link href="/accueil" className="text-primary underline underline-offset-2">
                    Retour à l&apos;accueil
                  </Link>
                </>
              )}
            </Precondition>
            <Precondition remplie={Boolean(profilSportif)}>
              Avoir un profil sportif complet —{" "}
              {profilSportif ? (
                <>votre profil est renseigné.</>
              ) : (
                <>
                  votre profil n&apos;est pas encore renseigné.{" "}
                  <Link href="/profil" className="text-primary underline underline-offset-2">
                    Compléter mon profil
                  </Link>
                </>
              )}
            </Precondition>
          </ul>

          {preconditionsRemplies ? (
            <GenererForm />
          ) : (
            <Button size="lg" className="w-full sm:w-auto" disabled>
              Générer ma séance
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
