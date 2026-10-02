// @vitest-environment jsdom
import { NextIntlClientProvider } from "next-intl";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { WorkflowGuide, type WorkflowGuideProps } from "./WorkflowGuide";

const localeMessages = { en: englishMessages, th: thaiMessages } as const;
type Locale = keyof typeof localeMessages;

function renderGuide(locale: Locale, props: Partial<WorkflowGuideProps> = {}) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Asia/Bangkok"
      messages={localeMessages[locale]}
    >
      <WorkflowGuide
        roleCode="employee"
        horizon="week"
        selectedDate="2026-10-02"
        primaryAction={{ kind: "choose-goal", href: "/plan?view=week&date=2026-10-02&new=goal" }}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("WorkflowGuide", () => {
  it("shows the selected role, horizon, first step, and one contextual action in Thai", () => {
    const { container } = renderGuide("th");

    const guide = screen.getByRole("region", { name: thaiMessages.workflowGuide.title });
    expect(within(guide).getByText(/พนักงาน/)).toBeInTheDocument();
    const nextAction = within(guide).getByRole("group", {
      name: thaiMessages.workflowGuide.nextAction,
    });
    expect(
      within(nextAction).getByText(thaiMessages.workflowGuide.steps.employee.week["1"]),
    ).toBeVisible();
    expect(
      within(guide).getByRole("link", {
        name: thaiMessages.workflowGuide.actions.chooseGoal,
      }),
    ).toHaveAttribute("href", "/plan?view=week&date=2026-10-02&new=goal");

    const navigation = within(guide).getByRole("navigation", {
      name: thaiMessages.workflowGuide.horizonNavigation,
    });
    expect(
      within(navigation).getByRole("link", { name: thaiMessages.workflowGuide.periods.week }),
    ).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    for (const horizonLink of within(navigation).getAllByRole("link")) {
      expect(horizonLink).toHaveClass("min-h-11");
    }
    expect(within(guide).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(container.textContent ?? "").not.toMatch(/[A-Za-z]/);
  });

  it("keeps the full three-step order behind an accessible collapsed disclosure", () => {
    renderGuide("th", {
      roleCode: "seller",
      horizon: "day",
      primaryAction: { kind: "today-priorities", href: "#today-plan-heading" },
    });

    const guide = screen.getByRole("region", { name: thaiMessages.workflowGuide.title });
    const disclosure = within(guide).getByText(thaiMessages.workflowGuide.showSteps);
    const details = disclosure.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(disclosure).toHaveClass("min-h-11", "flex", "items-center");
    expect(
      within(details as HTMLElement).getByText(thaiMessages.workflowGuide.priorityRule),
    ).toBeInTheDocument();
    fireEvent.click(disclosure);

    expect(within(guide).getByRole("list").children).toHaveLength(3);
    expect(
      within(guide).getByRole("link", {
        name: thaiMessages.workflowGuide.actions.todayPriorities,
      }),
    ).toHaveAttribute("href", "#today-plan-heading");
  });

  it("uses general guidance for a missing role and keeps English copy language-pure", () => {
    const { container } = renderGuide("en", {
      roleCode: null,
      horizon: "month",
      primaryAction: { kind: "goal", href: "/goals/goal-id", title: "Client milestone" },
    });

    const guide = screen.getByRole("region", { name: englishMessages.workflowGuide.title });
    expect(within(guide).getByText(/General/)).toBeInTheDocument();
    expect(
      within(guide).getByRole("link", {
        name: englishMessages.workflowGuide.actions.openGoal.replace(
          "{title}",
          "Client milestone",
        ),
      }),
    ).toHaveAttribute("href", "/goals/goal-id");
    expect(container.textContent ?? "").not.toMatch(/[\u0E00-\u0E7F]/);
  });

  it("lets long existing-goal titles wrap inside the compact action link", () => {
    const title = "Prepare and deliver the full client onboarding and reporting milestone";
    renderGuide("en", {
      primaryAction: { kind: "goal", href: "/goals/goal-id", title },
    });

    const action = screen.getByRole("link", {
      name: englishMessages.workflowGuide.actions.openGoal.replace("{title}", title),
    });
    expect(action).toHaveClass("h-auto", "min-h-11", "min-w-0", "max-w-full", "whitespace-normal");
  });
});
