import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import englishMessages from "@/messages/en.json";
import thaiMessages from "@/messages/th.json";
import { DatePicker } from "./DatePicker";

function renderWithLocale(locale: "en" | "th", children: ReactNode) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === "th" ? thaiMessages : englishMessages}
    >
      {children}
    </NextIntlClientProvider>,
  );
}

describe("DatePicker localization", () => {
  it("keeps the default calendar name and accepts contextual labels in English", () => {
    renderWithLocale(
      "en",
      <>
        <DatePicker value="2026-09-27" onChange={vi.fn()} />
        <DatePicker ariaLabel="Transaction date" value="2026-09-27" onChange={vi.fn()} />
        <DatePicker ariaLabel="Bill due date" value="2026-09-27" onChange={vi.fn()} />
      </>,
    );

    expect(screen.getByRole("button", { name: "Open calendar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transaction date" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bill due date" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Transaction date" }));
    expect(screen.getByRole("button", { name: "Transaction date" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("uses Thai calendar labels and selects a date with the Buddhist year", () => {
    const onChange = vi.fn();
    renderWithLocale("th", <DatePicker value="2026-09-15" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "เปิดปฏิทิน" }));

    expect(screen.getByRole("button", { name: "ไปเดือนก่อนหน้า" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ไปเดือนถัดไป" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "แถบนำทาง" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "กันยายน 2569" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /เลือกแล้ว/ })).toHaveAccessibleName(/2569/);

    fireEvent.click(screen.getByRole("button", { name: /16 กันยายน/ }));

    expect(onChange).toHaveBeenCalledWith("2026-09-16");
  });

  it("keeps English calendar labels and the Gregorian year in English mode", () => {
    renderWithLocale("en", <DatePicker value="2026-09-15" onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Open calendar" }));

    expect(screen.getByRole("button", { name: "Go to the Previous Month" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to the Next Month" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navigation bar" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "September 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /selected/ })).toHaveAccessibleName(/2026/);
  });

  it("keeps Thai today and selected markers around the Buddhist-era date label", () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    try {
      vi.setSystemTime(new Date(2026, 8, 27, 12));

      renderWithLocale("th", <DatePicker value="2026-09-27" onChange={vi.fn()} />);
      fireEvent.click(screen.getByRole("button", { name: "เปิดปฏิทิน" }));

      const todayButton = screen.getByRole("button", { name: /วันนี้,/ });
      expect(todayButton).toHaveAccessibleName(/วันนี้,.*27 กันยายน 2569.*เลือกแล้ว/);
    } finally {
      vi.useRealTimers();
    }
  });
});
