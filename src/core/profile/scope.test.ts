import { describe, expect, it } from "vitest";

import { domainInScope } from "./scope";

describe("domainInScope", () => {
  it("keeps work and life independently filterable", () => {
    expect(domainInScope("work", "work")).toBe(true);
    expect(domainInScope("health", "work")).toBe(false);
    expect(domainInScope("finance", "life")).toBe(true);
    expect(domainInScope("relationships", "all")).toBe(true);
  });
});
