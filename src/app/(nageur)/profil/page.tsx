import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { creneauKey, type Creneau } from "@/features/profil/creneaux";
import { ProfilForm, type ProfilInitial } from "@/features/profil/components/profil-form";
import { createSessionClient } from "@/lib/supabase/session";

export const metadata: Metadata = { title: "Mon profil — App Natation" };

/**
 * E-11 — Mon profil (PN-4, RG-16) : renseigner/modifier le profil sportif.
 * Lecture sous RLS (E1) avec le client de l'utilisateur ; accessible aussi
 * sans coach (PN-3).
 */
export default async function ProfilPage() {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Défense en profondeur — le proxy fait déjà ce contrôle (RG-08).
    redirect("/connexion");
  }

  const [{ data: profil, error: erreurProfil }, { data: creneaux, error: erreurCreneaux }] =
    await Promise.all([
      supabase
        .from("swimmer_profiles")
        .select("niveau, frequence, duree, bassin, objectifs, materiel")
        .eq("nageur_id", user.id)
        .maybeSingle(),
      supabase.from("swimmer_availabilities").select("jour, moment").eq("nageur_id", user.id),
    ]);
  if (erreurProfil || erreurCreneaux) {
    // Sans cela, un échec de lecture présenterait un formulaire vierge que
    // l'enregistrement écraserait — l'écran d'erreur du groupe prend le relais.
    throw new Error("profil nageur : lecture impossible");
  }

  const initial: ProfilInitial = {
    niveau: profil?.niveau ?? null,
    frequence: profil?.frequence ?? null,
    duree: profil?.duree ?? null,
    objectifs: profil?.objectifs ?? [],
    bassin: profil?.bassin ?? null,
    materiel: profil?.materiel ?? [],
    disponibilites: ((creneaux ?? []) as Creneau[]).map(creneauKey),
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <Link
          href="/accueil"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Retour à l&apos;accueil
        </Link>
        <h1 className="text-2xl font-semibold sm:text-[28px] sm:leading-9">Mon profil</h1>
        <p className="text-caption text-muted-foreground">
          Niveau, objectifs, disponibilités… Ces informations guideront la génération de vos
          séances. Vous pouvez les modifier à tout moment, sans toucher à vos séances existantes.
        </p>
      </header>

      <ProfilForm initial={initial} />
    </main>
  );
}
