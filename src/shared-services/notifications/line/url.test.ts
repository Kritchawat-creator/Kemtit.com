import { describe, expect, it } from "vitest";

import { lineOpenUrl } from "./url";

describe("lineOpenUrl", () => {
  it("ต่อ openExternalBrowser=1 เสมอ", () => {
    expect(lineOpenUrl("https://kemtit.com", "/dashboard")).toBe(
      "https://kemtit.com/dashboard?openExternalBrowser=1",
    );
    expect(lineOpenUrl("https://kemtit.com/", "/goals/abc?x=1")).toBe(
      "https://kemtit.com/goals/abc?x=1&openExternalBrowser=1",
    );
  });
});
