"use client";

import { th } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "cn";

import { fromISO, type ISODate, toISO } from "@/lib/date";
import { formatThaiDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Props = {
  value?: ISODate;
  onChange: (value?: ISODate) => void;
  id?: string;
  disabled?: boolean;
  className?: string;
};

const buddhistCaption = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { month: "long", year: "numeric" });
const buddhistYear = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { year: "numeric" });

/** เลือกวันที่ — ปฏิทินไทย พ.ศ. สัปดาห์เริ่มอาทิตย์ (Design §12, Q16) */
export function DatePicker({ value, onChange, id, disabled, className }: Props) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={t("a11y.openCalendar")}
          className={cn("w-full justify-start font-normal", !value && "text-text-muted", className)}
        >
          <CalendarDays aria-hidden="true" />
          {value ? formatThaiDate(value, "medium") : t("dates.pick")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={th}
          weekStartsOn={0}
          selected={value ? fromISO(value) : undefined}
          defaultMonth={value ? fromISO(value) : undefined}
          onSelect={(date) => {
            onChange(date ? toISO(date) : undefined);
            setOpen(false);
          }}
          formatters={{
            formatCaption: (date) => buddhistCaption.format(date),
            formatYearDropdown: (date) => buddhistYear.format(date),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
