// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/releases/actions", () => ({
  acknowledgeReleaseNote: mocks.acknowledge,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

import englishMessages from "@/messages/en.json";
import { ReleaseNoteAcknowledgeButton } from "./ReleaseNoteAcknowledgeButton";

function buttonTree(initialIsRead = false, releaseNoteId = "note-123") {
  return (
    <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
      <ReleaseNoteAcknowledgeButton releaseNoteId={releaseNoteId} initialIsRead={initialIsRead} />
    </NextIntlClientProvider>
  );
}

function renderButton(initialIsRead = false) {
  return render(buttonTree(initialIsRead));
}

describe("ReleaseNoteAcknowledgeButton", () => {
  beforeEach(() => {
    mocks.acknowledge.mockReset();
    mocks.refresh.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("acknowledges the current release and refreshes the unread marker", async () => {
    const user = userEvent.setup();
    mocks.acknowledge.mockResolvedValue({
      ok: true,
      data: { releaseNoteId: "note-123", readAt: "2026-10-04T00:00:00.000Z" },
    });
    renderButton();

    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(mocks.acknowledge).toHaveBeenCalledWith({ releaseNoteId: "note-123" });
    expect(await screen.findByTestId("release-note-acknowledged")).toHaveTextContent("Read");
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps the same note available for an idempotent retry after a failed response", async () => {
    const user = userEvent.setup();
    mocks.acknowledge.mockResolvedValueOnce({ ok: false, error: "generic" }).mockResolvedValueOnce({
      ok: true,
      data: { releaseNoteId: "note-123", readAt: "2026-10-04T00:00:00.000Z" },
    });
    renderButton();

    await user.click(screen.getByRole("button", { name: "Mark as read" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save this update as read. Try again.",
    );
    await user.click(screen.getByRole("button", { name: "Mark as read" }));

    expect(mocks.acknowledge.mock.calls).toEqual([
      [{ releaseNoteId: "note-123" }],
      [{ releaseNoteId: "note-123" }],
    ]);
    expect(await screen.findByTestId("release-note-acknowledged")).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("does not submit again when the note was already read", async () => {
    renderButton(true);

    expect(screen.getByTestId("release-note-acknowledged")).toHaveTextContent("Read");
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });

  it("reflects a server read-state update after the same page refreshes", () => {
    const view = renderButton(false);
    expect(screen.getByRole("button", { name: "Mark as read" })).toBeInTheDocument();

    view.rerender(buttonTree(true));

    expect(screen.getByTestId("release-note-acknowledged")).toHaveTextContent("Read");
    expect(screen.queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    expect(mocks.acknowledge).not.toHaveBeenCalled();
  });
});
