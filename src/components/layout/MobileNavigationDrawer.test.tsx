// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

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
}));

import { MobileNavigationDrawer } from "./MobileNavigationDrawer";

const localeCases = [
  { locale: "th", messages: thaiMessages },
  { locale: "en", messages: englishMessages },
] as const;

describe("MobileNavigationDrawer localization", () => {
  it.each(localeCases)("renders and closes with $locale labels", ({ locale, messages }) => {
    render(
      <NextIntlClientProvider locale={locale} timeZone="Asia/Bangkok" messages={messages}>
        <MobileNavigationDrawer workMode={null} />
      </NextIntlClientProvider>,
    );

    const trigger = screen.getByRole("button", { name: messages.common.menu });
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(messages.app.name)).toBeInTheDocument();
    expect(within(dialog).getByText(messages.shell.personalOs)).toBeInTheDocument();
    expect(within(dialog).getByText(messages.shell.area)).toBeInTheDocument();
    const navigation = within(dialog).getByRole("navigation", { name: messages.a11y.mainNav });
    expect(within(navigation).getByText(messages.shell.navigate)).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(dialog).getByRole("button", { name: messages.common.close }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
