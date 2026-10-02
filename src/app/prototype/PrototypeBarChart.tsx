"use client";

import { useId, useState, type KeyboardEvent } from "react";
import {
  formatPrototypeDate,
  formatPrototypeDuration,
  type PrototypeDateKey,
} from "./prototype-model";
import {
  getPrototypeBarPercent,
  getPrototypeChartCeiling,
  type PrototypeChartDay,
} from "./prototype-chart-model";
import styles from "./PrototypeBarChart.module.css";

type Props = {
  title: string;
  days: PrototypeChartDay[];
  initialDate: PrototypeDateKey;
  size?: "summary" | "report";
  actionLabel?: string;
  onAction?: () => void;
  onOpenDay?: (date: PrototypeDateKey) => void;
};

function shortValue(minutes: number | null): string {
  if (minutes === null) return "—";
  return minutes < 60 ? `${minutes}m` : `${Number((minutes / 60).toFixed(1))}h`;
}

function valueDescription(day: PrototypeChartDay): string {
  if (day.minutes !== null) return `${formatPrototypeDuration(day.minutes)} estimated`;
  return `${formatPrototypeDuration(day.knownMinutes)} known; ${day.missingEstimateCount} missing estimate${day.missingEstimateCount === 1 ? "" : "s"}`;
}

function moveDayFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button[data-chart-day]");
  if (!buttons?.length) return;
  let next: number;
  switch (event.key) {
    case "ArrowRight": next = (index + 1) % buttons.length; break;
    case "ArrowLeft": next = (index - 1 + buttons.length) % buttons.length; break;
    case "Home": next = 0; break;
    case "End": next = buttons.length - 1; break;
    default: return;
  }
  event.preventDefault();
  buttons[next]?.focus({ preventScroll: true });
}

export function PrototypeBarChart({
  title, days, initialDate, size = "summary", actionLabel, onAction, onOpenDay,
}: Props) {
  const id = useId();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const selected = days.find((day) => day.date === selectedDate)
    ?? days.find((day) => day.date === initialDate) ?? days[0];
  const ceiling = getPrototypeChartCeiling(days.map((day) => day.minutes));
  const first = days[0];
  const last = days.at(-1);
  const period = first && last
    ? `${formatPrototypeDate(first.date, { month: "short", day: "numeric" })} – ${formatPrototypeDate(last.date, { month: "short", day: "numeric", year: "numeric" })}`
    : "No period selected";
  const empty = !days.length || days.every((day) => day.itemCount === 0);

  return <section
    className={`${styles.panel} ${size === "report" ? styles.report : ""}`}
    aria-labelledby={`${id}-title`}
    data-testid="prototype-chart-panel"
    data-chart-title={title}
    data-chart-size={size}
  >
    <header className={styles.header}>
      <div>
        <h3 id={`${id}-title`}>{title}</h3>
        <p id={`${id}-description`}>Estimated workload · {period}</p>
      </div>
      {actionLabel && onAction ? <button type="button" className={styles.action} onClick={onAction}>
        {actionLabel}<span aria-hidden="true">→</span>
      </button> : null}
    </header>

    <figure className={styles.figure} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
      <figcaption className={styles.srOnly}>
        Estimates plus event durations, not time tracked. Select a day to read its exact value. Use the data table for all values. A dash means an estimate is missing; zero means no estimated workload.
      </figcaption>
      <div className={styles.axis} aria-hidden="true">
        <span>{shortValue(ceiling)}</span><span>0h</span>
      </div>
      <div className={styles.columns} data-testid="prototype-chart-plot">
        <span className={styles.baseline} data-testid="chart-baseline" aria-hidden="true" />
        {days.map((day, index) => <button
          key={day.date}
          type="button"
          className={styles.column}
          data-chart-day={day.date}
          data-testid="planned-time-bar"
          data-minutes={day.minutes === null ? "unknown" : day.minutes}
          aria-pressed={selected?.date === day.date}
          aria-label={`${formatPrototypeDate(day.date, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}: ${valueDescription(day)}`}
          onClick={() => setSelectedDate(day.date)}
          onFocus={() => setSelectedDate(day.date)}
          onPointerEnter={(event) => { if (event.pointerType === "mouse") setSelectedDate(day.date); }}
          onKeyDown={(event) => moveDayFocus(event, index)}
        >
          <span className={styles.barSlot} data-testid="chart-bar-slot" aria-hidden="true">
            <span className={styles.fill} data-testid="planned-time-bar-fill" style={{ height: `${getPrototypeBarPercent(day.minutes, ceiling)}%` }} />
          </span>
          <span className={styles.dayLabel} aria-hidden="true"><span>{day.label}</span><small>{shortValue(day.minutes)}</small></span>
        </button>)}
      </div>
    </figure>

    <footer className={styles.footer} data-testid="chart-footer">
      <p data-testid="chart-selected-value">
        {empty ? "Nothing planned for this week." : selected ? <>
          <strong>{formatPrototypeDate(selected.date, { weekday: "short", month: "short", day: "numeric" })}</strong>
          {" · "}{valueDescription(selected)}
        </> : "No data available."}
      </p>
      <div className={styles.footerActions}>
        {selected && onOpenDay ? <button type="button" className={styles.action} onClick={() => onOpenDay(selected.date)}>Open day’s plan<span aria-hidden="true">→</span></button> : null}
        <details className={styles.dataTable} data-testid="chart-data-table">
          <summary>View data table</summary>
          <table>
            <caption>{title} · {period} · exact estimates</caption>
            <thead><tr><th scope="col">Date</th><th scope="col">Estimated workload</th></tr></thead>
            <tbody>{days.map((day) => <tr key={day.date}>
              <th scope="row">{formatPrototypeDate(day.date, { weekday: "short", month: "short", day: "numeric" })}</th>
              <td>{valueDescription(day)}</td>
            </tr>)}</tbody>
          </table>
        </details>
      </div>
    </footer>
  </section>;
}
