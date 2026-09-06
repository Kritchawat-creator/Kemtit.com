import type { GoalSpec } from "@/core/goals/schema";

/**
 * Port สำหรับ AI แตกเป้า (Scope §16: เตรียม port ไว้ ไม่ implement ใน POC/MVP)
 * เมื่อเปิดใช้ (Phase 3) ให้ implement ที่ shared-services/ai และ gate ด้วย subscription tier + cache (Scope §15)
 */
export interface AiSuggestionPort {
  suggestCascade(input: {
    title: string;
    targetValue?: number;
    unit?: string;
    monthStart: string;
  }): Promise<GoalSpec>;
}
