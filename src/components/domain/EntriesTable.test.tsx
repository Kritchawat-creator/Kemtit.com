import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteEntry: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/core/entries/actions", () => ({ deleteEntry: mocks.deleteEntry }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string | number>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));
vi.mock("@/components/domain/EntryForm", () => ({
  EntryForm: () => null,
}));
vi.mock("@/components/domain/ConfirmSheet", () => ({
  ConfirmSheet: ({
    open,
    title,
    description,
    children,
  }: {
    open: boolean;
    title: string;
    description?: string;
    children: React.ReactNode;
  }) =>
    open ? (
      <section role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
        {children}
      </section>
    ) : null,
}));
vi.mock("@/components/ui/responsive-dialog", () => ({
  ResponsiveDialog: () => null,
}));

import { EntriesTable } from "./EntriesTable";
import type { GoalEntryWithGoal } from "@/core/entries/schema";

const row = {
  id: "entry-1",
  goal_id: "goal-1",
  entry_no: 42,
  entry_date: "2026-09-26",
  amount: 400,
  note: "Saturday sale",
  channel: "shopee",
  goal: { id: "goal-1", title: "Monthly sales", persona_data: { unit: "THB" } },
} as unknown as GoalEntryWithGoal;

function renderTable() {
  render(<EntriesTable rows={[row]} today="2026-09-27" goalOptions={[]} />);
}

function openDeleteConfirmation() {
  fireEvent.click(screen.getByRole("button", { name: "common.delete" }));
  return screen.getByRole("dialog", { name: "entries.deleteConfirm.title" });
}

describe("EntriesTable permanent deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not call delete when the confirmation is cancelled", () => {
    renderTable();
    openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "common.cancel" }));

    expect(mocks.deleteEntry).not.toHaveBeenCalled();
    expect(screen.getByText("Saturday sale")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the entry and confirmation open when the server rejects deletion", async () => {
    mocks.deleteEntry.mockResolvedValueOnce({ ok: false, error: "generic" });
    renderTable();
    openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "entries.deleteConfirm.confirm" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("errors.generic"));
    expect(mocks.deleteEntry).toHaveBeenCalledWith({ id: "entry-1" });
    expect(screen.getByText("Saturday sale")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the entry and confirmation open if the action throws", async () => {
    mocks.deleteEntry.mockRejectedValueOnce(new Error("private server detail"));
    renderTable();
    openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "entries.deleteConfirm.confirm" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("errors.generic"));
    expect(screen.getByText("Saturday sale")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("waits for server success before hiding the row and never offers a fake undo", async () => {
    let resolveDelete: ((value: { ok: true; data: null }) => void) | undefined;
    mocks.deleteEntry.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve;
      }),
    );
    renderTable();
    openDeleteConfirmation();

    fireEvent.click(screen.getByRole("button", { name: "entries.deleteConfirm.confirm" }));

    expect(screen.getByRole("button", { name: "entries.deleteConfirm.pending" })).toBeDisabled();
    expect(screen.getByText("Saturday sale")).toBeInTheDocument();
    resolveDelete?.({ ok: true, data: null });

    await waitFor(() => expect(screen.queryByText("Saturday sale")).not.toBeInTheDocument());
    expect(mocks.toastSuccess).toHaveBeenCalledWith("entries.toasts.deleted #K0042");
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "common.undo" })).not.toBeInTheDocument();
  });
});
