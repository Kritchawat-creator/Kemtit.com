"use client";

import { RouteErrorRecovery } from "@/components/layout/RouteErrorRecovery";

/** Catches failures in route-group layouts, including the authenticated app layout. */
export default function RootRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorRecovery error={error} reset={reset} />;
}
