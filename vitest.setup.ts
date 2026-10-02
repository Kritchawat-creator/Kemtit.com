import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` is a production guard; unit tests run in jsdom and need a no-op
// module boundary so they can exercise the server utility without importing the
// guard's client-component exception.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
