import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { enGB as englishCalendarLocale, th as thaiCalendarLocale } from "react-day-picker/locale";

import { Calendar } from "./calendar";

describe("Calendar month dropdown localization", () => {
  it.each([
    {
      locale: thaiCalendarLocale,
      dropdownName: "เลือกเดือน",
      januaryLabel: "ม.ค.",
    },
    {
      locale: englishCalendarLocale,
      dropdownName: "Choose the Month",
      januaryLabel: "Jan",
    },
  ])("formats month options for the selected locale", ({ locale, dropdownName, januaryLabel }) => {
    const january = new Date(2026, 0, 1);

    render(
      <Calendar
        captionLayout="dropdown"
        defaultMonth={january}
        startMonth={january}
        endMonth={new Date(2026, 11, 1)}
        locale={locale}
      />,
    );

    const monthDropdown = screen.getByRole("combobox", { name: dropdownName });
    expect(within(monthDropdown).getByRole("option", { name: januaryLabel })).toBeInTheDocument();
  });
});
