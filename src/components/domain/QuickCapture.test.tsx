// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  confirmQuickCapture: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/capture/actions", () => ({
  confirmQuickCapture: mocks.confirmQuickCapture,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("next-intl", () => {
  const translate = Object.assign(
    (key: string, values?: { type?: string }) => (values?.type ? `${key}: ${values.type}` : key),
    { has: () => true },
  );
  return { useLocale: () => "en", useTranslations: () => translate };
});

vi.mock("@/components/domain/DatePicker", () => ({
  DatePicker: ({
    id,
    value,
    onChange,
    disabled,
  }: {
    id?: string;
    value?: string;
    onChange: (value?: string) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      aria-label={id}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/domain/DomainSelect", () => ({
  DomainSelect: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <select
      aria-label="domain"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="work">Work</option>
      <option value="finance">Finance</option>
      <option value="health">Health</option>
    </select>
  ),
}));

import { QuickCapture } from "./QuickCapture";
import type { confirmQuickCapture } from "@/core/capture/actions";

type CaptureResult = Awaited<ReturnType<typeof confirmQuickCapture>>;

const smartDefaults = {
  preferredDomain: "work" as const,
  taskEstimatedMinutes: null,
  habitCadence: "daily" as const,
  habitTargetPerWeek: 7,
};

function renderQuickCapture() {
  const onDone = vi.fn();
  render(
    <QuickCapture
      today="2026-09-26"
      preferredDomain="work"
      smartDefaults={smartDefaults}
      onDone={onDone}
    />,
  );
  return { onDone };
}

function enterInput(text: string) {
  fireEvent.change(screen.getByLabelText("capture.prompt"), { target: { value: text } });
}

function openDetails() {
  fireEvent.click(screen.getByText("capture.editDetails"));
}

function clickSave() {
  fireEvent.click(screen.getByRole("button", { name: "capture.save" }));
}

beforeEach(() => {
  mocks.confirmQuickCapture.mockReset();
  mocks.refresh.mockReset();
  vi.stubGlobal("crypto", { randomUUID: () => "capture-request" });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QuickCapture", () => {
  it("keeps typing local and saves one canonical task from the live preview", async () => {
    mocks.confirmQuickCapture.mockResolvedValue({
      ok: true,
      data: { kind: "task", id: "task-1" },
    });
    const { onDone } = renderQuickCapture();

    expect(mocks.confirmQuickCapture).not.toHaveBeenCalled();
    enterInput("Send the report");
    expect(screen.getByRole("region", { name: "capture.livePreview" })).toBeInTheDocument();
    expect(screen.getByText("Send the report")).toBeInTheDocument();
    expect(mocks.confirmQuickCapture).not.toHaveBeenCalled();

    clickSave();
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());

    expect(mocks.confirmQuickCapture).toHaveBeenCalledOnce();
    expect(mocks.confirmQuickCapture).toHaveBeenCalledWith({
      requestId: "capture-request",
      kind: "task",
      title: "Send the report",
      domain: "work",
      dueDate: "2026-09-26",
      estimatedMinutes: null,
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("allows overriding any detected type before saving", async () => {
    mocks.confirmQuickCapture.mockResolvedValue({
      ok: true,
      data: { kind: "note", id: "note-1" },
    });
    const { onDone } = renderQuickCapture();
    enterInput("Send the report");
    openDetails();

    const typeSelect = screen.getByLabelText("capture.typeField");
    expect(typeSelect.querySelectorAll("option")).toHaveLength(7);
    fireEvent.change(typeSelect, { target: { value: "note" } });
    expect(
      within(screen.getByRole("region", { name: "capture.livePreview" })).getByText(
        "capture.types.note",
      ),
    ).toBeInTheDocument();

    clickSave();
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(mocks.confirmQuickCapture).toHaveBeenCalledWith({
      requestId: "capture-request",
      kind: "note",
      title: "Send the report",
    });
  });

  it("persists edited title, domain, and date while the source text stays unchanged", async () => {
    mocks.confirmQuickCapture.mockResolvedValue({
      ok: true,
      data: { kind: "task", id: "task-1" },
    });
    const { onDone } = renderQuickCapture();
    enterInput("Send the report");
    openDetails();
    fireEvent.change(screen.getByLabelText("capture.titleField"), {
      target: { value: "Send the final report" },
    });
    fireEvent.change(screen.getByLabelText("domain"), { target: { value: "finance" } });
    fireEvent.change(screen.getByLabelText("quick-capture-date"), {
      target: { value: "2026-09-27" },
    });

    expect(screen.getByText("Send the final report")).toBeInTheDocument();
    clickSave();
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());

    expect(mocks.confirmQuickCapture).toHaveBeenCalledWith({
      requestId: "capture-request",
      kind: "task",
      title: "Send the final report",
      domain: "finance",
      dueDate: "2026-09-27",
      estimatedMinutes: null,
    });
  });

  it("resets manual edits when the user changes the source text", () => {
    renderQuickCapture();
    enterInput("Send the report");
    openDetails();
    fireEvent.change(screen.getByLabelText("capture.titleField"), {
      target: { value: "Edited title" },
    });
    expect(screen.getByText("Edited title")).toBeInTheDocument();

    enterInput("Prepare the notes");

    expect(screen.getByText("Prepare the notes")).toBeInTheDocument();
    expect(screen.queryByText("Edited title")).not.toBeInTheDocument();
    expect(mocks.confirmQuickCapture).not.toHaveBeenCalled();
  });

  it("shows a missing expense amount and blocks saving until an amount is entered", async () => {
    mocks.confirmQuickCapture.mockResolvedValue({
      ok: true,
      data: { kind: "expense", id: "expense-1" },
    });
    const { onDone } = renderQuickCapture();
    enterInput("ค่าอาหาร");

    expect(screen.getByText("capture.expenseAmountRequired")).toBeInTheDocument();
    expect(screen.getByLabelText("capture.expenseAmount")).toHaveAttribute(
      "placeholder",
      "capture.expenseAmountPlaceholder",
    );
    const saveButton = screen.getByRole("button", { name: "capture.save" });
    expect(saveButton).toBeDisabled();
    expect(mocks.confirmQuickCapture).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("capture.expenseAmount"), {
      target: { value: "250" },
    });
    expect(saveButton).toBeEnabled();
    clickSave();

    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(mocks.confirmQuickCapture).toHaveBeenCalledWith({
      requestId: "capture-request",
      kind: "expense",
      title: "ค่าอาหาร",
      amount: 250,
      occurredOn: "2026-09-26",
    });
  });

  it("shows title length errors in the preview while the edit disclosure is closed", () => {
    renderQuickCapture();
    enterInput("x".repeat(201));

    expect(screen.getByRole("alert")).toHaveTextContent("tooLong");
    expect(screen.getByRole("button", { name: "capture.save" })).toBeDisabled();
  });

  it("guards rapid duplicate submits while the save is pending", async () => {
    const deferred: { resolve?: (value: CaptureResult) => void } = {};
    mocks.confirmQuickCapture.mockReturnValue(
      new Promise<CaptureResult>((resolve) => {
        deferred.resolve = resolve;
      }),
    );
    const { onDone } = renderQuickCapture();
    enterInput("Send the report");
    openDetails();
    const form = screen.getByRole("button", { name: "capture.save" }).closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(mocks.confirmQuickCapture).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.getByLabelText("capture.prompt")).toBeDisabled());
    expect(screen.getByLabelText("capture.typeField")).toBeDisabled();
    expect(screen.getByLabelText("capture.titleField")).toBeDisabled();
    expect(screen.getByLabelText("domain")).toBeDisabled();
    expect(screen.getByLabelText("quick-capture-date")).toBeDisabled();

    deferred.resolve?.({ ok: true, data: { kind: "task", id: "task-1" } });
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
  });

  it("retries a failed save with the same request ID when the intent is unchanged", async () => {
    mocks.confirmQuickCapture
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({ ok: true, data: { kind: "task", id: "task-1" } });
    const { onDone } = renderQuickCapture();
    enterInput("Send the report");

    clickSave();
    expect(await screen.findByRole("alert")).toHaveTextContent("generic");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();

    clickSave();
    await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
    expect(mocks.confirmQuickCapture).toHaveBeenCalledTimes(2);
    expect(mocks.confirmQuickCapture.mock.calls[0][0].requestId).toBe("capture-request");
    expect(mocks.confirmQuickCapture.mock.calls[1][0].requestId).toBe("capture-request");
  });

  it("catches thrown action failures and leaves the capture open for retry", async () => {
    mocks.confirmQuickCapture.mockRejectedValue(new Error("network failure"));
    const { onDone } = renderQuickCapture();
    enterInput("Send the report");

    clickSave();

    expect(await screen.findByRole("alert")).toHaveTextContent("generic");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(screen.getByLabelText("capture.prompt")).toBeInTheDocument();
  });
});
