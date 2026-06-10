import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthTabs } from "@/features/auth/components/auth-tabs";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = { title: "Inscription — App Natation" };

export default function InscriptionPage() {
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
