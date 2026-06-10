import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key) — subject to Row Level Security (D2/E1).
 * Only for reads/writes permitted to the authenticated role.
 * Privileged operations go through the server layer (src/server, service role).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable (see .env.example).",
    );
  }

  return createBrowserClient(url, anonKey);
}
