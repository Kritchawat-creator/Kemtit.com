import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database";

import { NotesList } from "./NotesList";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    const labels: Record<string, string> = {
      "common.cancel": "Cancel",
      "common.edit": "Edit",
      "common.save": "Save",
      "inbox.addNote": "Add note",
      "inbox.notePlaceholder": "Write a note",
    };
    if (key === "inbox.noteActions") return `Actions for ${values?.title ?? "note"}`;
    return labels[key] ?? key;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/core/notes/actions", () => ({
  archiveNote: vi.fn(),
  convertNoteToTask: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
}));

afterEach(cleanup);

const note: Database["public"]["Tables"]["notes"]["Row"] = {
  archived_at: null,
  body: "A short note body.",
  created_at: "2026-09-26T00:00:00.000Z",
  data_origin: "manual",
  id: "note-1",
  linked_task_id: null,
  note_date: "2026-09-26",
  title: "First note",
  updated_at: "2026-09-26T00:00:00.000Z",
  user_id: "user-1",
};

function getNoteActionsSummary() {
  const summary = screen.getByRole("group").querySelector("summary");
  if (!summary) throw new Error("Expected the note actions disclosure summary");
  return summary;
}

describe("NotesList focus behavior", () => {
  it("moves focus into the composer and restores it when Escape or Cancel closes it", async () => {
    const user = userEvent.setup();
    render(<NotesList notes={[]} date="2026-09-26" />);

    const addNoteButton = screen.getByRole("button", { name: "Add note" });
    await user.click(addNoteButton);
    expect(screen.getByRole("textbox", { name: "Write a note" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Write a note" })).not.toBeInTheDocument();
    expect(addNoteButton).toHaveFocus();

    await user.click(addNoteButton);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(addNoteButton).toHaveFocus();
  });

  it("moves focus into the editor and restores it to the note actions after Cancel", async () => {
    const user = userEvent.setup();
    render(<NotesList notes={[note]} date="2026-09-26" />);

    await user.click(getNoteActionsSummary());
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("textbox", { name: "Edit First note" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(getNoteActionsSummary()).toHaveFocus();
  });
});
