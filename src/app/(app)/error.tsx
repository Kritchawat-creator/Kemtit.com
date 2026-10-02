"use client";

import { RouteErrorRecovery } from "@/components/layout/RouteErrorRecovery";

/** Error กู้ไม่ได้ (Design §8.6): full-width card บอกเกิดอะไร + ปุ่มลองอีกครั้ง */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorRecovery error={error} reset={reset} />;
}
