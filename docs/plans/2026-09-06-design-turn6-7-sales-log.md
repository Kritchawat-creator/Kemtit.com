# Plan — Claude Design turn 6/7: desktop v2/v3 + "บันทึกยอด" (goal entries)

Source: Claude Design project `Kemtit.dc.html` turns **6** (D-04 Dashboard v2, D-07 Goal Detail v2, D-06 Goals v2) and **7** (D-04 Dashboard v3 admin-style, D-10 Sales Log Table). Turn 7 supersedes turn 6 for the desktop dashboard; turn 6 stays authoritative for goal detail / goals list. Mobile screens (turn 3) are unchanged. Planner/advisor: Fable 5.1 · Implementer: Sonnet 5 (CLAUDE.md "AI Model Routing").

Read this whole file before touching code. Every ambiguity has already been decided below — do not re-open decisions, do not ask questions; when something is genuinely impossible, do the rest and list it in the tracking-log entry.

## 0. Ground rules (repo conventions — must hold)

- GitNexus: run `impact` (MCP `mcp__gitnexus__impact`, or `node .gitnexus/run.cjs impact "<symbol>" --direction upstream --repo .`) before editing an existing exported symbol; run `detect_changes --scope all` before every commit. Impact already checked by the planner for: `updateCurrentValue` LOW · `Sidebar` LOW · `TopBar` LOW · `PageHeader` **HIGH (5 pages — keep its props backward compatible, only add optional props)** · `AppShell`/`ShellFrame`/`BottomNav`/`QuickAddHost`/`QuickAddMenu`/`UserMenu`/`GoalCard`/`GoalProgressPanel`/`GoalDetailActions` LOW · `getDayPlan` **HIGH (3 callers — keep signature, only wrap with `cache()`)** · `UpdateValueForm` **HIGH (keep props; internal change only)** · `listGoalsWithProgress` **CRITICAL — do not change it** · `NAV_ITEMS`/`EVENT_TYPES` UNKNOWN → text-search confirmed callers are only `Sidebar`, `BottomNav` (NAV_ITEMS) and nothing else (EVENT_TYPES).
- Design tokens only: **no hex colours** in `src/components`, `src/app`, `src/modules`, `src/shared-services` (eslint `no-restricted-syntax`). SVG uses Tailwind classes (`stroke-brand-500`, `fill-brand-100`, …) like `CompassDial.tsx`.
- All UI strings live in `src/messages/th.json` (next-intl). Server actions return `ActionResult` with error **keys** (`errors.*`), never Thai text. Zod schemas in `core/*/schema.ts` carry error keys.
- `core/` must not import `modules/` or `shared-services/`; `components/` must not import Supabase directly (`@/lib/supabase/*`) — data goes through server actions / server components.
- Mobile-first: mobile screens keep the approved turn-3 look. Desktop = `lg:` breakpoint (≥1024). `useIsMobile()` (< 640px) exists for JS-side switching.
- Numbers/dates go through `src/lib/format.ts` (tabular figures are global). Money shows as `50,000` + small `บาท`, never `฿` in hero/KPI (use `formatValueParts`); `formatValueWithUnit` (→ `฿50,000`) is fine inside sentences and toasts, as today.
- Undo-toast instead of confirm for deletes (pattern: `TaskList.remove` — 5 s timer, `toast(..., { action: undo })`).
- After each phase: `pnpm typecheck && pnpm lint && pnpm test` must pass; Storybook build (`pnpm build-storybook`) must still pass at the end of phase 2; Playwright (`pnpm e2e`) at the end of phase 3.
- Commit per phase (branch `feat/poc`), message style like `git log` (e.g. `M10a: goal entries data layer …`), trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Append a `tracking-log.md` entry per phase (format = existing entries: Date / Task / Files changed / Reason / Result — in Thai like the rest of the file).
- Local Supabase is running (Docker, DB at 127.0.0.1:54322). Apply new migration with `pnpm exec supabase migration up` (keeps local data), then regenerate types: `pnpm exec supabase gen types typescript --local > src/types/database.ts`.

## 1. Domain decisions (locked)

1. **Goal entries** (`บันทึกยอด`): an append-only log of amounts against a *metric* goal. Table `public.goal_entries`. `goals.current_value` becomes **derived = sum(entries.amount)** via a DB trigger (`greatest(0, sum)`), so all existing progress code (`buildProgressIndex`, `listGoalsWithProgress`, pace, widgets) keeps working untouched.
2. Existing absolute-value form (`UpdateValueForm` → `updateCurrentValue`) stays for mobile/detail, but internally inserts an **adjustment entry** with `amount = new − current` (skipped when 0) so history always sums to the total. Its i18n/labels are unchanged (e2e depends on them).
3. Entry "status" is **derived, not stored**: `entry_date === today` → `today` ("วันนี้", brand pill); otherwise `confirmed` ("ยืนยันแล้ว", success pill).
4. Entry code shown in tables: `#K` + `entry_no` zero-padded to 4 (`entry_no` = identity column).
5. Channel = optional enum `CHANNELS = ["shopee","lazada","tiktok","line","facebook","storefront","other"]` (labels in th.json). Note = optional text ≤ 120.
6. **No Free/Pro gating is enforced** (POC has no billing; `e2e/goals.spec.ts` creates a 2nd month goal for a free user). Pro touchpoints are informational: sidebar Pro card + "รายงาน PRO" nav item + lock icon on "ปี" chart tab; every "อัปเกรด Pro" click shows toast `pro.comingSoon`. The goals-page dashed "เป้าหมายที่ 2 PRO" slot is **not** built.
7. Desktop dashboard = turn 7 (v3). Its "งาน" nav item → new `/tasks` page (today's plan). "บันทึกยอด" nav → new `/entries` page. Search box → new `/search?q=` page. Bell → derived notifications (overdue tasks, LINE not linked); no stored notifications.
8. Dashboard page title stays `ทิศทางวันนี้` on all sizes (signature voice rule #6 beats the v3 mock's "แดชบอร์ด"); desktop breadcrumb reads `Kemtit › แดชบอร์ด · <วันที่>`.
9. Checkboxes stay **circular** everywhere (design-system signature #5), even though the v3 mock draws a rounded square in the tasks card.
10. Mobile ↔ desktop dashboard: **only one tree may exist in the DOM.** This repo learned that twice already (tracking-log round 13: "สลับด้วย `useIsMobile` เพื่อไม่ให้ชื่องานซ้ำใน DOM"; round 14: hiding with CSS duplicated "40,000" and broke Playwright strict mode). So do **not** use `lg:hidden` / `hidden lg:block` for the two dashboards. Instead add:
    - `useIsDesktop()` in `src/hooks/use-is-mobile.ts` — same `useSyncExternalStore` shape, `QUERY = "(min-width: 1024px)"` (matches Tailwind `lg`), SSR snapshot `false` (mobile-first, like `useIsMobile`).
    - `src/components/layout/ResponsiveSwitch.tsx` (client): `{ mobile, desktop }: { mobile: React.ReactNode; desktop: React.ReactNode }` → `useIsDesktop() ? desktop : mobile`. Both branches are server-rendered before being passed as props (same trick as `CalendarMonth` in round 14); `cache()` (§2.9) keeps the overlapping queries to one round trip.
    Consequence: **no `.filter({ visible: true })` anywhere and no existing locator changes** — on desktop the region named `งานวันนี้` is the v3 tasks card, on mobile it is `TodayTasksWidget`. Keep that region name and its `aria-label="เพิ่มงาน"` add-link on both so the shared QA/e2e steps keep passing.
11. Entry dates are constrained to the goal's period (`periodOf(goal.period_type, goal.period_start)`), enforced in `addEntry`/`updateEntry` with error key `entryOutsidePeriod`. Reason: the DB trigger sums *all* entries into `current_value` while `cumulativeSeries` only plots the ones inside the period — without this rule the chart's last point and the dial can disagree. With it, chart total ≡ `current_value` by construction.

## 2. Phase 1 — data layer (`M10a`)

### 2.1 Migration `supabase/migrations/20260907090000_goal_entries.sql`

```sql
-- goal_entries: บันทึกยอดรายวันของ metric goal (Claude Design turn 6/7 "บันทึกยอด")
-- goals.current_value กลายเป็นค่าที่คำนวณจาก sum(amount) ผ่าน trigger — โค้ด progress เดิมไม่ต้องแก้
create table public.goal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  entry_no bigint generated by default as identity,
  entry_date date not null,
  amount numeric not null check (amount <> 0),
  note text check (note is null or char_length(note) between 1 and 120),
  channel text check (channel is null or channel in ('shopee','lazada','tiktok','line','facebook','storefront','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.goal_entries is 'บันทึกยอดของ metric goal (append-only + แก้/ลบได้) — goals.current_value = greatest(0, sum(amount)) ผ่าน trigger';
create index goal_entries_goal_date_idx on public.goal_entries (goal_id, entry_date desc, created_at desc);
create index goal_entries_user_date_idx on public.goal_entries (user_id, entry_date desc);
create trigger set_goal_entries_updated_at before update on public.goal_entries for each row execute function public.set_updated_at();
```

- Owner/metric check trigger (pattern `task_photos_check_task_owner`): goal must exist with `user_id = new.user_id` **and** `goal_kind = 'metric'`, else `raise exception ... using errcode = '23514'`. Also forbid changing `goal_id` on update (raise).
- Sync trigger `goal_entries_sync_goal()` **after insert or update or delete** for each row: recompute for `coalesce(new.goal_id, old.goal_id)`:
  `update public.goals set current_value = greatest(0, coalesce((select sum(amount) from public.goal_entries where goal_id = v_goal), 0)) where id = v_goal;` (plpgsql, not security definer — the caller owns the goal so RLS allows the update). Return `null`.
- RLS: enable; policies select/insert/update/delete own (`(select auth.uid()) = user_id`, update with check too); `revoke all on public.goal_entries from anon;`.
- Backfill so history sums to today's totals: `insert into public.goal_entries (user_id, goal_id, entry_date, amount, note) select user_id, id, (created_at at time zone 'Asia/Bangkok')::date, current_value, 'ยอดเริ่มต้น' from public.goals where goal_kind = 'metric' and current_value > 0;` (runs as postgres in migration; trigger recomputes to the same value).

Then `pnpm exec supabase migration up` + regenerate `src/types/database.ts` (commit the regenerated file).

### 2.2 `src/core/entries/schema.ts`

```ts
export type GoalEntry = Omit<Database["public"]["Tables"]["goal_entries"]["Row"], "channel"> & { channel: Channel | null };
export type GoalEntryWithGoal = GoalEntry & { goal: { id: string; title: string; persona_data: Json } | null };
export const CHANNELS = ["shopee","lazada","tiktok","line","facebook","storefront","other"] as const; export type Channel = ...;
export const entryFormSchema = z.object({
  goalId: z.uuid({ error: "invalidGoal" }),
  entryDate: isoDateSchema,                                   // from core/tasks/schema
  amount: z.number({ error: "invalidNumber" }).positive({ error: "positive" }).max(1_000_000_000, { error: "tooLarge" }),
  note: z.string().trim().max(120, { error: "tooLong" }).optional(),
  channel: z.enum(CHANNELS).nullable().optional(),
});
export type EntryFormValues = z.infer<typeof entryFormSchema>;
export const updateEntrySchema = z.object({ id: z.uuid(), values: entryFormSchema.omit({ goalId: true }) });
export const deleteEntrySchema = z.object({ id: z.uuid() });
export type EntryStatus = "today" | "confirmed";
export function entryStatus(entryDate: ISODate, today: ISODate): EntryStatus
export function entryCode(entryNo: number): string   // "#K0041"
/** ตัวเลือกเป้าที่บันทึกยอดได้ (metric, active) สำหรับฟอร์ม */
export type EntryGoalOption = { id: string; title: string; unit: string | null; period_type: PeriodType; period_start: string; target_value: number | null };
```

### 2.3 `src/core/domain/entries.ts` (pure) + `entries.test.ts` (vitest)

- `sumAmounts(entries: {amount:number}[]): number`
- `dailyTotals(entries: {entry_date:ISODate; amount:number}[]): Map<ISODate, number>`
- `cumulativeSeries(entries, period: Period, today: ISODate): { date: ISODate; total: number }[]` — one point per day from `period.start` to `min(today, period.end)`; entries outside the period are ignored; running sum.
- `planValueAt(target: number, period: Period, date: ISODate): number` = `target * elapsedRatio(period, date)`.
- `entryStreak(dates: Iterable<ISODate>, today: ISODate): number` = `currentStreak(dates, today)` (re-export/reuse `core/domain/streak.ts`).
- `averagePerDay(total: number, period: Period, today: ISODate): number` = total / max(1, elapsed days incl. today) — rounded to integer.
- `perDayNeeded(remaining: number, daysLeft: number): number` = `daysLeft > 0 ? ceil(remaining/daysLeft) : remaining`.
- `paceDelta(current: number, target: number, period: Period, today: ISODate): number` = `round(current − target×elapsedRatio)` (same maths as `GoalProgressPanel` — then make `GoalProgressPanel` use this helper).
- `percentChange(current: number, previous: number): number | null` (null when previous ≤ 0) → rounded integer percent.
- Tests: ≥ 8 cases incl. empty entries, entries before/after period, streak with gap, percentChange null.

### 2.4 `src/core/goals/completion.ts` (server-only, **not** "use server")

`export async function markMetricCompletedIfReached(supabase: ServerSupabase, userId: string, goalId: string): Promise<{ current: number; percent: number; completed: boolean } | null>` — re-reads the goal, if `isMetricComplete(goal) && !goal.completed_at` → update `completed_at` + `status: "completed"` and `emitEvent(... "goal.completed", {...})`; returns current/percent(`computeProgress`)/completed. Move the equivalent code out of `updateCurrentValue` and call this helper there.

### 2.5 `src/core/goals/actions.ts` — `updateCurrentValue` refactor

Keep signature/result. New body: validate → requireUser → read goal (must be metric, else `notMetric`) → read the **true entry sum** `trueSum = (select sum(amount) from goal_entries where goal_id = …) ?? 0` → `delta = currentValue − trueSum` → if `delta !== 0` insert into `goal_entries` `{ user_id, goal_id, entry_date: todayBkk(), amount: delta, note: null }` (error → `generic`) → `markMetricCompletedIfReached` → revalidate as before (+ `/entries`) → `ok({ percent, completed })`.

> Use `trueSum`, **not** `goal.current_value`: the trigger writes `greatest(0, sum)`, so once the net sum goes negative the two diverge and `trueSum + delta` would not equal the value the user typed. `entry_date = todayBkk()` is inside the goal period for the normal case; when today falls outside the goal's period (editing a past/future goal) clamp it to the nearest period edge rather than rejecting — this path must never fail for a value the old UI accepted.

### 2.6 `src/core/entries/actions.ts` ("use server")

- `addEntry(input) → ActionResult<{ id: string; total: number; percent: number; completed: boolean }>`: parse `entryFormSchema`; requireUser; goal must be own + `goal_kind = 'metric'` + `status <> 'archived'` (else `invalidGoal` / `notMetric` / `goalArchived`); `entry_date` must satisfy `periodContains(periodOf(goal.period_type, goal.period_start), entryDate)` else `fail("entryOutsidePeriod", { entryDate: ["entryOutsidePeriod"] })` (§1.11); insert; `markMetricCompletedIfReached`; `emitEvent(... "entry.logged", { goalId, entryId, amount, date })`; `revalidateEntries(goalId)`.
- `updateEntry(input)` (`updateEntrySchema`) → re-read the row's goal, apply the same `entryOutsidePeriod` check, update `entry_date/amount/note/channel` of own row (`maybeSingle`, `notFound`), completion check, revalidate.
- `deleteEntry(input)` → delete own row, revalidate. (Completion status is not reverted when totals drop — same as today.)
- `revalidateEntries(goalId)`: `/dashboard`, `/goals`, `/goals/${goalId}`, `/entries`, `/search`.

### 2.7 `src/core/entries/queries.ts` (server-only)

- `listGoalEntries(goalId): Promise<GoalEntry[]>` — all entries of one goal, `entry_date asc, created_at asc`.
- `listEntries(filter: { goalId?: string; from?: ISODate; to?: ISODate; channel?: Channel; search?: string; limit?: number; offset?: number }): Promise<{ rows: GoalEntryWithGoal[]; total: number }>` — `select("*, goal:goals(id, title, persona_data)", { count: "exact" })`, order `entry_date desc, created_at desc`, `.range(offset, offset+limit-1)`; `search` → `.ilike("note", `%${q}%`)`.
- `listEntryGoalOptions(): Promise<EntryGoalOption[]>` — active metric goals (`status = 'active'`, `goal_kind = 'metric'`), map `persona_data.unit` via `goalUnit`.
- `getEntryStreak(today): Promise<number>` — entry dates of the last 60 days (all goals) → `entryStreak`.
- `sumEntriesBetween(from, to, goalId?)`: number (for "เทียบ ส.ค." / "เทียบเมื่อวาน").

### 2.8 Events

`src/core/events/types.ts`: add `"entry.logged": { goalId: string; entryId: string; amount: number; date: string }` to `EventPayloads` and `EVENT_TYPES`.

### 2.9 Request-level dedupe (`react` `cache`)

Wrap with `cache()` keeping names/signatures: `getDayPlan` and `getStreak` (`core/tasks/queries.ts`), `listParentCandidates` and `listGoalsWithProgress` (`core/goals/queries.ts` — cache only dedupes the no-arg call; that is enough), `getMe` (`core/profile/queries.ts`), `listEntryGoalOptions`. Example: `export const getDayPlan = cache(async (date: ISODate): Promise<DayPlan<TaskWithGoal>> => { … });`.

### 2.10 i18n (phase 1 only)

`errors`: `"tooLarge": "ตัวเลขใหญ่เกินไป"`, `"goalArchived": "เป้านี้เก็บเข้ากรุแล้ว"`, `"entryOutsidePeriod": "วันที่อยู่นอกช่วงของเป้าหมายนี้"`.

### Phase 1 acceptance

`pnpm typecheck`, `pnpm lint`, `pnpm test` green; migration applied locally; `psql`-free check via `pnpm exec supabase migration list`; tracking-log entry; commit `M10a`.

## 3. Phase 2 — desktop shell v3, dashboard v3, goals v2, goal detail v2 (`M10b`)

### 3.1 Navigation model — `src/components/layout/nav-items.ts`

```ts
export type NavKey = "dashboard" | "goals" | "entries" | "tasks" | "calendar" | "reports" | "settings";
export type NavItem = { key: NavKey; href: string; icon: LucideIcon; badge?: "tasks" | "pro"; disabled?: boolean };
export const NAV_SECTIONS: ReadonlyArray<{ key: "primary" | "more"; items: NavItem[] }> = [
  { key: "primary", items: [dashboard LayoutDashboard, goals Target, entries NotebookPen(/entries), tasks CheckSquare(/tasks, badge "tasks"), calendar CalendarDays] },
  { key: "more", items: [reports BarChart3 (href "#", disabled, badge "pro"), settings Settings] },
];
/** 4 แท็บบนมือถือ (Design §8.1 — ไม่เปลี่ยน) */
export const MOBILE_NAV_ITEMS = [dashboard, goals, calendar, settings];
export const NAV_ITEMS = MOBILE_NAV_ITEMS; // keep the old export for BottomNav (or update BottomNav to MOBILE_NAV_ITEMS and drop it)
```

`isActivePath` unchanged. i18n `nav`: add `"entries": "บันทึกยอด"`, `"tasks": "งาน"`, `"reports": "รายงาน"`, `"sectionPrimary": "หลัก"`, `"sectionMore": "เพิ่มเติม"`, `"proSoon": "มีในแพ็กเกจ Pro (เร็ว ๆ นี้)"`, `"search": "ค้นหา"`, `"searchPlaceholder": "ค้นหางาน เป้าหมาย รายการ…"`, `"notifications": "การแจ้งเตือน"`.

### 3.2 Shell data — `AppShell.tsx` (server) → `ShellFrame.tsx` (client) → `Sidebar.tsx` (client)

`AppShell` now computes: `today = todayBkk()`, `plan = await getDayPlan(today)` (cached), `openTasks = plan.overdue.length + plan.due.length`, `overdue = plan.overdue.length`, `lineLinked = Boolean(me.profile.line_user_id)`, `tier = me.profile.subscription_tier`. Passes a serializable `shell` object to `ShellFrame` → `Sidebar`, and the notification items to `TopBar`.

`Sidebar` v3 look (turn 7 `7a` aside): white, `shadow-sidebar`, padding 12, `w-60` / collapsed `w-[72px]`.
- Head row 48px: logo tile 32×32 `rounded-sm bg-brand-500` containing the compass polygon SVG (`<svg viewBox="0 0 10 10"><polygon points="5,0 7,5 5,10 3,5" class="fill-neutral-0"/><polygon points="5,0 7,5 5,5" class="fill-accent-500"/></svg>` 18px) + "Kemtit" `text-h2 text-brand-800` (link to /dashboard) · toggle button 40×40 `text-text-secondary` (`ChevronsLeft`, rotate when collapsed; aria-labels `nav.collapse`/`nav.expand` unchanged — QA relies on them).
- Section label (`nav.sectionPrimary`/`sectionMore`): `text-[11px] font-semibold uppercase tracking-[.08em] text-brand-200 px-3 pt-4 pb-1.5` (hidden when collapsed).
- Item: `h-12 rounded-md px-3 gap-3 text-base` · active: `bg-brand-50 text-brand-600 font-semibold` + left bar `absolute left-0 top-3 bottom-3 w-[3px] rounded-r-[3px] bg-brand-500` · inactive `text-text-secondary hover:bg-brand-50 hover:text-brand-600` · icon 22px stroke 1.5 · label `sr-only` when collapsed (keep `title` tooltip).
- Badge `tasks`: pill `h-[22px] px-2 rounded-full bg-brand-50 text-brand-800 text-caption` showing `openTasks` (hide when 0). Badge `pro`: `h-5 px-2 rounded-full bg-brand-800 text-neutral-0 text-[11px] font-semibold tracking-[.02em]` "PRO".
- Disabled item (`reports`): render `<span role="link" aria-disabled="true" title={t("nav.proSoon")}>` with `cursor-not-allowed opacity-70`, not a Next Link.
- Footer (expanded only): divider `border-t border-border pt-3.5`; row = avatar 36px (`LetterAvatar` or `<Avatar>` with `avatarUrl`) + `display_name · persona name` (`text-small font-semibold truncate`) + email (`text-[11px] text-text-secondary truncate`). Collapsed: avatar only, centered.
- `ProCard` (new client component `src/components/layout/ProCard.tsx`, expanded only): `rounded-lg bg-brand-50 p-3.5 mt-1.5 flex flex-col gap-2` — row `แพ็กเกจ Free`/`แพ็กเกจ Pro` (`pro.tierFree`/`pro.tierPro`) + pill `PRO` when pro · `pro.pitch` "Pro: เป้าหมายไม่จำกัด · รายงานสัปดาห์" `text-caption text-text-secondary` · button `h-10 rounded-full bg-brand-500 text-neutral-0 text-small w-full` `pro.upgrade` "อัปเกรด Pro" → `toast(t("pro.comingSoon"))`. Hidden entirely for tier `pro` except the label row. No "1/1 เป้า" bar (decision 6).

### 3.3 `TopBar.tsx` v3 (desktop) — mobile unchanged

Desktop (`lg:`) right cluster, absolutely positioned like today (`lg:absolute lg:top-0 lg:right-8 lg:h-[72px]`), gap 3:
1. Search form: `<form role="search" action="/search" method="get">` pill `h-11 w-56 xl:w-[300px] rounded-full bg-bg-surface shadow-sm px-3.5 flex items-center gap-2.5` with `Search` icon 18px `text-text-secondary` and `<input name="q" aria-label={t("nav.search")} placeholder={t("nav.searchPlaceholder")} className="flex-1 min-w-0 bg-transparent text-small outline-none placeholder:text-text-muted">`; Enter submits (native form).
2. `NotificationsMenu` (new client `src/components/layout/NotificationsMenu.tsx`): button `size-11 rounded-md bg-bg-surface shadow-sm text-brand-800` with `Bell` 20px, `aria-label={t("nav.notifications")}`; dot `absolute top-2.5 right-2.5 size-2 rounded-full bg-accent-500 ring-2 ring-bg-surface` when items > 0. Dropdown (`DropdownMenu` ui) items: overdue → `notifications.overdue` "งานค้าง {count} รายการ" → Link `/tasks`; LINE not linked → `notifications.lineNotLinked` "ยังไม่ได้เชื่อม LINE — รับสรุปงานทุกเช้า" → Link `/settings`; empty → `notifications.empty` "ไม่มีการแจ้งเตือนใหม่" (disabled item).
3. `UserMenu` desktop **chip** variant (prop `variant?: "avatar" | "chip"`, default `avatar` = current markup): trigger `h-11 rounded-full bg-bg-surface shadow-sm pl-1 pr-3.5 flex items-center gap-2.5` = avatar 36px + column (`display_name` `text-small font-semibold text-text-primary`, persona name `text-[11px] font-medium text-accent-900`) + `ChevronDown` 16px `text-text-secondary`. Keep `aria-label={t("a11y.userMenu")}` on the trigger (QA clicks "เมนูผู้ใช้"). Mobile keeps the persona pill + avatar exactly as now (TopBar renders the pill `lg:hidden`, chip `hidden lg:flex`).

### 3.4 `PageHeader.tsx` (HIGH impact — additive only)

New **optional** prop `breadcrumb?: string`. Turn 7's compact header applies **only to pages that pass it** (dashboard and `/entries`); turn 6 is authoritative for goals / goal-detail / calendar / settings, whose headers stay 24px with no breadcrumb.

- When `breadcrumb` is given: desktop title `lg:text-h2` (20px) with a breadcrumb line under it (`text-caption text-text-secondary flex gap-1.5 lg:flex hidden`): `Kemtit` › `<span class="text-brand-800">{breadcrumb}</span>`, plus ` · {meta}` when `meta` is set (and then `meta` is not rendered again on its own line).
- When it is absent: **exactly today's markup** — `text-h1` on all sizes, `meta` on its own `lg:block` line, no breadcrumb row. Do not change the five existing call sites' appearance.
- `eyebrow` stays mobile-only, `description` unchanged, toolbar grid unchanged.
- Header right-padding must clear the new TopBar cluster (search + bell + chip): `lg:pr-[520px] xl:pr-[600px]` replacing `lg:pr-80`, and add `truncate` to the `h1` so a long user-supplied goal title cannot collide with it.

### 3.5 Dashboard — `src/app/(app)/dashboard/page.tsx`

- Read `searchParams` (`chart` = `"week" | "month"`, default month).
- Render: `<PageHeader title={t("heading")} breadcrumb={t("title")} meta={formatThaiDate(today, "longWeekday")} eyebrow={greeting} actions={…same…} />` (no toolbar on desktop v3; mobile unchanged).
- Then a single `ResponsiveSwitch` (§1.10) — never two trees in the DOM:
  ```tsx
  <ResponsiveSwitch
    mobile={<div className="grid gap-4">{/* existing registry widget grid, unchanged */}</div>}
    desktop={<Suspense fallback={<DesktopDashboardSkeleton />}><DesktopDashboard today={today} chart={chart} /></Suspense>}
  />
  ```
  The mobile branch keeps its own `<Suspense>` wrappers exactly as today.

`src/app/(app)/dashboard/desktop-dashboard.tsx` (server, async). Data (all `Promise.all`): `goal = getMainMonthGoal(monthStart)`, `entries = goal ? listGoalEntries(goal.id) : []`, `plan = getDayPlan(today)`, `taskStreak = getStreak(today)`, `entryStreak = getEntryStreak(today)`, `prevMonthToDate = sumEntriesBetween(prevMonthStart, prevMonthSameDay)`, `yesterday = sumEntriesBetween(addDaysISO(today,-1), addDaysISO(today,-1))`, `weekTasks = getWeekTaskStats(today)` (new in `core/tasks/queries.ts`: non-recurring tasks with `due_date` in `[startOfWeekISO, endOfWeekISO]` → `{ done, total }`), `recent = listEntries({ limit: 5 })`, `goalOptions = listParentCandidates()`.
Layout: `grid grid-cols-12 gap-5` (design gap 20):
1. **KPI row** — 4 × `StatTile` (extend `src/components/domain/StatTile.tsx` with optional `icon?: LucideIcon`, `unit?: string`, `badge?: { tone: "success" | "danger" | "neutral"; icon?: "up" | "down"; text: string }`, `hint?` already exists; new look when `icon` is given: `rounded-lg bg-bg-surface px-6 py-5 shadow-md`, icon tile `size-12 rounded-md bg-brand-50 text-brand-600`, label `text-small text-text-secondary`, value `text-h1 text-text-primary` + unit `text-caption text-text-secondary ml-1`, footer `border-t border-border pt-2.5 mt-3 flex items-center gap-2` with the badge pill (`h-6 px-2.5 rounded-full` success-50/800 · danger-50/800 · bg-subtle/text-secondary, `ArrowUpRight`/`ArrowDownRight` 12px) + hint text). Each `col-span-3`:
   - `entries.kpi.monthTotal` (unit THB: "ยอดขายเดือนนี้", else `entries.kpi.monthTotalGeneric` "ทำได้เดือนนี้") — icon `CircleDollarSign`, value `formatValueParts(current, unit)`, badge = `percentChange(current, prevMonthToDate)` → `+12%` success / `-5%` danger, hint `entries.kpi.vsLastMonth` "เทียบ{month}" with previous month short name (`formatThaiDate(prevMonthStart, "monthYear")` → use `new Intl.DateTimeFormat("th-TH-u-ca-buddhist", { month: "short", timeZone: "UTC" })` added to `format.ts` as style `monthShort`); when previous = 0 → no badge, hint `entries.kpi.noCompare` "ยังไม่มีข้อมูลเปรียบเทียบ".
   - `entries.kpi.todayTotal` "ยอดวันนี้" (generic `ทำได้วันนี้`) — icon `ShoppingBag`, value = today's total, badge vs yesterday, hint `entries.kpi.vsYesterday` "เทียบเมื่อวาน".
   - `entries.kpi.weekTasks` "งานเสร็จสัปดาห์นี้" — icon `SquareCheck`, value `{done}/{total}` unit `งาน` (`widgets.goalProgress.tasksUnit`), badge: overdue > 0 → danger `-{overdue}` hint `entries.kpi.overdue` "ค้างจากก่อนหน้า" else success `entries.kpi.noOverdue` "ไม่มีงานค้าง".
   - `entries.kpi.entryStreak` "บันทึกต่อเนื่อง" — icon `Flame`, value streak unit `วัน`, badge: streak ≥ 7 → success `entries.kpi.streakHit` "ครบ 7 วัน" else neutral `entries.kpi.streakToGo` "อีก {days} วันครบ 7 วัน"; hint `entries.kpi.streakHint` "บันทึกทุกวันสร้างนิสัย".
2. **Chart card** `col-span-8` (`SalesChartCard`, server): white card `rounded-lg p-6 shadow-md`; header `h2 text-h3 text-brand-800` `entries.chart.title` "ยอดขายสะสม" (generic "ยอดสะสม") + `SegmentedNav` (reuse) items สัปดาห์ (`?chart=week`) / เดือน (`?chart=month`) / ปี (rendered as a disabled span with `Lock` 12px + `title=nav.proSoon`, not a link — extend `SegmentedNav` with optional `disabled?: boolean` per item); stats row: `entries.chart.total` "สะสม" / `entries.chart.avgPerDay` "เฉลี่ย/วัน" / `entries.chart.needPerDay` "ต้องทำ/วัน" (value `text-h2` + unit caption) and legend (line brand-500 `entries.chart.legendTotal` "ยอดสะสม" · dashed brand-200 `legendPlan` "แผนเฉลี่ย" · pink dot `legendToday` "วันนี้"); then `<SalesChart …/>`. Empty (no metric month goal) → `EmptyState` compass variant with CTA `?new=goal` spanning 12 columns instead of cards 2–4.
3. **Compass card** `col-span-4` (`CompassCard`, server; `aria-label={t("entries.compass.title")}` "เข็มทิศเดือนนี้"): header h2 + `PaceBadge`; goal title as `Link` to `/goals/{id}` (`text-small text-text-secondary hover:underline`, truncate); `CompassDial` `size-[168px] drop-shadow-dial` centered; 3 tiles `grid-cols-3 gap-2` each `rounded-md bg-brand-50 px-2 py-2.5 text-center` value `text-h2 text-brand-800` label `text-[11px] text-text-secondary`: `entries.compass.daysLeft` "วันที่เหลือ" / `entries.compass.remaining` "{unit}ที่เหลือ" (unit from `formatValueParts(...).unit ?? ""`; when unit null → `entries.compass.remainingPlain` "ที่เหลือ") / `entries.compass.perDay` "{unit}/วัน" (null → "ต่อวัน"); then `<QuickEntryForm goal=… compact />` pinned to bottom (`mt-auto`). Goal reached (≥100%) → replace tiles with `widgets.goalProgress.reached` line and still allow logging.
4. **Recent entries card** `col-span-8`: h2 `entries.recent.title` "บันทึกยอดล่าสุด" + link `/entries` `entries.recent.viewAll` "ดูทั้งหมด" (`ChevronRight` 14) → `<EntriesTable rows={recent.rows} today goalOptions compact />`; empty → `entries.recent.empty` "ยังไม่มีบันทึกยอด — เริ่มจากช่องด้านขวา".
5. **Tasks card** `col-span-4`: reuse `TodayTasksWidget` — add prop `quickAdd?: boolean` that renders `<QuickTaskInput today />` in a footer (`border-t border-border pt-3 mt-auto flex items-center gap-2`). Because `ResponsiveSwitch` guarantees only one tree exists (§1.10), reuse is safe and the region keeps the name **`งานวันนี้`**. Two things the shared e2e/QA steps depend on and that must survive: the region name `งานวันนี้`, and the header "+" link with `aria-label="เพิ่มงาน"` (`e2e/qa/localhost-qa.spec.ts` step `desktop-shell-sidebar-topbar` asserts `getByRole("link", { name: "เพิ่มงาน" }).first()` is visible on `/dashboard` — the desktop toolbar that used to satisfy it is gone in v3, so this link is now the only thing keeping that step green).

`QuickEntryForm` (`src/components/domain/QuickEntryForm.tsx`, client): props `goal: { id, title, unit }`, `layout: "compact" | "card"`. Compact (compass card): `flex gap-1.5` — `<Input inputMode="numeric" aria-label={t("entries.quick.amountLabel")} placeholder={t("entries.quick.placeholder")} className="h-11 rounded-sm text-base font-semibold" />` + `<Button size="sm"><Plus/>บันทึก</Button>`; Enter submits. Card layout (turn 6 white card, used in goal detail): title row `entries.quick.title` "บันทึกยอดวันนี้" + `formatThaiDate(today, "weekday")`; big input `h-12 text-h2 font-semibold pr-12` with unit suffix absolutely positioned (`บาท`/unit); chips row `+500 / +1,000 / +2,000` (only when unit THB; chip = `Button variant="outline" size="xs"` adding to the value) ; primary `Button size="lg" w-full` `<Plus/>บันทึก`; hint `entries.quick.hint` "เข็มและกราฟอัปเดตทันที" caption centered. Submit → `addEntry({ goalId, entryDate: todayBkk(), amount })` → on ok: `toast.success(t("entries.toasts.logged", { amount: formatValueWithUnit(amount, unit), total: formatValueWithUnit(result.data.total, unit) }))` ("บันทึกแล้ว +{amount} · ยอดรวม {total}"); if `completed` → `toast.success(t("goals.completedToast", { title }))` + `<Celebration>`; clear input; `router.refresh()`. Validation: empty/NaN/≤0 → inline `errors.positive`. Pending → button disabled + `common.saving`.

`QuickTaskInput` (`src/components/domain/QuickTaskInput.tsx`, client): dashed circle icon `size-6 rounded-full border-[1.5px] border-dashed border-brand-200` with `Plus` 12px, `<input aria-label={t("widgets.todayTasks.add")} placeholder={t("widgets.todayTasks.quickPlaceholder")} ("เพิ่มงานวันนี้ แล้วกด Enter") class="flex-1 h-10 bg-transparent text-base outline-none">`, button `Button variant="secondary" size="sm"` `common.add`. Submit → `createTask({ title, dueDate: today, domain: "work", recurrence: "none", weekdays: [], goalId: null })` → `toast.success(t("tasks.toasts.created"))` → clear → `router.refresh()`.

`SalesChart` (`src/components/domain/SalesChart.tsx`, plain server-safe component): props `{ series: {date, total}[]; target: number; period: Period; today: ISODate; range: "week"|"month"; unit: string|null; className? }`. Port of the design's `v2Chart`: viewBox `0 0 800 200`, padding l52 r20 t22 b30, `maxY = max(target, lastTotal) * 1.05`; x-domain = the shown range (month: `period.start…period.end`; week: `startOfWeekISO(today)…endOfWeekISO(today)`, series filtered to it, plan line for those dates via `planValueAt`); grid lines at 0 / target/2 / target (target line dashed `stroke-brand-200`, others `stroke-border`), y labels `0`, `25k`, `50k` (`v/1000 + "k"`, integers) `fill-text-secondary text-[12.5px] font-medium`; target label right `เป้า {formatNumber(target)}` `fill-brand-600`; plan line dashed `3 5` `stroke-border-strong`; area `fill-brand-100 opacity-80`; line `stroke-brand-500` 2.5 round; x labels at day 1, 7, 14, 21, last (month) or every day (week) using `formatThaiDate(d, "short")`; today: vertical dashed `2 3` `stroke-accent-500` + circle r5.5 `fill-accent-500 stroke-neutral-0` 2 + label `{formatNumber(total)} วันนี้` `fill-text-primary font-semibold`. `role="img"` `aria-label={t("entries.chart.aria", { total, target })}` ("ยอดสะสม {total} จาก {target}"). Tick/label text uses `className="font-sans"` — no hex, no inline colours. Story: `src/components/domain/SalesChart.stories.tsx` with 3 states (empty month, mid-month ahead, week view).

### 3.6 Goals list v2 (desktop) — `GoalCard.tsx`

Restructure to `div` + stretched link (title area `Link` with `after:absolute after:inset-0`; card `relative`); everything interactive inside sits `relative z-10`. Desktop-only additions (`hidden lg:…`): small `CompassDial` `size-16 small` left of title; number line `text-h1` `{current} / {target}` (existing); `ProgressBar marker` (existing); footer row: `PaceBadge` left + `<QuickEntryButton goal />` right (metric, active/completed-not-archived only) — `Button variant="secondary" size="sm"` `<Plus/>` `entries.quick.button` "บันทึก" opening `ResponsiveDialog` titled `entries.new` "บันทึกยอด" with `<EntryForm mode="create" goalOptions=[this goal] initial={{ goalId }} />` (new client `src/components/domain/QuickEntryButton.tsx`). Mobile markup/text stays as today (e2e `getByRole("link", { name: /ออกกำลังกายเดือนนี้/ })` must still resolve to the card link → the title link's accessible name must contain the title; the button's name is "บันทึก"). GoalsPage: `meta` already shows month; nothing else changes. Update `GoalCard.stories.tsx` if props changed.

### 3.7 Goal detail v2 (desktop) — `src/app/(app)/goals/[id]/page.tsx`

- Toolbar end: prepend `<ShareProgressButton …/>` (new client `src/components/domain/ShareProgressButton.tsx`: `Button` primary `goals.share` "แชร์ความคืบหน้า" → `navigator.share({ title, text, url })` when available else `navigator.clipboard.writeText(text)` + `toast.success(t("goals.shareCopied"))` "คัดลอกข้อความความคืบหน้าแล้ว"; text = `goals.shareText` "{title} — ทำได้ {current} จาก {target} ({percent}) · Kemtit"). Keep `GoalDetailActions` unchanged otherwise (QA needs "อัปเดตยอด"); the existing "แก้ไข" outline button is the design's "แก้ไขเป้า".
- Hero (4 cols) additions for metric goals: under the display number → line `widgets.goalProgress.target` (exists) + ` · {percent}`; pace row = `PaceBadge` + delta text (`goals.aheadOfPlan/behindPlan/onPlan` — use `paceDelta`); sentence block `border-t border-neutral-0/70 pt-2.5 mt-2.5 text-small text-brand-800`: `goals.remainingSentence` "เหลืออีก <b>{remaining}</b> ใน {days} วัน" + `goals.perDaySentence` "≈ <b>{perDay}</b> ก็ถึง" (use `t.rich` with `b` → `<strong className="text-text-primary">`); hide when reached or days = 0. Sub-card `rounded-md bg-bg-surface px-3.5 py-3 flex items-center justify-between`: label `goals.form.target`-like `goals.targetLabel` "เป้าหมาย" caption + `{target} · {period label}` `text-h3`; right: `Button variant="outline" size="xs"` `<Pencil/>` `common.edit` as `Link href="?edit=goal" scroll={false}`. `GoalDetailActions`: read `useSearchParams().get("edit") === "goal"` → open the edit dialog initially; on close `router.replace(pathname)`.
- 8 cols (metric goals only, above the existing เส้นทาง/งานที่ผูก sections): `SalesChartCard` (same component as dashboard, `range="month"`, header `entries.chart.routeTo` "เส้นทางสู่ {target}" + caption `entries.chart.legendHint` "เส้นประ = แผนเฉลี่ยต่อวัน · จุดชมพู = วันนี้"); then `grid lg:grid-cols-[minmax(0,1fr)_272px] gap-6`: **History card** (`EntriesHistory`, client, `src/components/domain/EntriesHistory.tsx`): h2 `entries.history.title` "ประวัติการบันทึก" + `entries.history.count` "{count} รายการ · คลิกเพื่อแก้ไข"; rows `min-h-[52px] border-t border-border flex items-center gap-3`: dot `size-2 rounded-full` (`bg-accent-500` today / `bg-brand-200` other) · `formatThaiDate(entry_date, "weekday")` · `+{formatNumber(amount)}` bold + unit caption (negative adjustments show `−`) · icon button `Pencil` (`aria-label={t("entries.history.edit")}` "แก้ไขรายการ") → `ResponsiveDialog` + `EntryForm mode="edit"`; also delete inside the edit dialog (`entries.delete` "ลบรายการ", undo toast). Empty → `entries.history.empty` "ยังไม่มีการบันทึก". Show latest 8, link `entries.history.all` "ดูทั้งหมด" → `/entries?goal={id}` when more. **Quick entry card** = `<QuickEntryForm goal layout="card" />`. These render on mobile too (stacked) — that is the intended follow-up in the design ("ยกช่องบันทึกยอดกลับไป mobile").

### 3.8 `EntryForm` (`src/components/domain/EntryForm.tsx`, client, react-hook-form + zodResolver like `TaskForm`)

Props `{ mode: "create" | "edit"; entryId?: string; goalOptions: EntryGoalOption[]; initial?: Partial<EntryFormValues>; onDone: () => void; onDelete?: () => void }`. Fields: goal `Select` (hidden when exactly one option; label `entries.form.goal` "เป้าหมาย"; empty options → message `entries.form.noMetricGoal` "ยังไม่มีเป้าที่วัดเป็นตัวเลข — ตั้งเป้าก่อน" + button to `?new=goal`), amount (`Input type="number" inputMode="decimal"` `h-14 text-h2`, label `entries.form.amount` "จำนวน", suffix unit; chips +500/+1,000/+2,000 when unit THB), date (`DatePicker`, label `entries.form.date` "วันที่", default today), channel (`Select` optional, label `entries.form.channel` "ช่องทาง", `entries.form.noChannel` "ไม่ระบุ", options `entries.channels.*`: shopee "Shopee", lazada "Lazada", tiktok "TikTok Shop", line "LINE OA", facebook "Facebook", storefront "หน้าร้าน", other "อื่น ๆ"), note (`Input`, label `entries.form.note` "รายการ", placeholder `entries.form.notePlaceholder` "เช่น ไลฟ์ 20:00 / โปรวันศุกร์"). Submit labels `entries.form.submitCreate` "บันทึกยอด" / `submitEdit` "บันทึกการแก้ไข". Toasts `entries.toasts.logged` (create, with amount/total) / `entries.toasts.updated` "แก้ไขรายการแล้ว". Errors via `FormMessageI18n`. Edit mode shows a ghost danger `entries.delete` button when `onDelete` given.

### 3.9 `QuickAddHost` / `QuickAddMenu`

`AppLayout` also loads `entryGoals = await listEntryGoalOptions()` and passes `entryGoals` to `QuickAddHost`. `?new=entry[&goal=id]` → `ResponsiveDialog` title `entries.new` "บันทึกยอด" + `<EntryForm mode="create" goalOptions={entryGoals} initial={{ goalId: goal ?? mainMonthMetric ?? first }} />`; `close()` also deletes `goal`. `QuickAddMenu`: third item `<NotebookPen/>` `nav.addEntry` "บันทึกยอด" → `?new=entry`.

### 3.10 i18n for phase 2 — add to `th.json`

`pro`: `tierFree` "แพ็กเกจ Free", `tierPro` "แพ็กเกจ Pro", `pitch` "Pro: เป้าหมายไม่จำกัด · รายงานสัปดาห์", `upgrade` "อัปเกรด Pro", `comingSoon` "แพ็กเกจ Pro เปิดให้สมัครเร็ว ๆ นี้", `badge` "PRO".
`notifications`: `overdue` "งานค้าง {count} รายการ", `lineNotLinked` "ยังไม่ได้เชื่อม LINE — รับสรุปงานทุกเช้า", `empty` "ไม่มีการแจ้งเตือนใหม่".
`nav`: as in 3.1 + `addEntry` "บันทึกยอด".
`goals`: `share` "แชร์ความคืบหน้า", `shareCopied` "คัดลอกข้อความความคืบหน้าแล้ว", `shareText` "{title} — ทำได้ {current} จาก {target} ({percent}) · Kemtit", `targetLabel` "เป้าหมาย", `remainingSentence` "เหลืออีก <b>{remaining}</b> ใน {days} วัน", `perDaySentence` "≈ <b>{perDay}</b> ก็ถึง".
`widgets.todayTasks.quickPlaceholder` "เพิ่มงานวันนี้ แล้วกด Enter".
`entries` (new namespace): `title` "บันทึกยอด", `new` "บันทึกยอด", `delete` "ลบรายการ", `kpi.*`, `chart.*`, `compass.*`, `recent.*`, `quick.*` (`title` "บันทึกยอดวันนี้", `amountLabel` "ยอดวันนี้", `placeholder` "ยอดวันนี้ (บาท)" — generic goals: "จำนวนวันนี้", `button` "บันทึก", `hint` "เข็มและกราฟอัปเดตทันที"), `history.*`, `form.*`, `channels.*`, `toasts.*` (`logged` "บันทึกแล้ว +{amount} · ยอดรวม {total}", `updated` "แก้ไขรายการแล้ว", `deleted` "ลบรายการ {code} แล้ว", `restored` "นำรายการ {code} กลับมาแล้ว"), `status.today` "วันนี้", `status.confirmed` "ยืนยันแล้ว", `adjustment` "ปรับยอด" (note fallback for entries with null note created by the absolute form), `fromDashboard` "บันทึกจากแดชบอร์ด" (note fallback otherwise), `noChannel` "—".

### 3.11 `EntriesTable` (`src/components/domain/EntriesTable.tsx`, client) — used by dashboard (compact) and `/entries` (full)

Props `{ rows: GoalEntryWithGoal[]; today: ISODate; goalOptions: EntryGoalOption[]; compact?: boolean; showGoal?: boolean }`. Markup = design table: wrapper `overflow-x-auto -mx-3`; `<table className="w-full border-collapse">`; `th` `text-left px-3 py-2.5 text-caption font-semibold text-text-secondary border-b border-border whitespace-nowrap` (`จำนวน`, `จัดการ` right-aligned); columns `entries.table.code` "รหัส" · `date` "วันที่" · `note` "รายการ" (icon tile `size-8 rounded-sm bg-brand-50 text-brand-600` `NotebookPen` 16 + note text or fallback; `showGoal` adds the goal title in caption below) · `channel` "ช่องทาง" · `amount` "จำนวน" (`font-semibold` + unit caption) · `status` "สถานะ" (pill) · `actions` "จัดการ" (icon buttons 32×32 `rounded-sm`: edit `bg-brand-50 text-brand-600` `Pencil` 14 `aria-label=common.edit`; delete `bg-danger-50 text-danger-800` `Trash2` 14 `aria-label=common.delete`). `td` `px-3 py-3 text-small border-b border-border whitespace-nowrap`. Edit → `ResponsiveDialog` + `EntryForm mode="edit"`. Delete → optimistic hide + `toast(t("entries.toasts.deleted", { code }), { duration: 5000, action: undo })` then `deleteEntry` after 5 s (copy the `TaskList` timer pattern), `router.refresh()`.

### Phase 2 acceptance

`pnpm typecheck && pnpm lint && pnpm test && pnpm build-storybook` green. Visual check with the in-app browser (dev server via `.claude/launch.json` "dev") at 1440×900 on /dashboard, /goals, /goals/[id]; mobile 390 width unchanged. Update `e2e/dashboard.spec.ts` now (see 4.6) so both projects pass: `pnpm e2e e2e/dashboard.spec.ts e2e/goals.spec.ts`. Tracking-log entry; commit `M10b`.

## 4. Phase 3 — `/entries`, CSV, `/tasks`, `/search`, tests, docs (`M10c`)

### 4.1 `/entries` — `src/app/(app)/entries/page.tsx` (server)

searchParams: `range` = `all | today | week` (default all) · `status` = `confirmed` (optional) · `channel` (Channel) · `goal` (uuid) · `page` (≥1). Page size 20. Query: `listEntries({ from, to, channel, goalId, limit: 20, offset })` where `range=today` → from=to=today; `week` → current week; `status=confirmed` → `to = min(to, yesterday)`. `PageHeader title=entries.title meta={formatThaiDate(today,"monthYear")}` toolbarStart = filter chips (`FilterChips`, small server component of `Link`s: `h-9 px-3.5 rounded-full border-[1.5px] text-small font-medium` active `border-brand-500 bg-brand-50 text-brand-800` else `border-border bg-bg-surface text-text-secondary`; chips: `entries.filters.all` "ทั้งหมด · {count}" (count = total of unfiltered — fetch `listEntries({limit:1})` for the count), `today` "วันนี้", `week` "สัปดาห์นี้", `confirmed` "ยืนยันแล้ว", channel `Select`-like dropdown = simple chips per channel that has entries is over-engineering → render one chip per `CHANNELS` value inside a `DropdownMenu` labelled `entries.filters.channel` "ช่องทาง" (client), active channel shown in the trigger); `toolbarEnd` = `Button variant="outline" asChild` `<a href={csvHref}>` `<Download/>` `entries.exportCsv` "ส่งออก CSV" + `Button asChild` `<Link href="?new=entry">` `<Plus/>` `entries.new`. On mobile the chips row scrolls horizontally (`overflow-x-auto flex gap-2`) and the buttons live in a second row under it (`toolbarStart` only exists on mobile; put the two buttons in `actions` for mobile as icon buttons or a small row below the header — keep it simple: render a `lg:hidden flex gap-2 mb-3` row with both buttons).
Stats (`grid lg:grid-cols-12 gap-5`, 4 × `StatTile col-span-3`): `entries.stats.total` "ยอดสะสม" (sum of filtered rows across all pages — compute via a second lightweight query `sumEntriesBetween(from,to,goalId)`; if channel filter is on, sum only current rows and label it `entries.stats.totalPage` "ยอดในหน้านี้"), `entries.stats.count` "จำนวนรายการ" (`total` + unit `รายการ`), `entries.stats.avgPerDay` "เฉลี่ยต่อวัน" (total ÷ distinct days in the filtered window, month by default), `entries.stats.goalStatus` "สถานะเป้า" (main month metric goal: `{percent}` `text-h1` + `PaceBadge`; none → "—").
Table card (`col-span-12`): h2 `entries.list.title` "รายการบันทึกยอด · {month}" + caption `entries.list.updated` "อัปเดตล่าสุด {when}" (latest `updated_at` via `formatRelative`), `<EntriesTable rows showGoal />`, pagination row `entries.pagination.showing` "แสดง {from}–{to} จาก {total} รายการ" + prev/next icon links (`aria-label` `calendar.nav.prev/next` reuse) + current page number button (`bg-brand-500 text-neutral-0 size-9 rounded-sm`). Empty (total 0) → `EmptyState` `entries.empty.title` "ยังไม่มีบันทึกยอด" / `description` "บันทึกยอดวันนี้จากแดชบอร์ด หรือกดปุ่มด้านบน" / cta `entries.new`.

### 4.2 CSV — `src/app/api/entries/export/route.ts`

`GET` with the same query params. `createServerSupabase()` → `auth.getUser()`; no user → 401 JSON. Fetch all filtered rows (cap 5000, `listEntries` with `limit: 5000`). Body = UTF-8 BOM + header `รหัส,วันที่,เป้าหมาย,รายการ,ช่องทาง,จำนวน` + rows (`entryCode`, ISO date, goal title, note, channel label (Thai from a small map in route — read labels via `getTranslations("entries.channels")`), amount). Escape quotes/commas (`"…"`). Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="kemtit-entries-<today>.csv"`, `Cache-Control: no-store`.

### 4.3 `/tasks` — `src/app/(app)/tasks/page.tsx`

Today's plan (like `DayView` in calendar page): `PageHeader title=tasks.title meta={t("calendar.todayLabel",{date})} toolbarStart={date pill like dashboard} toolbarEnd={<Button accent asChild><Link href="?new=task">…เพิ่มงาน}` → `TaskList groupByStatus showGoal` with `EmptyState` (`tasks.empty.today.*`). Max width `lg:max-w-3xl`.

### 4.4 `/search` — `src/app/(app)/search/page.tsx`

`q` param (trim). `< 2` chars → `EmptyState` `search.hint` "พิมพ์อย่างน้อย 2 ตัวอักษร". Else run in parallel (all via server Supabase, `ilike` `%q%`, limit 20 each): goals (`title`) → `GoalCard compact` grid; tasks (`title`) → list rows linking to `/calendar?view=day&date={due_date}`; entries (`note`) → `EntriesTable compact showGoal`. Sections `search.goals` "เป้าหมาย" / `search.tasks` "งาน" / `search.entries` "บันทึกยอด" with counts; none → `search.empty` "ไม่พบอะไรที่ตรงกับ “{q}”". `PageHeader title={t("search.title", { q })}` ("ค้นหา “{q}”") `breadcrumb=search.breadcrumb` "ค้นหา". Add `search.*` to th.json.

### 4.5 `Fab.tsx`

No change (FAB is fine on the new pages). `HIDDEN_ON` stays `["/settings"]`.

### 4.6 Tests

- `e2e/dashboard.spec.ts`: keep the mobile flow unchanged. Branch on `isMobile === false` for desktop, which now shows v3 instead of the widget grid: `const compass = page.getByRole("region", { name: "เข็มทิศเดือนนี้" })` → `compass.getByLabel("ยอดวันนี้").fill("25000")` → `compass.getByRole("button", { name: "บันทึก" }).click()` → `expect(page.getByText(/บันทึกแล้ว/)).toBeVisible()` → `expect(compass.getByText("50%")).toBeVisible()`; add the task through `QuickTaskInput` and still assert the streak pill. The `งานวันนี้` region locator needs **no** change (§1.10 — one tree only). Note the desktop tree only exists after hydration (`useIsDesktop`), so assert on a v3 element (`เข็มทิศเดือนนี้`) before interacting, rather than racing the SSR mobile markup.
- New `e2e/entries.spec.ts` (both projects): onboard → `/entries?new=entry` → fill amount 5000, note "ไลฟ์ 20:00", channel LINE OA → submit → toast → row with `฿5,000`/`5,000` + "วันนี้" pill visible → edit to 6000 → toast "แก้ไขรายการแล้ว" → delete → undo toast → click "เลิกทำ" → row still there → `page.request.get("/api/entries/export")` → 200, body contains `6000` and BOM; filter `?range=week` shows the row; `/goals/<id>` history list shows `+6,000`.
- `e2e/qa/localhost-qa.spec.ts` desktop: after the sidebar step add `desktop-sales-log` (sidebar link "บันทึกยอด" visible, log 1,000 via compass card, `/entries` table has ≥ 1 row, CSV link present) and update `desktop-goals-grid-and-detail` to also expect `getByRole("heading", { name: /เส้นทางสู่/ })`. In `desktop-shell-sidebar-topbar`, `getByRole("link", { name: "เพิ่มงาน" }).first()` now resolves to the tasks-card "+" link (§3.5 item 5) — confirm it still passes rather than deleting the assertion. **Mobile steps need no locator changes** (§1.10).
- Unit: `core/domain/entries.test.ts` (phase 1). Storybook: `SalesChart.stories.tsx` (phase 2), `EntriesTable.stories.tsx` (3 states: rows today/confirmed, compact, empty) — server actions imported by `EntriesTable` resolve through the existing `.storybook` mocks (`@/lib/supabase/server`, `next/cache`); if `next/navigation` needs a mock, add `.storybook/mocks/next-navigation.ts` like the others.

### 4.7 Docs

- `tracking-log.md`: one entry per phase (Thai), listing deviations from the design: no Free/Pro limit, no "เป้าหมายที่ 2 PRO" slot, circular checkboxes, dashboard title kept "ทิศทางวันนี้", "รายงาน" disabled, search/notifications minimal, chart "ปี" locked, mobile screens unchanged except goal-detail history/quick-entry cards.
- `README.md`: routes list (+ `/entries`, `/tasks`, `/search`, `/api/entries/export`) and one paragraph on `goal_entries` (current_value derived by trigger; absolute form = adjustment entry).
- `docs/kemtit-full-scope.md` row "บันทึกยอดขายจริงรายวัน" → mark Phase 1 done (manual entries + CSV export).

### Phase 3 acceptance

`pnpm typecheck && pnpm lint && pnpm test && pnpm build-storybook`; `pnpm e2e` (all specs, both projects, local Supabase running; `photos.spec.ts` needs `NEXT_PUBLIC_FLAG_UPLOADS=1` on a separate port as documented — run it too); QA spec both projects; `detect_changes --scope all` clean; commit `M10c`.
