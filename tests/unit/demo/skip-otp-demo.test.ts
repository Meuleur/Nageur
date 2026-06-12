import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/cookies", () => ({
  readPending2fa: vi.fn(),
  clearPending2faCookie: vi.fn(),
}));
vi.mock("@/server/auth/session", () => ({
  establishVerifiedSession: vi.fn(),
}));
vi.mock("@/server/auth/audit", () => ({
  logAuthEvent: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(),
}));

import { skipOtpDemoAction } from "@/features/auth/actions-demo";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clearPending2faCookie, readPending2fa } from "@/server/auth/cookies";
import { establishVerifiedSession } from "@/server/auth/session";

const PENDING = {
  purpose: "pending-2fa" as const,
  sub: "30000000-0000-4000-8000-000000000001",
  authAt: 1_750_000_000_000,
  exp: 1_750_000_600_000,
};

/** Capture l'erreur de contrôle de flux Next (redirect / notFound). */
async function digestDe(action: () => Promise<void>): Promise<string | undefined> {
  try {
    await action();
    return undefined;
  } catch (error) {
    return (error as { digest?: string }).digest;
  }
}

// Saut du second facteur en DÉMO : la garde DEMO_MODE est la première ligne
// — hors mode démo, l'action répond 404 sans rien lire ni écrire.
describe("skipOtpDemoAction", () => {
  beforeEach(() => {
    vi.mocked(createServiceRoleClient).mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { email: "lea.nageur@nageur.test" } },
            error: null,
          }),
        },
      },
    } as unknown as ReturnType<typeof createServiceRoleClient>);
    vi.mocked(establishVerifiedSession).mockResolvedValue("nageur");
    vi.mocked(readPending2fa).mockResolvedValue(PENDING);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("refuse (404) quand DEMO_MODE est absent — sans lire le cookie ni toucher la session", async () => {
    vi.stubEnv("DEMO_MODE", undefined);
    expect(await digestDe(skipOtpDemoAction)).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(readPending2fa).not.toHaveBeenCalled();
    expect(establishVerifiedSession).not.toHaveBeenCalled();
    expect(clearPending2faCookie).not.toHaveBeenCalled();
  });

  it("refuse (404) quand DEMO_MODE vaut autre chose que « true »", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    expect(await digestDe(skipOtpDemoAction)).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(establishVerifiedSession).not.toHaveBeenCalled();
  });

  it("en DEMO_MODE : établit la session sans OTP puis redirige selon le rôle", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    const digest = await digestDe(skipOtpDemoAction);
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/accueil");
    // L'e-mail vient du compte (service role), jamais du client.
    expect(establishVerifiedSession).toHaveBeenCalledWith("lea.nageur@nageur.test");
    expect(clearPending2faCookie).toHaveBeenCalled();
  });

  it("en DEMO_MODE sans état pending-2fa : retour à la connexion, aucune session", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    vi.mocked(readPending2fa).mockResolvedValue(null);
    const digest = await digestDe(skipOtpDemoAction);
    expect(digest).toContain("NEXT_REDIRECT");
    expect(digest).toContain("/connexion?motif=session-2fa-expiree");
    expect(establishVerifiedSession).not.toHaveBeenCalled();
  });
});
