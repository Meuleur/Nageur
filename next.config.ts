import type { NextConfig } from "next";

/**
 * En-têtes de sécurité statiques (C1/E2) — appliqués à toutes les routes, y
 * compris les ressources statiques. La Content-Security-Policy, qui exige un
 * nonce par requête, est posée dans src/proxy.ts.
 */
const securityHeaders = [
  // HTTPS exclusif (C1) — ignoré par les navigateurs en HTTP local.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  // Pas d'interprétation MIME divergente du Content-Type déclaré.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Anti-clickjacking — doublonne frame-ancestors 'none' de la CSP pour les
  // navigateurs anciens.
  { key: "X-Frame-Options", value: "DENY" },
  // Les URL internes (UUID de séances…) ne sortent pas vers d'autres origines.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // L'application n'utilise aucune API de capteur.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
