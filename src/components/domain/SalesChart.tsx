import { useTranslations } from "next-intl";
import { cn } from "cn";

import { planValueAt } from "@/core/domain/entries";
import type { Period } from "@/core/domain/periods";
import {
  daysBetween,
  endOfWeekISO,
  type ISODate,
  isAfterISO,
  isBeforeISO,
  startOfWeekISO,
} from "@/lib/date";
import { formatNumber, formatThaiDate, formatValueWithUnit } from "@/lib/format";

export type SalesPoint = { date: ISODate; total: number };

type Props = {
  /** ยอดสะสมรายวันของทั้ง period (จาก cumulativeSeries) — component ตัดช่วงที่จะแสดงเอง */
  series: SalesPoint[];
  target: number;
  period: Period;
  today: ISODate;
  /** month = ทั้งเดือน · week = เฉพาะสัปดาห์นี้ (ค่าที่พล็อตยังเป็นยอดสะสมของเดือน) */
  range: "week" | "month";
  unit: string | null;
  className?: string;
};

// ระบบพิกัดเดียวกับต้นแบบใน Claude Design turn 6/7 (v2Chart)
const W = 800;
const H = 200;
const PAD_L = 52;
const PAD_R = 20;
const PAD_T = 22;
const PAD_B = 30;

/** 25000 → "25k" · 0 → "0" — ป้ายแกน Y ให้สั้นพอไม่ชนเส้น */
function axisLabel(value: number): string {
  if (value === 0) return "0";
  return value >= 1000 ? `${formatNumber(Math.round(value / 1000))}k` : formatNumber(value);
}

/**
 * กราฟ "เส้นทางสะสม" (Claude Design turn 6 §3 / turn 7): พื้นที่ใต้เส้น brand-100 · เส้นสะสม brand-500 ·
 * เส้นประ border-strong = แผนเฉลี่ยต่อวัน · เส้นประเป้า brand-200 · จุดวันนี้ accent-500 (จุด accent เดียวของการ์ด)
 * สีทุกจุดมาจาก token ผ่าน class เหมือน CompassDial — ห้าม hex ดิบใน components (Design §16)
 */
export function SalesChart({ series, target, period, today, range, unit, className }: Props) {
  const t = useTranslations("entries.chart");

  const rangeStart = range === "week" ? startOfWeekISO(today) : period.start;
  const rangeEnd = range === "week" ? endOfWeekISO(today) : period.end;
  const days = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);

  const inRange = series.filter(
    (p) => !isBeforeISO(p.date, rangeStart) && !isAfterISO(p.date, rangeEnd),
  );
  const lastTotal = inRange.at(-1)?.total ?? 0;
  const maxY = Math.max(target, lastTotal, 1) * 1.05;

  // d = 0 คือเส้นฐานก่อนวันแรกของช่วง, d = days คือปลายช่วง
  const x = (d: number) => PAD_L + (d / days) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / maxY) * (H - PAD_T - PAD_B);
  const dayIndex = (date: ISODate) => daysBetween(rangeStart, date) + 1;

  const points: [number, number][] = inRange.map((p) => [x(dayIndex(p.date)), y(p.total)]);
  // เดือนเริ่มจาก 0 จริง ๆ · สัปดาห์เริ่มกลางเดือน จึงต่อจากยอดสะสมที่มีอยู่ก่อนแล้ว
  if (range === "month") points.unshift([x(0), y(0)]);
  const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`);
  const linePath = line.join(" ");
  const areaPath = points.length
    ? `${linePath} L${points.at(-1)![0].toFixed(1)} ${y(0).toFixed(1)} L${points[0][0].toFixed(1)} ${y(0).toFixed(1)} Z`
    : "";

  const gridValues = [0, target / 2, target];
  const planFrom = planValueAt(target, period, rangeStart);
  const planTo = planValueAt(target, period, rangeEnd);

  const todayInRange = !isBeforeISO(today, rangeStart) && !isAfterISO(today, rangeEnd);
  const todayPoint = todayInRange ? inRange.find((p) => p.date === today) : undefined;

  const ticks =
    range === "week"
      ? Array.from({ length: days }, (_, i) => i + 1)
      : [1, 7, 14, 21, days].filter((d, i, all) => all.indexOf(d) === i && d <= days);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("block h-auto w-full overflow-visible font-sans", className)}
      role="img"
      aria-label={t("aria", {
        total: formatValueWithUnit(lastTotal, unit),
        target: formatValueWithUnit(target, unit),
      })}
    >
      {gridValues.map((value) => (
        <g key={value}>
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(value)}
            y2={y(value)}
            strokeWidth={1}
            strokeDasharray={value === target ? "4 4" : undefined}
            className={value === target ? "stroke-brand-200" : "stroke-border"}
          />
          <text
            x={PAD_L - 8}
            y={y(value) + 4}
            textAnchor="end"
            fontSize={12.5}
            fontWeight={500}
            className="fill-text-secondary"
          >
            {axisLabel(value)}
          </text>
        </g>
      ))}

      <line
        x1={x(0)}
        y1={y(planFrom)}
        x2={x(days)}
        y2={y(planTo)}
        strokeWidth={1.5}
        strokeDasharray="3 5"
        className="stroke-border-strong"
      />

      {points.length > 1 ? (
        <>
          <path d={areaPath} className="fill-brand-100 opacity-80" />
          <path
            d={linePath}
            fill="none"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="stroke-brand-500"
          />
        </>
      ) : null}

      {ticks.map((d) => (
        <text
          key={d}
          x={x(d)}
          y={H - 8}
          textAnchor="middle"
          fontSize={12.5}
          fontWeight={500}
          className="fill-text-secondary"
        >
          {formatThaiDate(
            inRange[d - 1]?.date ?? series.find((p) => dayIndex(p.date) === d)?.date ?? rangeStart,
            "short",
          )}
        </text>
      ))}

      {todayPoint ? (
        <>
          <line
            x1={x(dayIndex(today))}
            x2={x(dayIndex(today))}
            y1={y(0)}
            y2={y(todayPoint.total)}
            strokeWidth={1}
            strokeDasharray="2 3"
            className="stroke-accent-500"
          />
          <circle
            cx={x(dayIndex(today))}
            cy={y(todayPoint.total)}
            r={5.5}
            strokeWidth={2}
            className="fill-accent-500 stroke-bg-surface"
          />
          <text
            x={x(dayIndex(today)) + 10}
            y={y(todayPoint.total) - 8}
            fontSize={13}
            fontWeight={600}
            className="fill-text-primary"
          >
            {formatNumber(todayPoint.total)}
          </text>
        </>
      ) : null}
    </svg>
  );
}
