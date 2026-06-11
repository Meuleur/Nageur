import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminEntete } from "@/features/admin/components/admin-entete";
import { InvitationCoachForm } from "@/features/admin/components/invitation-coach-form";
import { exigerSuperAdmin } from "@/features/admin/garde";
import { listerCoachs, listerNageursPourAffectation } from "@/server/data/admin";

export const metadata: Metadata = { title: "Coachs — App Natation" };

/**
 * E-33 — Comptes coachs (PA-5, RG-02) : liste des coachs et création par
 * invitation e-mail. Le rôle coach est fixé côté serveur (service role) —
 * l'inscription publique ne crée que des nageurs, aucun chemin
 * d'auto-attribution de rôle n'existe.
 */
export default async function CoachsPage() {
  await exigerSuperAdmin();
  const [coachs, nageurs] = await Promise.all([listerCoachs(), listerNageursPourAffectation()]);

  const nageursParCoach = new Map<string, number>();
  for (const nageur of nageurs) {
    if (nageur.coachId !== null) {
      nageursParCoach.set(nageur.coachId, (nageursParCoach.get(nageur.coachId) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <AdminEntete
        titre="Comptes coachs"
        description="Création par invitation : le coach définit lui-même son mot de passe."
      />

      <InvitationCoachForm />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Coachs ({coachs.length})</h2>
          </CardTitle>
          <CardDescription>
            Nageurs suivis par coach — les affectations se gèrent dans l&apos;onglet dédié.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coachs.length === 0 ? (
            <p className="text-muted-foreground">Aucun coach pour le moment : invitez-en un.</p>
          ) : (
            <ul className="divide-y divide-border">
              {coachs.map((coach) => {
                const suivis = nageursParCoach.get(coach.id) ?? 0;
                return (
                  <li
                    key={coach.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div>
                      <p className="font-medium">
                        {coach.prenom} {coach.nom}
                      </p>
                      <p className="text-caption text-muted-foreground">{coach.email}</p>
                    </div>
                    <p className="text-caption text-muted-foreground">
                      {suivis === 0
                        ? "Aucun nageur"
                        : `${suivis} nageur${suivis > 1 ? "s" : ""} suivi${suivis > 1 ? "s" : ""}`}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
