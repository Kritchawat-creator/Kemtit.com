/**
 * Raised when a read failed. A failed read is deliberately different from an
 * empty result: callers must render the route error state instead of telling
 * the user that there is no data or that the day is free.
 */
export class QueryError extends Error {
  readonly source: string;
  readonly code?: string;

  constructor(source: string, code?: string) {
    super("queryFailed");
    this.name = "QueryError";
    this.source = source;
    this.code = code;
  }
}
