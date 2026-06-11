import type { Metadata } from "next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminEntete } from "@/features/admin/components/admin-entete";
import { AffectationsTable } from "@/features/admin/components/affectations-table";
import { exigerSuperAdmin } from "@/features/admin/garde";
import { listerCoachs, listerNageursPourAffectation } from "@/server/data/admin";

export const metadata: Metadata = { title: "Affectations — App Natation" };

/**
 * E-32 — Affectations coach ↔ nageur (PA-4, RG-10 à RG-15). Seul le Super
 * Admin crée ou modifie une affectation (RG-12) ; le nageur affecté est
 * notifié par e-mail (N8, hors chemin critique) et sa génération se
 * débloque (RG-14).
 */
export default async function AffectationsPage() {
  await exigerSuperAdmin();
  const [nageurs, coachs] = await Promise.all([
    listerNageursPourAffectation(),
    listerCoachs(),
  ]);
  const sansCoach = nageurs.filter((nageur) => nageur.coachId === null).length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <AdminEntete
        actif="/admin/affectations"
        titre="Affectations coach ↔ nageur"
        description={
          sansCoach > 0
            ? `${sansCoach} nageur${sansCoach > 1 ? "s" : ""} sans coach — la génération est bloquée pour eux (RG-14).`
            : "Tous les nageurs ont un coach."
        }
      />

      {coachs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Aucun coach disponible</h2>
            </CardTitle>
            <CardDescription>
              Créez d&apos;abord un compte coach (onglet « Coachs ») pour pouvoir affecter les
              nageurs.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <AffectationsTable nageurs={nageurs} coachs={coachs} />
      )}
    </main>
  );
}
