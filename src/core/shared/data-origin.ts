export const DATA_ORIGINS = [
  "SYSTEM",
  "TEMPLATE",
  "SUGGESTED",
  "EXAMPLE",
  "USER",
  "IMPORT",
] as const;

export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const COUNTED_DATA_ORIGINS = ["USER", "IMPORT"] as const satisfies readonly DataOrigin[];

/**
 * Prepared data must remain non-operational until the user explicitly accepts it.
 * USER and IMPORT are persisted activity sources; analytics may still apply
 * metric-specific inclusion rules to IMPORT records.
 */
export function isPreparedOrigin(origin: DataOrigin): boolean {
  return origin === "SYSTEM" || origin === "TEMPLATE" || origin === "SUGGESTED" || origin === "EXAMPLE";
}

export function isAcceptedOrigin(origin: DataOrigin): boolean {
  return origin === "USER" || origin === "IMPORT";
}
