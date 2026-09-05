/**
 * Port สำหรับส่งข้อความหา user (Scope §4: modules/shared-services คุยกับ core ผ่าน port)
 * implementation จริงอยู่ที่ shared-services/notifications/line (Messaging API) และ dry-run สำหรับ dev
 */
export type NotifyResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

export interface Notifier {
  readonly channel: "line";
  readonly dryRun: boolean;
  push(recipientId: string, text: string): Promise<NotifyResult>;
}
