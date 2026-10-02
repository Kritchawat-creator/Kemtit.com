"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Command,
  Dumbbell,
  Goal,
  Gauge,
  HeartPulse,
  Home,
  Layers3,
  Lightbulb,
  ListTodo,
  Menu,
  PiggyBank,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  WalletCards,
  X,
} from "lucide-react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  formatPrototypeDate,
  formatPrototypeDuration,
  formatPrototypeMonth,
  findPrototypeTimeSlot,
  getPrototypeActionRecords,
  getPrototypeCapacity,
  getPrototypeDayRecords,
  getPrototypeMetrics,
  getPrototypeMonthCells,
  getPrototypeUpcomingRecords,
  getPrototypeWeekDates,
  getPrototypeWeekFocus,
  getRecordsInScope,
  INITIAL_PROTOTYPE_GOALS,
  INITIAL_PROTOTYPE_LEDGER,
  INITIAL_PROTOTYPE_PROJECTS,
  INITIAL_PROTOTYPE_RECORDS,
  INITIAL_PROTOTYPE_TIME_BLOCKS,
  parsePrototypeDate,
  PROTOTYPE_DEMO_TODAY,
  PROTOTYPE_MONTHLY_BUDGET,
  shiftPrototypeDays,
  shiftPrototypeMonths,
  toPrototypeDateKey,
  type PrototypeDateKey,
  type PrototypeGoal,
  type PrototypeItemArea,
  type PrototypeRecord,
  type PrototypeRecordScope,
  type PrototypeRecordType,
  type PrototypeScope,
  type PrototypeTimeBlock,
} from "./prototype-model";
import { PrototypeBarChart } from "./PrototypeBarChart";
import { PrototypeWeekBoard } from "./PrototypeWeekBoard";
import { getPrototypeBudgetUsage, getPrototypeEstimatedWeek } from "./prototype-chart-model";
import styles from "./prototype.module.css";

type ThemeKey = "minimal" | "dark" | "life" | "pro" | "spatial";
type ViewMode = "Today" | "Week" | "Month" | "Year";
type DemoMode = "sample" | "empty";
type StarterRole = "employee" | "seller";
type CaptureType = PrototypeRecordType;
type PrototypeRouteState = {
  theme: ThemeKey;
  scope: PrototypeScope;
  destination: string;
  date: PrototypeDateKey;
  view: ViewMode;
  mode: DemoMode;
};
type CaptureDraft = {
  title: string;
  type: CaptureType;
  date: string;
  dueDate: string;
  scope: PrototypeRecordScope | "";
  projectId: string;
  amount: string;
  startTime: string;
  durationMinutes: string;
  recurrence: string;
  reminderMinutes: string;
};

type CaptureProposal = {
  title: string;
  type: CaptureType;
  dueDate?: PrototypeDateKey;
  durationMinutes?: number;
  scope: PrototypeItemArea;
  projectId?: string;
  signals: string[];
};
type UnsupportedAction = { label: string; reason: string; reasonId: string };

type StarterTemplateItem = {
  title: string;
  type: "task" | "habit" | "note";
  scope: PrototypeRecordScope;
  tone: PrototypeRecord["tone"];
  status: "inbox" | "planned";
  durationMinutes?: number;
  recurrence?: string;
};

const STARTER_WORKSPACES: Record<StarterRole, { label: string; detail: string; items: StarterTemplateItem[] }> = {
  employee: {
    label: "Employee / Knowledge worker",
    detail: "A lightweight weekly planning and follow-up starter.",
    items: [
      { title: "Plan this week", type: "task", scope: "work", tone: "work", status: "planned", durationMinutes: 30 },
      { title: "Capture meeting follow-ups", type: "note", scope: "work", tone: "work", status: "inbox" },
      { title: "Weekly review", type: "habit", scope: "work", tone: "growth", status: "planned", durationMinutes: 20, recurrence: "Every Friday" },
    ],
  },
  seller: {
    label: "Seller / Creator",
    detail: "A starter for launches, content, and recurring business review.",
    items: [
      { title: "Plan next product launch", type: "task", scope: "work", tone: "growth", status: "planned", durationMinutes: 45 },
      { title: "Capture next content idea", type: "note", scope: "work", tone: "growth", status: "inbox" },
      { title: "Review business expenses", type: "habit", scope: "work", tone: "finance", status: "planned", durationMinutes: 20, recurrence: "Every month" },
    ],
  },
};

const THEMES: Array<{ key: ThemeKey; number: string; name: string; strapline: string; basis: string }> = [
  { key: "minimal", number: "01", name: "Modern Minimal", strapline: "Clean. Focused. Timeless.", basis: "Modernize + Vuexy" },
  { key: "dark", number: "02", name: "Dark Focus", strapline: "Focus. Organize. Go further.", basis: "Taskora + Hybrix" },
  { key: "life", number: "03", name: "Life Blend", strapline: "Work. Life. Balance.", basis: "Vona + Vuexy" },
  { key: "pro", number: "04", name: "Productivity Pro", strapline: "Data-driven. Results-oriented.", basis: "Able Pro + Modernize" },
  { key: "spatial", number: "05", name: "Spatial Flow", strapline: "See the bigger picture.", basis: "Taskora + Hybrix" },
];

type NavChild = { key: string; label: string; destination: string; supported?: boolean; reason?: string };
type NavGroup = { key: string; label: string; icon: LucideIcon; destination: string; children?: NavChild[] };
const NAV_GROUPS: NavGroup[] = [
  { key: "today", label: "Today", icon: Home, destination: "today" },
  {
    key: "workspace", label: "Workspace", icon: Layers3, destination: "workspace",
    children: [
      { key: "inbox", label: "Inbox", destination: "inbox" },
      { key: "tasks", label: "Tasks", destination: "tasks" },
    ],
  },
  {
    key: "planner", label: "Planner", icon: CalendarDays, destination: "planner",
    children: [
      { key: "planner-year", label: "Year overview", destination: "planner-year" },
      { key: "planner-month", label: "Month plan", destination: "planner-month" },
      { key: "planner-week", label: "Week plan", destination: "planner-week" },
      { key: "planner-day", label: "Day plan", destination: "planner-day" },
    ],
  },
  {
    key: "calendar", label: "Calendar", icon: Clock3, destination: "calendar",
    children: [
      { key: "calendar-month", label: "Month view", destination: "calendar-month" },
      { key: "calendar-week", label: "Week view", destination: "calendar-week" },
      { key: "calendar-schedule", label: "Schedule", destination: "calendar-schedule" },
      { key: "calendar-focus", label: "Focus blocks", destination: "calendar-focus", supported: false, reason: "Focus-block editing is outside this visual prototype." },
      { key: "calendar-upcoming", label: "Upcoming", destination: "calendar-upcoming" },
    ],
  },
  {
    key: "goals", label: "Goals", icon: Goal, destination: "goals",
    children: [
      { key: "goals-active", label: "Active goals", destination: "goals-active" },
      { key: "goals-milestones", label: "Milestones", destination: "goals-milestones", supported: false, reason: "Milestone detail data is not included in this prototype." },
      { key: "goals-review", label: "Review", destination: "goals-review" },
    ],
  },
  {
    key: "finance", label: "Finance", icon: WalletCards, destination: "finance",
    children: [
      { key: "finance-overview", label: "Overview", destination: "finance-overview" },
      { key: "finance-budget", label: "Budget", destination: "finance-budget" },
      { key: "finance-bills", label: "Bills", destination: "finance-bills" },
      { key: "finance-investments", label: "Investments", destination: "finance-investments", supported: false, reason: "Live investment balances and trading are outside this prototype." },
    ],
  },
  {
    key: "routine", label: "Routine", icon: HeartPulse, destination: "routine",
    children: [
      { key: "routine-habits", label: "Habits", destination: "routine-habits" },
      { key: "routine-health", label: "Health", destination: "routine-health", supported: false, reason: "Health metrics and integrations are outside this prototype." },
      { key: "routine-reflection", label: "Reflection", destination: "routine-reflection" },
    ],
  },
  {
    key: "insights", label: "Insights", icon: BarChart3, destination: "insights",
    children: [
      { key: "insights-overview", label: "Overview", destination: "insights-overview" },
      { key: "insights-productivity", label: "Productivity", destination: "insights-productivity" },
      { key: "insights-time", label: "Time", destination: "insights-time" },
      { key: "insights-balance", label: "Life balance", destination: "insights-balance" },
    ],
  },
];

const SPACES: Array<{ key: PrototypeScope; label: string; tone: string }> = [
  { key: "all", label: "All", tone: "all" },
  { key: "work", label: "Work", tone: "work" },
  { key: "life", label: "Life", tone: "life" },
];
const VIEW_OPTIONS: Array<{ label: ViewMode; helper: string }> = [
  { label: "Today", helper: "Single-day focus" },
  { label: "Week", helper: "Plan the next 7 days" },
  { label: "Month", helper: "Calendar overview" },
  { label: "Year", helper: "Year at a glance" },
];
const SCREEN_LABELS: Record<string, string> = {
  today: "Today", workspace: "Workspace", inbox: "Inbox", tasks: "Tasks", planner: "Planner",
  "planner-year": "Year overview", "planner-month": "Month plan", "planner-week": "Week plan", "planner-day": "Day plan",
  calendar: "Calendar", "calendar-month": "Month view", "calendar-week": "Week view", "calendar-schedule": "Schedule", "calendar-upcoming": "Upcoming",
  goals: "Goals", "goals-active": "Active goals", "goals-review": "Review",
  finance: "Finance", "finance-overview": "Overview", "finance-budget": "Budget", "finance-bills": "Bills",
  routine: "Routine", "routine-habits": "Habits", "routine-reflection": "Reflection",
  insights: "Insights", "insights-overview": "Overview", "insights-productivity": "Productivity", "insights-time": "Time", "insights-balance": "Life balance",
};
const VALID_THEMES = new Set<ThemeKey>(["minimal", "dark", "life", "pro", "spatial"]);
const VIEW_DESTINATIONS = new Set(["today", "planner", "planner-year", "planner-month", "planner-week", "planner-day", "calendar", "calendar-month", "calendar-week"]);
const DEFAULT_ROUTE_STATE: PrototypeRouteState = {
  theme: "minimal", scope: "all", destination: "today", date: PROTOTYPE_DEMO_TODAY, view: "Today", mode: "sample",
};
const TYPE_LABELS: Record<PrototypeRecordType, string> = { task: "Task", event: "Event", bill: "Bill", habit: "Habit", note: "Note" };
const ICON_BY_TYPE: Record<PrototypeRecordType, LucideIcon> = {
  task: ListTodo, event: CalendarDays, bill: WalletCards, habit: Dumbbell, note: StickyNote,
};

function readRouteFromHash(): PrototypeRouteState | null {
  if (typeof window === "undefined" || !window.location.hash) return null;
  const params = new URLSearchParams(window.location.hash.slice(1));
  const destination = params.get("screen");
  const date = params.get("date");
  const theme = params.get("theme") as ThemeKey | null;
  const scope = params.get("scope") as PrototypeScope | null;
  const view = params.get("view") as ViewMode | null;
  const mode = params.get("mode") as DemoMode | null;
  if (!destination || !Object.hasOwn(SCREEN_LABELS, destination)) return null;
  return {
    theme: theme && VALID_THEMES.has(theme) ? theme : DEFAULT_ROUTE_STATE.theme,
    scope: scope === "work" || scope === "life" ? scope : "all",
    destination,
    date: date && parsePrototypeDate(date) ? (date as PrototypeDateKey) : PROTOTYPE_DEMO_TODAY,
    view: VIEW_DESTINATIONS.has(destination) && view && VIEW_OPTIONS.some((item) => item.label === view) ? view : "Today",
    mode: mode === "empty" ? "empty" : "sample",
  };
}

function routeHash(route: PrototypeRouteState): string {
  const params = new URLSearchParams({
    screen: route.destination, date: route.date, scope: route.scope, view: route.view, theme: route.theme, mode: route.mode,
  });
  return "#" + params.toString();
}

function viewForDestination(destination: string, fallback: ViewMode): ViewMode {
  if (destination.includes("year")) return "Year";
  if (destination.includes("month") || destination === "calendar") return "Month";
  if (destination.includes("week")) return "Week";
  if (destination === "today" || destination.includes("day") || destination === "planner") return "Today";
  return VIEW_DESTINATIONS.has(destination) ? fallback : "Today";
}

function destinationForView(destination: string, view: ViewMode): string {
  const plannerDestination: Record<ViewMode, string> = {
    Today: "planner-day",
    Week: "planner-week",
    Month: "planner-month",
    Year: "planner-year",
  };

  if (destination === "today") {
    return view === "Today" ? "today" : plannerDestination[view];
  }

  if (destination === "planner" || destination.startsWith("planner-")) {
    return plannerDestination[view];
  }

  if (destination === "calendar" || destination === "calendar-month" || destination === "calendar-week") {
    if (view === "Week") return "calendar-week";
    if (view === "Month") return "calendar-month";
    return "calendar";
  }

  return destination;
}

function money(value: number | null): string {
  if (value === null) return "No data";
  const fractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function toneClass(tone: PrototypeRecord["tone"]): string {
  return styles[tone] ?? "";
}

function areaLabel(scope: PrototypeItemArea): string {
  if (scope === "work") return "Work";
  if (scope === "life") return "Life";
  return "Area not set";
}

function parseCaptureProposal(
  input: string,
  baseDate: PrototypeDateKey,
  scope: PrototypeScope,
): CaptureProposal | null {
  const raw = input.trim();
  if (!raw) return null;

  let title = raw;
  const signals: string[] = [];
  let dueDate: PrototypeDateKey | undefined;
  let durationMinutes: number | undefined;
  let inferredScope: PrototypeItemArea = scope === "all" ? "unassigned" : scope;
  let projectId: string | undefined;
  let type: CaptureType = "task";

  if (/\b(?:bill|invoice|pay)\b/i.test(raw)) {
    type = "bill";
    signals.push("Bill");
  } else if (/\b(?:note|idea|remember)\b/i.test(raw)) {
    type = "note";
    signals.push("Note");
  } else {
    signals.push("Task");
  }

  if (/\btomorrow\b/i.test(raw)) {
    dueDate = shiftPrototypeDays(baseDate, 1);
    signals.push("Tomorrow");
    title = title.replace(/\btomorrow\b/ig, " ");
  } else if (/\btoday\b/i.test(raw)) {
    dueDate = baseDate;
    signals.push("Today");
    title = title.replace(/\btoday\b/ig, " ");
  }

  const minuteMatch = raw.match(/\b(\d{1,3})\s*(?:m|min|mins|minute|minutes)\b/i);
  const hourMatch = raw.match(/\b(\d{1,2}(?:\.\d)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (minuteMatch) {
    durationMinutes = Number(minuteMatch[1]);
    signals.push(`${durationMinutes}m`);
    title = title.replace(minuteMatch[0], " ");
  } else if (hourMatch) {
    durationMinutes = Math.round(Number(hourMatch[1]) * 60);
    signals.push(formatPrototypeDuration(durationMinutes));
    title = title.replace(hourMatch[0], " ");
  }

  if (/\bwork\b/i.test(raw)) {
    inferredScope = "work";
    signals.push("Work");
    title = title.replace(/\bwork\b/ig, " ");
  } else if (/\blife\b/i.test(raw)) {
    inferredScope = "life";
    signals.push("Life");
    title = title.replace(/\blife\b/ig, " ");
  }

  if (/\b(?:listing|product|etsy)\b/i.test(raw)) {
    projectId = "project-digital-launch";
    signals.push("Digital Product Launch");
  } else if (/\bkemtit\b/i.test(raw)) {
    projectId = "project-kemtit-vnext";
    signals.push("Kemtit Prototype VNext");
  }

  title = title.replace(/\s+/g, " ").trim();
  return {
    title: title || raw,
    type,
    dueDate,
    durationMinutes,
    scope: inferredScope,
    projectId,
    signals,
  };
}

export function PrototypeClient() {
  const [route, setRoute] = useState(DEFAULT_ROUTE_STATE);
  const [records, setRecords] = useState(INITIAL_PROTOTYPE_RECORDS);
  const [goals, setGoals] = useState(INITIAL_PROTOTYPE_GOALS);
  const [ledger, setLedger] = useState(INITIAL_PROTOTYPE_LEDGER);
  const [timeBlocks, setTimeBlocks] = useState(INITIAL_PROTOTYPE_TIME_BLOCKS);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [starterRole, setStarterRole] = useState<StarterRole | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const [command, setCommand] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [activeViewIndex, setActiveViewIndex] = useState(() => Math.max(
    0,
    VIEW_OPTIONS.findIndex((option) => option.label === DEFAULT_ROUTE_STATE.view),
  ));
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [captureDraft, setCaptureDraft] = useState<CaptureDraft | null>(null);
  const captureOpen = captureDraft !== null;
  const [captureError, setCaptureError] = useState("");
  const [captureStatus, setCaptureStatus] = useState("");
  const [toast, setToast] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  const captureDialogRef = useRef<HTMLDialogElement>(null);
  const captureTitleRef = useRef<HTMLInputElement>(null);
  const captureSubmitting = useRef(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const viewTriggerRef = useRef<HTMLButtonElement>(null);
  const viewOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const navigationFromDrawerRef = useRef(false);
  const drawerDismissalRequestedRef = useRef(false);
  const pendingDestinationFocusRef = useRef(false);
  const pendingRecordFocusRef = useRef<string | null>(null);
  const composingRef = useRef(false);
  const nextRecordId = useRef(1);
  const nextBlockId = useRef(1);
  const focusViewOption = useCallback((index: number) => {
    const option = viewOptionRefs.current[index];
    if (!option) return;
    option.focus({ preventScroll: true });
    const menu = viewMenuRef.current;
    if (!menu) return;
    const optionBounds = option.getBoundingClientRect();
    const menuBounds = menu.getBoundingClientRect();
    if (optionBounds.top < menuBounds.top) menu.scrollTop -= menuBounds.top - optionBounds.top;
    else if (optionBounds.bottom > menuBounds.bottom) menu.scrollTop += optionBounds.bottom - menuBounds.bottom;
  }, []);

  const currentTheme = useMemo(() => THEMES.find((item) => item.key === route.theme) ?? THEMES[0], [route.theme]);
  const allVisibleRecords = useMemo(
    () => route.mode === "sample" ? records : records.filter((record) => record.createdInPrototype),
    [records, route.mode],
  );
  const visibleRecords = useMemo(() => getRecordsInScope(allVisibleRecords, route.scope), [allVisibleRecords, route.scope]);
  const visibleGoals = useMemo(
    () => getRecordsInScope(route.mode === "sample" ? goals : [], route.scope),
    [goals, route.mode, route.scope],
  );
  const visibleLedger = useMemo(
    () => getRecordsInScope(route.mode === "sample" ? ledger : [], route.scope),
    [ledger, route.mode, route.scope],
  );
  const visibleTimeBlocks = useMemo(
    () => route.mode === "sample" ? timeBlocks : timeBlocks.filter((block) => block.createdInPrototype),
    [route.mode, timeBlocks],
  );
  const projectById = useMemo(
    () => new Map(INITIAL_PROTOTYPE_PROJECTS.map((project) => [project.id, project])),
    [],
  );
  const dayRecords = useMemo(() => getPrototypeDayRecords(visibleRecords, route.date, "all"), [visibleRecords, route.date]);
  const actionRecords = useMemo(() => getPrototypeActionRecords(visibleRecords, route.date, "all"), [visibleRecords, route.date]);
  const metrics = useMemo(
    () => getPrototypeMetrics(visibleRecords, visibleGoals, visibleLedger, route.date, "all", completedIds),
    [visibleRecords, visibleGoals, visibleLedger, route.date, completedIds],
  );
  const capacity = useMemo(
    () => getPrototypeCapacity(allVisibleRecords, visibleTimeBlocks, route.date),
    [allVisibleRecords, route.date, visibleTimeBlocks],
  );
  const inboxItems = useMemo(
    () => visibleRecords.filter((record) => record.status === "inbox"),
    [visibleRecords],
  );
  const hasLocalRecords = useMemo(
    () => records.some((record) => record.createdInPrototype),
    [records],
  );
  const allUpcoming = useMemo(
    () => getPrototypeUpcomingRecords(visibleRecords, route.date, "all", Number.MAX_SAFE_INTEGER),
    [visibleRecords, route.date],
  );
  const upcoming = useMemo(() => allUpcoming.slice(0, 3), [allUpcoming]);
  const planningCandidates = useMemo(
    () => visibleRecords
      .filter((record) => (
        record.type === "task" &&
        !completedIds.has(record.id) &&
        (record.status === "inbox" || (record.status === "planned" && record.date === route.date)) &&
        !visibleTimeBlocks.some((block) => block.itemId === record.id && block.date === route.date)
      ))
      .slice()
      .sort((left, right) => (left.dueDate ?? left.date).localeCompare(right.dueDate ?? right.date))
      .slice(0, 5),
    [completedIds, route.date, visibleRecords, visibleTimeBlocks],
  );
  const planSuggestions = useMemo(() => {
    const temporaryBlocks = [...visibleTimeBlocks];
    return planningCandidates.flatMap((record) => {
      const durationMinutes = record.durationMinutes ?? 30;
      const startTime = findPrototypeTimeSlot(allVisibleRecords, temporaryBlocks, route.date, durationMinutes);
      if (!startTime) return [];
      const block: PrototypeTimeBlock = {
        id: "proposal-" + record.id,
        itemId: record.id,
        date: route.date,
        startTime,
        durationMinutes,
      };
      temporaryBlocks.push(block);
      return [{ record, block }];
    });
  }, [allVisibleRecords, planningCandidates, route.date, visibleTimeBlocks]);
  const overflowPlanItems = useMemo(() => {
    const scheduledIds = new Set(planSuggestions.map(({ record }) => record.id));
    return planningCandidates.filter((record) => !scheduledIds.has(record.id));
  }, [planSuggestions, planningCandidates]);
  const captureProposal = useMemo(
    () => parseCaptureProposal(command, route.date, route.scope),
    [command, route.date, route.scope],
  );
  const filteredSuggestions = useMemo(() => {
    const query = command.trim().toLocaleLowerCase();
    const candidates = allVisibleRecords.filter((record) => !query || record.title.toLocaleLowerCase().includes(query) || TYPE_LABELS[record.type].toLocaleLowerCase().includes(query));
    return candidates.slice(0, 5);
  }, [allVisibleRecords, command]);
  const matchingTitle = useMemo(
    () => allVisibleRecords.filter((record) => record.title.toLocaleLowerCase() === command.trim().toLocaleLowerCase()),
    [allVisibleRecords, command],
  );

  useEffect(() => {
    if (!commandOpen || activeSuggestion < 0) return;
    const suggestionList = suggestionListRef.current;
    const activeOption = suggestionList?.querySelector<HTMLElement>(`#suggestion-${activeSuggestion}`);
    if (!suggestionList || !activeOption) return;

    const optionTop = activeOption.offsetTop;
    const optionBottom = optionTop + activeOption.offsetHeight;
    const visibleTop = suggestionList.scrollTop;
    const visibleBottom = visibleTop + suggestionList.clientHeight;
    if (optionTop < visibleTop) {
      suggestionList.scrollTop = optionTop;
    } else if (optionBottom > visibleBottom) {
      suggestionList.scrollTop = optionBottom - suggestionList.clientHeight;
    }
  }, [activeSuggestion, commandOpen]);

  const updateRoute = (patch: Partial<PrototypeRouteState>, history: "push" | "replace" = "push") => {
    const next = { ...route, ...patch };
    setRoute(next);
    if (typeof window !== "undefined") {
      const method = history === "push" ? "pushState" : "replaceState";
      window.history[method](null, "", routeHash(next));
    }
  };

  useEffect(() => {
    const initial = readRouteFromHash();
    const frame = initial ? window.requestAnimationFrame(() => setRoute(initial)) : null;
    if (!initial) {
      window.history.replaceState(null, "", routeHash(DEFAULT_ROUTE_STATE));
    }
    const restoreRoute = () => {
      const restored = readRouteFromHash() ?? DEFAULT_ROUTE_STATE;
      setRoute(restored);
      setDrawerOpen(false);
      setCommandOpen(false);
      setViewOpen(false);
    };
    window.addEventListener("popstate", restoreRoute);
    window.addEventListener("hashchange", restoreRoute);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", restoreRoute);
      window.removeEventListener("hashchange", restoreRoute);
    };
  }, []);

  useEffect(() => {
    if (!pendingDestinationFocusRef.current) return;
    pendingDestinationFocusRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelector<HTMLElement>("[data-screen-heading]")?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route]);

  useEffect(() => {
    const recordId = pendingRecordFocusRef.current;
    if (!recordId) return;
    const frame = window.requestAnimationFrame(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('[data-record-id="' + recordId + '"]'));
      const target = candidates.find((element) => element.dataset.testid === "prototype-record-detail") ?? candidates[0];
      if (!target) return;
      pendingRecordFocusRef.current = null;
      target.scrollIntoView({ block: "center", inline: "nearest" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, selectedRecordId, records]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1150px)");
    const update = () => {
      setCompact(media.matches);
      if (!media.matches) setDrawerOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    navigationFromDrawerRef.current = false;
    drawerDismissalRequestedRef.current = false;
    const returnFocusTarget = menuButtonRef.current;
    const drawerElement = drawerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstFrame = window.requestAnimationFrame(() => {
      const firstFocusable = drawerElement?.querySelector<HTMLElement>("button:not([disabled]), a[href], input, select, [tabindex='0']");
      firstFocusable?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !drawerElement) return;
      const focusable = Array.from(drawerElement.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], input, select, [tabindex='0']"))
        .filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(firstFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      const focusWasInsideDrawer = drawerElement?.contains(document.activeElement) ?? false;
      if (
        !navigationFromDrawerRef.current &&
        (drawerDismissalRequestedRef.current || focusWasInsideDrawer) &&
        returnFocusTarget?.isConnected &&
        returnFocusTarget.offsetParent !== null
      ) {
        returnFocusTarget.focus();
      }
      navigationFromDrawerRef.current = false;
      drawerDismissalRequestedRef.current = false;
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!viewOpen) return;
    const selectedIndex = Math.max(0, VIEW_OPTIONS.findIndex((option) => option.label === route.view));
    const frame = window.requestAnimationFrame(() => focusViewOption(selectedIndex));
    return () => window.cancelAnimationFrame(frame);
  }, [viewOpen, route.view, focusViewOption]);

  useEffect(() => {
    const dialog = captureDialogRef.current;
    if (!captureOpen || !dialog || dialog.open) return;
    dialog.showModal();
    captureTitleRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [captureOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (composingRef.current || event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (captureDraft) return;
        if (drawerOpen) setDrawerOpen(false);
        setCommandOpen(true);
        setViewOpen(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      if (event.key === "Escape") {
        if (captureDraft) {
          setCommand(captureDraft.title);
          setCaptureDraft(null);
          setCaptureError("");
          setCaptureStatus("Draft cancelled. The title remains in quick capture.");
          setCommandOpen(true);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        } else if (commandOpen) {
          setCommandOpen(false);
          setActiveSuggestion(-1);
        } else if (viewOpen) {
          setViewOpen(false);
          window.requestAnimationFrame(() => viewTriggerRef.current?.focus());
        } else if (drawerOpen) {
          drawerDismissalRequestedRef.current = true;
          setDrawerOpen(false);
        }
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (commandOpen && !target.closest("[data-command-anchor]")) {
        setCommandOpen(false);
        setActiveSuggestion(-1);
      }
      if (viewOpen && !target.closest("[data-view-anchor]")) {
        setViewOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [captureDraft, commandOpen, drawerOpen, viewOpen]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectDestination = (destination: string, groupKey?: string) => {
    if (!Object.hasOwn(SCREEN_LABELS, destination)) return;
    navigationFromDrawerRef.current = compact && drawerOpen;
    pendingDestinationFocusRef.current = true;
    updateRoute({ destination, view: viewForDestination(destination, route.view) });
    setCommandOpen(false);
    setViewOpen(false);
    setDrawerOpen(false);
    setActiveSuggestion(-1);
    if (groupKey) setOpenGroups((groups) => ({ ...groups, [groupKey]: true }));
  };

  const toggleViewMenu = (open: boolean) => {
    if (open) {
      setActiveViewIndex(Math.max(0, VIEW_OPTIONS.findIndex((option) => option.label === route.view)));
      setCommandOpen(false);
    }
    setViewOpen(open);
  };

  const onViewSelected = (view: ViewMode) => {
    const destination = destinationForView(route.destination, view);
    updateRoute({ view, destination });
    setViewOpen(false);
    window.requestAnimationFrame(() => viewTriggerRef.current?.focus());
  };

  const handleViewMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const direction = event.shiftKey ? -1 : 1;
      const menu = event.currentTarget;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
      )).filter((element) => element.offsetParent !== null && !element.closest("[inert]") && !menu.contains(element));
      const triggerIndex = focusable.indexOf(viewTriggerRef.current as HTMLElement);
      const nextFocus = focusable[triggerIndex + direction];
      setViewOpen(false);
      (nextFocus ?? viewTriggerRef.current)?.focus({ preventScroll: true });
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setViewOpen(false);
      viewTriggerRef.current?.focus({ preventScroll: true });
      return;
    }

    const currentIndex = viewOptionRefs.current.findIndex((option) => option === document.activeElement);
    const index = currentIndex >= 0 ? currentIndex : activeViewIndex;
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (index + 1) % VIEW_OPTIONS.length;
    else if (event.key === "ArrowUp") nextIndex = (index - 1 + VIEW_OPTIONS.length) % VIEW_OPTIONS.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = VIEW_OPTIONS.length - 1;
    if (nextIndex !== null) {
      event.preventDefault();
      setActiveViewIndex(nextIndex);
      focusViewOption(nextIndex);
    }
  };

  const chooseDate = (date: PrototypeDateKey, push = true) => {
    updateRoute({ date }, push ? "push" : "replace");
  };
  const shiftDate = (direction: -1 | 1) => {
    if (route.view === "Week") chooseDate(shiftPrototypeDays(route.date, 7 * direction));
    else if (route.view === "Month") chooseDate(shiftPrototypeMonths(route.date, direction));
    else if (route.view === "Year") chooseDate(shiftPrototypeMonths(route.date, 12 * direction));
    else chooseDate(shiftPrototypeDays(route.date, direction));
  };
  const shiftLabel = route.view === "Week" ? "week" : route.view === "Month" ? "month" : route.view === "Year" ? "year" : "day";

  const toggleCompleted = (id: string) => {
    setCompletedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markBillPaid = (record: PrototypeRecord) => {
    if (record.type !== "bill" || record.amount === undefined || record.scope === "unassigned") return;
    const paymentScope: PrototypeRecordScope = record.scope;
    const paymentId = "payment-" + record.id;
    if (ledger.some((entry) => entry.id === paymentId)) {
      setToast("This bill already has a recorded payment.");
      return;
    }
    setLedger((current) => [...current, {
      id: paymentId,
      title: record.title,
      date: route.date,
      scope: paymentScope,
      direction: "expense",
      amount: record.amount!,
    }]);
    setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: "done" as const } : item));
    setToast("Payment recorded: " + record.title);
  };

  const openCapture = (initialTitle = "", type: CaptureType = "task", proposal?: CaptureProposal) => {
    captureSubmitting.current = false;
    setEditingRecordId(null);
    setCommand(proposal?.title ?? initialTitle);
    setCommandOpen(false);
    setViewOpen(false);
    setDrawerOpen(false);
    setActiveSuggestion(-1);
    setCaptureError("");
    setCaptureStatus("");
    setCaptureDraft({
      title: proposal?.title ?? initialTitle,
      type: proposal?.type ?? type,
      date: route.date,
      dueDate: proposal?.dueDate ?? "",
      scope: proposal?.scope && proposal.scope !== "unassigned" ? proposal.scope : route.scope === "all" ? "" : route.scope,
      projectId: proposal?.projectId ?? "",
      amount: "",
      startTime: "09:00",
      durationMinutes: String(proposal?.durationMinutes ?? 30),
      recurrence: "",
      reminderMinutes: "",
    });
  };

  const reviewInboxRecord = (record: PrototypeRecord) => {
    captureSubmitting.current = false;
    setEditingRecordId(record.id);
    setCommand(record.title);
    setCommandOpen(false);
    setViewOpen(false);
    setDrawerOpen(false);
    setCaptureError("");
    setCaptureStatus("");
    setCaptureDraft({
      title: record.title,
      type: record.type,
      date: route.date,
      dueDate: record.dueDate ?? "",
      scope: record.scope === "unassigned" ? "" : record.scope,
      projectId: record.projectId ?? "",
      amount: record.amount === undefined ? "" : String(record.amount),
      startTime: record.startTime ?? "09:00",
      durationMinutes: String(record.durationMinutes ?? 30),
      recurrence: record.recurrence ?? "",
      reminderMinutes: record.reminderMinutes === undefined ? "" : String(record.reminderMinutes),
    });
  };

  const updateCaptureDraft = (patch: Partial<CaptureDraft>) => {
    setCaptureDraft((current) => current ? { ...current, ...patch } : current);
    setCaptureError("");
  };

  const openQuickCapture = (initialTitle = "") => {
    setCommand(initialTitle);
    setCommandOpen(true);
    setViewOpen(false);
    setDrawerOpen(false);
    setActiveSuggestion(-1);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const cancelCapture = () => {
    setCommand(captureDraft?.title ?? command);
    setCaptureDraft(null);
    setEditingRecordId(null);
    setCaptureError("");
    setCaptureStatus("Draft cancelled. The title remains in quick capture.");
    setCommandOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const openExistingRecord = (record: PrototypeRecord) => {
    const destinationByType: Record<PrototypeRecordType, string> = {
      task: "tasks", event: "calendar-schedule", bill: "finance-bills", habit: "routine-habits", note: "inbox",
    };
    const destination = destinationByType[record.type];
    pendingRecordFocusRef.current = record.id;
    setSelectedRecordId(record.id);
    updateRoute({ date: record.date, scope: record.scope === "unassigned" ? "all" : record.scope, destination, view: viewForDestination(destination, route.view) });
    setCommandOpen(false);
    setCommand("");
    setToast("Opened existing demo item: " + record.title);
  };

  const confirmCapture = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!captureDraft || captureSubmitting.current) return;
    const title = captureDraft.title.trim();
    const date = parsePrototypeDate(captureDraft.date);
    const dueDate = captureDraft.dueDate ? parsePrototypeDate(captureDraft.dueDate) : null;
    const scope: PrototypeItemArea | "" = captureDraft.scope || (captureDraft.type === "note" ? "unassigned" : "");
    if (!title) {
      setCaptureError("Enter a title before adding this demo item.");
      return;
    }
    if (!date) {
      setCaptureError("Choose a valid plan date.");
      return;
    }
    if (captureDraft.dueDate && !dueDate) {
      setCaptureError("Choose a valid due date.");
      return;
    }
    if (!scope) {
      setCaptureError("Choose Work or Life area before planning this item.");
      return;
    }
    const amountText = captureDraft.amount.trim();
    const amount = amountText ? Number(amountText) : undefined;
    const hasCurrencyPrecision = /^\d+(?:\.\d{1,2})?$/.test(amountText);
    if (captureDraft.type === "bill" && (amount === undefined || !Number.isFinite(amount) || amount < 0.01 || !hasCurrencyPrecision)) {
      setCaptureError("Enter a bill amount of at least ฿0.01 with up to two decimal places.");
      return;
    }
    const duration = Number(captureDraft.durationMinutes);
    if ((captureDraft.type === "task" || captureDraft.type === "event" || captureDraft.type === "habit") && (!captureDraft.durationMinutes.trim() || !Number.isFinite(duration) || duration < 0)) {
      setCaptureError("Enter a valid duration in minutes.");
      return;
    }
    const reminderMinutes = captureDraft.reminderMinutes.trim() ? Number(captureDraft.reminderMinutes) : undefined;
    if (reminderMinutes !== undefined && (!Number.isFinite(reminderMinutes) || reminderMinutes < 0)) {
      setCaptureError("Enter a valid reminder lead time.");
      return;
    }
    if (captureDraft.type === "event" && !captureDraft.startTime) {
      setCaptureError("Choose a start time for this event.");
      return;
    }
    if (captureDraft.type === "event" && duration <= 0) {
      setCaptureError("Event duration must be greater than zero.");
      return;
    }

    captureSubmitting.current = true;
    const recordType = captureDraft.type as PrototypeRecordType;
    const existing = editingRecordId ? records.find((record) => record.id === editingRecordId) : undefined;
    const project = captureDraft.projectId ? projectById.get(captureDraft.projectId) : undefined;
    const tone: PrototypeRecord["tone"] = recordType === "bill" ? "finance" : recordType === "habit" ? "health" : scope === "work" ? "work" : "personal";
    const record: PrototypeRecord = {
      ...(existing ?? {}),
      id: existing?.id ?? "prototype-created-" + nextRecordId.current++,
      type: recordType,
      title,
      date: toPrototypeDateKey(date),
      dueDate: dueDate ? toPrototypeDateKey(dueDate) : undefined,
      scope,
      tone,
      status: recordType === "note" ? "inbox" : "planned",
      projectId: captureDraft.projectId || undefined,
      goalId: project?.goalId ?? existing?.goalId,
      createdInPrototype: existing?.createdInPrototype ?? true,
      recurrence: captureDraft.recurrence.trim() || undefined,
      reminderMinutes,
      ...(recordType === "bill" ? { amount } : { amount: undefined }),
      ...(recordType === "event" ? { startTime: captureDraft.startTime, durationMinutes: duration } : { startTime: undefined }),
      ...(recordType === "task" || recordType === "habit" ? { durationMinutes: duration } : recordType === "event" ? {} : { durationMinutes: undefined }),
    };

    setRecords((current) => existing
      ? current.map((item) => item.id === existing.id ? record : item)
      : [...current, record]);
    pendingRecordFocusRef.current = record.id;
    setSelectedRecordId(record.id);
    setCaptureDraft(null);
    setEditingRecordId(null);
    setCaptureError("");
    setCommand("");
    const destination = record.type === "note" ? "inbox" : record.type === "bill" ? "finance-bills" : record.type === "event" ? "calendar-schedule" : record.type === "habit" ? "routine-habits" : "tasks";
    updateRoute({ date: record.date, scope: record.scope === "unassigned" ? "all" : record.scope, destination, view: viewForDestination(destination, route.view) });
    setDrawerOpen(false);
    setCaptureStatus((existing ? "Updated “" : "Added “") + title + "” in this local visual prototype.");
    setToast((existing ? "Updated demo item: " : "Added demo item: ") + title);
  };

  const addProposalToInbox = (proposal: CaptureProposal) => {
    const record: PrototypeRecord = {
      id: "prototype-created-" + nextRecordId.current++,
      type: proposal.type,
      title: proposal.title,
      date: route.date,
      dueDate: proposal.dueDate,
      scope: proposal.scope,
      tone: proposal.type === "bill" ? "finance" : proposal.scope === "work" ? "work" : "personal",
      status: "inbox",
      projectId: proposal.projectId,
      goalId: proposal.projectId ? projectById.get(proposal.projectId)?.goalId : undefined,
      durationMinutes: proposal.type === "task" ? proposal.durationMinutes : undefined,
      createdInPrototype: true,
    };
    setRecords((current) => [...current, record]);
    setCommand("");
    setCommandOpen(false);
    setActiveSuggestion(-1);
    setToast("Added to Inbox: " + record.title);
    updateRoute({ destination: "inbox", scope: record.scope === "unassigned" ? "all" : record.scope, view: "Today" });
  };

  const applyStarterWorkspace = () => {
    if (!starterRole) return;
    const starter = STARTER_WORKSPACES[starterRole];
    const created = starter.items.map((item) => ({
      id: "prototype-created-" + nextRecordId.current++,
      type: item.type,
      title: item.title,
      date: route.date,
      scope: item.scope,
      tone: item.tone,
      status: item.status,
      durationMinutes: item.durationMinutes,
      recurrence: item.recurrence,
      createdInPrototype: true,
    } satisfies PrototypeRecord));
    setRecords((current) => [...current, ...created]);
    setStarterRole(null);
    setToast("Starter workspace created from your confirmed suggestions.");
  };

  const confirmPreparedPlan = () => {
    if (!planSuggestions.length) {
      setPlanOpen(false);
      return;
    }
    const blocks = planSuggestions.map(({ record, block }) => ({
      ...block,
      id: "prototype-block-" + nextBlockId.current++,
      createdInPrototype: true,
    }));
    const plannedIds = new Set(blocks.map((block) => block.itemId));
    setTimeBlocks((current) => [...current, ...blocks]);
    setRecords((current) => current.map((record) => plannedIds.has(record.id)
      ? { ...record, date: route.date, status: "planned" as const }
      : record));
    setPlanOpen(false);
    setToast(`Planned ${blocks.length} item${blocks.length === 1 ? "" : "s"} into available time.`);
  };

  const resetDemoData = () => {
    setRecords(INITIAL_PROTOTYPE_RECORDS);
    setGoals(INITIAL_PROTOTYPE_GOALS);
    setLedger(INITIAL_PROTOTYPE_LEDGER);
    setTimeBlocks(INITIAL_PROTOTYPE_TIME_BLOCKS);
    setCompletedIds(new Set());
    setSelectedRecordId(null);
    setEditingRecordId(null);
    setPlanOpen(false);
    setStarterRole(null);
    setCaptureStatus("");
    nextRecordId.current = 1;
    nextBlockId.current = 1;
    updateRoute({ mode: "sample", scope: "all", date: PROTOTYPE_DEMO_TODAY }, "replace");
    setToast("Demo fixtures restored. Changes in this prototype are local only.");
  };

  const toggleDemoMode = () => {
    updateRoute({ mode: route.mode === "sample" ? "empty" : "sample" }, "replace");
  };

  const dayRecordsFor = (date: PrototypeDateKey) => getPrototypeDayRecords(visibleRecords, date, "all");
  const eventRecordsFor = (date: PrototypeDateKey) => dayRecordsFor(date).filter((record) => record.type === "event" && record.startTime);

  const EmptyState = ({
    title,
    detail,
    action,
    captureType = "task",
    className = "",
    variant = "embedded",
  }: {
    title: string;
    detail: string;
    action?: string;
    captureType?: CaptureType;
    className?: string;
    variant?: "embedded" | "standalone";
  }) => (
    <div className={styles.emptyState + (variant === "standalone" ? " " + styles.emptyStateStandalone : "") + (className ? " " + className : "")}>
      <span className={styles.widgetIcon}><Layers3 size={17} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action ? <button type="button" onClick={() => captureType === "task" ? openQuickCapture() : openCapture("", captureType)}><Plus size={14} />{action}</button> : null}
    </div>
  );

  const PanelHeader = ({ title, action, onAction, unsupportedAction }: { title: string; action?: string; onAction?: () => void; unsupportedAction?: UnsupportedAction }) => (
    <div className={styles.panelHeader}>
      <h3>{title}</h3>
      {action ? unsupportedAction ? <span className={styles.disabledActionGroup}>
        <button type="button" disabled aria-describedby={unsupportedAction.reasonId}>{action}</button>
        <small className={styles.disabledActionReason} id={unsupportedAction.reasonId}>{unsupportedAction.reason}</small>
      </span> : <button type="button" onClick={onAction}>{action}<ArrowRight size={13} /></button> : null}
    </div>
  );

  const ActionList = ({
    items,
    title,
    captureType = "task",
    unsupportedAction,
    panelClassName = "",
    emptyState,
    hideHeaderActionWhenEmpty = true,
    actionLabel = "Add item",
  }: {
    items: PrototypeRecord[];
    title: string;
    captureType?: CaptureType;
    unsupportedAction?: UnsupportedAction;
    panelClassName?: string;
    emptyState?: { title: string; detail: string; action?: string; className?: string };
    hideHeaderActionWhenEmpty?: boolean;
    actionLabel?: string;
  }) => (
    <section className={styles.panel + (panelClassName ? " " + panelClassName : "")}>
      {PanelHeader({
        title,
        action: unsupportedAction?.label ?? (hideHeaderActionWhenEmpty && !items.length ? undefined : actionLabel),
        onAction: () => captureType === "task" ? openQuickCapture() : openCapture("", captureType),
        unsupportedAction,
      })}
      {items.length ? (
        <div className={styles.taskList}>
          {items.map((record) => {
            const canComplete = record.type === "task" || record.type === "habit";
            const done = completedIds.has(record.id);
            const Icon = ICON_BY_TYPE[record.type];
            return (
              <button key={record.id} type="button" className={styles.taskRow} onClick={() => canComplete ? toggleCompleted(record.id) : openExistingRecord(record)} data-testid={canComplete ? "task-row" : "prototype-record-row"} data-record-id={record.id} data-completed={canComplete ? String(done) : undefined} aria-pressed={canComplete ? done : undefined}>
                <span className={done ? styles.checkDone : styles.check}>{done ? <Check size={13} /> : <Circle size={13} />}</span>
                <span className={styles.taskText}>
                  <strong className={done ? styles.taskDone : undefined}>{record.title}</strong>
                  <small><span className={styles.domainDot + " " + toneClass(record.tone)} />{TYPE_LABELS[record.type]} · {areaLabel(record.scope)}{record.dueDate ? " · due " + formatPrototypeDate(record.dueDate, { month: "short", day: "numeric" }) : ""}{record.recurrence ? " · " + record.recurrence : ""}{record.status === "done" ? record.type === "bill" ? " · Paid" : " · Done" : ""}</small>
                </span>
                <span className={styles.duration}>{record.durationMinutes ? formatPrototypeDuration(record.durationMinutes) : <Icon size={14} />}</span>
              </button>
            );
          })}
        </div>
      ) : EmptyState({
        title: emptyState?.title ?? (unsupportedAction ? "No habits for this date" : "Nothing here yet"),
        detail: emptyState?.detail ?? unsupportedAction?.reason ?? "There are no matching demo items for this date and scope.",
        action: unsupportedAction ? undefined : emptyState?.action ?? "Capture an item",
        captureType,
        className: emptyState?.className,
      })}
      {selectedRecordId && items.some((record) => record.id === selectedRecordId) ? (() => {
        const selectedRecord = items.find((record) => record.id === selectedRecordId);
        if (!selectedRecord) return null;
        const project = selectedRecord.projectId ? projectById.get(selectedRecord.projectId) : undefined;
        const blocks = visibleTimeBlocks.filter((block) => block.itemId === selectedRecord.id);
        return <article className={styles.recordDetail} data-testid="prototype-record-detail" data-record-id={selectedRecord.id} tabIndex={-1}>
          <span className={styles.widgetEyebrow}>{TYPE_LABELS[selectedRecord.type]} · {areaLabel(selectedRecord.scope)}</span>
          <h3>{selectedRecord.title}</h3>
          <div className={styles.detailGrid}>
            <span><small>Plan date</small><strong>{formatPrototypeDate(selectedRecord.date, { month: "short", day: "numeric" })}</strong></span>
            <span><small>Due</small><strong>{selectedRecord.dueDate ? formatPrototypeDate(selectedRecord.dueDate, { month: "short", day: "numeric" }) : "Not set"}</strong></span>
            <span><small>Estimate</small><strong>{selectedRecord.durationMinutes ? formatPrototypeDuration(selectedRecord.durationMinutes) : "Not set"}</strong></span>
            <span><small>Project</small><strong>{project?.title ?? "Not linked"}</strong></span>
            <span><small>Repeat</small><strong>{selectedRecord.recurrence ?? "Does not repeat"}</strong></span>
            <span><small>Reminder</small><strong>{selectedRecord.reminderMinutes ? formatPrototypeDuration(selectedRecord.reminderMinutes) + " before" : "Not set"}</strong></span>
          </div>
          {blocks.length ? <div className={styles.detailSchedule}><small>Scheduled</small>{blocks.map((block) => <span key={block.id}>{formatPrototypeDate(block.date, { weekday: "short", month: "short", day: "numeric" })} · {block.startTime} · {formatPrototypeDuration(block.durationMinutes)}</span>)}</div> : <p className={styles.detailMuted}>Not scheduled into a time block yet.</p>}
          {selectedRecord.amount !== undefined ? <p>{money(selectedRecord.amount)}</p> : null}
          <div className={styles.detailActions}>{selectedRecord.type === "bill" && selectedRecord.status !== "done" ? <button type="button" className={styles.detailPrimary} onClick={() => markBillPaid(selectedRecord)}>Mark as paid</button> : null}{selectedRecord.type !== "habit" ? <button type="button" onClick={() => reviewInboxRecord(selectedRecord)}>Edit planning</button> : null}<button type="button" onClick={() => setSelectedRecordId(null)}>Close details</button></div>
        </article>;
      })() : null}
    </section>
  );

  const EventList = ({ items, title }: { items: PrototypeRecord[]; title: string }) => {
    const blocks = visibleTimeBlocks
      .filter((block) => block.date === route.date)
      .flatMap((block) => {
        const record = visibleRecords.find((item) => item.id === block.itemId);
        return record ? [{ block, record }] : [];
      });
    const scheduleRows = [
      ...items.map((record) => ({ key: "event-" + record.id, startTime: record.startTime ?? "", record, durationMinutes: record.durationMinutes ?? 0, kind: "event" as const })),
      ...blocks.map(({ block, record }) => ({ key: "block-" + block.id, startTime: block.startTime, record, durationMinutes: block.durationMinutes, kind: "block" as const })),
    ].sort((left, right) => left.startTime.localeCompare(right.startTime));

    return <section className={styles.panel}>
      {PanelHeader({ title, action: scheduleRows.length ? "Add event" : undefined, onAction: () => openCapture("", "event") })}
      {scheduleRows.length ? <div className={styles.timeline}>
        {scheduleRows.map((row) => <div className={styles.timelineRow} key={row.key}>
          <time>{row.startTime}</time>
          <button type="button" className={styles.timelineEvent + " " + (row.kind === "block" ? styles.timelineTaskBlock : styles["event_" + row.record.tone])} onClick={() => openExistingRecord(row.record)} data-record-id={row.record.id}>
            <span>{row.record.title}</span><small>{row.kind === "block" ? "Task block" : "Event"} · {formatPrototypeDuration(row.durationMinutes)}</small>
          </button>
        </div>)}
      </div> : EmptyState({ title: "No scheduled items", detail: "Events and task time blocks will appear here.", action: "Add event", captureType: "event" })}
      {selectedRecordId && items.some((record) => record.id === selectedRecordId) ? (() => {
        const selectedEvent = items.find((record) => record.id === selectedRecordId);
        if (!selectedEvent) return null;
        return <article className={styles.recordDetail} data-testid="prototype-record-detail" data-record-id={selectedEvent.id} tabIndex={-1}>
          <span className={styles.widgetEyebrow}>Event · {areaLabel(selectedEvent.scope)}</span>
          <h3>{selectedEvent.title}</h3>
          <p>{formatPrototypeDate(selectedEvent.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · {selectedEvent.startTime}{selectedEvent.durationMinutes ? " · " + formatPrototypeDuration(selectedEvent.durationMinutes) : ""}</p>
          <button type="button" onClick={() => setSelectedRecordId(null)}>Close details</button>
        </article>;
      })() : null}
    </section>;
  };

  const GoalList = ({ items }: { items: PrototypeGoal[] }) => (
    <section className={styles.panel}>
      {PanelHeader({ title: "Goals" })}
      {items.length ? items.map((goal) => {
        const linkedProjects = INITIAL_PROTOTYPE_PROJECTS.filter((project) => project.goalId === goal.id);
        const linkedTasks = visibleRecords.filter((record) => record.goalId === goal.id && record.type === "task");
        return <div className={styles.goalRow} key={goal.id} data-goal-id={goal.id}>
          <div><strong>{goal.title}</strong><span>{goal.progress}%</span></div>
          <small>{linkedProjects.length} project{linkedProjects.length === 1 ? "" : "s"} · {linkedTasks.length} linked task{linkedTasks.length === 1 ? "" : "s"}</small>
          <div className={styles.progressTrack}><span style={{ width: goal.progress + "%" }} /></div>
        </div>;
      }) : EmptyState({ title: "No goal data", detail: "Goals are hidden in the empty workspace mode." })}
      <small className={styles.unsupportedReason}>Goal editing is outside this prototype.</small>
    </section>
  );

  const MiniCalendar = ({ compactFooter = false }: { compactFooter?: boolean } = {}) => {
    const cells = getPrototypeMonthCells(route.date);
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return (
      <section className={styles.panel + " " + styles.calendarWidget}>
        <div className={styles.calendarHeader}>
          <div><span className={styles.widgetEyebrow}>Calendar</span><h3>{formatPrototypeMonth(route.date)}</h3></div>
          <div className={styles.calendarControls}>
            <button type="button" aria-label="Previous month" onClick={() => chooseDate(shiftPrototypeMonths(route.date, -1))}><ChevronLeft size={15} /></button>
            <button type="button" className={styles.todayButton} onClick={() => chooseDate(PROTOTYPE_DEMO_TODAY)}>Demo today</button>
            <button type="button" aria-label="Next month" onClick={() => chooseDate(shiftPrototypeMonths(route.date, 1))}><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className={styles.calendarWeekdays} aria-hidden="true">{days.map((day) => <span key={day}>{day}</span>)}</div>
        <div className={styles.calendarGrid}>
          {cells.map((date, index) => {
            if (!date) return <span key={"blank-" + index} className={styles.calendarEmpty} />;
            const dayRecords = dayRecordsFor(date);
            const selected = date === route.date;
            const tone = dayRecords[0]?.tone;
            return (
              <button key={date} type="button" className={selected ? styles.calendarDayActive : styles.calendarDay} onClick={() => chooseDate(date)} aria-label={formatPrototypeDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} aria-pressed={selected}>
                <span>{Number(date.slice(-2))}</span>
                {dayRecords.length ? <span className={styles.eventDots} aria-label={dayRecords.length + " demo items"}><i className={styles["calendarDot_" + (tone === "finance" ? "finance" : tone === "health" ? "health" : tone === "work" ? "work" : "personal")]} /></span> : null}
              </button>
            );
          })}
        </div>
        <div className={styles.calendarFooter}>
          <span>{dayRecordsFor(route.date).length} demo item{dayRecordsFor(route.date).length === 1 ? "" : "s"}</span>
          {!compactFooter ? <strong>{formatPrototypeDate(route.date, { weekday: "short", month: "short", day: "numeric" })}</strong> : null}
        </div>
      </section>
    );
  };

  const renderDayView = () => (
    <>
      {route.mode === "empty" && !hasLocalRecords ? <section className={styles.panel + " " + styles.starterWorkspace} data-testid="starter-workspace">
        <span className={styles.widgetEyebrow}>Suggested starter · nothing is added until you confirm</span>
        <div className={styles.starterHeading}><div><h3>Start with a useful workspace, not fake data</h3><p>Choose a starting pattern. You can edit or remove these local prototype items afterward.</p></div><Sparkles size={20} /></div>
        <div className={styles.starterRoles}>
          {(Object.keys(STARTER_WORKSPACES) as StarterRole[]).map((role) => {
            const starter = STARTER_WORKSPACES[role];
            return <button type="button" key={role} className={starterRole === role ? styles.starterRoleActive : styles.starterRole} aria-pressed={starterRole === role} onClick={() => setStarterRole(role)}><strong>{starter.label}</strong><small>{starter.detail}</small></button>;
          })}
        </div>
        {starterRole ? <div className={styles.starterPreview}>
          <strong>Suggested items</strong>
          <div>{STARTER_WORKSPACES[starterRole].items.map((item) => <span key={item.title}><Check size={13} /><span><strong>{item.title}</strong><small>{TYPE_LABELS[item.type]} · {areaLabel(item.scope)}{item.recurrence ? " · " + item.recurrence : ""}</small></span></span>)}</div>
          <div className={styles.starterActions}><button type="button" onClick={() => setStarterRole(null)}>Cancel</button><button type="button" className={styles.starterConfirm} onClick={applyStarterWorkspace}>Create starter workspace</button></div>
        </div> : null}
      </section> : null}
      <div className={styles.metrics}>
        <Metric icon={ListTodo} value={metrics.taskCount ? metrics.completedTaskCount + "/" + metrics.taskCount : "No data"} label="Tasks complete" />
        <Metric icon={Clock3} value={route.mode === "empty" && !dayRecords.length ? "No data" : formatPrototypeDuration(metrics.focusMinutes)} label="Estimated focus" />
        <Metric icon={Goal} value={metrics.goalProgress === null ? "No data" : metrics.goalProgress + "%"} label="Goal progress" />
        <Metric icon={Gauge} value={formatPrototypeDuration(capacity.freeMinutes)} label="Free capacity" />
      </div>
      <div className={styles.primaryGrid}>
        {ActionList({ items: actionRecords, title: "Today’s focus" })}
        {EventList({ items: eventRecordsFor(route.date), title: "Today’s schedule" })}
        <section className={styles.panel + " " + styles.contextPanel} data-testid="plan-day-panel">
          {PanelHeader({ title: "Plan my day" })}
          {planOpen ? <div className={styles.planProposal}>
            <div className={styles.planSummary}><strong>{planSuggestions.length ? "Prepared from your available time" : "No schedulable items found"}</strong><span>{formatPrototypeDuration(capacity.freeMinutes)} free before this proposal</span></div>
            {planSuggestions.length ? <div className={styles.planItems}>{planSuggestions.map(({ record, block }) => <div key={record.id} className={styles.planItem}><span><strong>{record.title}</strong><small>{block.startTime} · {formatPrototypeDuration(block.durationMinutes)}{record.dueDate ? " · due " + formatPrototypeDate(record.dueDate, { month: "short", day: "numeric" }) : ""}</small></span><Check size={15} /></div>)}</div> : <p className={styles.panelCopy}>Capture something into Inbox or leave a task unscheduled to see a proposal.</p>}
            <div className={styles.planActions}><button type="button" onClick={() => setPlanOpen(false)}>Cancel</button><button type="button" className={styles.planConfirm} disabled={!planSuggestions.length} onClick={confirmPreparedPlan}>Confirm plan</button></div>
          </div> : <div className={styles.planStarter}>
            <Sparkles size={22} />
            <strong>{inboxItems.length ? inboxItems.length + " item" + (inboxItems.length === 1 ? "" : "s") + " waiting in Inbox" : "Your plan is organized"}</strong>
            <span>Prepare available slots around fixed events and existing time blocks.</span>
            <button type="button" onClick={() => setPlanOpen(true)}>Prepare plan</button>
          </div>}
        </section>
      </div>
      <div className={styles.utilityGrid}>
        {MiniCalendar()}
        <div className={styles.utilityStack}>
          <section className={styles.widgetCard}>
            <div className={styles.widgetHeading}>
              <span className={styles.widgetIcon}><Gauge size={16} /></span>
              <div><strong>Day capacity</strong><small>09:00–18:00 · includes all visible and hidden-area commitments</small></div>
              <span className={styles.capacityValue}>{formatPrototypeDuration(capacity.freeMinutes)} free</span>
            </div>
            <div className={styles.capacityTrack}><span style={{ width: capacity.totalMinutes ? Math.min(100, Math.round(capacity.bookedMinutes / capacity.totalMinutes * 100)) + "%" : "0%" }} /></div>
            <div className={styles.capacityLegend}><span><i className={styles.capacityBooked} />{formatPrototypeDuration(capacity.bookedMinutes)} booked</span><span>{formatPrototypeDuration(capacity.bufferMinutes)} buffer</span></div>
          </section>
          <section className={styles.widgetCard}>
            <div className={styles.widgetHeading}>
              <span className={styles.widgetIcon}><CalendarRange size={16} /></span>
              <div><strong>Coming up</strong><small>Next three visible demo items</small></div>
              <button type="button" className={styles.widgetAction} onClick={() => selectDestination("calendar-upcoming")}>See all</button>
            </div>
            {upcoming.length ? <div className={styles.upcomingList}>{upcoming.map((record) => <button type="button" key={record.id} className={styles.upcomingItem} onClick={() => openExistingRecord(record)}><span className={styles.dateTile}><strong>{(record.dueDate ?? record.date).slice(-2)}</strong><small>{formatPrototypeDate(record.dueDate ?? record.date, { weekday: "short" })}</small></span><span className={styles.upcomingText}><strong>{record.title}</strong><small>{TYPE_LABELS[record.type]} · {areaLabel(record.scope)}</small></span><ChevronRight size={14} /></button>)}</div> : EmptyState({ title: "Nothing coming up", detail: "No later demo items match this scope." })}
          </section>
          {!dismissedSuggestion && inboxItems.length ? <section className={styles.smartWidget}>
            <span className={styles.smartOrb}><Lightbulb size={18} /></span>
            <div><small>Needs attention</small><strong>{inboxItems[0].title}</strong><p>{inboxItems[0].dueDate ? "Due " + formatPrototypeDate(inboxItems[0].dueDate, { weekday: "short", month: "short", day: "numeric" }) : "Still needs planning"} · {inboxItems[0].durationMinutes ? formatPrototypeDuration(inboxItems[0].durationMinutes) + " estimate" : "No estimate"}</p></div>
            <div className={styles.smartActions}><button type="button" onClick={() => setDismissedSuggestion(true)}>Not now</button><button type="button" className={styles.smartPrimary} onClick={() => selectDestination("inbox")}>Review</button></div>
          </section> : null}
        </div>
      </div>
      <div className={styles.secondaryGrid}>
        {WeekRhythm()}
        {GoalList({ items: visibleGoals })}
        <section className={styles.insightCard}><Lightbulb size={22} /><span>Reflection</span><strong>{dayRecords.length ? "Review the visible plan and adjust it to your capacity." : "Add demo items to see a planning reflection."}</strong><small>Derived from local prototype data · no production data</small></section>
      </div>
    </>
  );

  const renderWeekView = () => {
    const weekDates = getPrototypeWeekDates(route.date);
    const weekFocus = getPrototypeWeekFocus(visibleRecords, route.date, "all");
    const weekMinutes = weekFocus.reduce((total, item) => total + item.minutes, 0);
    const dueInWeek = visibleRecords.filter((record) => record.dueDate && weekDates.includes(record.dueDate) && record.status !== "done").length;
    return <>
      <section className={styles.panel + " " + styles.weekOverview}>
        {PanelHeader({ title: "Week capacity" })}
        <div className={styles.reviewStats}><span><strong>{formatPrototypeDuration(weekMinutes)}</strong><small>estimated work + events</small></span><span><strong>{dueInWeek}</strong><small>items due this week</small></span><span><strong>{inboxItems.length}</strong><small>items still in Inbox</small></span></div>
      </section>
      <PrototypeWeekBoard
        key={`${weekDates[0]}:${route.scope}:${route.mode}:${route.destination}`}
        days={weekDates.map((date) => ({ date, records: dayRecordsFor(date) }))}
        selectedDate={route.date}
        timeBlocks={visibleTimeBlocks}
        completedIds={completedIds}
        onSelectDate={chooseDate}
        onToggleComplete={toggleCompleted}
        onOpenRecord={openExistingRecord}
        onOpenCalendar={(date) => {
          pendingDestinationFocusRef.current = true;
          updateRoute({ date, view: "Today", destination: "calendar-schedule" });
        }}
      />
    </>;
  };

  const renderMonthView = () => <div className={styles.monthViewGrid} data-testid="prototype-month-view-grid">
    {MiniCalendar({ compactFooter: true })}
    {ActionList({
      items: dayRecords,
      title: "Selected day",
      panelClassName: styles.selectedDayPanel,
      emptyState: {
        title: "Nothing planned yet",
        detail: "No items are planned for this selected day.",
        action: "Add item",
        className: styles.selectedDayEmpty,
      },
      hideHeaderActionWhenEmpty: true,
    })}
  </div>;

  const renderYearView = () => {
    const year = Number(route.date.slice(0, 4));
    const activeProjects = INITIAL_PROTOTYPE_PROJECTS.filter((project) => route.scope === "all" || project.scope === route.scope);
    return <>
      <section className={styles.panel + " " + styles.yearStrategy}>
        {PanelHeader({ title: year + " priorities" })}
        <div className={styles.strategyGrid}>
          {visibleGoals.map((goal) => <div className={styles.strategyItem} key={goal.id}><span className={styles.widgetIcon}><Goal size={15} /></span><span><strong>{goal.title}</strong><small>Goal · {goal.progress}% fixture progress</small></span></div>)}
          {activeProjects.map((project) => <div className={styles.strategyItem} key={project.id}><span className={styles.widgetIcon}><Layers3 size={15} /></span><span><strong>{project.title}</strong><small>Project · {project.status}</small></span></div>)}
        </div>
      </section>
      <div className={styles.yearGrid}>{Array.from({ length: 12 }, (_, index) => {
        const first = toPrototypeDateKey(new Date(year, index, 1));
        const cells = getPrototypeMonthCells(first);
        return <section className={styles.panel + " " + styles.yearMonth} key={first}>
          <button type="button" onClick={() => updateRoute({ date: first, view: "Month", destination: destinationForView(route.destination, "Month") })} aria-label={new Date(year, index, 1).toLocaleString("en-US", { month: "long", year: "numeric" })}>{new Date(year, index, 1).toLocaleString("en-US", { month: "long" })}</button>
          <div className={styles.yearMonthDays}>{cells.map((date, cellIndex) => date ? <button type="button" key={date} aria-label={formatPrototypeDate(date, { month: "long", day: "numeric", year: "numeric" })} className={date === route.date ? styles.yearDateActive : ""} onClick={() => updateRoute({ date, view: "Month", destination: destinationForView(route.destination, "Month") })}>{Number(date.slice(-2))}</button> : <span key={"blank" + cellIndex} />)}</div>
        </section>;
      })}</div>
    </>;
  };

  const renderPlannerSurface = () => {
    if (route.view === "Week") return renderWeekView();
    if (route.view === "Month") return renderMonthView();
    if (route.view === "Year") return renderYearView();
    return renderDayView();
  };

  const renderFinance = () => {
    const bills = visibleRecords.filter((record) => record.type === "bill").sort((a, b) => a.date.localeCompare(b.date));
    const openBills = bills.filter((record) => record.status !== "done");
    const month = route.date.slice(0, 7);
    const entries = visibleLedger.filter((entry) => entry.date.startsWith(month));
    const expenses = entries.filter((entry) => entry.direction === "expense").reduce((sum, entry) => sum + entry.amount, 0);
    const budgetUsage = getPrototypeBudgetUsage(expenses, PROTOTYPE_MONTHLY_BUDGET);
    const budgetPercent = budgetUsage.percent === null ? null : Math.round(budgetUsage.percent);
    if (route.destination === "finance-bills") return ActionList({ items: bills, title: "Bills", captureType: "bill" });
    if (route.destination === "finance-budget") return <div className={styles.screenCardGrid}>
      <section className={styles.widgetCard}><div className={styles.widgetHeading}><span className={styles.widgetIcon}><Gauge size={16} /></span><div><strong>Demo budget</strong><small>{entries.length ? money(expenses) + " of " + money(PROTOTYPE_MONTHLY_BUDGET) : "No ledger entries for this month"}</small></div><span className={styles.capacityValue} data-testid="budget-percent">{entries.length ? budgetPercent === null ? "No budget" : budgetPercent + "%" : "—"}</span></div><div className={styles.capacityTrack}><span data-testid="budget-fill" style={{ width: entries.length ? budgetUsage.barPercent + "%" : "0%" }} /></div>{entries.length && budgetUsage.overAmount > 0 ? <p data-testid="budget-overspend" style={{ color: "var(--p-errorText)" }}>Over budget by {money(budgetUsage.overAmount)}</p> : null}<p>Budget limit is a prototype fixture; no financial data is connected.</p></section>
      <section className={styles.panel}>{PanelHeader({ title: "Monthly entries" })}{entries.length ? entries.map((entry) => <div className={styles.financeRow} key={entry.id}><span>{formatPrototypeDate(entry.date, { month: "short", day: "numeric" })} · {entry.title}</span><strong>{entry.direction === "expense" ? "−" : "+"}{money(entry.amount)}</strong></div>) : EmptyState({ title: "No ledger entries", detail: "There is no financial data for this month and scope." })}</section>
    </div>;
    return <div className={styles.screenCardGrid}>
      <section className={styles.widgetCard}><div className={styles.widgetHeading}><span className={styles.widgetIcon}><PiggyBank size={16} /></span><div><strong>Monthly balance</strong><small>{formatPrototypeMonth(route.date)}</small></div><span className={styles.capacityValue}>{money(metrics.monthlyBalance)}</span></div><div className={styles.financeRows}><span>Income <strong>{money(metrics.monthlyIncome)}</strong></span><span>Expenses <strong>{money(metrics.monthlyExpenses)}</strong></span></div></section>
      <section className={styles.widgetCard}><div className={styles.widgetHeading}><span className={styles.widgetIcon}><Gauge size={16} /></span><div><strong>Demo budget</strong><small>{entries.length ? money(expenses) + " of " + money(PROTOTYPE_MONTHLY_BUDGET) : "No ledger entries for this month"}</small></div><span className={styles.capacityValue} data-testid="budget-percent">{entries.length ? budgetPercent === null ? "No budget" : budgetPercent + "%" : "—"}</span></div><div className={styles.capacityTrack}><span data-testid="budget-fill" style={{ width: entries.length ? budgetUsage.barPercent + "%" : "0%" }} /></div>{entries.length && budgetUsage.overAmount > 0 ? <p data-testid="budget-overspend" style={{ color: "var(--p-errorText)" }}>Over budget by {money(budgetUsage.overAmount)}</p> : null}<p>Budget limit is a prototype fixture; no financial data is connected.</p></section>
      {ActionList({ items: openBills, title: "Upcoming bills", captureType: "bill" })}
    </div>;
  };

  const renderGoals = () => route.destination === "goals-review" ? <div className={styles.screenCardGrid}>{GoalList({ items: visibleGoals })}<section className={styles.panel}>{PanelHeader({ title: "Review" })}<p className={styles.panelCopy}>{visibleGoals.length ? "Average visible goal progress is " + Math.round(visibleGoals.reduce((sum, goal) => sum + goal.progress, 0) / visibleGoals.length) + "%." : "No goal data is available in the empty workspace mode."}</p></section></div> : GoalList({ items: visibleGoals });

  const renderRoutine = () => {
    if (route.destination === "routine-reflection") return <section className={styles.insightCard}><Lightbulb size={22} /><span>Reflection</span><strong>{dayRecords.length ? "What went well in the visible plan?" : "No reflection data in this prototype."}</strong><small>Reflection entry editing is outside this prototype.</small></section>;
    const habits = visibleRecords.filter((record) => record.type === "habit" && record.date === route.date);
    return ActionList({
      items: habits,
      title: "Habits",
      captureType: "habit",
      actionLabel: "Add habit",
      emptyState: {
        title: "No habits for this date",
        detail: "Create a repeating routine and choose when you want to be reminded.",
        action: "Add habit",
      },
    });
  };

  const renderInsights = () => {
    const weekly = getPrototypeEstimatedWeek(visibleRecords, route.date, "all");
    const selected = weekly.find((item) => item.date === route.date);
    const tasks = getPrototypeDayRecords(visibleRecords, route.date, "all").filter((record) => record.type === "task");
    const completedTasks = metrics.completedTaskCount;
    const estimatedTime = selected?.minutes == null ? "Incomplete estimates" : formatPrototypeDuration(selected.minutes);
    const timeReport = <PrototypeBarChart
      key={`${route.date}:${route.scope}:${route.mode}:${route.destination}`}
      title="Estimated workload"
      days={weekly}
      initialDate={route.date}
      size="report"
      onOpenDay={(date) => {
        pendingDestinationFocusRef.current = true;
        updateRoute({ date, view: "Today", destination: "planner-day" });
      }}
    />;
    if (route.destination === "insights-productivity") return <div className={styles.screenCardGrid}>
      <section className={styles.panel}>{PanelHeader({ title: "Task completion" })}<p className={styles.panelCopy}>{tasks.length ? completedTasks + " of " + tasks.length + " visible tasks completed on " + formatPrototypeDate(route.date, { weekday: "long", month: "short", day: "numeric" }) + "." : "No task data for this date and scope."}</p><div className={styles.progressTrack}><span style={{ width: tasks.length ? Math.round(completedTasks / tasks.length * 100) + "%" : "0%" }} /></div></section>
      <section className={styles.panel}>{PanelHeader({ title: "Visible work items" })}<p className={styles.panelCopy}>{visibleRecords.filter((record) => record.date === route.date).length} demo items on the selected date · {visibleGoals.length} visible goals.</p><small className={styles.unsupportedReason}>Completion applies only to local task and habit rows.</small></section>
    </div>;
    if (route.destination === "insights-time") return <div className={styles.screenCardGrid}>
      {timeReport}
      <section className={styles.panel}>{PanelHeader({ title: "Selected date" })}<p className={styles.panelCopy}>{dayRecords.length} planned items · {estimatedTime}. This chart adds task and habit estimates to event durations. Time blocks are not added again, and these values are not tracked actual time.</p></section>
    </div>;
    if (route.destination === "insights-balance") return <div className={styles.screenCardGrid}>
      <section className={styles.widgetCard}><div className={styles.widgetHeading}><span className={styles.widgetIcon}><PiggyBank size={16} /></span><div><strong>Monthly balance</strong><small>{formatPrototypeMonth(route.date)} · {route.scope === "all" ? "All areas" : route.scope === "work" ? "Work" : "Life"}</small></div><span className={styles.capacityValue}>{money(metrics.monthlyBalance)}</span></div><div className={styles.financeRows}><span>Income <strong>{money(metrics.monthlyIncome)}</strong></span><span>Expenses <strong>{money(metrics.monthlyExpenses)}</strong></span></div></section>
      <section className={styles.panel}>{PanelHeader({ title: "Visible demo activity" })}<p className={styles.panelCopy}>{visibleRecords.length} local item{visibleRecords.length === 1 ? "" : "s"} · {visibleLedger.length ? visibleLedger.length + " ledger entries in the current fixture." : "No ledger entries in this scope."}</p><small className={styles.unsupportedReason}>Bills remain unpaid obligations and are not counted as expenses.</small></section>
    </div>;
    const goalsWithoutLinkedWork = visibleGoals.filter((goal) => !visibleRecords.some((record) => record.goalId === goal.id));
    return <div className={styles.screenCardGrid}>
      <section className={styles.panel}>{PanelHeader({ title: "Day review", action: "Prepare next week", onAction: () => updateRoute({ date: shiftPrototypeDays(route.date, 7), view: "Week", destination: "planner-week" }) })}<div className={styles.reviewStats}><span><strong>{metrics.completedCount}</strong><small>completed on selected day</small></span><span><strong>{inboxItems.length}</strong><small>still need planning</small></span><span><strong>{formatPrototypeDuration(capacity.freeMinutes)}</strong><small>free capacity today</small></span></div><p className={styles.panelCopy}>Review what was completed, what is still unplanned, and whether the visible workload fits the day before preparing the next week.</p></section>
      <section className={styles.panel}>{PanelHeader({ title: "Goal coverage" })}<p className={styles.panelCopy}>{goalsWithoutLinkedWork.length ? goalsWithoutLinkedWork.map((goal) => goal.title).join(", ") + " currently has no linked work in this scope." : "Every visible goal has at least one linked item in this prototype."}</p><small className={styles.unsupportedReason}>Goal progress remains a fixture; linked work is shown separately and is not treated as business outcome data.</small></section>
      {timeReport}
    </div>;
  };

  const renderInbox = () => {
    if (!inboxItems.length) {
      return EmptyState({ title: "Your inbox is clear", detail: "Capture first. Organize when you are ready.", action: "Capture an item", variant: "standalone" });
    }
    return <section className={styles.panel + " " + styles.inboxPanel}>
      {PanelHeader({ title: "Unplanned items", action: "Capture", onAction: () => openQuickCapture() })}
      <div className={styles.inboxList}>
        {inboxItems.map((record) => {
          const project = record.projectId ? projectById.get(record.projectId) : undefined;
          const Icon = ICON_BY_TYPE[record.type];
          return <article className={styles.inboxItem} key={record.id} data-record-id={record.id} tabIndex={-1}>
            <span className={styles.widgetIcon}><Icon size={16} /></span>
            <span className={styles.inboxCopy}>
              <strong>{record.title}</strong>
              <small>{TYPE_LABELS[record.type]} · {areaLabel(record.scope)}{record.dueDate ? " · due " + formatPrototypeDate(record.dueDate, { month: "short", day: "numeric" }) : ""}{record.durationMinutes ? " · " + formatPrototypeDuration(record.durationMinutes) : ""}</small>
              {project ? <small>Project · {project.title}</small> : null}
            </span>
            <span className={styles.inboxActions}>
              {record.type === "task" && record.scope !== "unassigned" ? <button type="button" onClick={() => {
                setRecords((current) => current.map((item) => item.id === record.id ? { ...item, status: "planned" as const, date: route.date } : item));
                setToast("Planned for today: " + record.title);
              }}>Plan today</button> : null}
              <button type="button" onClick={() => reviewInboxRecord(record)}>Review</button>
            </span>
          </article>;
        })}
      </div>
    </section>;
  };

  const renderOtherSurface = () => {
    const destination = route.destination;
    if (destination === "today" || destination.startsWith("planner") || destination === "calendar" || destination === "calendar-month" || destination === "calendar-week") return renderPlannerSurface();
    if (destination === "calendar-schedule") return <div className={styles.screenCardGrid}>{EventList({ items: eventRecordsFor(route.date), title: "Schedule" })}{ActionList({ items: actionRecords, title: "Day focus" })}</div>;
    if (destination === "calendar-upcoming") return allUpcoming.length ? <div className={styles.screenCardGrid}>{allUpcoming.map((record) => <section className={styles.widgetCard + " " + styles.resourceCard} key={record.id} data-testid="upcoming-card"><span className={styles.widgetEyebrow}>{formatPrototypeDate(record.dueDate ?? record.date, { weekday: "long", month: "short", day: "numeric" })}</span><h3>{record.title}</h3><p>{TYPE_LABELS[record.type]} · {areaLabel(record.scope)}</p><button type="button" className={styles.cardAction} onClick={() => openExistingRecord(record)}>Open item<ArrowRight size={13} /></button></section>)}</div> : EmptyState({ title: "Nothing coming up", detail: "No later demo items match the selected scope.", variant: "standalone" });
    if (destination === "tasks") return ActionList({ items: visibleRecords.filter((record) => record.type === "task" && record.status !== "inbox" && record.status !== "archived"), title: "Tasks" });
    if (destination === "inbox") return renderInbox();
    if (destination === "workspace") return <div className={styles.screenCardGrid}>{["inbox", "tasks", "planner"].map((key) => <button type="button" className={styles.widgetCard + " " + styles.workspaceCard} key={key} data-testid="workspace-card" onClick={() => selectDestination(key)}><span className={styles.widgetIcon}><Layers3 size={16} /></span><span className={styles.workspaceCardContent}><strong>{SCREEN_LABELS[key]}</strong><small>Open this prototype view</small></span><ArrowRight size={15} /></button>)}</div>;
    if (destination.startsWith("goals") || destination === "goals") return renderGoals();
    if (destination.startsWith("finance") || destination === "finance") return renderFinance();
    if (destination.startsWith("routine") || destination === "routine") return renderRoutine();
    if (destination.startsWith("insights") || destination === "insights") return renderInsights();
    return EmptyState({ title: "This screen is unavailable", detail: "Choose a supported prototype destination.", variant: "standalone" });
  };

  const scopeLabel = route.scope === "all" ? "All areas" : route.scope === "work" ? "Work" : "Life";
  const currentScreen = SCREEN_LABELS[route.destination] ?? "Today";

  return (
    <main className={styles.prototype + " " + (route.theme === "minimal" ? "" : styles["theme_" + route.theme])}>
      <div className={styles.ambient} aria-hidden="true" />
      <header className={styles.prototypeHeader} aria-hidden={compact && drawerOpen} inert={compact && drawerOpen}>
        <div className={styles.directionIntro}>
          <span className={styles.kicker}>Kemtit Visual Prototype · Demo data only</span>
          <h1>{currentTheme.name}</h1>
          <p>{currentTheme.strapline}</p>
        </div>
        <div className={styles.themePicker} role="group" aria-label="Design direction">
          {THEMES.map((item) => <button key={item.key} type="button" className={route.theme === item.key ? styles.themeButtonActive : styles.themeButton} onClick={() => updateRoute({ theme: item.key }, "replace")} aria-pressed={route.theme === item.key}><span>{item.number}</span><strong>{item.name}</strong></button>)}
        </div>
        <div className={styles.referenceChip}><span>ThemeForest research basis</span><strong>{currentTheme.basis}</strong></div>
      </header>

      <section className={styles.stage}>
        {compact && drawerOpen ? <button type="button" className={styles.drawerBackdrop} aria-label="Close navigation" onClick={() => { drawerDismissalRequestedRef.current = true; setDrawerOpen(false); }} /> : null}
        <aside id="prototype-navigation" ref={drawerRef} className={styles.sidebar + (compact && drawerOpen ? " " + styles.sidebarOpen : "")} aria-label="Prototype navigation drawer" data-testid="mobile-drawer" role={compact && drawerOpen ? "dialog" : undefined} aria-modal={compact && drawerOpen ? true : undefined} aria-hidden={compact && !drawerOpen} inert={compact && !drawerOpen}>
          <div className={styles.brand}>
            <span className={styles.logoMark}>K</span>
            <span className={styles.brandText}><span className={styles.brandName}>Kemtit</span><small>Personal OS</small></span>
            {compact ? <button type="button" className={styles.drawerClose} aria-label="Close navigation" data-testid="drawer-close-button" onClick={() => { drawerDismissalRequestedRef.current = true; setDrawerOpen(false); }}><X size={17} /></button> : <button type="button" className={styles.brandAction} aria-label="Quick capture" onClick={() => openQuickCapture()}><Plus size={16} /></button>}
          </div>

          <section className={styles.spaceCard} aria-label="Workspace scope">
            <div className={styles.spaceCardTitle}><span><Layers3 size={14} /> Area</span><small>{scopeLabel}</small></div>
            <div className={styles.spaceSwitcher}>{SPACES.map((space) => <button key={space.key} type="button" className={route.scope === space.key ? styles.spaceActive : styles.spaceButton} onClick={() => updateRoute({ scope: space.key })} aria-pressed={route.scope === space.key} data-testid={"scope-" + space.key}><span className={styles.spaceDot + " " + styles["space_" + space.tone]} />{space.label}</button>)}</div>
          </section>

          <div className={styles.navLabel}><span>Navigate</span><span className={styles.navPulse} aria-hidden="true" /></div>
          <nav className={styles.nav} aria-label="Prototype navigation">
            {NAV_GROUPS.map(({ key, label, icon: Icon, destination, children }) => {
              const open = openGroups[key] ?? (children?.some((child) => child.destination === route.destination) ?? false);
              const active = route.destination === destination || children?.some((child) => child.destination === route.destination) || false;
              return <div key={key} className={styles.navGroup}>
                <div className={styles.navHeadingRow}>
                  <button type="button" className={active ? styles.navActive : styles.navItem} data-testid="prototype-nav-destination" data-supported="true" data-destination-id={destination} aria-current={route.destination === destination ? "page" : undefined} aria-expanded={children ? open : undefined} onClick={() => selectDestination(destination, children ? key : undefined)}>
                    <span className={styles.navGlyph}><Icon size={17} strokeWidth={1.8} /></span><span className={styles.navText}>{label}</span>
                  </button>
                  {children ? <button type="button" className={styles.navDisclosure} aria-label={(open ? "Collapse " : "Expand ") + label} aria-expanded={open} onClick={() => setOpenGroups((groups) => ({ ...groups, [key]: !open }))}><ChevronDown size={14} className={open ? styles.navChevronOpen : styles.navChevron} /></button> : null}
                </div>
                {children ? <div className={open ? styles.submenuOpen : styles.submenuClosed} aria-hidden={!open} inert={!open}><div className={styles.submenuTrack}>{children.map((child) => {
                  const reasonId = "unsupported-" + child.key;
                  const childActive = route.destination === child.destination;
                  return <div className={styles.submenuRow} key={child.key}>
                    <button type="button" className={childActive ? styles.submenuActive : styles.submenuItem} data-testid="prototype-nav-destination" data-supported={child.supported === false ? "false" : "true"} data-destination-id={child.destination} aria-current={childActive ? "page" : undefined} aria-describedby={child.supported === false ? reasonId : undefined} disabled={child.supported === false} onClick={() => selectDestination(child.destination, key)} tabIndex={open ? 0 : -1}>
                      <span className={styles.submenuLabel}>{child.label}</span>
                    </button>
                    {child.supported === false ? <small className={styles.unsupportedReason} id={reasonId}>{child.reason}</small> : null}
                  </div>;
                })}</div></div> : null}
              </div>;
            })}
          </nav>

          <div className={styles.sidebarBottom}>
            <button type="button" className={styles.quickCreate} onClick={() => openQuickCapture()}><Plus size={16} /><span><strong>Quick capture</strong><small>Task, event, bill, note · local only</small></span><kbd>⌘ K</kbd></button>
            <button type="button" className={styles.settingsRow} disabled aria-describedby="settings-unsupported"><Settings size={17} strokeWidth={1.8} /><span>Settings</span></button>
            <small className={styles.unsupportedReason} id="settings-unsupported">Account settings are outside this prototype.</small>
            <div className={styles.profile}><span className={styles.avatar}>H</span><span><strong>Hut</strong><small>Visual prototype user</small></span><span className={styles.profileStatus} aria-label="Demo profile" /></div>
          </div>
        </aside>

        <div className={styles.workspace} aria-hidden={compact && drawerOpen} inert={compact && drawerOpen}>
          <div className={styles.topbar + (commandOpen || viewOpen ? " " + styles.topbarExpanded : "")}>
            <div className={styles.topbarRow}>
              <button ref={menuButtonRef} type="button" className={styles.mobileMenu} aria-label="Open navigation" aria-expanded={drawerOpen} aria-controls="prototype-navigation" data-testid="mobile-menu-button" onClick={() => setDrawerOpen(true)}><Menu size={18} /></button>
              <div className={styles.commandWrap} data-command-anchor>
                <label className={styles.commandBar}>
                  <Search size={17} />
                  <input ref={inputRef} type="text" role="combobox" aria-label="Quick capture" aria-autocomplete="list" aria-expanded={commandOpen} aria-controls="prototype-suggestions" aria-activedescendant={activeSuggestion >= 0 ? "suggestion-" + activeSuggestion : undefined} placeholder="Search or add anything..." value={command} onChange={(event) => { setCommand(event.target.value); setCommandOpen(true); setViewOpen(false); setActiveSuggestion(-1); setCaptureStatus(""); }} onFocus={() => { setCommandOpen(true); setViewOpen(false); }} onClick={() => { setCommandOpen(true); setViewOpen(false); }} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onKeyDown={(event) => {
                    if (event.nativeEvent.isComposing || composingRef.current) return;
                    if (event.key === "ArrowDown" && filteredSuggestions.length) { event.preventDefault(); setActiveSuggestion((index) => (index + 1) % filteredSuggestions.length); }
                    else if (event.key === "ArrowUp" && filteredSuggestions.length) { event.preventDefault(); setActiveSuggestion((index) => index <= 0 ? filteredSuggestions.length - 1 : index - 1); }
                    else if (event.key === "Enter") { event.preventDefault(); if (activeSuggestion >= 0 && filteredSuggestions[activeSuggestion]) openExistingRecord(filteredSuggestions[activeSuggestion]); else if (command.trim()) openCapture(command.trim(), "task", captureProposal ?? undefined); }
                  }} />
                  <kbd><Command size={11} /> K</kbd>
                </label>
                {commandOpen ? <div className={styles.autocomplete} data-testid="prototype-suggestion-popover">
                  <div className={styles.autocompleteHeader}><span><Sparkles size={13} /> Demo items</span><button type="button" onClick={() => setCommandOpen(false)}>Close</button></div>
                  <div ref={suggestionListRef} className={styles.suggestionList} id="prototype-suggestions" role="listbox" aria-label="Quick capture suggestions">
                    {filteredSuggestions.map((record, index) => {
                      const Icon = ICON_BY_TYPE[record.type];
                      return <button key={record.id} id={"suggestion-" + index} type="button" role="option" aria-selected={activeSuggestion === index} className={activeSuggestion === index ? styles.suggestionActive : styles.suggestionItem} onMouseDown={(event) => event.preventDefault()} onClick={() => openExistingRecord(record)}><span className={styles.suggestionIcon}><Icon size={15} /></span><span className={styles.suggestionText}><strong>{record.title}</strong><small>{TYPE_LABELS[record.type]} · {formatPrototypeDate(record.date, { month: "short", day: "numeric" })} · {areaLabel(record.scope)}</small></span><kbd>Open</kbd></button>;
                    })}
                  </div>
                  {command.trim() && matchingTitle.length ? <p className={styles.noSuggestion} role="status">An item with this title exists. Open it or add another demo item.</p> : null}
                  {command.trim() && !filteredSuggestions.length ? <p className={styles.noSuggestion} role="status">No match found. You can capture it without finishing every detail.</p> : null}
                  {captureProposal ? <div className={styles.captureProposal} data-testid="capture-proposal">
                    <span className={styles.suggestionIcon}><Sparkles size={15} /></span>
                    <span className={styles.captureProposalCopy}><strong>{captureProposal.title}</strong><small>{captureProposal.signals.join(" · ")}{captureProposal.scope === "unassigned" ? " · Area not set" : ""}</small></span>
                    <span className={styles.captureProposalActions}><button type="button" onClick={() => openCapture(command.trim(), captureProposal.type, captureProposal)}>Review</button><button type="button" className={styles.captureProposalPrimary} onClick={() => addProposalToInbox(captureProposal)}>Add to Inbox</button></span>
                  </div> : null}
                  {command.trim() ? <button type="button" className={styles.createSuggestion} onMouseDown={(event) => event.preventDefault()} onClick={() => openCapture(command.trim(), "task", captureProposal ?? undefined)}><Plus size={14} />Create new demo item</button> : null}
                  <div className={styles.detectedRow}><span>Capture first · review details before planning.</span></div>
                </div> : null}
              </div>
              <div className={styles.topActions}>
                {VIEW_DESTINATIONS.has(route.destination) ? <ViewDropdown value={route.view} open={viewOpen} triggerRef={(element) => { viewTriggerRef.current = element; }} onOpenChange={toggleViewMenu}>
                  {viewOpen ? <div ref={viewMenuRef} className={styles.viewMenu} data-testid="prototype-view-popover" id="prototype-view-menu" role="menu" tabIndex={-1} aria-label="Choose planner view" onKeyDown={handleViewMenuKeyDown}><div className={styles.viewPanelHeader}><span><SlidersHorizontal size={13} /> Choose view</span><button type="button" onClick={() => { setViewOpen(false); viewTriggerRef.current?.focus({ preventScroll: true }); }}>Close</button></div><div className={styles.viewPanelOptions}>{VIEW_OPTIONS.map((option, index) => <button ref={(element) => { viewOptionRefs.current[index] = element; }} type="button" role="menuitemradio" tabIndex={activeViewIndex === index ? 0 : -1} aria-checked={route.view === option.label} key={option.label} className={route.view === option.label ? styles.viewOptionActive : styles.viewOption} onClick={() => onViewSelected(option.label)}><span><strong>{option.label}</strong><small>{option.helper}</small></span>{route.view === option.label ? <Check size={14} /> : null}</button>)}</div></div> : null}
                </ViewDropdown> : null}
                <button type="button" aria-label={"Previous " + shiftLabel} onClick={() => shiftDate(-1)}><ChevronLeft size={17} /></button>
                <time data-testid="prototype-date" data-date={route.date} dateTime={route.date}>{formatPrototypeDate(route.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</time>
                <button type="button" aria-label={"Next " + shiftLabel} onClick={() => shiftDate(1)}><ChevronRight size={17} /></button>
              </div>
            </div>
          </div>

          <div className={styles.content}>
            <section className={styles.screenHeader}>
              <div><span className={styles.eyebrow}>{scopeLabel} · {formatPrototypeDate(route.date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span><h2 tabIndex={-1} data-screen-heading={currentScreen}>{currentScreen}</h2><p>{route.mode === "sample" ? currentTheme.strapline : "Empty workspace · new items stay local to this prototype"}</p></div>
              <div className={styles.heroDateControls}><button type="button" aria-label={"Previous " + shiftLabel} onClick={() => shiftDate(-1)}><ChevronLeft size={17} /></button><button type="button" className={styles.todayButton} onClick={() => chooseDate(PROTOTYPE_DEMO_TODAY)}>Demo today</button><button type="button" aria-label={"Next " + shiftLabel} onClick={() => shiftDate(1)}><ChevronRight size={17} /></button></div>
            </section>
            <div className={styles.dataModeControls}>
              <span>{route.mode === "sample" ? "Sample fixtures visible" : "Empty workspace mode"}</span>
              <button type="button" data-testid="demo-mode-toggle" onClick={toggleDemoMode}>{route.mode === "sample" ? "Show empty workspace" : "Load demo data"}</button>
              <button type="button" data-testid="reset-demo-data" onClick={resetDemoData}>Reset demo data</button>
            </div>
            <section className={styles.prototypeViewSurface} data-testid="prototype-view-surface" data-view={route.view.toLowerCase()} data-destination-id={route.destination} data-scope={route.scope}>
              {
                /* eslint-disable-next-line react-hooks/refs -- Surface helpers create callbacks that access refs only after user events. */
                renderOtherSurface()
              }
            </section>
          </div>
        </div>
      </section>

      <nav className={styles.mobileExecutionNav} aria-label="Mobile prototype navigation" aria-hidden={!compact || drawerOpen} inert={!compact || drawerOpen}>
        <button type="button" className={route.destination === "today" ? styles.mobileExecutionActive : undefined} aria-current={route.destination === "today" ? "page" : undefined} onClick={() => selectDestination("today")}><Home size={17} /><span>Today</span></button>
        <button type="button" className={route.destination.startsWith("planner") ? styles.mobileExecutionActive : undefined} aria-current={route.destination.startsWith("planner") ? "page" : undefined} onClick={() => selectDestination("planner")}><CalendarDays size={17} /><span>Planner</span></button>
        <button type="button" className={styles.mobileCapture} aria-label="Quick capture" onClick={() => openQuickCapture()}><Plus size={20} /></button>
        <button type="button" className={route.destination.startsWith("insights") ? styles.mobileExecutionActive : undefined} aria-current={route.destination.startsWith("insights") ? "page" : undefined} onClick={() => selectDestination("insights")}><BarChart3 size={17} /><span>Insights</span></button>
        <button type="button" onClick={() => setDrawerOpen(true)}><Menu size={17} /><span>More</span></button>
      </nav>

      <footer className={styles.prototypeFooter} aria-hidden={compact && drawerOpen} inert={compact && drawerOpen}><span>{currentTheme.number}/05 · {currentTheme.name}</span><span>Interactive visual prototype · changes are local to this page</span></footer>
      <div className={styles.srOnly} aria-live="polite" role="status">{captureStatus || toast}</div>

      {captureDraft ? <dialog ref={captureDialogRef} className={styles.captureDialog} aria-modal="true" aria-labelledby="capture-title" aria-describedby="capture-description" data-testid="capture-draft" onCancel={(event) => { event.preventDefault(); cancelCapture(); }} onPointerDown={(event) => { if (event.target === event.currentTarget) cancelCapture(); }}>
          <div className={styles.captureDialogBody} data-testid="capture-dialog-body">
            <div className={styles.captureHeader}><div><span className={styles.eyebrow}>Local demo only</span><h2 id="capture-title">Review new demo item</h2></div><button type="button" aria-label="Cancel" onClick={cancelCapture}> <X size={17} /></button></div>
            <p id="capture-description">Review these manual details before adding an item to the current visual prototype.</p>
            <form className={styles.captureFields} onSubmit={confirmCapture}>
              <label>Title<input ref={captureTitleRef} aria-label="Title" value={captureDraft.title} onChange={(event) => updateCaptureDraft({ title: event.target.value })} /></label>
              <label>Type<select aria-label="Type" value={captureDraft.type} onChange={(event) => updateCaptureDraft({ type: event.target.value as CaptureType })}><option value="task">Task</option><option value="event">Event</option><option value="bill">Bill</option><option value="habit">Habit</option><option value="note">Note</option></select></label>
              <label>Plan date<input aria-label="Date" type="date" value={captureDraft.date} onChange={(event) => updateCaptureDraft({ date: event.target.value })} /></label>
              <label>Due date <small>optional</small><input aria-label="Due date" type="date" value={captureDraft.dueDate} onChange={(event) => updateCaptureDraft({ dueDate: event.target.value })} /></label>
              <label>Area<select aria-label="Scope" value={captureDraft.scope} onChange={(event) => updateCaptureDraft({ scope: event.target.value as PrototypeRecordScope | "" })}><option value="">Choose area</option><option value="work">Work</option><option value="life">Life</option></select></label>
              <label>Project <small>optional</small><select aria-label="Project" value={captureDraft.projectId} onChange={(event) => updateCaptureDraft({ projectId: event.target.value })}><option value="">No project</option>{INITIAL_PROTOTYPE_PROJECTS.map((project) => <option value={project.id} key={project.id}>{project.title}</option>)}</select></label>
              {captureDraft.type === "bill" ? <label>Amount (THB)<input aria-label="Amount (THB)" type="number" min="0.01" step="0.01" value={captureDraft.amount} onChange={(event) => updateCaptureDraft({ amount: event.target.value })} /></label> : null}
              {captureDraft.type === "event" ? <label>Start time<input aria-label="Start time" type="time" value={captureDraft.startTime} onChange={(event) => updateCaptureDraft({ startTime: event.target.value })} /></label> : null}
              {captureDraft.type === "task" || captureDraft.type === "event" || captureDraft.type === "habit" ? <label>Duration (minutes)<input aria-label="Duration (minutes)" type="number" min="0" step="5" value={captureDraft.durationMinutes} onChange={(event) => updateCaptureDraft({ durationMinutes: event.target.value })} /></label> : null}
              {captureDraft.type === "task" || captureDraft.type === "habit" || captureDraft.type === "bill" ? <label>Repeat <small>optional</small><input aria-label="Repeat" placeholder="Every Sunday" value={captureDraft.recurrence} onChange={(event) => updateCaptureDraft({ recurrence: event.target.value })} /></label> : null}
              {captureDraft.type !== "note" ? <label>Reminder lead time <small>minutes · optional</small><input aria-label="Reminder minutes" type="number" min="0" step="5" value={captureDraft.reminderMinutes} onChange={(event) => updateCaptureDraft({ reminderMinutes: event.target.value })} /></label> : null}
              {captureError ? <p className={styles.captureError} role="alert">{captureError}</p> : null}
              <div className={styles.captureActions}><button type="button" data-testid="capture-cancel" onClick={cancelCapture}>Cancel</button><button type="submit" className={styles.captureConfirm} data-testid="capture-confirm">Confirm demo item</button></div>
            </form>
          </div>
        </dialog> : null}
    </main>
  );

  function WeekRhythm() {
    const week = getPrototypeEstimatedWeek(visibleRecords, route.date, "all");
    return <PrototypeBarChart
      key={`${route.date}:${route.scope}:${route.mode}`}
      title="Weekly rhythm"
      days={week}
      initialDate={route.date}
      actionLabel="This week"
      onAction={() => {
        pendingDestinationFocusRef.current = true;
        updateRoute({ view: "Week", destination: destinationForView(route.destination, "Week") });
      }}
      onOpenDay={(date) => {
        pendingDestinationFocusRef.current = true;
        updateRoute({ date, view: "Today", destination: "planner-day" });
      }}
    />;
  }
}

function ViewDropdown({ value, open, onOpenChange, triggerRef, children }: { value: ViewMode; open: boolean; onOpenChange: (open: boolean) => void; triggerRef: (element: HTMLButtonElement | null) => void; children?: ReactNode }) {
  return <div className={styles.viewSelect} data-view-anchor>
    <button ref={triggerRef} type="button" className={styles.viewTrigger} onClick={() => onOpenChange(!open)} aria-expanded={open} aria-haspopup="menu" aria-controls="prototype-view-menu" aria-label="Choose view"><SlidersHorizontal size={14} /><span>{value}</span><ChevronDown size={13} className={open ? styles.viewChevronOpen : styles.viewChevron} /></button>
    {children}
  </div>;
}

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return <article className={styles.metric}><span className={styles.metricIcon}><Icon size={18} /></span><span><strong>{value}</strong><small>{label}</small></span></article>;
}
