import type { Metadata } from "next";
import { connection } from "next/server";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthTabs } from "@/features/auth/components/auth-tabs";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Inscription — App Natation" };

export default async function InscriptionPage() {
  // CSP à nonce (proxy.ts) : le rendu doit être dynamique — une page
  // prérendue servirait des scripts inline sans nonce, bloqués en prod.
  await connection();
  return (
    <div className="space-y-4">
      <AuthTabs active="inscription" />
      <Card>
        <CardHeader>
          <CardTitle>Créer mon compte nageur</CardTitle>
          <CardDescription>
            Une vérification de votre adresse e-mail vous sera demandée avant la première connexion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </div>
  );
}
