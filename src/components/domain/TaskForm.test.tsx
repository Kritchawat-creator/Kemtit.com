// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createTask: vi.fn(), updateTask: vi.fn(), refresh: vi.fn() }));

vi.mock("@/core/tasks/actions", () => ({
  createTask: mocks.createTask,
  updateTask: mocks.updateTask,
}));
vi.mock("@/hooks/use-photo-upload", () => ({ usePhotoUpload: () => ({ upload: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";
import { TaskForm } from "./TaskForm";

const validInitial = {
  title: "QA duration guidance",
  dueDate: "2026-10-10",
  plannedDate: "2026-10-10",
  deadline: null,
  domain: "work" as const,
  recurrence: "none" as const,
  weekdays: [],
  goalId: null,
  projectId: null,
  priority: "normal" as const,
  estimatedMinutes: null,
  notes: null,
};

describe("TaskForm duration guidance", () => {
  beforeEach(() => {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it.each([
    { locale: "en" as const, messages: englishMessages },
    { locale: "th" as const, messages: thaiMessages },
  ])("explains how to correct an invalid duration in $locale", async ({ locale, messages }) => {
    render(
      <NextIntlClientProvider locale={locale} timeZone="Asia/Bangkok" messages={messages}>
        <TaskForm mode="create" initial={validInitial} goalOptions={[]} onDone={() => {}} />
      </NextIntlClientProvider>,
    );

    const durationInput = screen.getByRole("spinbutton", {
      name: messages.tasks.form.estimatedMinutes,
    });
    expect(durationInput).toHaveAttribute("min", "1");
    expect(durationInput).toHaveAttribute("max", "1440");
    expect(durationInput).toHaveAttribute("step", "1");

    fireEvent.change(durationInput, { target: { value: "1441" } });
    fireEvent.click(screen.getByRole("button", { name: messages.tasks.form.submitCreate }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      messages.errors.estimatedMinutesRange,
    );
    expect(mocks.createTask).not.toHaveBeenCalled();
  });
});
