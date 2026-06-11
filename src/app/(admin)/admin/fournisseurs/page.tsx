import type { Metadata } from "next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminEntete } from "@/features/admin/components/admin-entete";
import { FournisseurCarte } from "@/features/admin/components/fournisseur-carte";
import { exigerSuperAdmin } from "@/features/admin/garde";
import { listerFournisseursLlm } from "@/server/data/admin";

export const metadata: Metadata = { title: "Fournisseurs LLM — App Natation" };

/**
 * E-31 — Gestion des fournisseurs LLM (PA-3, RG-38, ADR-007) : clés API via
 * Vault (jamais réaffichées), modèle par fournisseur, test de clé, et UN
 * SEUL fournisseur actif. Tout passe par le serveur — la clé ne transite
 * jamais vers le client.
 */
export default async function FournisseursPage() {
  await exigerSuperAdmin();
  const fournisseurs = await listerFournisseursLlm();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <AdminEntete
        titre="Fournisseurs LLM"
        description="Clés API chiffrées (Vault), modèle et fournisseur actif — un seul à la fois."
      />

      {fournisseurs.map((fournisseur) => (
        <FournisseurCarte
          key={fournisseur.fournisseur}
          fournisseur={fournisseur.fournisseur}
          modele={fournisseur.modele}
          actif={fournisseur.actif}
          cleEnregistree={fournisseur.cleEnregistree}
          majLe={fournisseur.majLe}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Rappels de sécurité</h2>
          </CardTitle>
          <CardDescription>
            Les clés sont chiffrées en base via Supabase Vault et ne sont jamais réaffichées ni
            journalisées (ADR-007). Le test de clé effectue un appel minimal authentifié, sans
            générer de séance ni consommer de tokens (C4).
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}
