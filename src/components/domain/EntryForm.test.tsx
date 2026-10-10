// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/core/entries/actions", () => ({
  addEntry: vi.fn(),
  updateEntry: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import englishMessages from "@/messages/en.json";
import { EntryForm } from "./EntryForm";

const goalOptions = [
  {
    id: "goal-1",
    title: "October sales",
    unit: "THB",
    period_type: "month" as const,
    period_start: "2026-10-01",
    target_value: 10000,
  },
];

describe("EntryForm amount accessibility", () => {
  it.each(["create", "edit"] as const)("labels the amount input in %s mode", (mode) => {
    render(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <EntryForm
          mode={mode}
          entryId={mode === "edit" ? "entry-1" : undefined}
          goalOptions={goalOptions}
          initial={
            mode === "edit"
              ? {
                  goalId: "goal-1",
                  entryDate: "2026-10-10",
                  amount: 1200,
                  note: "",
                  channel: null,
                }
              : undefined
          }
          onDone={() => {}}
        />
      </NextIntlClientProvider>,
    );

    expect(
      screen.getByRole("spinbutton", { name: englishMessages.entries.form.amount }),
    ).toBeInTheDocument();
  });
});
