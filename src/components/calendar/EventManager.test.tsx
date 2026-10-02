// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  createExternalCalendarEvent: vi.fn(),
  updateExternalCalendarEvent: vi.fn(),
  deleteExternalCalendarEvent: vi.fn(),
  loadExternalCalendarEvent: vi.fn(),
  reconcileExternalCalendarOperation: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/core/calendar-events/actions", () => ({
  createCalendarEvent: mocks.createCalendarEvent,
  updateCalendarEvent: mocks.updateCalendarEvent,
  deleteCalendarEvent: mocks.deleteCalendarEvent,
}));

vi.mock("@/core/calendar-integrations/actions", () => ({
  createExternalCalendarEvent: mocks.createExternalCalendarEvent,
  updateExternalCalendarEvent: mocks.updateExternalCalendarEvent,
  deleteExternalCalendarEvent: mocks.deleteExternalCalendarEvent,
  loadExternalCalendarEvent: mocks.loadExternalCalendarEvent,
  reconcileExternalCalendarOperation: mocks.reconcileExternalCalendarOperation,
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

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => {
    const translate = (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key;
    Object.assign(translate, { has: () => true });
    return translate;
  },
}));

import type { Database } from "@/types/database";
import { addDaysISO } from "@/lib/date";

import { EventManager, type EventManagerConnection, type ExternalEventDetail } from "./EventManager";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];

const DATE = "2026-09-27";
const USER_EVENT_ID = "6a73e579-ce70-4f21-9b0f-d7cbe8ec1c05";
const SOURCE_EVENT_ID = "a8d60452-84f1-43cc-8517-30ed7a5a1657";
const CONNECTION_ID = "b7d86f7a-2eb5-40a3-a536-1fc4fa18b8f5";
const REVISION = "98915157-f7ee-40bc-ad39-56c13a5b8b2f";
const OPERATION_ID = "50cb4479-1872-4e41-a993-6eadf3cbad54";

const localEvent: CalendarEventRow = {
  id: USER_EVENT_ID,
  user_id: "user-1",
  title: "Local appointment",
  event_date: DATE,
  all_day: true,
  blocks_time: true,
  start_time: null,
  end_time: null,
  notes: null,
  data_origin: "USER",
  external_source_id: null,
  created_at: `${DATE}T00:00:00.000Z`,
  updated_at: `${DATE}T00:00:00.000Z`,
};

const writableConnection: EventManagerConnection = {
  id: CONNECTION_ID,
  provider: "google",
  accountLabel: "Work",
  status: "active",
  canWrite: true,
};

function providerEvent(title: string): ExternalEventDetail {
  return {
    sourceEventId: SOURCE_EVENT_ID,
    connectionId: CONNECTION_ID,
    provider: "google",
    providerLabel: "Work",
    editable: true,
    kind: "single",
    revision: REVISION,
    value: {
      title,
      start: `${DATE}T09:00:10+07:00`,
      end: `${DATE}T09:00:40+07:00`,
      allDay: false,
      blocksTime: true,
    },
  };
}

function renderManager(options: {
  events?: CalendarEventRow[];
  connections?: EventManagerConnection[];
  externalDetails?: ExternalEventDetail[];
  operations?: ComponentProps<typeof EventManager>["operations"];
} = {}) {
  return render(
    <EventManager
      date={DATE}
      events={options.events ?? []}
      connections={options.connections ?? []}
      externalDetails={options.externalDetails ?? []}
      operations={options.operations ?? []}
    />,
  );
}

describe("EventManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps imported recurring series read-only", () => {
    const event = { ...localEvent, external_source_id: SOURCE_EVENT_ID, data_origin: "GOOGLE" };
    const detail = { ...providerEvent("Recurring series"), kind: "series" as const, editable: false };

    renderManager({ events: [event], externalDetails: [detail] });

    expect(screen.getByText("seriesReadOnly")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "editEvent: Recurring series" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "delete: Recurring series" })).not.toBeInTheDocument();
  });

  it("shows the end date for provider appointments that cross midnight", () => {
    const event = { ...localEvent, external_source_id: SOURCE_EVENT_ID, data_origin: "GOOGLE" };
    const detail = {
      ...providerEvent("Overnight appointment"),
      value: {
        title: "Overnight appointment",
        start: "2026-09-27T16:30:00.000Z",
        end: "2026-09-27T18:00:00.000Z",
        allDay: false,
        blocksTime: true,
      },
    };
    renderManager({ events: [event], externalDetails: [detail] });

    const row = screen.getByText("Overnight appointment").closest("li");
    expect(row).not.toBeNull();
    expect(within(row!).getByText(/27.*28/)).toBeInTheDocument();
  });

  it("keeps a local edit draft visible when the save fails", async () => {
    mocks.updateCalendarEvent.mockResolvedValue({ ok: false, error: "generic" });
    renderManager({ events: [localEvent] });

    fireEvent.click(screen.getByRole("button", { name: `editEvent: ${localEvent.title}` }));
    const title = screen.getByLabelText("eventTitle");
    fireEvent.change(title, { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(mocks.updateCalendarEvent).toHaveBeenCalled());
    expect(screen.getByLabelText("eventTitle")).toHaveValue("Keep this draft");
    expect(screen.getByRole("alert")).toHaveTextContent("generic");
  });

  it("requires explicit confirmation before deleting a local event and does nothing on cancel", async () => {
    mocks.deleteCalendarEvent.mockResolvedValue({ ok: true, data: null });
    renderManager({ events: [localEvent] });

    fireEvent.click(screen.getByRole("button", { name: `delete: ${localEvent.title}` }));
    expect(mocks.deleteCalendarEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "deleteConfirmTitle" })).toHaveTextContent(
      `deleteConfirmDescription ${localEvent.title} sourceLocal`,
    );

    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(mocks.deleteCalendarEvent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `delete: ${localEvent.title}` }));
    fireEvent.click(screen.getByRole("button", { name: "deleteConfirm" }));

    await waitFor(() => expect(mocks.deleteCalendarEvent).toHaveBeenCalledWith({ id: USER_EVENT_ID }));
  });

  it("requires confirmation in the editor before deleting a provider event", async () => {
    mocks.deleteExternalCalendarEvent.mockResolvedValue({
      ok: true,
      data: { operationId: OPERATION_ID, status: "succeeded", sourceEventId: SOURCE_EVENT_ID },
    });
    const event = { ...localEvent, external_source_id: SOURCE_EVENT_ID, data_origin: "GOOGLE" };
    renderManager({
      events: [event],
      connections: [writableConnection],
      externalDetails: [providerEvent("Provider appointment")],
    });

    fireEvent.click(screen.getByRole("button", { name: "editEvent: Provider appointment" }));
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    expect(mocks.deleteExternalCalendarEvent).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "deleteConfirmTitle" })).toHaveTextContent(
      "deleteConfirmDescription Provider appointment providerGoogle · Work",
    );

    fireEvent.click(screen.getByRole("button", { name: "deleteConfirm" }));
    await waitFor(() => expect(mocks.deleteExternalCalendarEvent).toHaveBeenCalledOnce());
    expect(mocks.deleteExternalCalendarEvent).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      sourceEventId: SOURCE_EVENT_ID,
      expectedRevision: REVISION,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
  });

  it("submits only the dirty provider field and preserves a long full title", async () => {
    const title = `Provider title ${"with a long source label ".repeat(12)}`;
    mocks.updateExternalCalendarEvent.mockResolvedValue({
      ok: true,
      data: { operationId: OPERATION_ID, status: "succeeded", sourceEventId: SOURCE_EVENT_ID },
    });
    const event = { ...localEvent, external_source_id: SOURCE_EVENT_ID, data_origin: "GOOGLE" };
    renderManager({
      events: [event],
      connections: [writableConnection],
      externalDetails: [providerEvent(title)],
    });

    fireEvent.click(screen.getByRole("button", { name: `editEvent: ${title.trim()}` }));
    fireEvent.change(screen.getByLabelText("endTime"), {
      target: { value: `${DATE}T10:00` },
    });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(mocks.updateExternalCalendarEvent).toHaveBeenCalled());
    const input = mocks.updateExternalCalendarEvent.mock.calls[0]?.[0];
    expect(input).toMatchObject({
      connectionId: CONNECTION_ID,
      sourceEventId: SOURCE_EVENT_ID,
      expectedRevision: REVISION,
      patch: { end: "2026-09-27T03:00:00.000Z" },
    });
    expect(input.patch).not.toHaveProperty("title");
    expect(input.operationId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("requires a destination and creates an all-day provider event with an exclusive end", async () => {
    mocks.createExternalCalendarEvent.mockResolvedValue({
      ok: true,
      data: { operationId: OPERATION_ID, status: "queued" },
    });
    renderManager({ connections: [writableConnection] });

    fireEvent.click(screen.getByRole("button", { name: "newEvent" }));
    fireEvent.change(screen.getByLabelText("eventTitle"), { target: { value: "Provider event" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("required");
    expect(mocks.createCalendarEvent).not.toHaveBeenCalled();
    expect(mocks.createExternalCalendarEvent).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("destination"), { target: { value: CONNECTION_ID } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(mocks.createExternalCalendarEvent).toHaveBeenCalled());
    expect(mocks.createExternalCalendarEvent).toHaveBeenCalledWith({
      connectionId: CONNECTION_ID,
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      value: {
        title: "Provider event",
        start: DATE,
        end: addDaysISO(DATE, 1),
        allDay: true,
        blocksTime: true,
      },
    });
    expect(await screen.findByText("queued")).toBeInTheDocument();
  });

  it("keeps the operation ID when a provider action rejects before reconciliation", async () => {
    mocks.createExternalCalendarEvent.mockRejectedValueOnce(new Error("transport unavailable"));
    mocks.reconcileExternalCalendarOperation.mockImplementation(
      async (input: { operationId: string }) => ({
        ok: true,
        data: { operationId: input.operationId, status: "pending" },
      }),
    );
    renderManager({ connections: [writableConnection] });

    fireEvent.click(screen.getByRole("button", { name: "newEvent" }));
    fireEvent.change(screen.getByLabelText("eventTitle"), {
      target: { value: "Do not duplicate this event" },
    });
    fireEvent.change(screen.getByLabelText("destination"), { target: { value: CONNECTION_ID } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));

    await waitFor(() => expect(mocks.createExternalCalendarEvent).toHaveBeenCalledOnce());
    expect(await screen.findByText("outcomeUnknown")).toBeInTheDocument();
    const submittedOperationId = mocks.createExternalCalendarEvent.mock.calls[0]?.[0].operationId;

    fireEvent.click(screen.getByRole("button", { name: "reconcile" }));
    await waitFor(() =>
      expect(mocks.reconcileExternalCalendarOperation).toHaveBeenCalledWith({
        connectionId: CONNECTION_ID,
        operationId: submittedOperationId,
      }),
    );
    expect(submittedOperationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(await screen.findByText("pending")).toBeInTheDocument();
  });

  it("shows queued writes separately from uncertain outcomes and reconciles explicitly", async () => {
    mocks.reconcileExternalCalendarOperation.mockResolvedValue({
      ok: true,
      data: { operationId: OPERATION_ID, status: "pending" },
    });
    renderManager({
      connections: [writableConnection],
      operations: [
        {
          operationId: OPERATION_ID,
          connectionId: CONNECTION_ID,
          sourceEventId: null,
          kind: "create",
          status: "queued",
          errorCode: null,
          updatedAt: `${DATE}T00:00:00.000Z`,
        },
      ],
    });

    expect(screen.getByText("queued")).toBeInTheDocument();
    expect(screen.queryByText("outcomeUnknown")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "reconcile" }));

    await waitFor(() =>
      expect(mocks.reconcileExternalCalendarOperation).toHaveBeenCalledWith({
        connectionId: CONNECTION_ID,
        operationId: OPERATION_ID,
      }),
    );
    expect(await screen.findByText("pending")).toBeInTheDocument();
  });
});
