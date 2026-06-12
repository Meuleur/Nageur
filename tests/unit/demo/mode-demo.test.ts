import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { estModeDemo } from "@/server/demo";

// Garde du mode DÉMO (branche demo) : inerte par défaut, activée par la
// seule valeur stricte "true".
describe("estModeDemo", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("est faux quand DEMO_MODE est absent (défaut)", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    expect(estModeDemo()).toBe(false);
  });

  it("est faux pour toute valeur autre que la chaîne stricte « true »", () => {
    for (const valeur of ["false", "TRUE", "True", "1", "yes", ""]) {
      vi.stubEnv("DEMO_MODE", valeur);
      expect(estModeDemo()).toBe(false);
    }
  });

  it("est vrai uniquement pour DEMO_MODE=true", () => {
    vi.stubEnv("DEMO_MODE", "true");
    expect(estModeDemo()).toBe(true);
  });
});
