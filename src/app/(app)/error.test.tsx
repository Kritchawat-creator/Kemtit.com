import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QueryError } from "@/core/shared/query-error";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import AppError from "./error";
import RootRouteError from "../error";

describe("application error recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the generic route message without exposing query source or code", () => {
    const queryError = new QueryError("finance.listBills", "PGRST303");
    render(<AppError error={queryError} reset={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("errors.pageTitle");
    expect(alert).toHaveTextContent("errors.pageDescription");
    expect(alert).not.toHaveTextContent("finance.listBills");
    expect(alert).not.toHaveTextContent("PGRST303");
  });

  it("refreshes server data and resets the route boundary when retry is selected", () => {
    const reset = vi.fn();
    render(<AppError error={new Error("queryFailed")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(reset).toHaveBeenCalledOnce();
  });

  it("logs only the safe digest, never query details or the raw error message", () => {
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("sensitive backend detail"), {
      digest: "safe-digest",
      source: "finance.listBills",
      code: "PGRST303",
    });

    render(<AppError error={error} reset={vi.fn()} />);

    expect(logError).toHaveBeenCalledWith("[app] route error", { digest: "safe-digest" });
    expect(JSON.stringify(logError.mock.calls)).not.toContain("sensitive backend detail");
    expect(JSON.stringify(logError.mock.calls)).not.toContain("finance.listBills");
    expect(JSON.stringify(logError.mock.calls)).not.toContain("PGRST303");
  });

  it("uses the same recovery UI for failures in authenticated layout setup", () => {
    render(<RootRouteError error={new Error("queryFailed")} reset={vi.fn()} />);

    expect(screen.getByRole("alert")).toHaveTextContent("errors.pageTitle");
    expect(screen.getByRole("button", { name: "common.retry" })).toBeInTheDocument();
  });
});
