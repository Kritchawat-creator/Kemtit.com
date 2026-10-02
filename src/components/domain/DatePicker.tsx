"use client";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";
import { enGB as enGBCalendarLocale, th as thaiCalendarLocale } from "react-day-picker/locale";

import type { AppLocale } from "@/i18n/config";
import { intlLocale, LOCALE_CONFIG } from "@/i18n/config";
import { fromISO, type ISODate, toISO } from "@/lib/date";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value?: ISODate;
  onChange: (value?: ISODate) => void;
  id?: string;
  ariaLabel?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

export function DatePicker({
  value,
  onChange,
  id,
  ariaLabel,
  disabled,
  clearable = false,
  className,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const datePickerLocale = locale === "th" ? thaiCalendarLocale : enGBCalendarLocale;
  const calendarLocale = intlLocale(locale);
  const caption = new Intl.DateTimeFormat(calendarLocale, {
    month: "long",
    year: "numeric",
  });
  const yearOnly = new Intl.DateTimeFormat(calendarLocale, { year: "numeric" });
  const fullDate = new Intl.DateTimeFormat(calendarLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formatWithCalendarEra = (label: string, date: Date) =>
    label.replace(format(date, "PPPP", { locale: datePickerLocale }), fullDate.format(date));
  const localeLabels = datePickerLocale.labels;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel ?? t("a11y.openCalendar")}
          className={cn("w-full justify-start font-normal", !value && "text-text-muted", className)}
        >
          <CalendarDays aria-hidden="true" />
          {value ? formatDate(value, "medium", locale) : t("dates.pick")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={datePickerLocale}
          weekStartsOn={LOCALE_CONFIG[locale].weekStartsOn}
          selected={value ? fromISO(value) : undefined}
          defaultMonth={value ? fromISO(value) : undefined}
          onSelect={(date) => {
            if (!date && !clearable) return;
            onChange(date ? toISO(date) : undefined);
            setOpen(false);
          }}
          formatters={{
            formatCaption: (date) => caption.format(date),
            formatMonthDropdown: (date) =>
              new Intl.DateTimeFormat(calendarLocale, { month: "short" }).format(date),
            formatYearDropdown: (date) => yearOnly.format(date),
          }}
          labels={{
            labelGrid: (date) => caption.format(date),
            labelGridcell: (date, modifiers, options, dateLib) => {
              const label = localeLabels?.labelGridcell;
              if (typeof label !== "function") return fullDate.format(date);
              return formatWithCalendarEra(label(date, modifiers, options, dateLib), date);
            },
            labelDayButton: (date, modifiers, options, dateLib) => {
              const label = localeLabels?.labelDayButton;
              if (typeof label !== "function") return fullDate.format(date);
              return formatWithCalendarEra(label(date, modifiers, options, dateLib), date);
            },
          }}
        />
        {clearable && value ? (
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 w-full"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              {t("dates.clear")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
