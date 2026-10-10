import { describe, expect, it } from "vitest";

import { BrandLogo } from "./BrandLogo";

describe("BrandLogo", () => {
  it("keeps the original image as the default and exposes the transparent variant explicitly", () => {
    const defaultLogo = BrandLogo({}).props as { src: string };
    const transparentLogo = BrandLogo({ transparent: true }).props as { src: string };

    expect(defaultLogo.src).toBe("/brand/kemtit-logo-v2.png");
    expect(transparentLogo.src).toBe("/brand/kemtit-logo-v2-transparent.png");
  });
});
