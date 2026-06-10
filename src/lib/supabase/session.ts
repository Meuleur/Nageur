import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase lié aux cookies de la requête (helpers SSR, C1/D2) — pour
 * Server Components, Server Actions et Route Handlers.
 *
 * Gating du second facteur (C1) : une session n'existe dans ces cookies
 * QU'APRÈS validation du code OTP — c'est leur établissement qui marque
 * l'utilisateur « pleinement authentifié ». Aucun autre chemin du code ne
 * pose de cookies de session.
 */
export async function createSessionClient() {
  // `cookies()` d'abord : au build (prerender), cet appel fait basculer la
  // page en rendu dynamique AVANT toute lecture d'environnement — le build
  // doit réussir sans variables renseignées (D3), la CI n'en a aucune.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable (see .env.example).",
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Rendu d'un Server Component : écrire un cookie y est interdit.
          // Le rafraîchissement de session est assuré par src/proxy.ts.
        }
      },
    },
  });
}
