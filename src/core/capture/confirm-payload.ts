import type { CaptureProposal } from "@/core/capture/parse";
import type { Domain } from "@/core/domain/domains";
import type { ISODate } from "@/lib/date";

export type ConfirmCapturePayload =
  | {
      requestId: string;
      kind: "task";
      title: string;
      domain: Domain;
      dueDate: ISODate;
      estimatedMinutes: number | null;
    }
  | {
      requestId: string;
      kind: "habit";
      title: string;
      domain: Domain;
      cadence: "daily" | "weekly";
      targetPerWeek: number;
    }
  | {
      requestId: string;
      kind: "goal";
      title: string;
      domain: Domain;
      periodStart: ISODate;
    }
  | {
      requestId: string;
      kind: "event";
      title: string;
      eventDate: ISODate;
    }
  | {
      requestId: string;
      kind: "bill";
      title: string;
      amount: number | null;
      dueDate: ISODate;
      recurrence: "none" | "monthly";
    }
  | {
      requestId: string;
      kind: "expense";
      title: string;
      amount: number;
      occurredOn: ISODate;
    }
  | {
      requestId: string;
      kind: "note";
      title: string;
    };

export function buildConfirmCapturePayload(
  proposal: CaptureProposal,
  requestId: string,
  today: ISODate,
): ConfirmCapturePayload | null {
  switch (proposal.kind) {
    case "task":
      return {
        requestId,
        kind: "task",
        title: proposal.title,
        domain: proposal.domain,
        dueDate: proposal.dueDate ?? today,
        estimatedMinutes: proposal.estimatedMinutes,
      };
    case "habit":
      return {
        requestId,
        kind: "habit",
        title: proposal.title,
        domain: proposal.domain,
        cadence: proposal.cadence ?? "daily",
        targetPerWeek: proposal.targetPerWeek ?? 7,
      };
    case "goal":
      return {
        requestId,
        kind: "goal",
        title: proposal.title,
        domain: proposal.domain,
        periodStart: proposal.periodStart ?? today,
      };
    case "event":
      return {
        requestId,
        kind: "event",
        title: proposal.title,
        eventDate: proposal.dueDate ?? today,
      };
    case "bill":
      return {
        requestId,
        kind: "bill",
        title: proposal.title,
        amount: proposal.amount,
        dueDate: proposal.dueDate ?? today,
        recurrence: proposal.recurrence ?? "none",
      };
    case "expense":
      if (proposal.amount === null || proposal.amount <= 0) return null;
      return {
        requestId,
        kind: "expense",
        title: proposal.title,
        amount: proposal.amount,
        occurredOn: proposal.dueDate ?? today,
      };
    case "note":
      return {
        requestId,
        kind: "note",
        title: proposal.title,
      };
    default: {
      const unreachableKind: never = proposal.kind;
      return unreachableKind;
    }
  }
}
