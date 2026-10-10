// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";
import type { WorkMode } from "@/core/profile/work-modes";

const navigationState = vi.hoisted(() => ({ pathname: "/today", search: "" }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("./QuickAddMenu", () => ({
  QuickAddMenu: () => <button type="button" data-testid="sidebar-quick-add" />,
}));

import { Sidebar } from "./Sidebar";

const localeMessages = { en: englishMessages, th: thaiMessages } as const;
type Locale = keyof typeof localeMessages;

type SidebarOptions = {
  collapsed?: boolean;
  workMode?: WorkMode | null;
  pathname?: string;
  search?: string;
  openTasks?: number;
};

function renderSidebar(locale: Locale, options: SidebarOptions = {}) {
  navigationState.pathname = options.pathname ?? "/today";
  navigationState.search = options.search ?? "";

  return render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Asia/Bangkok"
      messages={localeMessages[locale]}
    >
      <Sidebar
        collapsed={options.collapsed ?? false}
        onToggle={vi.fn()}
        shell={{ openTasks: options.openTasks ?? 3, tier: "free" }}
        profile={{
          displayName: "QA user",
          email: "qa@example.test",
          workMode: options.workMode ?? null,
          avatarUrl: null,
        }}
      />
    </NextIntlClientProvider>,
  );
}

function expectedPages(locale: Locale, workMode: WorkMode | null) {
  const { nav } = localeMessages[locale];
  const pages = [
    { label: nav.today, href: "/today" },
    { label: nav.inbox, href: "/inbox" },
    { label: nav.tasks, href: "/tasks" },
  ];

  if (workMode === "professional") {
    pages.push({ label: nav.projects, href: "/work/projects" });
  } else if (workMode === "seller") {
    pages.push({ label: nav.workSales, href: "/work/sales" });
  }

  pages.push(
    { label: nav.plan, href: "/plan" },
    { label: nav.calendar, href: "/calendar" },
    { label: nav.goals, href: "/goals" },
    { label: nav.finance, href: "/finance" },
    { label: nav.life, href: "/life" },
    { label: nav.reviews, href: "/reviews" },
    { label: nav.insights, href: "/insights" },
  );

  return pages;
}

const navigationVariants = (Object.keys(localeMessages) as Locale[]).flatMap((locale) =>
  ([null, "professional", "seller"] as const).map((workMode) => ({ locale, workMode })),
);

describe("Sidebar unique page navigation", () => {
  it.each(navigationVariants)(
    "renders one translated link per destination for $locale and $workMode mode",
    ({ locale, workMode }) => {
      renderSidebar(locale, { workMode });

      const navigation = screen.getByRole("navigation", { name: localeMessages[locale].a11y.mainNav });
      const links = within(navigation).getAllByRole("link");
      const expected = expectedPages(locale, workMode);
      const hrefs = links.map((link) => link.getAttribute("href"));

      expect(hrefs).toEqual(expected.map((page) => page.href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
      for (const [index, page] of expected.entries()) {
        expect(links[index]).toHaveTextContent(page.label);
      }
      expect(within(navigation).queryAllByRole("button")).toHaveLength(0);
      expect(navigation.querySelectorAll('a[aria-current="page"]')).toHaveLength(1);
      expect(navigation.querySelector('a[aria-current="page"]')).toHaveAttribute("href", "/today");
    },
  );

  it.each([
    { locale: "en" as const, workMode: "professional" as const },
    { locale: "th" as const, workMode: "seller" as const },
  ])("keeps every collapsed destination accessible in $locale", ({ locale, workMode }) => {
    renderSidebar(locale, { collapsed: true, workMode });

    const navigation = screen.getByRole("navigation", { name: localeMessages[locale].a11y.mainNav });
    const links = within(navigation).getAllByRole("link");
    const expected = expectedPages(locale, workMode);

    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expected.map((page) => page.href),
    );
    for (const [index, page] of expected.entries()) {
      expect(links[index]).toHaveAttribute("title", page.label);
      expect(links[index]).toHaveAccessibleName(
        page.href === "/tasks" ? `${page.label} (3)` : page.label,
      );
    }
  });

  it.each([
    { pathname: "/plan", search: "view=month", workMode: null, href: "/plan" },
    { pathname: "/calendar", search: "view=week", workMode: null, href: "/calendar" },
    { pathname: "/insights", search: "tab=productivity", workMode: null, href: "/insights" },
    { pathname: "/tasks/task-id", search: "", workMode: null, href: "/tasks" },
    {
      pathname: "/work/projects/project-id",
      search: "",
      workMode: "professional" as const,
      href: "/work/projects",
    },
    {
      pathname: "/work/sales/report-id",
      search: "",
      workMode: "seller" as const,
      href: "/work/sales",
    },
  ])("marks only the matching destination current for $pathname?$search", (route) => {
    renderSidebar("en", route);

    const navigation = screen.getByRole("navigation", { name: englishMessages.a11y.mainNav });
    const currentLinks = navigation.querySelectorAll('a[aria-current="page"]');

    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveAttribute("href", route.href);
  });

  it("keeps scope filters, Quick Add, Settings, task count, and profile in the expanded shell", () => {
    renderSidebar("en", { pathname: "/today", search: "scope=work", openTasks: 7 });

    const navigation = screen.getByRole("navigation", { name: englishMessages.a11y.mainNav });
    const taskLink = within(navigation).getByRole("link", { name: "Tasks (7)" });
    expect(taskLink).toHaveAttribute("href", "/tasks");
    expect(taskLink).toHaveTextContent("7");

    const scope = screen.getByRole("region", { name: englishMessages.shell.area });
    expect(within(scope).getByRole("link", { name: "All" })).toHaveAttribute(
      "href",
      "/today",
    );
    expect(within(scope).getByRole("link", { name: "Work" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(scope).getByRole("link", { name: "Life" })).toHaveAttribute(
      "href",
      "/today?scope=life",
    );
    expect(screen.getByTestId("sidebar-quick-add")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: englishMessages.nav.settings })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByText("QA user")).toBeInTheDocument();
  });

  it("uses Thai labels for scope and footer controls", () => {
    renderSidebar("th", { search: "scope=life" });

    const navigation = screen.getByRole("navigation", { name: thaiMessages.a11y.mainNav });
    expect(screen.getByText(thaiMessages.app.name)).toBeInTheDocument();
    expect(screen.getByText(thaiMessages.shell.personalOs)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: thaiMessages.shell.area })).toBeInTheDocument();
    expect(screen.getByText(thaiMessages.shell.navigate)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: thaiMessages.nav.settings })).toBeInTheDocument();
    expect(screen.getByLabelText(thaiMessages.shell.active)).toBeInTheDocument();
    expect(within(navigation).getByRole("link", { name: thaiMessages.nav.life })).toHaveAttribute(
      "href",
      "/life",
    );
  });
});
