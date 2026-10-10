// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/core/goals/actions", () => ({
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import englishMessages from "@/messages/en.json";
import { GoalForm } from "./GoalForm";

describe("GoalForm period options", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("keeps an existing quarterly goal selectable while editing it", () => {
    render(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <GoalForm
          mode="edit"
          goalId="goal-1"
          initial={{
            title: "Quarterly study goal",
            periodType: "quarter",
            periodStart: "2026-10-01",
            domain: "growth",
            goalKind: "execution",
            targetValue: undefined,
            unit: "",
            parentId: null,
          }}
          parentCandidates={[]}
          onDone={() => {}}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("radio", { name: "Quarter" })).toHaveAttribute("data-state", "on");
    expect(screen.getByRole("radio", { name: "Month" })).toBeEnabled();
  });
});
