// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isMobile: false,
  search: "",
  submitFeedback: vi.fn(),
}));

vi.mock("@/core/feedback/actions", () => ({
  submitFeedback: mocks.submitFeedback,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => mocks.isMobile,
}));

import englishMessages from "@/messages/en.json";
import { FeedbackHost, useFeedbackHost } from "./FeedbackHost";

const pendingStorageKey = "kemtit:pending-feedback:v1:user-123";

function FeedbackLauncher() {
  const { openFeedback } = useFeedbackHost();
  return (
    <button type="button" onClick={(event) => openFeedback(event.currentTarget)}>
      Open feedback
    </button>
  );
}

function renderHost() {
  return render(
    <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
      <FeedbackHost userId="user-123">
        <FeedbackLauncher />
      </FeedbackHost>
    </NextIntlClientProvider>,
  );
}

async function openFeedback(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Open feedback" }));
  return screen.findByRole("dialog");
}

describe("FeedbackHost", () => {
  beforeEach(() => {
    mocks.search = "";
    mocks.isMobile = false;
    mocks.submitFeedback.mockReset();
    window.history.replaceState(null, "", "/today");
    window.sessionStorage.clear();
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requires one topic and shows thanks only after the server confirms success", async () => {
    const user = userEvent.setup();
    let finishRequest!: (result: {
      ok: true;
      data: { id: string; createdAt: string; duplicate: boolean };
    }) => void;
    mocks.submitFeedback.mockReturnValue(
      new Promise((resolve) => {
        finishRequest = resolve;
      }),
    );
    renderHost();

    await openFeedback(user);
    const submit = screen.getByTestId("feedback-submit");
    expect(submit).toBeDisabled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    for (const name of [
      "Easy to use",
      "Hard to use",
      "Slow performance",
      "Encountered an error",
      "Want more features",
    ]) {
      expect(screen.getByRole("radio", { name })).not.toBeChecked();
    }

    await user.click(screen.getByRole("radio", { name: "Easy to use" }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(screen.getByText("Sending…")).toBeInTheDocument();
    expect(screen.queryByTestId("feedback-success")).not.toBeInTheDocument();
    expect(mocks.submitFeedback).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      topicCode: "easy_to_use",
    });

    finishRequest({
      ok: true,
      data: { id: "feedback-1", createdAt: "2026-10-04T00:00:00.000Z", duplicate: false },
    });

    expect(await screen.findByTestId("feedback-success")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Thanks for your feedback" })).toBeInTheDocument();
    expect(screen.getAllByText(englishMessages.feedback.successDescription)).toHaveLength(1);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      englishMessages.feedback.successDescription,
    );
    expect(window.sessionStorage.getItem(pendingStorageKey)).toBeNull();
  });

  it("restores an uncertain submission after remount and retries the same request and topic", async () => {
    const user = userEvent.setup();
    mocks.submitFeedback
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "feedback-2", createdAt: "2026-10-04T00:00:00.000Z", duplicate: true },
      });
    const firstView = renderHost();

    await openFeedback(user);
    await user.click(screen.getByRole("radio", { name: "Slow performance" }));
    await user.click(screen.getByTestId("feedback-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't confirm whether this feedback was saved.",
    );
    const savedRecord = window.sessionStorage.getItem(pendingStorageKey);
    expect(savedRecord).not.toBeNull();
    firstView.unmount();

    renderHost();
    await openFeedback(user);

    const restoredChoice = screen.getByRole("radio", { name: "Slow performance" });
    expect(restoredChoice).toBeChecked();
    expect(restoredChoice).toBeDisabled();
    await user.click(screen.getByTestId("feedback-submit"));

    await waitFor(() => expect(mocks.submitFeedback).toHaveBeenCalledTimes(2));
    expect(mocks.submitFeedback.mock.calls[1][0]).toEqual(mocks.submitFeedback.mock.calls[0][0]);
    expect(await screen.findByTestId("feedback-success")).toBeInTheDocument();
  });

  it("keeps an uncertain request locked when a retry is rejected as unauthorized", async () => {
    const user = userEvent.setup();
    mocks.submitFeedback
      .mockResolvedValueOnce({ ok: false, error: "generic" })
      .mockResolvedValueOnce({ ok: false, error: "unauthorized" })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "feedback-recovered", createdAt: "2026-10-04T00:00:00.000Z", duplicate: true },
      });
    const firstView = renderHost();

    await openFeedback(user);
    await user.click(screen.getByRole("radio", { name: "Encountered an error" }));
    await user.click(screen.getByTestId("feedback-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't confirm whether this feedback was saved.",
    );
    const savedRecord = window.sessionStorage.getItem(pendingStorageKey);
    expect(savedRecord).not.toBeNull();

    await user.click(screen.getByTestId("feedback-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your session is no longer valid.");
    expect(window.sessionStorage.getItem(pendingStorageKey)).toBe(savedRecord);
    expect(screen.getByRole("radio", { name: "Encountered an error" })).toBeDisabled();
    firstView.unmount();

    renderHost();
    await openFeedback(user);
    expect(screen.getByRole("radio", { name: "Encountered an error" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Encountered an error" })).toBeDisabled();
    await user.click(screen.getByTestId("feedback-submit"));
    await screen.findByTestId("feedback-success");

    expect(mocks.submitFeedback).toHaveBeenCalledTimes(3);
    expect(mocks.submitFeedback.mock.calls[1][0]).toEqual(mocks.submitFeedback.mock.calls[0][0]);
    expect(mocks.submitFeedback.mock.calls[2][0]).toEqual(mocks.submitFeedback.mock.calls[0][0]);
  });

  it("clears a proven rate-limit rejection so the user can choose a new topic", async () => {
    const user = userEvent.setup();
    mocks.submitFeedback
      .mockResolvedValueOnce({ ok: false, error: "feedbackRateLimited" })
      .mockResolvedValueOnce({
        ok: true,
        data: { id: "feedback-3", createdAt: "2026-10-04T00:00:00.000Z", duplicate: false },
      });
    renderHost();
    await openFeedback(user);

    await user.click(screen.getByRole("radio", { name: "Easy to use" }));
    await user.click(screen.getByTestId("feedback-submit"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You've already sent feedback recently.",
    );
    expect(window.sessionStorage.getItem(pendingStorageKey)).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Want more features" }));
    await user.click(screen.getByTestId("feedback-submit"));
    await screen.findByTestId("feedback-success");

    const [firstRequest, secondRequest] = mocks.submitFeedback.mock.calls.map(([input]) => input);
    expect(firstRequest.topicCode).toBe("easy_to_use");
    expect(secondRequest.topicCode).toBe("more_features");
    expect(secondRequest.requestId).not.toBe(firstRequest.requestId);
  });

  it("fails closed when the saved retry record is malformed", async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(pendingStorageKey, "not-json");
    renderHost();

    await openFeedback(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A previous feedback attempt can't be checked in this tab.",
    );
    expect(screen.getByRole("radio", { name: "Easy to use" })).toBeDisabled();
    expect(screen.getByTestId("feedback-submit")).toBeDisabled();
    expect(window.sessionStorage.getItem(pendingStorageKey)).toBe("not-json");
    expect(mocks.submitFeedback).not.toHaveBeenCalled();
  });

  it("does not send when this tab cannot persist a retry key", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable", "SecurityError");
    });
    renderHost();

    await openFeedback(user);
    await user.click(screen.getByRole("radio", { name: "Hard to use" }));
    await user.click(screen.getByTestId("feedback-submit"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This browser couldn't save a retry record.",
    );
    expect(mocks.submitFeedback).not.toHaveBeenCalled();
  });

  it("blocks opening alongside Quick Capture and closes if its query appears later", async () => {
    const user = userEvent.setup();
    mocks.search = "?capture=1";
    window.history.replaceState(null, "", "/today?capture=1");
    const view = renderHost();

    await user.click(screen.getByRole("button", { name: "Open feedback" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    mocks.search = "";
    window.history.replaceState(null, "", "/today");
    view.rerender(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <FeedbackHost userId="user-123">
          <FeedbackLauncher />
        </FeedbackHost>
      </NextIntlClientProvider>,
    );
    await openFeedback(user);

    mocks.search = "?new=task";
    window.history.replaceState(null, "", "/today?new=task");
    view.rerender(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <FeedbackHost userId="user-123">
          <FeedbackLauncher />
        </FeedbackHost>
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the active feedback control focused when the dialog switches to a mobile sheet", async () => {
    const user = userEvent.setup();
    const view = renderHost();
    await openFeedback(user);

    const topic = screen.getByRole("radio", { name: "Want more features" });
    await user.click(topic);
    expect(topic).toHaveFocus();

    mocks.isMobile = true;
    view.rerender(
      <NextIntlClientProvider locale="en" timeZone="Asia/Bangkok" messages={englishMessages}>
        <FeedbackHost userId="user-123">
          <FeedbackLauncher />
        </FeedbackHost>
      </NextIntlClientProvider>,
    );

    const mobileTopic = await screen.findByRole("radio", { name: "Want more features" });
    expect(mobileTopic).toHaveFocus();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
