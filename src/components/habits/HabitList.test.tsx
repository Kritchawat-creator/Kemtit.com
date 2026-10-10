// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toggleHabit: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/habits/actions", () => ({ toggleHabit: mocks.toggleHabit }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import englishMessages from "@/messages/en.json";
import { HabitList } from "./HabitList";

const habit = (done: boolean) => ({
  id: "habit-water",
  title: "Drink water every day",
  domain: "health",
  cadence: "daily",
  done,
});

function renderList(done: boolean) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
      <HabitList habits={[habit(done)]} date="2026-10-10" />
    </NextIntlClientProvider>,
  );
}

describe("HabitList completion state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the persisted toggle state and sends the inverse state on activation", async () => {
    mocks.toggleHabit.mockResolvedValue({ ok: true, data: null });
    const { rerender } = renderList(false);
    const button = screen.getByRole("button", { name: /Drink water every day/ });

    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    await waitFor(() =>
      expect(mocks.toggleHabit).toHaveBeenCalledWith({
        habitId: "habit-water",
        date: "2026-10-10",
        done: true,
      }),
    );

    rerender(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <HabitList habits={[habit(true)]} date="2026-10-10" />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: /Drink water every day/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("keeps the prior state exposed when the update fails", async () => {
    mocks.toggleHabit.mockResolvedValue({ ok: false, error: "generic" });
    renderList(true);
    const button = screen.getByRole("button", { name: /Drink water every day/ });

    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(button).toHaveAttribute("aria-pressed", "true");
  });
});
