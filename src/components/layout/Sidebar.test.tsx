// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/today",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./QuickAddMenu", () => ({
  QuickAddMenu: () => null,
}));

import { Sidebar } from "./Sidebar";

const localeMessages = { en: englishMessages, th: thaiMessages } as const;
type Locale = keyof typeof localeMessages;

function renderSidebar(locale: Locale, collapsed: boolean) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Asia/Bangkok"
      messages={localeMessages[locale]}
    >
      <Sidebar
        collapsed={collapsed}
        onToggle={vi.fn()}
        shell={{ openTasks: 3, tier: "free" }}
        profile={{
          displayName: "QA user",
          email: "qa@example.test",
          workMode: null,
          avatarUrl: null,
        }}
      />
    </NextIntlClientProvider>,
  );
}

function interpolateItem(template: string, item: string) {
  return template.replace("{item}", item);
}

describe("Sidebar collapsed navigation", () => {
  it("keeps every icon-only primary link accessible by its navigation label", () => {
    renderSidebar("en", true);

    const navigation = screen.getByRole("navigation", { name: englishMessages.a11y.mainNav });
    const links = within(navigation).getAllByRole("link");

    expect(links).toHaveLength(8);
    for (const link of links) {
      expect(link).toHaveAccessibleName();
      expect(link).toHaveAttribute("title", link.getAttribute("aria-label"));
    }
  });

  it("renders Thai shell labels and updates a group's translated expand label", () => {
    renderSidebar("th", false);

    expect(screen.getByText(thaiMessages.app.name)).toBeInTheDocument();
    expect(screen.getByText(thaiMessages.shell.personalOs)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: thaiMessages.shell.area })).toBeInTheDocument();
    expect(screen.getByText(thaiMessages.shell.navigate)).toBeInTheDocument();
    expect(screen.getByLabelText(thaiMessages.shell.active)).toBeInTheDocument();

    const expandLabel = interpolateItem(thaiMessages.nav.expandItem, thaiMessages.nav.workspace);
    const expandButton = screen.getByRole("button", { name: expandLabel });
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(expandButton);

    const collapseLabel = interpolateItem(thaiMessages.nav.collapseItem, thaiMessages.nav.workspace);
    expect(screen.getByRole("button", { name: collapseLabel })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("link", { name: thaiMessages.nav.inbox })).toBeInTheDocument();
  });

  it("uses English brand and shell labels for the English locale", () => {
    renderSidebar("en", false);

    expect(screen.getByText(englishMessages.app.name)).toBeInTheDocument();
    expect(screen.getByText(englishMessages.shell.personalOs)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: englishMessages.shell.area })).toBeInTheDocument();
    expect(screen.getByText(englishMessages.shell.navigate)).toBeInTheDocument();
  });
});
