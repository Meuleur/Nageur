import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { AUTH_PAGES, PROTECTED_PREFIXES, ROLE_HOME, type AppRole } from "@/features/auth/routes";

/**
 * Proxy Next.js (successeur de middleware.ts en Next 16) — protection des
 * routes (C1, RG-03, RG-08) :
 *   - rafraîchit la session Supabase et synchronise ses cookies (SSR) ;
 *   - getUser() VALIDE le jeton auprès du serveur Auth (jamais une simple
 *     lecture de cookie) ;
 *   - tant que l'OTP n'est pas validé il n'existe AUCUNE session (gating
 *     C1) : l'état « 2FA en attente » ne donne donc accès à rien ici ;
 *   - chaque préfixe protégé exige le rôle correspondant (RG-03), lu dans
 *     public.profiles avec le client de l'utilisateur (sous RLS).
 * Défense en profondeur : la RLS (E1) reste la barrière de référence sur
 * les données ; les server actions revérifient leurs préconditions.
 *
 * Le proxy pose aussi la Content-Security-Policy (C1/E2) : un nonce par
 * requête (Next l'extrait de l'en-tête de requête et l'applique à ses
 * scripts), toutes les pages étant rendues dynamiquement.
 */
function buildContentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    // strict-dynamic : les scripts porteurs du nonce peuvent en charger
    // d'autres (chunks Next) ; unsafe-eval requis par React en dev seulement.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // unsafe-inline : attributs style posés par React/Framer Motion/Recharts.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Aucun appel navigateur vers Supabase aujourd'hui (écritures côté
    // serveur, D2) ; ws: en dev pour le rechargement à chaud.
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable (see .env.example).",
    );
  }

  // Mutées avant toute création de réponse : chaque NextResponse.next({
  // request }) (y compris dans setAll ci-dessous) emporte ces en-têtes, et
  // Next lit le nonce dans l'en-tête de REQUÊTE au moment du rendu.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = buildContentSecurityPolicy(nonce);
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", contentSecurityPolicy);

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // La CSP doit figurer sur la RÉPONSE rendue (les redirections, sans corps,
  // n'en ont pas besoin) ; `response` pouvant être recréée par setAll, on la
  // pose au moment du retour.
  const withCsp = (res: NextResponse) => {
    res.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return res;
  };

  // Toute redirection doit emporter les cookies éventuellement rafraîchis.
  const redirectTo = (path: string) => {
    const redirected = NextResponse.redirect(new URL(path, request.url));
    for (const cookie of response.cookies.getAll()) {
      redirected.cookies.set(cookie);
    }
    return redirected;
  };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const protectedEntry = PROTECTED_PREFIXES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPage = AUTH_PAGES.some(
    (page) => pathname === page || pathname.startsWith(`${page}/`),
  );

  if (!user) {
    if (protectedEntry || pathname === "/") {
      return redirectTo("/connexion");
    }
    return withCsp(response);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profile?.role ?? null) as AppRole | null;
  if (!role) {
    // Compte auth sans profil applicatif : anomalie — on coupe la session
    // plutôt que de boucler entre redirections.
    await supabase.auth.signOut({ scope: "local" });
    return redirectTo("/connexion");
  }

  if (pathname === "/" || isAuthPage) {
    return redirectTo(ROLE_HOME[role]);
  }
  if (protectedEntry && protectedEntry.role !== role) {
    // RG-03 : un compte n'accède pas aux écrans d'un autre rôle.
    return redirectTo(ROLE_HOME[role]);
  }
  return withCsp(response);
}

export const config = {
  // Tout sauf les ressources statiques ; /auth/confirm passe ici aussi mais
  // n'est ni protégé ni listé comme écran d'auth : il reste accessible
  // connecté comme déconnecté.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
