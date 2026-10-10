// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyGoalWizard: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/goals/wizard-actions", () => ({ applyGoalWizard: mocks.applyGoalWizard }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));

import enMessages from "@/messages/en.json";
import { GoalWizard } from "./GoalWizard";

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <GoalWizard userId="user-1" today="2026-10-09" starterPack={null} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.applyGoalWizard.mockReset();
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
  vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GoalWizard", () => {
  it("shows an inline error, focuses the invalid field, and focuses the next step heading", async () => {
    renderWizard();
    await screen.findByRole("heading", { name: "Choose a direction" });

    const goalTitle = screen.getByLabelText("What would you like to improve?");
    fireEvent.change(goalTitle, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(goalTitle).toHaveAttribute("aria-invalid", "true");
    expect(goalTitle).toHaveAttribute("aria-describedby", "wizard-goal-title-error");
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required");
    expect(document.activeElement).toBe(goalTitle);

    fireEvent.change(goalTitle, { target: { value: "Feel more rested" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const nextHeading = await screen.findByRole("heading", { name: "Choose one first step" });
    await waitFor(() => expect(document.activeElement).toBe(nextHeading));
  });

  it("does not describe the initial request as a previous save while it is still pending", async () => {
    let resolveSave: ((value: { ok: false; error: "generic" }) => void) | undefined;
    mocks.applyGoalWizard.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve)),
    );
    renderWizard();
    await screen.findByRole("heading", { name: "Choose a direction" });
    fireEvent.change(screen.getByLabelText("What would you like to improve?"), {
      target: { value: "Feel more rested" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Choose one first step" });
    fireEvent.change(screen.getByLabelText("First step"), {
      target: { value: "Choose a regular bedtime" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review before saving" });

    fireEvent.click(screen.getByRole("button", { name: "Create this goal" }));
    await screen.findByRole("button", { name: "Saving…" });
    expect(screen.queryByText("A previous save has no confirmed result")).not.toBeInTheDocument();

    await act(async () => {
      resolveSave?.({ ok: false, error: "generic" });
    });
    await screen.findByText("A previous save has no confirmed result");
  });

  it("waits for explicit confirmation and safely retries the same operation after an unknown result", async () => {
    mocks.applyGoalWizard
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({ ok: true, data: { goalId: "goal-1", taskIds: ["task-1"] } });

    const firstRender = renderWizard();
    await screen.findByRole("heading", { name: "Choose a direction" });
    fireEvent.change(screen.getByLabelText("What would you like to improve?"), {
      target: { value: "Feel more rested" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Choose one first step" });
    fireEvent.change(screen.getByLabelText("First step"), {
      target: { value: "Choose a regular bedtime" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review before saving" });

    expect(mocks.applyGoalWizard).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create this goal" }));
    await screen.findByRole("button", { name: "Retry safely" });
    expect(mocks.applyGoalWizard).toHaveBeenCalledOnce();

    const savedAttempt = JSON.parse(localStorage.getItem("kemtit.goal-wizard.v1:user-1") ?? "null");
    expect(savedAttempt).toMatchObject({
      requestId: "00000000-0000-4000-8000-000000000001",
      spec: {
        title: "Feel more rested",
        goalKind: "execution",
        tasks: [{ title: "Choose a regular bedtime", dueDate: "2026-10-16", domain: "work" }],
      },
    });

    firstRender.unmount();
    renderWizard();
    await screen.findByText("A previous save has no confirmed result");
    fireEvent.click(screen.getByRole("button", { name: "Retry safely" }));
    await waitFor(() => expect(mocks.applyGoalWizard).toHaveBeenCalledTimes(2));
    expect(mocks.applyGoalWizard.mock.calls[1][0]).toEqual(mocks.applyGoalWizard.mock.calls[0][0]);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/goals/goal-1"));
    expect(localStorage.getItem("kemtit.goal-wizard.v1:user-1")).toBeNull();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("reuses an attempt saved by another tab instead of reserving a new request ID", async () => {
    const generateRequestId = vi.fn(() => "00000000-0000-4000-8000-000000000003");
    vi.stubGlobal("crypto", { randomUUID: generateRequestId });
    mocks.applyGoalWizard.mockResolvedValue({ ok: false, error: "generic" });
    renderWizard();
    await screen.findByRole("heading", { name: "Choose a direction" });
    fireEvent.change(screen.getByLabelText("What would you like to improve?"), {
      target: { value: "Feel more rested" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Choose one first step" });
    fireEvent.change(screen.getByLabelText("First step"), {
      target: { value: "Choose a regular bedtime" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review before saving" });

    const storageKey = "kemtit.goal-wizard.v1:user-1";
    const savedByOtherTab = {
      requestId: "00000000-0000-4000-8000-000000000002",
      spec: {
        title: "Feel more rested",
        periodType: "month",
        periodStart: "2026-10-01",
        domain: "work",
        goalKind: "execution",
        tasks: [
          {
            title: "Choose a regular bedtime",
            dueDate: "2026-10-16",
            domain: "work",
          },
        ],
      },
    };
    localStorage.setItem(storageKey, JSON.stringify(savedByOtherTab));
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: storageKey,
        newValue: JSON.stringify(savedByOtherTab),
      }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Retry safely" }));
    await waitFor(() => expect(mocks.applyGoalWizard).toHaveBeenCalledOnce());
    expect(mocks.applyGoalWizard).toHaveBeenCalledWith(savedByOtherTab);
    expect(generateRequestId).not.toHaveBeenCalled();
  });
});
