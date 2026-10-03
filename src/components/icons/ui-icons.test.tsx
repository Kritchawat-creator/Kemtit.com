import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, createRef } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import * as Icons from "./ui-icons";
import type { SVGIconComponent } from "./ui-icons";

describe("SVG icon components", () => {
  it("forwards SVG props and refs while exposing the sprite symbol accessibly", () => {
    const ref = createRef<SVGSVGElement>();

    render(
      <Icons.Compass
        ref={ref}
        size={32}
        strokeWidth={1.5}
        className="text-brand-500"
        data-testid="compass"
        aria-label="Compass"
      />,
    );

    const icon = screen.getByRole("img", { name: "Compass" });
    expect(ref.current).toBe(icon);
    expect(icon).toHaveAttribute("viewBox", "0 0 24 24");
    expect(icon).toHaveAttribute("width", "32");
    expect(icon).toHaveAttribute("height", "32");
    expect(icon).toHaveAttribute("stroke-width", "1.5");
    expect(icon).toHaveClass("text-brand-500");
    expect(icon.querySelector("use")).toHaveAttribute("href", "/icons/ui/sprite.svg#icon-compass");
    expect(icon).not.toHaveAttribute("aria-hidden");
  });

  it("hides unlabeled icons from assistive technology", () => {
    render(<Icons.Plus className="size-4" />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("maps every exported icon to a drawable standalone SVG and sprite symbol", () => {
    const icons = Object.entries(Icons).filter(
      ([, component]) =>
        typeof component === "object" && component !== null && "$$typeof" in component,
    );
    const { container } = render(
      <div>
        {icons.map(([name, Component]) =>
          createElement(Component as SVGIconComponent, { key: name }),
        )}
      </div>,
    );
    const sprite = readFileSync(path.resolve(process.cwd(), "public/icons/ui/sprite.svg"), "utf8");
    const symbolIds = new Set(
      [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((match) => match[1]),
    );
    const referencedIds = new Set<string>();

    for (const svg of container.querySelectorAll("svg")) {
      const href = svg.querySelector("use")?.getAttribute("href");
      expect(href).toMatch(/^\/icons\/ui\/sprite\.svg#icon-/);
      const symbolId = href?.split("#")[1];
      expect(symbolIds.has(symbolId ?? "")).toBe(true);
      if (!symbolId) continue;
      referencedIds.add(symbolId);

      const fileName = `${symbolId.replace(/^icon-/, "")}.svg`;
      const standalone = readFileSync(
        path.resolve(process.cwd(), "public/icons/ui", fileName),
        "utf8",
      );
      expect(standalone).toMatch(/<(?:path|circle|rect|line|polyline|polygon)\b/);
      expect(standalone).toContain('stroke="currentColor"');
    }

    expect(icons.length).toBeGreaterThan(80);
    expect(referencedIds).toEqual(symbolIds);
  });

  it("keeps the loading mark as an open arc for its spin animation", () => {
    const loaderSvg = readFileSync(
      path.resolve(process.cwd(), "public/icons/ui/loader.svg"),
      "utf8",
    );
    const loaderPath = loaderSvg.match(/<path d="([^"]+)"/)?.[1] ?? "";

    expect(loaderPath).toMatch(/[Aa]/);
    expect(loaderPath).not.toMatch(/z\s*$/i);
    expect(loaderSvg).not.toContain("<circle");
  });
});
