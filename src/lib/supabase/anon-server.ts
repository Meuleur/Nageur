import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client anonyme SANS persistance de session (gating C1) : sert à vérifier
 * des identifiants (`signInWithPassword`) ou à consommer des jetons e-mail
 * (`verifyOtp`) côté serveur sans JAMAIS écrire de cookie navigateur. Les
 * jetons obtenus restent en mémoire de la requête, puis sont révoqués
 * (admin.signOut) ou abandonnés par l'appelant.
 */
export function createBareAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable (see .env.example).",
    );
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
