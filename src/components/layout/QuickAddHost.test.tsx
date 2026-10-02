// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  href: "/insights",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => new URL(mocks.href, "http://localhost").pathname,
  useSearchParams: () => new URLSearchParams(new URL(mocks.href, "http://localhost").search),
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/domain/QuickCapture", () => ({
  QuickCapture: () => <input aria-label="Quick Capture text" />,
}));

import { QuickAddHost } from "./QuickAddHost";
import { QuickAddMenu } from "./QuickAddMenu";

function quickAddPage() {
  return (
    <>
      <button type="button" aria-label="Notifications">
        Notifications
      </button>
      <button type="button" aria-label="Today destination">
        Today
      </button>
      <QuickAddMenu variant="command" />
      <QuickAddHost
        parentCandidates={[]}
        preferredCaptureDomain="work"
        captureSmartDefaults={{
          preferredDomain: "work",
          taskEstimatedMinutes: null,
          habitCadence: "daily",
          habitTargetPerWeek: 7,
        }}
        entryGoals={[]}
        projectOptions={[]}
      />
    </>
  );
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

beforeEach(() => {
  mocks.href = "/insights";
  mocks.push.mockReset();
  mocks.replace.mockReset();
  window.history.replaceState(null, "", "/insights");
});

describe("QuickAddHost focus behavior", () => {
  it("returns focus to the control that was active before Meta+K opened Quick Capture", async () => {
    const user = userEvent.setup();
    const view = render(quickAddPage());

    const notifications = screen.getByRole("button", { name: "Notifications" });
    notifications.focus();
    expect(notifications).toHaveFocus();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/insights?capture=1", { scroll: false }));
    mocks.href = mocks.push.mock.calls[0][0];
    window.history.replaceState(null, "", mocks.href);
    view.rerender(quickAddPage());

    const captureTextbox = await screen.findByRole("textbox", { name: "Quick Capture text" });
    await waitFor(() => expect(captureTextbox).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/insights", { scroll: false }));
    mocks.href = mocks.replace.mock.calls[0][0];
    window.history.replaceState(null, "", mocks.href);
    view.rerender(quickAddPage());

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(notifications).toHaveFocus());
  });

  it("does not return focus to the old opener when navigation closes Quick Capture", async () => {
    const view = render(quickAddPage());
    const notifications = screen.getByRole("button", { name: "Notifications" });
    notifications.focus();
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/insights?capture=1", { scroll: false }));
    mocks.href = mocks.push.mock.calls[0][0];
    window.history.replaceState(null, "", mocks.href);
    view.rerender(quickAddPage());
    await screen.findByRole("textbox", { name: "Quick Capture text" });

    mocks.href = "/today";
    window.history.replaceState(null, "", mocks.href);
    view.rerender(quickAddPage());

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(notifications).not.toHaveFocus();
  });
});
