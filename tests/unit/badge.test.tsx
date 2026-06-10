import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

describe("Badge", () => {
  it("renders a session status badge with its label", () => {
    render(<Badge variant="valid">Validée</Badge>);

    const badge = screen.getByText("Validée");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-status-valid-soft", "text-status-valid-text");
  });
});
