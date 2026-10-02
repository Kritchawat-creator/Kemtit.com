// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptStarterSuggestion: vi.fn(),
  finishStarterWorkspace: vi.fn(),
  skipStarterSuggestion: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("./actions", () => ({
  acceptStarterSuggestion: mocks.acceptStarterSuggestion,
  finishStarterWorkspace: mocks.finishStarterWorkspace,
  skipStarterSuggestion: mocks.skipStarterSuggestion,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const translate = (key: string) => (namespace === "errors" ? key : key);
    return Object.assign(translate, { has: () => true });
  },
}));

import { StarterWorkspace, type StarterSuggestionView } from "./starter-workspace";

const suggestions: StarterSuggestionView[] = [
  {
    id: "starter-task-1",
    type: "task",
    area: "work",
    areaLabel: "Work",
    title: "Prepare weekly report",
    subtitle: "A first task",
    reason: "Make progress",
    status: "pending",
  },
  {
    id: "starter-task-2",
    type: "task",
    area: "work",
    areaLabel: "Work",
    title: "Plan next week",
    subtitle: "Another task",
    reason: "Stay organized",
    status: "pending",
  },
];

function renderWorkspace() {
  return render(
    <StarterWorkspace
      suggestions={suggestions}
      calendarConfigured={false}
      calendarConnected={false}
    />,
  );
}

beforeEach(() => {
  mocks.acceptStarterSuggestion.mockReset();
  mocks.finishStarterWorkspace.mockReset();
  mocks.skipStarterSuggestion.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
});

describe("StarterWorkspace", () => {
  it("hides the empty-state callout after accepting an item and removes a skipped item after saving", async () => {
    mocks.acceptStarterSuggestion.mockResolvedValue({
      ok: true,
      data: { entityType: "task", entityId: "task-1" },
    });

    let resolveSkip!: (result: { ok: true; data: { status: "skipped" } }) => void;
    mocks.skipStarterSuggestion.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSkip = resolve;
        }),
    );

    renderWorkspace();

    expect(screen.getByText("nothingAddedTitle")).toBeInTheDocument();
    expect(screen.getByText("nothingAddedDescription")).toBeInTheDocument();

    const firstCard = screen
      .getByRole("heading", { name: "Prepare weekly report" })
      .closest("article");
    expect(firstCard).not.toBeNull();
    fireEvent.click(within(firstCard!).getByRole("button", { name: "accept" }));

    await waitFor(() => {
      expect(within(firstCard!).getByText("accepted")).toBeInTheDocument();
    });
    expect(screen.queryByText("nothingAddedTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("nothingAddedDescription")).not.toBeInTheDocument();

    const secondCard = screen.getByRole("heading", { name: "Plan next week" }).closest("article");
    expect(secondCard).not.toBeNull();
    const skipButton = within(secondCard!).getByRole("button", { name: "skip" });
    fireEvent.click(skipButton);

    expect(skipButton).toBeDisabled();
    expect(mocks.skipStarterSuggestion).toHaveBeenCalledWith({ suggestionId: "starter-task-2" });

    resolveSkip({ ok: true, data: { status: "skipped" } });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Plan next week" })).not.toBeInTheDocument();
    });
    expect(within(firstCard!).getByText("accepted")).toBeInTheDocument();
  });

  it("keeps the empty-state callout when accepting an item fails", async () => {
    mocks.acceptStarterSuggestion.mockResolvedValue({ ok: false, error: "generic" });
    renderWorkspace();

    const firstCard = screen
      .getByRole("heading", { name: "Prepare weekly report" })
      .closest("article");
    expect(firstCard).not.toBeNull();
    fireEvent.click(within(firstCard!).getByRole("button", { name: "accept" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("generic");
    expect(screen.getByText("nothingAddedTitle")).toBeInTheDocument();
    expect(screen.getByText("nothingAddedDescription")).toBeInTheDocument();
  });
});
