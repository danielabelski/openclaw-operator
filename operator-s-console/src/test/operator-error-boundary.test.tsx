import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OperatorRouteErrorBoundary } from "@/components/console/OperatorRouteErrorBoundary";

function BrokenPage(): never {
  throw new Error("Unexpected nested response value");
}

describe("operator route error boundary", () => {
  it("renders a controlled diagnostic state when a page render fails", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(
      <OperatorRouteErrorBoundary>
        <BrokenPage />
      </OperatorRouteErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("This operator page could not be rendered.");
    expect(screen.getByText("Unexpected nested response value")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
