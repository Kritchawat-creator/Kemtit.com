"use client";

import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, X } from "@/components/icons/ui-icons";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { formatPrototypeDate } from "./prototype-model";
import type { PrototypeDateKey, PrototypeRecord, PrototypeTimeBlock } from "./prototype-model";
import { getWeekDayEntries, getWeekDayPreview } from "./prototype-week-model";
import type { WeekDayEntry } from "./prototype-week-model";
import styles from "./PrototypeWeekBoard.module.css";

export type PrototypeWeekDay = { date: PrototypeDateKey; records: PrototypeRecord[] };
type Props = {
  days: PrototypeWeekDay[];
  selectedDate: PrototypeDateKey;
  timeBlocks?: PrototypeTimeBlock[];
  completedIds: ReadonlySet<string>;
  onSelectDate: (date: PrototypeDateKey) => void;
  onToggleComplete: (id: string) => void;
  onOpenRecord: (record: PrototypeRecord) => void;
  onOpenCalendar: (date: PrototypeDateKey) => void;
};
const TONES = { work: "--p-workText", personal: "--p-personalText", finance: "--p-financeText", health: "--p-healthText", growth: "--p-growthText" } as const;
const longDate = (date: PrototypeDateKey) => formatPrototypeDate(date, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
const countLabel = (count: number) => `${count} item${count === 1 ? "" : "s"}`;

function WeekEntry({ entry, completedIds, onToggleComplete, onOpenRecord, expanded = false }: {
  entry: WeekDayEntry;
  completedIds: ReadonlySet<string>;
  onToggleComplete: Props["onToggleComplete"];
  onOpenRecord: Props["onOpenRecord"];
  expanded?: boolean;
}) {
  const { record, timing } = entry;
  const canComplete = record.type === "task" || record.type === "habit";
  const done = canComplete && completedIds.has(record.id);
  const style = { "--week-item-tone": `var(${TONES[record.tone]})` } as CSSProperties;
  return <div className={styles.entry + (expanded ? " " + styles.expandedEntry : "")} data-testid={expanded ? "week-detail-row" : "week-preview-row"} data-record-id={record.id}>
    <button type="button" className={styles.itemButton} style={style}
      data-testid={expanded ? "week-detail-item" : canComplete ? "week-action-item" : "week-record-item"}
      data-record-id={record.id} aria-pressed={canComplete ? done : undefined}
      aria-label={`${canComplete ? done ? "Reopen: " : "Complete: " : "Open: "}${record.title}. ${timing}`}
      onClick={() => canComplete ? onToggleComplete(record.id) : onOpenRecord(record)}>
      <span className={styles.marker + (done ? " " + styles.doneMarker : "")} aria-hidden="true">
        {canComplete ? done ? <Check size={14} /> : <Circle size={13} /> : <span className={styles.dot} />}
      </span>
      <span className={styles.itemCopy}>
        <span className={styles.itemTitle + (done ? " " + styles.doneTitle : "")} data-testid="week-item-title">{record.title}</span>
        <small className={styles.itemMeta}>{timing}</small>
      </span>
    </button>
    {expanded && canComplete ? <button type="button" className={styles.openRecord} aria-label={`Open details: ${record.title}`} onClick={() => onOpenRecord(record)}><ArrowRight size={16} /></button> : null}
  </div>;
}

function DayDetails({ date, entries, completedIds, onToggleComplete, onOpenRecord, onOpenCalendar, onDismiss }: {
  date: PrototypeDateKey; entries: WeekDayEntry[]; completedIds: ReadonlySet<string>;
  onToggleComplete: Props["onToggleComplete"]; onOpenRecord: Props["onOpenRecord"];
  onOpenCalendar: Props["onOpenCalendar"]; onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const navigating = useRef(false);
  const onDismissRef = useRef(onDismiss);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const visible = entries.filter(({ record, timing }) => `${record.title} ${timing}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const preventGlobalShortcuts = (event: globalThis.KeyboardEvent) => {
      // A modal day view must keep global capture and navigation shortcuts from stealing focus.
      event.stopPropagation();
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
      }
    };
    let pointerStartedOutside = false;
    const isOutside = (event: globalThis.MouseEvent | globalThis.PointerEvent) => {
      if (event.target !== dialog) return false;
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX >= rect.right ||
        event.clientY < rect.top ||
        event.clientY >= rect.bottom
      );
    };
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      pointerStartedOutside = isOutside(event);
    };
    const handleClick = (event: globalThis.MouseEvent) => {
      if (pointerStartedOutside && isOutside(event)) onDismissRef.current();
      pointerStartedOutside = false;
    };
    const returnTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.addEventListener("keydown", preventGlobalShortcuts);
    dialog.addEventListener("pointerdown", handlePointerDown);
    dialog.addEventListener("click", handleClick);
    dialog.showModal();
    headingRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      dialog.removeEventListener("keydown", preventGlobalShortcuts);
      dialog.removeEventListener("pointerdown", handlePointerDown);
      dialog.removeEventListener("click", handleClick);
      document.body.style.overflow = oldOverflow;
      if (!navigating.current && returnTarget?.isConnected) returnTarget.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", onDismiss);
    window.addEventListener("hashchange", onDismiss);
    return () => {
      window.removeEventListener("popstate", onDismiss);
      window.removeEventListener("hashchange", onDismiss);
    };
  }, [onDismiss]);

  const openRecord = (record: PrototypeRecord) => {
    navigating.current = true;
    onDismiss();
    onOpenRecord(record);
  };
  return <dialog ref={dialogRef} className={styles.dialog} data-testid="week-day-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onDismiss(); }}>
    <header className={styles.dialogHeader}>
      <div className={styles.dialogHeading}><div><h2 id={titleId} ref={headingRef} tabIndex={-1}>{longDate(date)}</h2><p id={descriptionId}>{countLabel(entries.length)} · All items for this day</p></div><button type="button" className={styles.iconButton} aria-label="Close day details" onClick={onDismiss}><X size={20} /></button></div>
      <label className={styles.searchLabel} htmlFor={searchId}>Find an item in this day</label>
      <input className={styles.searchInput} id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by title or time" />
      <p className={styles.resultCount} role="status">Showing {visible.length} of {entries.length} items</p>
    </header>
    <div className={styles.dialogList} data-testid="week-day-scroll" role="region" aria-label="All day items">
      {visible.length ? visible.map((entry) => <WeekEntry key={entry.record.id} entry={entry} completedIds={completedIds} onToggleComplete={onToggleComplete} onOpenRecord={openRecord} expanded />)
        : <p className={styles.empty}>{query ? "No matching items. Try another title or time." : "No items for this day."}</p>}
    </div>
    <footer className={styles.dialogFooter}><button type="button" className={styles.calendarAction} onClick={() => { navigating.current = true; onDismiss(); onOpenCalendar(date); }}>View in Calendar <ArrowRight size={16} /></button></footer>
  </dialog>;
}

export function PrototypeWeekBoard({ days, selectedDate, timeBlocks = [], completedIds, onSelectDate, onToggleComplete, onOpenRecord, onOpenCalendar }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [openDate, setOpenDate] = useState<PrototypeDateKey | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(Math.max(0, days.findIndex((day) => day.date === selectedDate)));
  const viewDays = useMemo(() => days.map((day) => ({ date: day.date, entries: getWeekDayEntries(day.records, day.date, timeBlocks) })), [days, timeBlocks]);
  const expanded = viewDays.find((day) => day.date === openDate);
  const activeIndex = Math.min(visibleIndex, Math.max(0, days.length - 1));
  const scrollDay = (index: number) => {
    const grid = gridRef.current;
    const card = grid?.children[index] as HTMLElement | undefined;
    if (!grid || !card) return;
    grid.scrollTo({ left: card.offsetLeft - (grid.children[0] as HTMLElement).offsetLeft, behavior: "auto" });
    setVisibleIndex(index);
  };

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const media = window.matchMedia("(max-width: 760px)");
    const reveal = () => {
      if (!media.matches) return;
      const card = grid.querySelector<HTMLElement>(`[data-week-date="${selectedDate}"]`);
      const first = grid.children[0] as HTMLElement | undefined;
      if (card && first) grid.scrollTo({ left: card.offsetLeft - first.offsetLeft, behavior: "auto" });
    };
    reveal();
    media.addEventListener("change", reveal);
    return () => media.removeEventListener("change", reveal);
  }, [selectedDate]);

  return <section className={styles.board} aria-label="Week overview" data-testid="prototype-week-board">
    <div className={styles.mobileControls}>
      <button type="button" className={styles.iconButton} aria-label="Show previous day" disabled={activeIndex === 0} onClick={() => scrollDay(activeIndex - 1)}><ChevronLeft size={18} /></button>
      <span aria-live="polite">{days[activeIndex] ? formatPrototypeDate(days[activeIndex].date, { weekday: "short", month: "short", day: "numeric" }) : "Week"}<small>{activeIndex + 1} / {days.length}</small></span>
      <button type="button" className={styles.iconButton} aria-label="Show next day" disabled={activeIndex >= days.length - 1} onClick={() => scrollDay(activeIndex + 1)}><ChevronRight size={18} /></button>
    </div>
    <div ref={gridRef} className={styles.grid} data-testid="week-day-grid" role="region" aria-label="Days of this week"
      onScroll={() => {
        const grid = gridRef.current;
        if (!grid || !window.matchMedia("(max-width: 760px)").matches) return;
        const first = grid.children[0] as HTMLElement;
        let nearest = 0;
        let distance = Infinity;
        Array.from(grid.children).forEach((child, index) => {
          const diff = Math.abs((child as HTMLElement).offsetLeft - first.offsetLeft - grid.scrollLeft);
          if (diff < distance) { distance = diff; nearest = index; }
        });
        setVisibleIndex(nearest);
      }}>
      {viewDays.map(({ date, entries }) => {
        const preview = getWeekDayPreview(entries);
        return <section key={date} className={styles.dayCard + (date === selectedDate ? " " + styles.selectedDay : "")} data-testid="week-day-card" data-week-date={date} aria-label={`${longDate(date)}. ${countLabel(preview.total)}`}>
          <button type="button" className={styles.dayHeading} aria-pressed={date === selectedDate} onClick={() => onSelectDate(date)}>
            <span><span className={styles.weekday}>{formatPrototypeDate(date, { weekday: "short" })}</span><small>{countLabel(preview.total)}</small></span><strong>{Number(date.slice(-2))}</strong>
          </button>
          <div className={styles.dayList}>{preview.total ? preview.visible.map((entry) => <WeekEntry key={entry.record.id} entry={entry} completedIds={completedIds} onToggleComplete={onToggleComplete} onOpenRecord={onOpenRecord} />) : <p className={styles.empty}>No items</p>}</div>
          <div className={styles.dayFooter}>{preview.total ? <button type="button" className={styles.moreButton} data-testid="week-day-more" aria-haspopup="dialog" aria-label={`${preview.remaining ? `+${preview.remaining} more` : "View day"}, ${longDate(date)}, ${countLabel(preview.total)} total`} onClick={() => setOpenDate(date)}>{preview.remaining ? `+${preview.remaining} more` : "View day"}<ChevronDown size={15} /></button> : <span>No items planned</span>}</div>
        </section>;
      })}
    </div>
    {expanded ? <DayDetails key={expanded.date} date={expanded.date} entries={expanded.entries} completedIds={completedIds} onToggleComplete={onToggleComplete} onOpenRecord={onOpenRecord} onOpenCalendar={onOpenCalendar} onDismiss={() => setOpenDate(null)} /> : null}
  </section>;
}
