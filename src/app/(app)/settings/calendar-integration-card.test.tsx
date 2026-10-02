import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  disconnect: vi.fn(),
  refresh: vi.fn(),
  sync: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  locale: "en" as "en" | "th",
}));

vi.mock("@/core/calendar-integrations/actions", () => ({
  disconnectExternalCalendarConnection: mocks.disconnect,
  syncExternalCalendarConnection: mocks.sync,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => {
    const messages: Record<"en" | "th", Record<string, string>> = {
      en: {
        "providers.google": "Google Calendar",
        "providers.outlook": "Outlook Calendar",
        connectGoogle: "Connect and sync Google Calendar",
        connectOutlook: "Connect and sync Outlook Calendar",
        syncNow: "Sync now",
        providerUnavailable: "providerUnavailable {provider}",
      },
      th: {
        "providers.google": "Google Calendar",
        "providers.outlook": "Outlook Calendar",
        connectGoogle: "เชื่อมและซิงก์ Google Calendar",
        connectOutlook: "เชื่อมและซิงก์ Outlook Calendar",
        syncNow: "ซิงก์ตอนนี้",
        providerUnavailable: "providerUnavailable {provider}",
      },
    };

    return (key: string, values?: Record<string, string | number>) =>
      (messages[mocks.locale][key] ?? (values ? `${key} ${Object.values(values).join(" ")}` : key)).replace(
        "{provider}",
        String(values?.provider ?? ""),
      );
  },
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }));

import type { ExternalCalendarConnection } from "@/core/calendar-integrations/schema";
import { CalendarIntegrationCard } from "./calendar-integration-card";

const connections: ExternalCalendarConnection[] = [
  {
    id: "google-write",
    provider: "google",
    accountLabel: "owner@example.test",
    status: "active",
    syncStatus: "ok",
    canWrite: true,
    lastSyncedAt: null,
    lastError: null,
  },
  {
    id: "google-readonly",
    provider: "google",
    accountLabel: "reader@example.test",
    status: "active",
    syncStatus: "idle",
    canWrite: false,
    lastSyncedAt: null,
    lastError: null,
  },
  {
    id: "outlook-write",
    provider: "outlook",
    accountLabel: "outlook@example.test",
    status: "active",
    syncStatus: "ok",
    canWrite: true,
    lastSyncedAt: null,
    lastError: null,
  },
];

describe("CalendarIntegrationCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.locale = "en";
    mocks.disconnect.mockResolvedValue({ ok: true, data: null });
    mocks.sync.mockResolvedValue({ ok: true, data: { imported: 0 } });
  });

  it("renders every account and offers reconnect for an account without write permission", () => {
    render(
      <CalendarIntegrationCard
        configured={{ google: true, outlook: true }}
        connections={connections}
        notice={null}
      />,
    );

    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
    expect(screen.getByText("reader@example.test")).toBeInTheDocument();
    expect(screen.getByText("outlook@example.test")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outlook Calendar" })).toBeInTheDocument();
    expect(screen.getAllByText("writeEnabled")).toHaveLength(2);
    expect(screen.getByText("readOnlyHint")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "reconnectForEditing" })).toHaveAttribute(
      "href",
      "/api/calendar/google/connect",
    );
    expect(screen.getByRole("link", { name: "Connect and sync Outlook Calendar" })).toHaveAttribute(
      "href",
      "/api/calendar/outlook/connect",
    );
    expect(screen.getByRole("link", { name: "Connect and sync Google Calendar" })).toHaveAttribute(
      "href",
      "/api/calendar/google/connect",
    );
  });

  it("keeps existing connections manageable while a provider is unavailable", async () => {
    render(
      <CalendarIntegrationCard
        configured={{ google: false, outlook: true }}
        connections={connections.slice(0, 1)}
        notice={"not-configured"}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("notices.not-configured");
    const googleSection = screen.getByRole("region", { name: "Google Calendar" });
    const unavailableReason = within(googleSection).getByText("providerUnavailable Google Calendar");
    expect(unavailableReason).toHaveClass("sr-only");
    const connectButton = within(googleSection).getByRole("button", {
      name: "Connect and sync Google Calendar",
    });
    expect(connectButton).toBeDisabled();
    expect(connectButton).toHaveAttribute("aria-describedby", unavailableReason.id);
    expect(within(googleSection).getByRole("button", { name: "Sync now" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Connect and sync Google Calendar" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "disconnect" }));

    await waitFor(() => {
      expect(mocks.disconnect).toHaveBeenCalledWith({ connectionId: "google-write" });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("disconnected");
  });

  it("keeps provider actions disabled and their unavailable reasons screen-reader-only", () => {
    mocks.locale = "th";

    render(
      <CalendarIntegrationCard
        configured={{ google: false, outlook: false }}
        connections={[]}
        notice={null}
      />,
    );

    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outlook Calendar" })).toBeInTheDocument();
    for (const provider of ["Google Calendar", "Outlook Calendar"] as const) {
      const providerSection = screen.getByRole("region", { name: provider });
      const connectButton = within(providerSection).getByRole("button", {
        name: `เชื่อมและซิงก์ ${provider}`,
      });
      const unavailableReason = within(providerSection).getByText(
        `providerUnavailable ${provider}`,
      );

      expect(connectButton).toBeDisabled();
      expect(connectButton).toHaveAttribute("aria-describedby", unavailableReason.id);
      expect(unavailableReason).toHaveClass("sr-only");
    }
    expect(
      screen.queryByRole("link", { name: "เชื่อมและซิงก์ Google Calendar" }),
    ).not.toBeInTheDocument();
  });

  it("dispatches manual sync for an active connected account", async () => {
    render(
      <CalendarIntegrationCard
        configured={{ google: true, outlook: false }}
        connections={[connections[0]]}
        notice={null}
      />,
    );

    const googleSection = screen.getByRole("region", { name: "Google Calendar" });
    fireEvent.click(within(googleSection).getByRole("button", { name: "Sync now" }));

    await waitFor(() => {
      expect(mocks.sync).toHaveBeenCalledWith({ connectionId: "google-write" });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("syncSuccess 0");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("reports a failed manual sync and refreshes the connection status", async () => {
    mocks.sync.mockResolvedValueOnce({ ok: false, error: "calendarSyncFailed" });
    render(
      <CalendarIntegrationCard
        configured={{ google: true, outlook: false }}
        connections={[connections[0]]}
        notice={null}
      />,
    );

    const googleSection = screen.getByRole("region", { name: "Google Calendar" });
    fireEvent.click(within(googleSection).getByRole("button", { name: "Sync now" }));

    await waitFor(() => {
      expect(mocks.sync).toHaveBeenCalledWith({ connectionId: "google-write" });
    });
    expect(mocks.toastError).toHaveBeenCalledWith("syncFailed");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("disables connection controls while a manual sync is pending", async () => {
    let completeSync!: (result: { ok: true; data: { imported: number } }) => void;
    mocks.sync.mockImplementationOnce(
      () =>
        new Promise<{ ok: true; data: { imported: number } }>((resolve) => {
          completeSync = resolve;
        }),
    );

    render(
      <CalendarIntegrationCard
        configured={{ google: true, outlook: false }}
        connections={[connections[0]]}
        notice={null}
      />,
    );

    const googleSection = screen.getByRole("region", { name: "Google Calendar" });
    const syncButton = within(googleSection).getByRole("button", { name: "Sync now" });
    const disconnectButton = within(googleSection).getByRole("button", { name: "disconnect" });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(mocks.sync).toHaveBeenCalledWith({ connectionId: "google-write" });
      expect(syncButton).toBeDisabled();
      expect(disconnectButton).toBeDisabled();
    });

    completeSync({ ok: true, data: { imported: 0 } });
    await waitFor(() => expect(syncButton).not.toBeDisabled());
  });

  it("keeps revoked connections from syncing and offers reconnect", () => {
    const revokedConnection: ExternalCalendarConnection = {
      ...connections[0],
      id: "google-revoked",
      status: "revoked",
    };

    render(
      <CalendarIntegrationCard
        configured={{ google: true, outlook: false }}
        connections={[revokedConnection]}
        notice={null}
      />,
    );

    const googleSection = screen.getByRole("region", { name: "Google Calendar" });
    expect(within(googleSection).getByRole("button", { name: "Sync now" })).toBeDisabled();
    expect(within(googleSection).getByRole("link", { name: "reconnect" })).toHaveAttribute(
      "href",
      "/api/calendar/google/connect",
    );
    expect(within(googleSection).getByText("connectionUnavailable")).toBeInTheDocument();
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
