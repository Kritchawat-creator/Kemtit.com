/* Kemtit Planner VNext prototype. This file is intentionally standalone and demo-only. */
(function () {
  "use strict";

  const DEMO_DATE = "2026-09-22";
  const STORAGE_KEY = "kemtit-planner-vnext-demo-v1";
  const root = document.getElementById("main-content");
  const sidebar = document.getElementById("sidebar");
  const topbar = document.getElementById("topbar");
  const bottomNav = document.getElementById("bottom-nav");
  const modalRoot = document.getElementById("modal-root");
  const toastRegion = document.getElementById("toast-region");
  const extras = window.KemtitExtraPages || {};
  let previousFocus = null;
  let pendingCapture = null;
  let focusTimer = null;
  let quickAfterRoute = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Canonical __iconNode geometry mirrored from lucide-react 1.41.0 ESM icon files.
  // Mapping and provenance: docs/prototypes/planner-vnext/licenses/README.md.
  // React-only key metadata is omitted; this standalone renderer emits the same SVG nodes.
  const ICON_PATHS = {
    calendar: "<path d=\"M8 2v3\"/><path d=\"M16 2v3\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/><path d=\"M3 9h18\"/>",
    inbox: "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\"/><path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\"/>",
    target: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><circle cx=\"12\" cy=\"12\" r=\"6\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>",
    chart: "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\"/><path d=\"m19 9-5 5-4-4-3 3\"/>",
    settings: "<path d=\"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>",
    plus: "<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>",
    check: "<path d=\"M20 6 9 17l-5-5\"/>",
    "check-circle": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16 9-5.5 5.5L8 12\"/>",
    arrow: "<path d=\"M5 12h14\"/><path d=\"m12 5 7 7-7 7\"/>",
    clock: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 6v6l4 2\"/>",
    heart: "<path d=\"M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5\"/>",
    wallet: "<path d=\"M3 11h3.75a2 2 0 0 1 1.6.8l.45.6a4 4 0 0 0 6.4 0l.45-.6a2 2 0 0 1 1.6-.8H21\"/><path d=\"M3 7h18\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"/>",
    folder: "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>",
    chevron: "<path d=\"m9 18 6-6-6-6\"/>",
    "chevron-left": "<path d=\"m15 18-6-6 6-6\"/>",
    "chevron-right": "<path d=\"m9 18 6-6-6-6\"/>",
    sparkles: "<path d=\"M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z\"/><path d=\"M20 2v4\"/><path d=\"M22 4h-4\"/><circle cx=\"4\" cy=\"20\" r=\"2\"/>",
    home: "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>",
    menu: "<path d=\"M4 5h16\"/><path d=\"M4 12h16\"/><path d=\"M4 19h16\"/>",
    search: "<path d=\"m21 21-4.34-4.34\"/><circle cx=\"11\" cy=\"11\" r=\"8\"/>",
    x: "<path d=\"M18 6 6 18\"/><path d=\"m6 6 12 12\"/>",
    compass: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"/>",
    review: "<rect width=\"8\" height=\"4\" x=\"8\" y=\"2\" rx=\"1\" ry=\"1\"/><path d=\"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2\"/><path d=\"M12 11h4\"/><path d=\"M12 16h4\"/><path d=\"M8 11h.01\"/><path d=\"M8 16h.01\"/>",
    briefcase: "<path d=\"M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16\"/><rect width=\"20\" height=\"14\" x=\"2\" y=\"6\" rx=\"2\"/>",
    repeat: "<path d=\"m2 9 3-3 3 3\"/><path d=\"M13 18H7a2 2 0 0 1-2-2V6\"/><path d=\"m22 15-3 3-3-3\"/><path d=\"M11 6h6a2 2 0 0 1 2 2v10\"/>",
    dollar: "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\"/><path d=\"M12 18V6\"/>",
    lock: "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\"/><path d=\"M7 11V7a5 5 0 0 1 10 0v4\"/>",
    play: "<path d=\"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z\"/>",
    pause: "<rect x=\"14\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"/><rect x=\"5\" y=\"3\" width=\"5\" height=\"18\" rx=\"1\"/>",
    undo: "<path d=\"M9 14 4 9l5-5\"/><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"/>",
    flag: "<path d=\"M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528\"/>",
    list: "<path d=\"M3 5h.01\"/><path d=\"M3 12h.01\"/><path d=\"M3 19h.01\"/><path d=\"M8 5h13\"/><path d=\"M8 12h13\"/><path d=\"M8 19h13\"/>",
    sun: "<circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2\"/><path d=\"M12 20v2\"/><path d=\"m4.93 4.93 1.41 1.41\"/><path d=\"m17.66 17.66 1.41 1.41\"/><path d=\"M2 12h2\"/><path d=\"M20 12h2\"/><path d=\"m6.34 17.66-1.41 1.41\"/><path d=\"m19.07 4.93-1.41 1.41\"/>",
    moon: "<path d=\"M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401\"/>",
    bell: "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"/><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"/>",
    book: "<path d=\"M12 5v16\"/><path d=\"M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z\"/>",
    link: "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\"/><path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\"/>",
    refresh: "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"/><path d=\"M21 3v5h-5\"/><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"/><path d=\"M8 16H3v5\"/>",
    sliders: "<path d=\"M10 5H3\"/><path d=\"M12 19H3\"/><path d=\"M14 3v4\"/><path d=\"M16 17v4\"/><path d=\"M21 12h-9\"/><path d=\"M21 19h-5\"/><path d=\"M21 5h-7\"/><path d=\"M8 10v4\"/><path d=\"M8 12H3\"/>",
    timer: "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"/><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"/><circle cx=\"12\" cy=\"14\" r=\"8\"/>",
    move: "<path d=\"M18 8L22 12L18 16\"/><path d=\"M2 12H22\"/>",
    trend: "<path d=\"M16 7h6v6\"/><path d=\"m22 7-8.5 8.5-5-5L2 17\"/>",
    user: "<path d=\"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2\"/><circle cx=\"12\" cy=\"7\" r=\"4\"/>",
    login: "<path d=\"m10 17 5-5-5-5\"/><path d=\"M15 12H3\"/><path d=\"M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4\"/>",
    dots: "<circle cx=\"12\" cy=\"12\" r=\"1\"/><circle cx=\"19\" cy=\"12\" r=\"1\"/><circle cx=\"5\" cy=\"12\" r=\"1\"/>",
    "calendar-plus": "<path d=\"M16 18h6\"/><path d=\"M16 2v3\"/><path d=\"M19 15v6\"/><path d=\"M21 11.5V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h8.3\"/><path d=\"M3 9h18\"/><path d=\"M8 2v3\"/>",
    goal: "<path d=\"M12 13V2l8 4-8 4\"/><path d=\"M20.561 10.222a9 9 0 1 1-12.55-5.29\"/><path d=\"M8.002 9.997a5 5 0 1 0 8.9 2.02\"/>",
    project: "<path d=\"M12 10v6\"/><path d=\"M9 13h6\"/><path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"/>",
    habit: "<path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\"/><path d=\"M2 6h4\"/><path d=\"M2 10h4\"/><path d=\"M2 14h4\"/><path d=\"M2 18h4\"/><path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\"/>",
  };

  function icon(name, label) {
    const path = ICON_PATHS[name] || ICON_PATHS.compass;
    const accessible = label ? ` role="img" aria-label="${escapeHtml(label)}"` : ' aria-hidden="true"';
    return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${accessible}>${path}</svg>`;
  }

  function makeDemoState() {
    return {
      version: 1,
      route: "today",
      scope: "all",
      planTab: "week",
      calendarTab: "week",
      taskFilter: "planned",
      focusTaskId: "task-proposal",
      focusSeconds: 25 * 60,
      focusRunning: false,
      planConfirmed: false,
      rescuePreview: false,
      rescueUndo: null,
      profile: { name: "คุณกิต", role: "เจ้าของร้าน + ผู้ดูแลงานลูกค้า", initials: "ก" },
      tasks: [
        { id: "task-proposal", title: "ส่งข้อเสนอให้ลูกค้า", area: "งาน", type: "work", estimatedMinutes: 90, dueDate: "2026-09-25", deadline: "2026-09-25", plannedDate: DEMO_DATE, plannedTime: "09:00", done: false, inbox: false, priority: "high", priorityLabel: "สูง", project: "รีแบรนด์ร้านกาแฟ", projectId: "project-client", goalId: "goal-product", reason: "กำหนดส่งศุกร์ · ใช้เวลาต่อเนื่อง" },
        { id: "task-sales", title: "ทำสรุปยอดขายประจำสัปดาห์", area: "งาน", type: "work", estimatedMinutes: 60, dueDate: "2026-09-23", deadline: "2026-09-23", plannedDate: DEMO_DATE, plannedTime: "13:00", done: false, inbox: false, priority: "medium", priorityLabel: "กลาง", project: "หลังบ้านร้าน", projectId: "project-client", goalId: "goal-product", reason: "ช่วยตัดสินใจโปรโมชันสัปดาห์นี้" },
        { id: "task-walk", title: "เดิน 30 นาทีหลังเลิกงาน", area: "สุขภาพ", type: "life", estimatedMinutes: 30, dueDate: null, deadline: null, plannedDate: DEMO_DATE, plannedTime: "17:00", done: false, inbox: false, priority: "medium", priorityLabel: "กลาง", project: "เวลาส่วนตัว", projectId: "project-personal", goalId: "goal-rest", reason: "เติมพลังหลังช่วงโฟกัส" },
        { id: "task-attachments", title: "เตรียมไฟล์แนบให้ข้อเสนอ", area: "งาน", type: "work", estimatedMinutes: 30, dueDate: "2026-09-25", deadline: "2026-09-25", plannedDate: DEMO_DATE, plannedTime: "14:00", done: false, inbox: false, priority: "medium", priorityLabel: "กลาง", project: "รีแบรนด์ร้านกาแฟ", projectId: "project-client", goalId: "goal-product", reason: "งานสั้นที่ช่วยปิดข้อเสนอ" },
        { id: "task-bill", title: "เช็คบิลค่าไฟและตั้งเตือนจ่าย", area: "การเงิน", type: "life", estimatedMinutes: 30, dueDate: "2026-09-24", deadline: "2026-09-24", plannedDate: null, plannedTime: null, done: false, inbox: true, priority: "medium", priorityLabel: "กลาง", project: null, projectId: null, goalId: "goal-cashflow", reason: "เข้ามาใหม่จากการจดเร็ว" },
        { id: "task-deck", title: "เตรียมสไลด์คุยกับพาร์ตเนอร์", area: "งาน", type: "work", estimatedMinutes: 45, dueDate: "2026-09-29", deadline: "2026-09-29", plannedDate: null, plannedTime: null, done: false, inbox: true, priority: "low", priorityLabel: "ต่ำ", project: "พาร์ตเนอร์ปลายเดือน", projectId: "project-partner", goalId: "goal-stable-business", reason: "ค่อยจัดหลังงานส่งศุกร์" },
      ],
      events: [
        { id: "event-client", date: DEMO_DATE, start: "10:30", end: "11:30", title: "คุยบรีฟกับลูกค้า", kind: "meeting" },
        { id: "event-family", date: DEMO_DATE, start: "15:00", end: "16:00", title: "รับหลานกลับบ้าน", kind: "life" },
        { id: "event-break", date: DEMO_DATE, start: "12:00", end: "13:00", title: "พักกลางวัน", kind: "break" },
      ],
      extra: {},
      firstUse: false,
    };
  }

  function makeFreshState() {
    const fresh = makeDemoState();
    fresh.firstUse = true;
    fresh.tasks = [];
    fresh.events = [];
    fresh.rescuePreview = false;
    fresh.rescueUndo = null;
    fresh.planConfirmed = false;
    fresh.focusTaskId = null;
    fresh.extra = {};
    return fresh;
  }

  function readState() {
    const fresh = makeDemoState();
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return makeFreshState();
      return Object.assign(fresh, saved, {
        tasks: Array.isArray(saved.tasks) ? saved.tasks : fresh.tasks,
        events: Array.isArray(saved.events) ? saved.events : fresh.events,
        extra: saved.extra && typeof saved.extra === "object" ? saved.extra : {},
        firstUse: typeof saved.firstUse === "boolean" ? saved.firstUse : !Array.isArray(saved.tasks) || saved.tasks.length === 0,
      });
    } catch (error) {
      return fresh;
    }
  }

  const state = readState();
  let route = state.route || "today";

  function saveState() {
    state.route = route;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* Private browsing or blocked storage still leaves the demo usable. */
    }
  }

  function formatMinutes(minutes) {
    const value = Number(minutes) || 0;
    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const remainder = value % 60;
      return remainder ? `${hours} ชม. ${remainder} น.` : `${hours} ชม.`;
    }
    return `${value} นาที`;
  }

  function formatDate(dateString) {
    if (!dateString) return "ยังไม่กำหนด";
    const date = new Date(`${dateString}T12:00:00`);
    return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(date);
  }

  function getRouteFromHash() {
    const raw = window.location.hash.replace(/^#/, "").split("?")[0] || "today";
    const aliases = { dashboard: "today", life: "routine", "work/sales": "sales", "work/projects": "projects" };
    return aliases[raw] || raw;
  }

  const CORE_TITLES = {
    today: "วันนี้",
    plan: "วางแผน",
    calendar: "ปฏิทิน",
    inbox: "Inbox",
    tasks: "งานทั้งหมด",
    rescue: "ปรับแผนเมื่อมีงานแทรก",
    focus: "โหมดโฟกัส",
  };

  function titleForRoute(routeKey) {
    return CORE_TITLES[routeKey] || (extras[routeKey] && extras[routeKey].title) || "หน้าต้นแบบ";
  }

  function taskById(id) {
    return state.tasks.find((task) => task.id === id);
  }

  function tasksForToday() {
    return state.tasks.filter((task) => task.plannedDate === DEMO_DATE && !task.inbox);
  }

  function todayMinutes() {
    return tasksForToday().filter((task) => !task.done).reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
  }

  function navButton(routeKey, label, iconName, badge) {
    const active = route === routeKey ? ' aria-current="page"' : "";
    const badgeHtml = badge ? `<span class="nav-badge">${escapeHtml(badge)}</span>` : "";
    return `<button class="nav-item" type="button" data-route="${escapeHtml(routeKey)}"${active}>${icon(iconName)}<span>${escapeHtml(label)}</span>${badgeHtml}</button>`;
  }

  function renderSidebar() {
    sidebar.innerHTML = `
      <a class="brand-lockup" href="#today" data-route="today" aria-label="Kemtit ไปหน้าวันนี้">
        <span class="brand-mark">${icon("compass")}</span>
        <span><span class="brand-name">kemtit</span><span class="brand-subtitle">วางแผนให้ไปต่อได้</span></span>
      </a>
      <section class="nav-section" aria-label="หลัก">
        <div class="nav-label">หลัก</div>
        <div class="nav-list">
          ${navButton("today", "วันนี้", "home")}
          ${navButton("plan", "วางแผน", "calendar")}
          ${navButton("inbox", "Inbox", "inbox", state.tasks.filter((task) => task.inbox).length || null)}
          ${navButton("calendar", "ปฏิทิน", "calendar")}
          ${navButton("insights", "อินไซต์", "chart")}
        </div>
      </section>
      <section class="nav-section" aria-label="ต่อยอด">
        <div class="nav-label">ต่อยอด</div>
        <div class="nav-list">
          ${navButton("goals", "เป้าหมาย", "target")}
          ${navButton("reviews", "รีวิวสัปดาห์", "review")}
          ${navButton("routine", "ชีวิตประจำวัน", "heart")}
          ${navButton("finance", "การเงิน", "wallet")}
          ${navButton("projects", "โปรเจกต์", "folder")}
        </div>
      </section>
      <section class="nav-section">
        <div class="nav-list">
          ${navButton("more", "ดูทุกหน้า", "menu")}
          ${navButton("settings", "ตั้งค่า", "settings")}
        </div>
      </section>
      <div class="sidebar-footer">
        <button class="btn btn-peach" type="button" data-action="open-capture">${icon("plus")}<span>บันทึกเร็ว</span></button>
        <div class="profile-chip">
          <span class="avatar">${escapeHtml(state.profile.initials)}</span>
          <span class="profile-copy"><strong>${escapeHtml(state.profile.name)}</strong><span>${escapeHtml(state.profile.role)}</span></span>
        </div>
      </div>`;
  }

  function renderTopbar() {
    topbar.innerHTML = `
      <div class="topbar-left"><div class="topbar-crumb"><span>Kemtit</span><span class="topbar-separator">/</span><strong>${escapeHtml(titleForRoute(route))}</strong></div></div>
      <div class="topbar-right"><span class="topbar-date">${icon("calendar", "วันที่ทดลอง")}อังคาร 22 ก.ย. 2026</span><button class="btn btn-ghost" type="button" data-action="open-capture" aria-label="บันทึกงานใหม่">${icon("plus")}<span class="desktop-only">บันทึกเร็ว</span></button><button class="avatar" type="button" data-route="settings" aria-label="เปิดการตั้งค่า">${escapeHtml(state.profile.initials)}</button></div>`;
  }

  function renderBottomNav() {
    const item = (routeKey, label, iconName, quick) => {
      const active = route === routeKey ? ' aria-current="page"' : "";
      return `<button class="bottom-nav-item${quick ? " quick" : ""}" type="button" data-route="${escapeHtml(routeKey)}"${active}><span class="bottom-icon">${icon(iconName)}</span><span>${escapeHtml(label)}</span></button>`;
    };
    bottomNav.innerHTML = `${item("today", "วันนี้", "home")}${item("plan", "วางแผน", "calendar")}${item("quick", "เพิ่ม", "plus", true)}${item("insights", "อินไซต์", "chart")}${item("more", "เพิ่มเติม", "menu")}`;
  }

  function pageHeading(eyebrow, title, lead, actions) {
    return `<div class="page-heading"><div class="page-heading-copy"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1>${lead ? `<p class="lead">${escapeHtml(lead)}</p>` : ""}</div>${actions ? `<div class="heading-actions row wrap">${actions}</div>` : ""}</div>`;
  }

  function taskRow(task, options) {
    const isDone = task.done ? " is-done" : "";
    const domainClass = task.area === "สุขภาพ" ? "health" : task.area === "การเงิน" ? "finance" : task.area === "ครอบครัว" ? "family" : "";
    const due = task.dueDate ? `ส่ง ${formatDate(task.dueDate)}` : task.plannedTime ? task.plannedTime : "ยังไม่ลงเวลา";
    return `<div class="list-row task-row${isDone}" data-task-id="${escapeHtml(task.id)}"><button class="task-check${task.done ? " is-done" : ""}" type="button" data-action="toggle-task" data-task-id="${escapeHtml(task.id)}" aria-label="${task.done ? "ทำเสร็จแล้ว" : "ทำเครื่องหมายว่าเสร็จ"}: ${escapeHtml(task.title)}">${task.done ? icon("check", "เสร็จแล้ว") : ""}</button><div class="list-row-main"><button class="list-row-title" type="button" data-action="focus-task" data-task-id="${escapeHtml(task.id)}">${escapeHtml(task.title)}</button><div class="list-row-meta"><span class="task-domain"><span class="domain-dot ${domainClass}"></span>${escapeHtml(task.area)}</span><span>${formatMinutes(task.estimatedMinutes)}</span>${task.project ? `<span>${escapeHtml(task.project)}</span>` : ""}</div></div><div class="list-row-end"><span>${escapeHtml(due)}</span>${options && options.action ? `<button class="mini-action" type="button" data-action="${escapeHtml(options.action)}" data-task-id="${escapeHtml(task.id)}">${icon(options.action === "move-to-today" ? "arrow" : "calendar-plus")}<span>${escapeHtml(options.label || "จัดเวลา")}</span></button>` : ""}</div></div>`;
  }

  function renderCompass() {
    const done = tasksForToday().filter((task) => task.done).length;
    const progress = Math.min(100, 42 + done * 14);
    return `<div class="compass-wrap"><div class="compass" style="--needle:${Math.max(14, 90 - progress * 0.7)}deg"><span class="compass-label n">N</span><span class="compass-label e">E</span><span class="compass-label s">S</span><span class="compass-label w">W</span><span class="compass-needle"></span><span class="compass-center"></span><strong class="compass-value">${progress}<small>%</small></strong></div><div class="quiet" style="text-align:center;margin-top:7px">ทิศทางสัปดาห์นี้</div></div>`;
  }

  function renderFreshToday() {
    const hasTasks = state.tasks.length > 0;
    const todayTasks = tasksForToday();
    const intro = hasTasks ? "นี่คือรายการแรกของคุณ เพิ่มอีกเรื่องได้เมื่อพร้อม แล้วค่อยจัดวันหรือเวลาทีหลัง" : "ยังไม่มีแผนค้างอยู่เลย เริ่มจากหนึ่งเรื่องที่อยากเอาออกจากหัว แล้วค่อยเลือกว่าจะทำวันนี้หรือเก็บไว้ก่อน";
    const taskSection = hasTasks ? `<section class="card"><div class="card-header"><div><h2>วันนี้ของคุณ</h2><p>${todayTasks.length} รายการที่เลือกไว้ · เพิ่มหรือติ๊กเสร็จได้ทันที</p></div><span class="badge badge-success">ข้อมูลของคุณ</span></div>${todayTasks.length ? todayTasks.map((task) => taskRow(task)).join("") : `<div class="notice"><span>${icon("inbox")}</span><span>รายการที่เพิ่มไว้ยังอยู่ใน Inbox เลือก “วันนี้” จากปุ่มบันทึกเพื่อให้เห็นตรงนี้</span></div>`}</section>` : `<section class="hero-card"><div class="hero-grid"><div><span class="eyebrow">จุดเริ่มต้นของคุณ</span><h2>ให้วันนี้มีที่เริ่ม โดยไม่ต้องตั้งค่าทั้งระบบ</h2><p class="hero-note">พิมพ์เพียงชื่อเรื่องเดียว ระบบจะตั้งค่าเริ่มต้นที่อ่อนโยนให้ แล้วค่อยปรับวัน เวลา หรือเป้าหมายเมื่อคุณพร้อม</p><div class="hero-actions"><button class="btn btn-secondary" type="button" data-action="load-demo">เปิดข้อมูลตัวอย่าง</button></div></div><div class="card compact" style="background:rgb(255 255 255 / .58);border-color:rgb(122 95 224 / .18)"><div class="empty-compass" style="margin:0 auto 12px">${icon("compass")}</div><strong style="display:block;text-align:center;color:var(--brand-900)">ยังไม่ได้ตั้งทิศ</strong><p class="quiet" style="margin:3px 0 0;text-align:center">จะค่อย ๆ ชัดขึ้นจากสิ่งที่คุณบันทึก</p></div></div></section>`;
    return `${pageHeading("อังคาร 22 กันยายน 2026 · เริ่มแบบเบา ๆ", `สวัสดีตอนเช้า ${state.profile.name}`, intro, `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกงาน</button><button class="btn btn-secondary" type="button" data-action="load-demo">ลองดูตัวอย่าง</button>`)}<div class="stack"><form class="card compact row" data-form="fresh-capture"><label class="sr-only" for="fresh-capture-title">สิ่งที่อยากบันทึก</label><input class="input" id="fresh-capture-title" name="title" placeholder="เช่น โทรหาลูกค้าเรื่องใบเสนอราคา" autocomplete="off" /><button class="btn btn-primary" type="button" data-action="fresh-capture-save">บันทึกวันนี้ ${icon("check")}</button></form>${taskSection}<div class="grid-2"><section class="card"><div class="route-card-icon">${icon("inbox")}</div><h3 style="margin:13px 0 3px;font-size:16px">ยังไม่อยากตัดสินใจ?</h3><p class="quiet" style="margin:0">เลือก Inbox ตอนบันทึก แล้วเรื่องนั้นจะรออยู่โดยไม่กวนวันนี้</p><button class="btn btn-ghost" type="button" data-route="inbox" style="padding-left:0">ดู Inbox ${icon("arrow")}</button></section><section class="card"><div class="route-card-icon">${icon("calendar")}</div><h3 style="margin:13px 0 3px;font-size:16px">ค่อยจัดเวลาภายหลัง</h3><p class="quiet" style="margin:0">เปิดปฏิทินเมื่ออยากเห็นช่องว่างจริงของวัน</p><button class="btn btn-ghost" type="button" data-route="calendar" style="padding-left:0">เปิดปฏิทิน ${icon("arrow")}</button></section></div><div class="notice"><span>${icon("lock")}</span><span><strong>พื้นที่ทดลองส่วนตัว</strong><br />ข้อมูลที่คุณบันทึกอยู่ใน prototype นี้เท่านั้น ยังไม่มีการเชื่อมต่อบัญชีหรือส่งข้อมูลออก</span></div></div>`;
  }

  function eventBusyMinutes(date) {
    return state.events.filter((event) => event.date === date && event.kind !== "break").reduce((sum, event) => sum + eventDuration(event), 0);
  }

  function eventBreakMinutes(date) {
    return state.events.filter((event) => event.date === date && event.kind === "break").reduce((sum, event) => sum + eventDuration(event), 0);
  }
  function renderCapacity() {
    const selected = todayMinutes();
    const meetingMinutes = eventBusyMinutes(DEMO_DATE);
    const breakMinutes = eventBreakMinutes(DEMO_DATE);
    const available = Math.max(0, 480 - meetingMinutes - breakMinutes);
    const free = Math.max(0, available - selected);
    const width = available ? Math.min(100, Math.round((selected / available) * 100)) : 0;
    return `<div class="capacity-strip"><div class="capacity-number">${formatMinutes(free)}<small>ว่าง</small></div><div class="capacity-meter"><div class="capacity-copy"><strong>วันนี้ทำไหวแค่ไหน</strong><span>เวลางาน 8 ชม. − ช่วงที่ล็อก ${formatMinutes(meetingMinutes)} (รวมชีวิต) − พัก ${formatMinutes(breakMinutes)} = ${formatMinutes(available)} ที่ลงมือได้</span></div><div class="progress"><span style="width:${width}%"></span></div><div class="capacity-legend"><span class="legend-item"><i class="legend-swatch"></i>งาน ${formatMinutes(selected)}</span><span class="legend-item"><i class="legend-swatch meeting"></i>ล็อก ${formatMinutes(meetingMinutes)}</span><span class="legend-item"><i class="legend-swatch break"></i>พัก ${formatMinutes(breakMinutes)}</span><span class="legend-item"><i class="legend-swatch open"></i>ว่าง ${formatMinutes(free)}</span></div></div><button class="btn btn-secondary" type="button" data-route="plan">ดูแผน</button></div>`;
  }

  function eventDuration(event) {
    if (!event || !event.start || !event.end) return 0;
    const start = event.start.split(":").map(Number);
    const end = event.end.split(":").map(Number);
    return Math.max(0, (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]));
  }

  function isoDateFromLocalDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function weekDatesFor(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    const mondayOffset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(date);
      day.setDate(date.getDate() + index);
      return isoDateFromLocalDate(day);
    });
  }

  function plannedTasks() {
    return state.tasks
      .filter((task) => task.plannedDate && !task.inbox)
      .slice()
      .sort((left, right) => `${left.plannedDate} ${left.plannedTime || "99:99"}`.localeCompare(`${right.plannedDate} ${right.plannedTime || "99:99"}`));
  }

  function planScopeLabel(tab) {
    if (tab === "year") return "รายการในปีที่เลือก";
    if (tab === "month") return "รายการในเดือนที่เลือก";
    return "รายการในสัปดาห์ที่เลือก";
  }

  function planScopeHint(tab) {
    if (tab === "year") return "รวมรายการที่มีวันที่จริงในปีเดียวกัน เพื่อเห็นทิศทางก่อนลงรายละเอียด";
    if (tab === "month") return "รวมรายการตามเดือนจากวันที่ที่คุณวางไว้ ไม่รวมรายการที่ยังอยู่ใน Inbox";
    return "แยกตามวันที่จริงภายในสัปดาห์ 21–27 กันยายน เพื่อเลือกจุดที่ควรลงมือก่อน";
  }

  function renderPlanScope(tab) {
    const tasks = plannedTasks();
    if (tab === "year") {
      const years = [...new Set(tasks.map((task) => task.plannedDate.slice(0, 4)))].sort();
      if (!years.length) return renderPlanBucket("ปี 2026", "2026-01-01", []);
      return years.map((year) => renderPlanBucket(`ปี ${year}`, `${year}-01-01`, tasks.filter((task) => task.plannedDate.startsWith(`${year}-`)))).join("");
    }
    if (tab === "month") {
      const months = [...new Set(tasks.map((task) => task.plannedDate.slice(0, 7)))].sort();
      if (!months.length) return renderPlanBucket("กันยายน 2026", "2026-09-01", []);
      return months.map((month) => {
        const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${month}-01T12:00:00`));
        return renderPlanBucket(monthLabel, `${month}-01`, tasks.filter((task) => task.plannedDate.startsWith(`${month}-`)));
      }).join("");
    }
    const weekDates = weekDatesFor(DEMO_DATE);
    const weekTasks = tasks.filter((task) => weekDates.includes(task.plannedDate));
    const groupedDates = [...new Set(weekTasks.map((task) => task.plannedDate))].sort();
    const grouped = groupedDates.map((date) => renderPlanBucket(date === DEMO_DATE ? `วันนี้ · ${formatDate(date)}` : formatDate(date), date, weekTasks.filter((task) => task.plannedDate === date))).join("");
    const laterTasks = tasks.filter((task) => !weekDates.includes(task.plannedDate));
    const later = laterTasks.length ? `<div class="stack-sm" style="margin-top:18px"><div class="row-between"><strong style="font-size:13px;color:var(--ink-2)">ถัดจากสัปดาห์นี้</strong><span class="quiet">${laterTasks.length} รายการ</span></div>${renderLaterPlanBuckets(laterTasks)}</div>` : "";
    const start = formatDate(weekDates[0]);
    const end = formatDate(weekDates[weekDates.length - 1]);
    return `<div class="stack-sm"><div class="row-between"><strong style="font-size:13px;color:var(--ink-2)">สัปดาห์ ${escapeHtml(start)} – ${escapeHtml(end)}</strong><span class="quiet">${weekTasks.length ? `${weekTasks.length} รายการ` : "ยังว่าง"}</span></div>${grouped || renderPlanBucket("รายการในสัปดาห์นี้", DEMO_DATE, [])}${later}</div>`;
  }


  function renderPlan() {
    const tabs = [["year", "ปี"], ["month", "เดือน"], ["week", "สัปดาห์"]].map(([key, label]) => `<button class="tab${state.planTab === key ? " is-active" : ""}" type="button" data-action="plan-tab" data-value="${key}">${label}</button>`).join("");
    const today = tasksForToday();
    const scopeLabel = planScopeLabel(state.planTab);
    const scopeHint = planScopeHint(state.planTab);
    const plannedCount = plannedTasks().length;
    if (state.firstUse) {
      return `${pageHeading("วางแผนเมื่อพร้อม", "แผนที่เดินต่อได้", "เริ่มจากรายการจริงของคุณ แล้วค่อยเลือกวันที่หรือเวลาที่เหมาะสม ไม่มีข้อมูลตัวอย่างมาปน", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกงาน</button>`)}<div class="tab-row" role="tablist" aria-label="ช่วงเวลาการวางแผน">${tabs}</div><div class="stack" style="margin-top:20px"><section class="card"><div class="card-header"><div><h2>${scopeLabel}</h2><p>${scopeHint}</p></div><span class="badge">${plannedCount} รายการ</span></div>${renderPlanScope(state.planTab)}</section><div class="notice"><span>${icon("sparkles")}</span><span>ยังไม่คำนวณ capacity จนกว่าจะมีนัดและเวลาจริงของคุณ เพื่อไม่แสดงตัวเลขที่เดาแทน</span></div></div>`;
    }
    const meeting = eventBusyMinutes(DEMO_DATE);
    const breaks = eventBreakMinutes(DEMO_DATE);
    const available = Math.max(0, 480 - meeting - breaks);
    const selected = today.filter((task) => !task.done).reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
    const free = Math.max(0, available - selected);
    return `${pageHeading("วางแผนโดยดูความจุจริง", "แผนที่เดินต่อได้", "เตรียมงานตามเวลาที่มี ก่อนจะเติมงานเพิ่ม พรุ่งนี้จึงไม่เริ่มด้วยรายการที่ค้างแบบมองไม่เห็น", `<button class="btn btn-primary" type="button" data-action="plan-today">${icon("sparkles")}จัดแผนวันนี้</button>`)}<div class="tab-row" role="tablist" aria-label="ช่วงเวลาการวางแผน">${tabs}</div><div class="stack" style="margin-top:20px"><section class="hero-card"><div class="hero-grid"><div><span class="eyebrow">${scopeLabel}</span><h2>โฟกัสงานที่ช่วยให้วันศุกร์เบาลง</h2><p class="hero-note">${scopeHint} งานที่กำหนดส่งยังถูกล็อกไว้ในเส้นทาง</p><div class="hero-actions"><button class="btn btn-primary" type="button" data-route="calendar">เปิดปฏิทิน</button><button class="btn btn-secondary" type="button" data-action="open-capture">บันทึกงานที่นึกออก</button></div></div><div class="card compact" style="background:rgb(255 255 255 / .58);border-color:rgb(122 95 224 / .18)"><div class="metric"><span class="metric-label">ช่องว่างที่คำนวณจากวันนี้</span><span class="metric-value">${formatMinutes(free)}</span><span class="metric-delta">หลังหักช่วงที่ล็อก ${formatMinutes(meeting)} + พัก ${formatMinutes(breaks)}</span></div></div></div></section><div class="split-layout"><section class="card"><div class="card-header"><div><h2>ความจุของวันนี้</h2><p>คิดจากเวลางาน ไม่ใช่จำนวนรายการ</p></div><span class="badge badge-success">เหลือ ${formatMinutes(free)}</span></div><div class="grid-3"><div class="metric"><span class="metric-value">8<span class="unit">ชม.</span></span><span class="metric-label">เวลางาน</span></div><div class="metric"><span class="metric-value">${formatMinutes(meeting)}</span><span class="metric-label">ช่วงที่ล็อก</span></div><div class="metric"><span class="metric-value">${formatMinutes(breaks)}</span><span class="metric-label">พัก</span></div></div><div class="progress-row" style="margin-top:18px"><div class="progress-label"><span>งานที่เลือก ${formatMinutes(selected)}</span><strong>${available ? Math.round((selected / available) * 100) : 0}%</strong></div><div class="progress"><span style="width:${available ? Math.min(100, (selected / available) * 100) : 0}%"></span></div></div></section><section class="card"><div class="card-header"><div><h2>${scopeLabel}</h2><p>${scopeHint}</p></div><span class="badge">${plannedCount} รายการ</span></div>${renderPlanScope(state.planTab)}</section></div></div>`;
  }

  function renderFreshCalendar(tabs) {
    const planned = plannedTasks().filter((task) => task.plannedDate === DEMO_DATE);
    const events = (Array.isArray(state.events) ? state.events : []).filter((event) => event && event.date === DEMO_DATE);
    const eventRows = events.map((event) => `<div class="list-row"><div class="list-row-main"><strong>${escapeHtml(event.title || "นัดที่บันทึกไว้")}</strong><div class="list-row-meta"><span>${escapeHtml(event.date)}</span><span>${escapeHtml(event.start || "เวลาไม่ระบุ")}–${escapeHtml(event.end || "")}</span><span>${formatMinutes(eventDuration(event))}</span></div></div></div>`).join("");
    const dayView = `<div class="split-layout"><section class="card"><div class="card-header"><div><h2>วันจากข้อมูลของคุณ</h2><p>รายการที่มีวันที่และช่วงเวลาจะปรากฏตรงนี้</p></div><button class="btn btn-secondary" type="button" data-action="open-capture">${icon("plus")}จัดเวลา</button></div>${planned.length ? planned.map((task) => taskRow(task)).join("") : `<div class="empty-state"><div class="empty-compass">${icon("calendar")}</div><h3>ยังไม่มีรายการในปฏิทิน</h3><p>บันทึกหนึ่งเรื่องก่อน แล้วค่อยกลับมาเลือกวันที่หรือเวลา</p><button class="btn btn-primary" type="button" data-action="open-capture">บันทึกงาน</button></div>`}</section><section class="card"><div class="card-header"><div><h2>ช่วงที่ล็อกไว้</h2><p>แสดงเฉพาะ event ที่อยู่ในข้อมูลของคุณ</p></div><span class="badge">${events.length} รายการ</span></div>${events.length ? `<div class="stack-sm">${eventRows}</div>` : `<div class="empty-state"><div class="empty-compass">${icon("calendar")}</div><p>ยังไม่มีช่วงเวลาที่ล็อกไว้</p><button class="btn btn-ghost" type="button" data-action="open-capture">เพิ่มรายการ</button></div>`}</section></div>`;
    const view = state.calendarTab === "day" ? dayView : state.calendarTab === "month" ? renderMonthGrid() : `<div class="week-scroll">${renderWeekGrid()}</div>`;
    return `${pageHeading("ปฏิทินที่เริ่มจากข้อมูลจริง", "มองช่องว่างเมื่อพร้อม", "ยังไม่มีนัดหรือ event ตัวอย่างที่ระบบเดาให้ คุณจะเห็นสิ่งที่บันทึกทันทีเมื่อเลือกวันที่", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("calendar-plus")}เพิ่มรายการ</button>`)}<div class="tab-row" role="tablist" aria-label="มุมมองปฏิทิน">${tabs}</div><div style="margin-top:20px">${view}</div>`;
  }
  function renderCalendar() {
    const tabs = [["day", "วัน"], ["week", "สัปดาห์"], ["month", "เดือน"]].map(([key, label]) => `<button class="tab${state.calendarTab === key ? " is-active" : ""}" type="button" data-action="calendar-tab" data-value="${key}">${label}</button>`).join("");
    if (state.firstUse) return renderFreshCalendar(tabs);
    const view = state.calendarTab === "day" ? `<div class="split-layout"><section class="card"><div class="card-header"><div><h2>อังคาร 22 กันยายน</h2><p>จากนัดและงานที่บันทึกไว้</p></div><button class="btn btn-secondary" type="button" data-action="open-capture">${icon("plus")}จัดเวลา</button></div>${renderTodayTimelineDynamic()}</section><aside class="card"><div class="card-header"><div><h2>ยังไม่ได้ลงเวลา</h2><p>เลือกแล้วพาไปช่องว่างแรก</p></div></div>${state.tasks.filter((task) => task.inbox).map((task) => taskRow(task, { action: "link-calendar", label: "ลงเวลา" })).join("") || `<div class="empty-state"><h3>ช่องว่างเรียบร้อย</h3><p>ไม่มีงานค้างที่ต้องจัดตอนนี้</p></div>`}</aside></div>` : state.calendarTab === "month" ? renderMonthGrid() : `<div class="week-scroll">${renderWeekGrid()}</div>`;
    return `${pageHeading("ปฏิทินที่เชื่อมกับแผน", "มองทั้งงานและชีวิตในช่องเดียว", "เห็นนัดที่ล็อกไว้และงานที่ยังขยับได้ ก่อนจะรับงานเพิ่ม", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("calendar-plus")}ลงเวลา</button>`)}<div class="tab-row" role="tablist" aria-label="มุมมองปฏิทิน">${tabs}</div><div style="margin-top:20px">${view}</div>`;
  }

  function renderFreshRescue() {
    const openTasks = state.tasks.filter((task) => !task.done);
    const hasTasks = openTasks.length > 0;
    const taskRows = openTasks.slice(0, 3).map((task) => taskRow(task)).join("");
    return `${pageHeading("ปรับแผนจากข้อมูลจริง", hasTasks ? "มีงานให้ตรวจ" : "ยังไม่มีแผนให้ขยับ", hasTasks ? "รายการด้านล่างมาจากสิ่งที่คุณบันทึกไว้ ระบบยังไม่ย้ายงานให้อัตโนมัติ" : "เริ่มจากบันทึกงานจริงก่อน แล้วค่อยดูผลกระทบเมื่อมีนัดแทรก", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกงานแรก</button><button class="btn btn-secondary" type="button" data-action="load-demo">เปิดข้อมูลตัวอย่าง</button>`)}<section class="card"><div class="card-header"><div><h2>ตรวจการเปลี่ยนแปลงเมื่อมีงานจริง</h2><p>เลือกเองก่อนยืนยันทุกครั้ง</p></div>${hasTasks ? `<span class="badge badge-success">${openTasks.length} งานที่ยังเปิด</span>` : ""}</div>${hasTasks ? `<div class="stack-sm">${taskRows}</div>` : `<div class="empty-state"><div class="empty-compass">${icon("refresh")}</div><h3>ยังไม่มีงานให้ขยับ</h3><p>ลองบันทึกงานแรก หรือเปิดข้อมูลตัวอย่างเพื่อสำรวจ flow เพิ่มนัด → ตรวจการย้าย → ยืนยัน → Undo</p></div>`}<div class="hero-actions"><button class="btn btn-primary" type="button" data-action="open-capture">บันทึกงาน</button><button class="btn btn-ghost" type="button" data-route="today">กลับไปวันนี้ ${icon("arrow")}</button></div></section>`;
  }
  function renderRescue() {
    if (state.firstUse) return renderFreshRescue();
    const preview = state.rescuePreview;
    const selected = todayMinutes();
    const meeting = eventBusyMinutes(DEMO_DATE);
    const breaks = eventBreakMinutes(DEMO_DATE);
    const applied = state.events.some((event) => event.id === "event-rescue");
    const rescueMoveTimes = { "task-sales": "09:30", "task-attachments": "11:00" };
    const rescueTasks = Object.keys(rescueMoveTimes).map((id) => taskById(id)).filter(Boolean);
    const movingTasks = applied ? [] : rescueTasks.filter((task) => !task.done && task.plannedDate === DEMO_DATE);
    const moveMinutes = movingTasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0);
    const moveSummary = rescueTasks.length ? rescueTasks.map((task) => `“${escapeHtml(task.title)}”`).join(" + ") : "งานที่อยู่ในวันนี้";
    const moveRows = rescueTasks.length ? rescueTasks.map((task) => {
      const targetTime = rescueMoveTimes[task.id];
      const actionText = applied ? `วางไว้พรุ่งนี้ ${formatDate("2026-09-23")} ${targetTime}` : `ย้าย “${escapeHtml(task.title)}” ไปพรุ่งนี้ ${targetTime}`;
      return `<div class="list-row"><span class="task-check" aria-hidden="true">${icon("move")}</span><div class="list-row-main"><span class="list-row-title">${actionText}</span><div class="list-row-meta"><span>${formatMinutes(task.estimatedMinutes)} ที่ย้ายได้</span><span>${escapeHtml(task.title)}</span></div></div><span class="list-row-end">${applied ? "พรุ่งนี้" : "พร้อมย้าย"}</span></div>`;
    }).join("") : `<div class="notice"><span>${icon("inbox")}</span><span>ไม่พบงานตัวอย่างที่ต้องขยับในวันนี้</span></div>`;
    const urgentMinutes = applied ? 0 : 60;
    const projected = Math.max(0, (480 - breaks - meeting - urgentMinutes) - (selected - moveMinutes));
    const undo = state.rescueUndo;
    return `${pageHeading("วันที่ไม่เป็นตามแผนก็ยังไปต่อได้", "มีงานแทรก? ปรับแผน", "เพิ่มนัดหนึ่งรายการ แล้วเห็นผลกระทบก่อนยืนยัน ระบบจะรักษากำหนดส่งและบอกว่าขยับอะไรบ้าง", `<button class="btn btn-secondary" type="button" data-route="today">กลับไปวันนี้ ${icon("arrow")}</button>`)}<div class="stack"><section class="hero-card"><div class="hero-grid"><div><span class="eyebrow">สถานการณ์จำลอง · ข้อมูลตัวอย่าง</span><h2>เพิ่มนัดด่วน 13:30–14:30 แล้วเหลือ ${formatMinutes(projected)} ให้โฟกัส</h2><p class="hero-note">${applied ? `วาง ${moveSummary} ไว้พรุ่งนี้แล้ว` : `ย้าย ${moveSummary} (${formatMinutes(moveMinutes)}) ไปพรุ่งนี้ โดยงานส่งศุกร์ยังคงเดิม`}</p><div class="hero-actions">${preview ? `<button class="btn btn-primary" type="button" data-action="confirm-rescue">ยืนยันการปรับ ${icon("check")}</button><button class="btn btn-secondary" type="button" data-action="cancel-rescue">ยกเลิก</button>` : `<button class="btn btn-primary" type="button" data-action="preview-rescue">ดูแผนที่กระทบ</button>`}</div></div><div class="card compact" style="background:rgb(255 255 255 / .56);border-color:rgb(245 100 140 / .25)"><div class="metric"><span class="metric-label">พื้นที่โฟกัสหลังปรับ</span><span class="metric-value">${formatMinutes(projected)}</span><span class="metric-delta">คำนวณจากเวลาประเมินและช่วงที่ล็อกไว้</span></div></div></div></section>${preview ? `<section class="card"><div class="card-header"><div><h2>ตรวจการเปลี่ยนแปลง</h2><p>คุณยังเป็นคนตัดสินใจก่อนแผนจะเปลี่ยน</p></div><span class="badge badge-warning">รอตัดสินใจ</span></div><div class="stack-sm"><div class="notice success"><span>${icon("lock")}</span><span><strong>กำหนดส่งไม่เปลี่ยน</strong><br />รายการที่ย้ายยังคงกำหนดส่งเดิมไว้ในข้อมูลของคุณ</span></div>${moveRows}<div class="list-row"><span class="task-check" aria-hidden="true">${icon("calendar")}</span><div class="list-row-main"><span class="list-row-title">เพิ่มนัดด่วน 13:30–14:30</span><div class="list-row-meta"><span>ข้อมูลตัวอย่างเท่านั้น</span><span>ไม่ทับกับงานที่ย้ายไปพรุ่งนี้</span></div></div><span class="list-row-end">วันนี้</span></div></div><div class="modal-foot"><button class="btn btn-primary" type="button" data-action="confirm-rescue">ยืนยันการปรับ ${icon("check")}</button></div></section>` : ""}${undo ? `<div class="notice success"><span>${icon("check-circle")}</span><span>ปรับแผนแล้ว · deadline ของรายการยังอยู่ที่เดิม</span><button class="toast-action" type="button" data-action="undo-rescue">ย้อนกลับ ${icon("undo")}</button></div>` : ""}</div>`;
  }

  function renderPlanBucket(label, date, tasks) {
    return `<div class="stack-sm" style="margin-top:14px"><div class="row-between"><strong style="font-size:13px;color:var(--ink-2)">${escapeHtml(label)}</strong><span class="quiet">${tasks.length ? formatMinutes(tasks.reduce((sum, task) => sum + Number(task.estimatedMinutes || 0), 0)) : "ว่าง"}</span></div>${tasks.length ? tasks.map((task) => taskRow(task)).join("") : `<div class="notice"><span>${icon("sparkles")}</span><span>ยังไม่มีงานลงวันที่ ${formatDate(date)} · Inbox ยังมีรายการที่รอจัด</span></div>`}</div>`;
  }


  function renderLaterPlanBuckets(laterTasks) {
    const dates = [...new Set(laterTasks.map((task) => task.plannedDate).filter(Boolean))].sort();
    return dates.map((date) => renderPlanBucket(`ถัดจากนั้น · ${formatDate(date)}`, date, laterTasks.filter((task) => task.plannedDate === date))).join("");
  }
  function dayTimelineHtml() {
    const items = [
      { time: "09:00", title: "ส่งข้อเสนอให้ลูกค้า", meta: "โฟกัส 90 นาที", kind: "task" },
      { time: "10:30", title: "คุยบรีฟกับลูกค้า", meta: "นัด 60 นาที", kind: "meeting" },
      { time: "12:00", title: "พักกลางวัน", meta: "พัก 60 นาที", kind: "break" },
      { time: "13:00", title: "ทำสรุปยอดขายประจำสัปดาห์", meta: "โฟกัส 60 นาที", kind: "task" },
      { time: "15:00", title: "รับหลานกลับบ้าน", meta: "ชีวิต 60 นาที", kind: "meeting" },
      { time: "17:00", title: "เดิน 30 นาทีหลังเลิกงาน", meta: "สุขภาพ · 60 นาที", kind: "break" },
    ];
    return `<ul class="timeline">${items.map((item) => `<li class="timeline-item"><span class="timeline-time">${item.time}</span><span class="timeline-node ${item.kind === "meeting" ? "meeting" : item.kind === "break" ? "break" : ""}"></span><span class="timeline-content"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)}</span></span></li>`).join("")}</ul>`;
  }

  function renderWeekGrid() {
    const dates = weekDatesFor(DEMO_DATE);
    const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const events = (Array.isArray(state.events) ? state.events : []).filter((event) => dates.includes(event.date));
    const tasks = plannedTasks().filter((task) => dates.includes(task.plannedDate));
    const entries = [
      ...events.filter((event) => event.start).map((event) => ({ date: event.date, time: event.start, title: event.title || "ช่วงเวลาที่ล็อก", meta: `${event.start}–${event.end || ""} · ${event.kind === "break" ? "พัก" : event.kind === "life" ? "ชีวิต" : "ช่วงที่ล็อก"} ${formatMinutes(eventDuration(event))}`, kind: event.kind === "break" ? "break" : event.kind === "life" ? "life" : "meeting" })),
      ...tasks.filter((task) => task.plannedTime).map((task) => ({ date: task.plannedDate, time: task.plannedTime, title: task.title, meta: `${task.plannedTime} · ${task.area} · ${formatMinutes(task.estimatedMinutes)}`, kind: "task" })),
    ];
    const rows = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
    const header = `<div class="week-grid"><div class="week-header">เวลา</div>${dates.map((date) => { const day = new Date(`${date}T12:00:00`); return `<div class="week-header${date === DEMO_DATE ? " is-today" : ""}">${dayNames[day.getDay()]}<strong>${formatDate(date).split(" ")[0]}</strong></div>`; }).join("")}`;
    const cells = rows.map((time) => {
      const hour = time.slice(0, 2);
      return `<div class="week-time">${time}</div>${dates.map((date) => {
        const cellEntries = entries.filter((entry) => entry.date === date && entry.time.slice(0, 2) === hour);
        return `<div>${cellEntries.map((entry) => `<div class="schedule-block${entry.kind === "meeting" ? " meeting" : entry.kind === "break" ? " break" : entry.kind === "life" ? " life" : ""}">${escapeHtml(entry.title)}<br /><small>${escapeHtml(entry.meta)}</small></div>`).join("")}</div>`;
      }).join("")}`;
    }).join("");
    const unplacedTasks = tasks.filter((task) => !task.plannedTime);
    const unplacedEvents = events.filter((event) => !event.start);
    const unplaced = unplacedTasks.length || unplacedEvents.length ? `<section class="card compact" style="margin-top:14px"><div class="card-header"><div><h3>ยังไม่ได้ลงเวลาในสัปดาห์นี้</h3><p>วันที่ยังคงมาจากรายการจริง คุณค่อยเติมเวลาได้</p></div></div>${unplacedTasks.map((task) => taskRow(task)).join("")}${unplacedEvents.map((event) => `<div class="list-row"><div class="list-row-main"><strong>${escapeHtml(event.title || "ช่วงเวลาที่ล็อก")}</strong><div class="list-row-meta"><span>${escapeHtml(event.date)}</span><span>ยังไม่ระบุเวลา</span></div></div></div>`).join("")}</section>` : "";
    const empty = !entries.length && !unplacedTasks.length && !unplacedEvents.length ? `<div class="notice" style="margin-top:14px"><span>${icon("calendar")}</span><span>สัปดาห์นี้ยังไม่มีรายการจากข้อมูลของคุณ กด “ลงเวลา” เพื่อเริ่มวางรายการแรก</span></div>` : "";
    return `${header}${cells}</div>${unplaced}${empty}`;
  }

  function renderMonthGrid() {
    const weekdays = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
    const monthKey = DEMO_DATE.slice(0, 7);
    const firstDay = new Date(`${monthKey}-01T12:00:00`);
    const start = firstDay.getDay();
    const totalDays = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
    const entriesByDate = new Map();
    const addEntry = (date, html) => entriesByDate.set(date, [...(entriesByDate.get(date) || []), html]);
    (Array.isArray(state.events) ? state.events : []).filter((event) => event && event.date && event.date.startsWith(monthKey)).forEach((event) => {
      const chipClass = event.kind === "break" ? " success" : " meeting";
      addEntry(event.date, `<span class="calendar-chip${chipClass}">${escapeHtml(event.title || "ช่วงเวลาที่ล็อก")}</span>`);
    });
    plannedTasks().filter((task) => task.plannedDate.startsWith(monthKey)).forEach((task) => {
      addEntry(task.plannedDate, `<span class="calendar-chip">${escapeHtml(task.title)}</span>`);
    });
    const cells = [];
    for (let index = 0; index < start; index += 1) {
      const previous = new Date(firstDay);
      previous.setDate(index - start + 1);
      cells.push(`<div class="month-cell is-muted"><span class="month-date">${previous.getDate()}</span></div>`);
    }
    for (let day = 1; day <= totalDays; day += 1) {
      const date = `${monthKey}-${String(day).padStart(2, "0")}`;
      const chips = (entriesByDate.get(date) || []).join("");
      cells.push(`<div class="month-cell${date === DEMO_DATE ? " is-today" : ""}"><span class="month-date">${day}</span>${chips}</div>`);
    }
    while (cells.length % 7) {
      const next = new Date(firstDay);
      next.setDate(totalDays + (cells.length - start - totalDays + 1));
      cells.push(`<div class="month-cell is-muted"><span class="month-date">${next.getDate()}</span></div>`);
    }
    const monthLabel = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(firstDay);
    const empty = entriesByDate.size ? "" : `<div class="notice" style="margin-top:14px"><span>${icon("calendar")}</span><span>เดือนนี้ยังไม่มีรายการจากข้อมูลของคุณ กด “ลงเวลา” เพื่อเริ่มวางรายการแรก</span></div>`;
    return `<div class="row-between" style="margin-bottom:12px"><strong>${escapeHtml(monthLabel)}</strong><span class="quiet">${entriesByDate.size ? `${entriesByDate.size} วันที่มีรายการ` : "ยังว่าง"}</span></div><div class="month-grid">${weekdays.map((day) => `<div class="month-weekday">${day}</div>`).join("")}${cells.join("")}</div>${empty}`;
  }


  function renderInbox() {
    const inboxTasks = state.tasks.filter((task) => task.inbox);
    return `${pageHeading("เก็บก่อน ค่อยจัดทีหลัง", "Inbox", "ทุกความคิดมีที่พักชั่วคราว จึงไม่ต้องตัดสินใจตอนกำลังรีบ", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกเร็ว</button>`)}<div class="split-layout"><section class="card"><div class="card-header"><div><h2>เพิ่มสิ่งที่เพิ่งนึกออก</h2><p>ค่าเริ่มต้นจะยังไม่รบกวนแผนวันนี้</p></div><span class="shortcut">⌘ K</span></div><div class="row"><input class="input" id="inline-capture-title" placeholder="เช่น ส่งใบเสร็จให้บัญชี" aria-label="ชื่อรายการใหม่" /><button class="btn btn-primary" type="button" data-action="inline-capture">เพิ่ม</button></div><div class="notice" style="margin-top:14px"><span>${icon("sparkles")}</span><span>กดเพิ่มแล้วจะพาไปดูตัวอย่างพร้อมบันทึกโดยไม่ต้องกรอกฟอร์มยาว</span></div></section><section class="card"><div class="card-header"><div><h2>สิ่งที่รอการจัดวาง</h2><p>${inboxTasks.length} รายการ · ไม่หายไปไหน</p></div><span class="badge badge-warning">รอจัด</span></div>${inboxTasks.length ? inboxTasks.map((task) => taskRow(task, { action: "move-to-today", label: "ใส่วันนี้" })).join("") : `<div class="empty-state"><div class="empty-compass">${icon("inbox")}</div><h3>Inbox เบาแล้ว</h3><p>ถ้ามีเรื่องใหม่ให้บันทึกไว้ก่อน แล้วค่อยเลือกวันที่เมื่อพร้อม</p></div>`}</section></div>`;
  }

  function renderTasks() {
    const filters = [["planned", "วางแผนแล้ว"], ["all", "ทั้งหมด"], ["done", "เสร็จแล้ว"]].map(([key, label]) => `<button class="segment${state.taskFilter === key ? " is-active" : ""}" type="button" data-action="task-filter" data-value="${key}">${label}</button>`).join("");
    const tasks = state.tasks.filter((task) => state.taskFilter === "all" || (state.taskFilter === "done" ? task.done : task.plannedDate));
    return `${pageHeading("ศูนย์รวมรายการ", "งานทั้งหมด", "เปลี่ยนมุมมองตามสิ่งที่ต้องตัดสินใจ โดยยังเห็นกำหนดส่งและเหตุผลเดิม", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}เพิ่มงาน</button>`)}<div class="row-between wrap" style="margin-bottom:18px"><div class="segmented" role="tablist" aria-label="กรองงาน">${filters}</div><span class="quiet">${tasks.length} รายการ</span></div><section class="card">${tasks.length ? tasks.map((task) => taskRow(task, task.inbox ? { action: "move-to-today", label: "จัดวันนี้" } : null)).join("") : `<div class="empty-state"><div class="empty-compass">${icon("list")}</div><h3>ยังไม่มีรายการในมุมมองนี้</h3><p>เริ่มจากบันทึกงานใหม่หรือเปลี่ยนตัวกรองเพื่อดูรายการตัวอย่าง</p><button class="btn btn-primary" type="button" data-action="open-capture">บันทึกงาน</button></div>`}</section>`;
  }


  function effectiveFocusTask() {
    const selected = taskById(state.focusTaskId);
    if (selected && !selected.done) return selected;
    const nextOpen = tasksForToday().find((task) => !task.done) || state.tasks.find((task) => !task.done);
    return nextOpen || selected || tasksForToday()[0] || state.tasks[0] || null;
  }

  function renderFocus() {
    const task = effectiveFocusTask();
    if (!task) {
      return `${pageHeading("เริ่มโฟกัสเมื่อมีงานจริง", "โหมดโฟกัส", "ยังไม่มี task ให้โฟกัส ระบบจะรอข้อมูลที่คุณบันทึกเองก่อน", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกงานแรก</button><button class="btn btn-secondary" type="button" data-action="load-demo">เปิดข้อมูลตัวอย่าง</button>`)}<section class="card"><div class="empty-state"><div class="empty-compass">${icon("timer")}</div><h2>พร้อมเมื่อคุณพร้อม</h2><p>เพิ่มงานหนึ่งเรื่อง แล้วกลับมาเริ่มช่วงโฟกัสได้ทันที</p><div class="hero-actions"><button class="btn btn-primary" type="button" data-action="open-capture">บันทึกงาน</button><button class="btn btn-ghost" type="button" data-route="today">กลับไปวันนี้ ${icon("arrow")}</button></div></div></section>`;
    }
    const seconds = Math.max(0, Number(state.focusSeconds || 0));
    const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    const next = tasksForToday().find((item) => item.id !== task.id && !item.done);
    return `${pageHeading("โฟกัสทีละเรื่อง", "โหมดโฟกัส", "ตัดสินใจน้อยลงในช่วงเวลานี้ แล้วกลับไปดูภาพรวมเมื่อพร้อม", `<button class="btn btn-secondary" type="button" data-route="today">ออกจากโฟกัส ${icon("arrow")}</button>`)}<div class="split-layout"><section class="focus-task"><div class="row-between"><span class="eyebrow">ตอนนี้กำลังทำ</span><span class="badge" style="background:rgb(255 255 255 / .12);color:#fff">${escapeHtml(task.area)}</span></div><h2>${escapeHtml(task.title)}</h2><div class="row-between"><span class="quiet">กำหนดส่ง ${formatDate(task.dueDate)} · ${formatMinutes(task.estimatedMinutes)}</span><span class="metric-value" style="color:#fff;font-size:25px">${clock}</span></div><div class="progress focus-progress"><span style="width:${Math.max(4, Math.min(100, ((task.estimatedMinutes * 60 - seconds) / (task.estimatedMinutes * 60)) * 100))}%"></span></div><div class="focus-controls">${state.focusRunning ? `<button class="btn btn-secondary" type="button" data-action="pause-focus">${icon("pause")}พักนาฬิกา</button>` : `<button class="btn btn-peach" type="button" data-action="start-focus">${icon("play")}เริ่ม 25 นาที</button>`}<button class="btn btn-secondary" type="button" data-action="complete-focus">${icon("check")}ทำเสร็จแล้ว</button></div></section><aside class="card"><div class="card-header"><div><h2>จังหวะถัดไป</h2><p>คุณไม่ต้องเลือกใหม่ทุกครั้ง</p></div><span class="badge badge-success">${task.done ? "เสร็จแล้ว" : "พร้อมทำ"}</span></div>${next ? `<div class="notice"><span>${icon("arrow")}</span><span><strong>${escapeHtml(next.title)}</strong><br />${formatMinutes(next.estimatedMinutes)} · วางไว้ ${escapeHtml(next.plannedTime || "หลังจากนี้")}</span></div>` : `<div class="empty-state"><div class="empty-compass">${icon("target")}</div><h3>Top 3 วันนี้ครบแล้ว</h3><p>กลับไปดูพื้นที่ว่างหรือทบทวนแผนพรุ่งนี้ได้เลย</p></div>`}<div class="stack-sm" style="margin-top:16px"><button class="btn btn-secondary" type="button" data-route="today">ดูงานวันนี้</button><button class="btn btn-ghost" type="button" data-action="reset-focus-time">รีเซ็ตตัวจับเวลา</button></div></aside></div>`;
  }

  function renderPlaceholder(routeKey) {
    const title = titleForRoute(routeKey);
    return `${pageHeading("ต้นแบบหน้าหลัก", title, "หน้านี้เชื่อมกับ navigation แล้ว กำลังเตรียมรายละเอียดการใช้งานสำหรับรอบถัดไป", `<button class="btn btn-primary" type="button" data-action="open-capture">${icon("plus")}บันทึกงาน</button>`)}<div class="empty-state"><div class="empty-compass">${icon("compass")}</div><h3>เลือกจังหวะที่อยากทดลอง</h3><p>ใช้เมนู “ดูทุกหน้า” เพื่อสำรวจเส้นทางของ Kemtit และกลับมาที่วันนี้ได้ทุกเมื่อ</p><button class="btn btn-secondary" type="button" data-route="today">กลับไปวันนี้ ${icon("arrow")}</button></div>`;
  }

  const api = {
    state,
    icon,
    escape: escapeHtml,
    toast(message, type) { showToast(message, type); },
    navigate(routeKey) { navigate(routeKey); },
    render() { render(); },
    openModal(title, html) { openModal(title, html); },
    closeModal() { closeModal(); },
    startFresh() { startFresh(); },
  };
  api.state.extra = api.state.extra || {};
  window.KemtitPrototype = api;

  function showToast(message, type) {
    const toast = document.createElement("div");
    toast.className = `toast ${type || ""}`;
    toast.innerHTML = `${icon(type === "warning" ? "clock" : "check-circle")}<span>${escapeHtml(message)}</span>`;
    toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3400);
  }

  function openModal(title, html) {
    closeModal();
    previousFocus = document.activeElement;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><div><h2 id="modal-title">${escapeHtml(title)}</h2></div><button class="modal-close" type="button" data-action="close-modal" aria-label="ปิดหน้าต่าง">${icon("x")}</button></div><div class="modal-content">${html}</div></section></div>`;
    const first = modalRoot.querySelector("input, select, textarea") || modalRoot.querySelector("button");
    if (first) window.setTimeout(() => first.focus(), 0);
  }

  function closeModal() {
    if (!modalRoot.innerHTML) return;
    modalRoot.innerHTML = "";
    if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
    previousFocus = null;
  }

  function newTaskId() {
    return `task-demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function openCaptureModal() {
    state.captureDestination = "inbox";
    state.captureType = "work";
    const selectedDestination = state.captureDestination || "inbox";
    openModal("บันทึกเร็ว", `<form id="capture-form" data-form="capture" class="stack-sm">
      <p class="lead" style="margin:0">พิมพ์สิ่งที่อยากจำ ระบบจะเตรียมปลายทางให้ก่อน แล้วคุณค่อยตัดสินใจครั้งเดียว</p>
      <div class="field"><label for="capture-title">มีอะไรอยู่ในหัวตอนนี้</label><input class="input" id="capture-title" name="title" required autocomplete="off" placeholder="เช่น โทรหาลูกค้าเรื่องใบเสนอราคา" /></div>
      <div class="row wrap"><span class="quiet">ลองเลือกตัวอย่าง</span><button class="mini-action" type="button" data-action="fill-capture" data-value="ตอบข้อความลูกค้าค้างไว้">ตอบข้อความลูกค้า</button><button class="mini-action" type="button" data-action="fill-capture" data-value="จดไอเดียโปรโมชันใหม่">จดไอเดีย</button></div>
      <div class="field"><label>ประเภท</label><div class="segmented" role="radiogroup" aria-label="ประเภทของรายการ"><button class="segment is-active" type="button" data-action="capture-type" data-value="work" aria-pressed="true">งาน</button><button class="segment" type="button" data-action="capture-type" data-value="life" aria-pressed="false">ชีวิต</button></div></div>
      <div class="field"><label>ปลายทางเริ่มต้น</label><div class="segmented" role="radiogroup" aria-label="ปลายทางของรายการ"><button class="segment${selectedDestination === "today" ? " is-active" : ""}" type="button" data-action="capture-destination" data-value="today" aria-pressed="${selectedDestination === "today"}">วันนี้</button><button class="segment${selectedDestination === "inbox" ? " is-active" : ""}" type="button" data-action="capture-destination" data-value="inbox" aria-pressed="${selectedDestination === "inbox"}">Inbox</button><button class="segment${selectedDestination === "tomorrow" ? " is-active" : ""}" type="button" data-action="capture-destination" data-value="tomorrow" aria-pressed="${selectedDestination === "tomorrow"}">พรุ่งนี้</button></div><span class="field-hint">รายละเอียด เช่น เวลาและกำหนดส่ง ค่อยเติมทีหลังได้</span></div>
      <div class="modal-foot"><button class="btn btn-primary" type="button" data-action="confirm-capture">บันทึกเลย ${icon("check")}</button></div>
    </form>`);
  }

  function previewCapture() {
    const form = document.getElementById("capture-form");
    const input = form && form.querySelector("[name=title]");
    const title = input ? input.value.trim() : "";
    if (!title) {
      if (input) input.focus();
      showToast("เติมข้อความสั้น ๆ ก่อนบันทึกได้เลย", "warning");
      return;
    }
    const destination = state.captureDestination || "today";
    pendingCapture = { title, destination };
    const destinationLabel = destination === "inbox" ? "Inbox" : destination === "tomorrow" ? "พรุ่งนี้ · 23 ก.ย." : "วันนี้ · 22 ก.ย.";
    openModal("ตรวจอีกครั้งก่อนบันทึก", `<div class="stack"><div class="notice success"><span>${icon("check-circle")}</span><span>รายการนี้พร้อมเข้า <strong>${escapeHtml(destinationLabel)}</strong></span></div><div class="card compact"><span class="eyebrow">รายการใหม่</span><h3 style="margin:0;color:var(--ink-2);font-size:18px;font-weight:500">${escapeHtml(title)}</h3><p class="quiet" style="margin:5px 0 0">ยังไม่ใส่เวลา · ปรับรายละเอียดภายหลังได้</p></div><p class="quiet" style="margin:0">การบันทึกนี้เป็นข้อมูลตัวอย่างใน prototype และจะเชื่อมไปยังหน้าที่เลือกให้เห็นทันที</p></div><div class="modal-foot"><button class="btn btn-secondary" type="button" data-action="open-capture">แก้ข้อความ</button><button class="btn btn-primary" type="button" data-action="confirm-capture">ยืนยันบันทึก ${icon("check")}</button></div>`);
  }

  function addCapturedTask(title, destination, type) {
    const isInbox = destination === "inbox";
    const itemType = type || "work";
    state.tasks.push({ id: newTaskId(), title, area: itemType === "life" ? "ชีวิต" : "งาน", type: itemType, estimatedMinutes: 30, dueDate: null, deadline: null, plannedDate: destination === "today" ? DEMO_DATE : destination === "tomorrow" ? "2026-09-23" : null, plannedTime: null, done: false, inbox: isInbox, priority: "medium", priorityLabel: "กลาง", project: null, projectId: null, goalId: null, reason: "รายการใหม่จากการบันทึกเร็ว" });
    saveState();
    return isInbox;
  }

  function confirmCapture() {
    let capture = pendingCapture;
    if (!capture) {
      const form = document.getElementById("capture-form");
      const input = form && form.querySelector("[name=title]");
      const title = input ? input.value.trim() : "";
      if (!title) {
        if (input) input.focus();
        showToast("เติมข้อความสั้น ๆ ก่อนบันทึกได้เลย", "warning");
        return;
      }
      capture = { title, destination: state.captureDestination || "today", type: state.captureType || "work" };
    }
    const isInbox = addCapturedTask(capture.title, capture.destination, capture.type);
    pendingCapture = null;
    closeModal();
    showToast(isInbox ? "เก็บไว้ใน Inbox แล้ว" : "เพิ่มในแผนแล้ว · ใช้เวลาเริ่มต้น 30 นาที", "success");
    render();
  }

  function openPlanModal() {
    const selected = todayMinutes();
    const free = Math.max(0, 300 - selected);
    openModal("จัดแผนวันนี้", `<div class="stack"><div class="notice"><span>${icon("sparkles")}</span><span>ผมเตรียม Top 3 ตามกำหนดส่งและเวลาที่มีให้แล้ว คุณตัดสินใจแค่ครั้งเดียวว่าจะใช้แผนนี้ไหม</span></div><div class="grid-3"><div class="metric"><span class="metric-value">8<span class="unit">ชม.</span></span><span class="metric-label">เวลางานตั้งต้น</span></div><div class="metric"><span class="metric-value">5<span class="unit">ชม.</span></span><span class="metric-label">เวลาที่ลงมือได้</span></div><div class="metric"><span class="metric-value">${formatMinutes(free)}</span><span class="metric-label">เหลือหลังจัด Top 3</span></div></div><div class="card compact"><div class="card-header"><div><h3>สิ่งที่จะลงในวันนี้</h3><p>รวม ${formatMinutes(selected)} · ไม่เลื่อนกำหนดส่ง</p></div><span class="badge badge-success">พร้อมยืนยัน</span></div>${tasksForToday().slice(0, 3).map((task) => `<div class="list-row"><span class="task-check is-done" aria-hidden="true">${icon("check")}</span><div class="list-row-main"><span class="list-row-title">${escapeHtml(task.title)}</span><div class="list-row-meta"><span>${formatMinutes(task.estimatedMinutes)}</span><span>${escapeHtml(task.reason || "ตามลำดับความสำคัญ")}</span></div></div><span class="list-row-end">${escapeHtml(task.plannedTime || "จัดเวลา")}</span></div>`).join("")}</div><div class="notice warning"><span>${icon("clock")}</span><span>งานที่ยังไม่มีเวลาประเมินจะใช้ค่าเริ่มต้น 30 นาทีและติดป้ายให้คุณทบทวนภายหลัง</span></div></div><div class="modal-foot"><button class="btn btn-secondary" type="button" data-action="close-modal">ไว้ทีหลัง</button><button class="btn btn-primary" type="button" data-action="confirm-plan">ยืนยันแผนวันนี้ ${icon("check")}</button></div>`);
  }

  function toggleTask(taskId) {
    const task = taskById(taskId);
    if (!task) return;
    task.done = !task.done;
    saveState();
    render();
    showToast(task.done ? `เสร็จแล้ว: ${task.title}` : `เปิดกลับมาให้ทำต่อ: ${task.title}`, "success");
  }

  function startFresh() {
    const fresh = makeFreshState();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, fresh);
    pendingCapture = null;
    closeModal();
    saveState();
    window.location.hash = "today";
    render();
  }

  function loadDemo() {
    const demo = makeDemoState();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, demo);
    closeModal();
    saveState();
    window.location.hash = "today";
    showToast("โหลดเส้นทางตัวอย่างแล้ว · ลองกดจัดแผนวันนี้", "success");
    render();
  }

  function previewRescue() {
    state.rescuePreview = true;
    saveState();
    render();
  }

  function confirmRescue() {
    if (!state.rescuePreview) return previewRescue();
    state.rescueUndo = { tasks: JSON.parse(JSON.stringify(state.tasks)), events: JSON.parse(JSON.stringify(state.events)) };
    const rescueMoveTimes = { "task-sales": "09:30", "task-attachments": "11:00" };
    Object.entries(rescueMoveTimes).forEach(([taskId, plannedTime]) => {
      const task = taskById(taskId);
      if (task && !task.done && task.plannedDate === DEMO_DATE) {
        task.plannedDate = "2026-09-23";
        task.plannedTime = plannedTime;
      }
    });
    if (!state.events.some((event) => event.id === "event-rescue")) state.events.push({ id: "event-rescue", date: DEMO_DATE, start: "13:30", end: "14:30", title: "นัดด่วนที่เพิ่มเข้ามา", kind: "meeting" });
    state.rescuePreview = false;
    saveState();
    render();
    showToast("ปรับแผนแล้ว · มี Undo ให้ย้อนกลับ", "success");
  }

  function undoRescue() {
    if (!state.rescueUndo) return;
    state.tasks = state.rescueUndo.tasks;
    state.events = state.rescueUndo.events;
    state.rescueUndo = null;
    saveState();
    render();
    showToast("ย้อนกลับแผนเดิมแล้ว", "success");
  }

  function setFocusTimer(running) {
    state.focusRunning = running;
    if (focusTimer) window.clearInterval(focusTimer);
    focusTimer = null;
    if (running) {
      focusTimer = window.setInterval(() => {
        state.focusSeconds = Math.max(0, Number(state.focusSeconds || 0) - 1);
        if (state.focusSeconds <= 0) {
          setFocusTimer(false);
          showToast("ครบช่วงโฟกัสแล้ว · พักสักครู่ก่อนเลือกต่อ", "success");
        }
        saveState();
        if (route === "focus") render();
      }, 1000);
    }
    saveState();
    render();
  }

  function handleAction(action, element) {
    if (!action) return;
    if (action === "close-modal") return closeModal();
    if (action === "open-capture" || action === "quick-capture") return openCaptureModal();
    if (action === "preview-capture") return previewCapture();
    if (action === "confirm-capture") return confirmCapture();
    if (action === "fill-capture") {
      const input = document.querySelector("#capture-title");
      if (input) { input.value = element.dataset.value || ""; input.focus(); }
      return;
    }
    if (action === "capture-destination") {
      state.captureDestination = element.dataset.value || "today";
      document.querySelectorAll("[data-action=\"capture-destination\"]").forEach((button) => {
        const selected = button.dataset.value === state.captureDestination;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      return;
    }
    if (action === "plan-today") return openPlanModal();
    if (action === "load-demo") return loadDemo();
    if (action === "switch-fresh") return startFresh();
    if (action === "confirm-plan") {
      state.planConfirmed = true;
      saveState();
      closeModal();
      showToast("จัดแผนวันนี้ให้แล้ว · เหลือพื้นที่ 90 นาที", "success");
      return render();
    }
    if (action === "scope") {
      state.scope = element.dataset.value || "all";
      saveState();
      return render();
    }
    if (action === "plan-tab") {
      state.planTab = element.dataset.value || "week";
      saveState();
      return render();
    }
    if (action === "calendar-tab") {
      state.calendarTab = element.dataset.value || "week";
      saveState();
      return render();
    }
    if (action === "task-filter") {
      state.taskFilter = element.dataset.value || "planned";
      saveState();
      return render();
    }
    if (action === "inline-capture") {
      const inline = document.getElementById("inline-capture-title");
      const value = inline ? inline.value.trim() : "";
      openCaptureModal();
      const input = document.getElementById("capture-title");
      if (input && value) input.value = value;
      return;
    }
    if (action === "fresh-capture-save") {
      const input = document.getElementById("fresh-capture-title");
      const value = input ? input.value.trim() : "";
      if (!value) {
        if (input) input.focus();
        showToast("พิมพ์สิ่งแรกที่อยากถือไว้ก่อน", "warning");
        return;
      }
      addCapturedTask(value, "today");
      showToast("เพิ่มในวันนี้แล้ว · ใช้เวลาเริ่มต้น 30 นาที", "success");
      return render();
    }
    if (action === "move-to-today") {
      const task = taskById(element.dataset.taskId);
      if (!task) return;
      task.inbox = false;
      task.plannedDate = DEMO_DATE;
      task.plannedTime = null;
      saveState();
      render();
      showToast(`ย้าย “${task.title}” มาวันนี้แล้ว`, "success");
      return;
    }
    if (action === "link-calendar") {
      const task = taskById(element.dataset.taskId);
      if (!task) return;
      task.inbox = false;
      task.plannedDate = DEMO_DATE;
      task.plannedTime = "16:30";
      saveState();
      navigate("calendar");
      showToast(`ลงเวลา ${task.title} ไว้ 16:30 แล้ว`, "success");
      return;
    }
    if (action === "preview-rescue") return previewRescue();
    if (action === "cancel-rescue") {
      state.rescuePreview = false;
      saveState();
      return render();
    }
    if (action === "confirm-rescue") return confirmRescue();
    if (action === "undo-rescue") return undoRescue();
    if (action === "start-focus") return setFocusTimer(true);
    if (action === "pause-focus") return setFocusTimer(false);
    if (action === "reset-focus-time") {
      state.focusSeconds = 25 * 60;
      state.focusRunning = false;
      if (focusTimer) window.clearInterval(focusTimer);
      focusTimer = null;
      saveState();
      return render();
    }
    if (action === "complete-focus") {
      const task = effectiveFocusTask();
      if (task) task.done = true;
      state.focusRunning = false;
      if (focusTimer) window.clearInterval(focusTimer);
      focusTimer = null;
      saveState();
      render();
      showToast("เสร็จแล้ว · เลือกว่าจะพักหรือไปงานถัดไป", "success");
      return;
    }
    if (action === "toggle-task") return toggleTask(element.dataset.taskId);
    if (action === "focus-task") {
      state.focusTaskId = element.dataset.taskId || state.focusTaskId;
      saveState();
      return navigate("focus");
    }
    if (action === "reset-demo") {
      const fresh = makeDemoState();
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, fresh);
      pendingCapture = null;
      closeModal();
      saveState();
      window.location.hash = "today";
      showToast("รีเซ็ตข้อมูลตัวอย่างแล้ว", "success");
      return render();
    }
    const page = extras[route];
    if (page && typeof page.action === "function") {
      page.action(action, element, api);
      saveState();
      return;
    }
    showToast("การกระทำนี้ยังอยู่ในหน้าต้นแบบ", "warning");
  }

  function renderTodayTimelineDynamic() {
    const items = [];
    state.events.filter((event) => event.date === DEMO_DATE).forEach((event) => items.push({ time: event.start, title: event.title, meta: `${event.kind === "break" ? "พัก" : event.kind === "meeting" ? "นัด" : "ชีวิต"} ${formatMinutes(eventDuration(event))}`, kind: event.kind === "meeting" ? "meeting" : event.kind === "break" ? "break" : "" }));
    tasksForToday().filter((task) => task.plannedTime).forEach((task) => items.push({ time: task.plannedTime, title: task.title, meta: `${task.area} · ${formatMinutes(task.estimatedMinutes)}`, kind: "" }));
    items.sort((a, b) => a.time.localeCompare(b.time));
    if (!items.length) return `<div class="empty-state"><div class="empty-compass">${icon("calendar")}</div><h3>ยังไม่มีช่วงเวลาที่ล็อกไว้</h3><p>เพิ่มงานแล้วค่อยเลือกเวลาที่อยากปกป้องไว้</p></div>`;
    return `<ul class="timeline">${items.map((item) => `<li class="timeline-item"><span class="timeline-time">${escapeHtml(item.time)}</span><span class="timeline-node ${item.kind}"></span><span class="timeline-content"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.meta)}</span></span></li>`).join("")}</ul>`;
  }

  function renderDayRail() {
    const signature = window.KemtitSignature;
    return signature && typeof signature.dayRail === "function" ? signature.dayRail(api) : renderTodayTimelineDynamic();
  }
  function renderToday() {
    if (state.firstUse) return renderFreshToday();
    const allToday = tasksForToday();
    const visibleToday = state.scope === "all" ? allToday : allToday.filter((task) => task.type === state.scope);
    const topTasks = visibleToday.slice(0, 3);
    const selected = todayMinutes();
    const meetingMinutes = eventBusyMinutes(DEMO_DATE);
    const breakMinutes = eventBreakMinutes(DEMO_DATE);
    const available = Math.max(0, 480 - meetingMinutes - breakMinutes);
    const free = Math.max(0, available - selected);
    return `${pageHeading("อังคาร 22 กันยายน 2026 · ข้อมูลตัวอย่าง", `สวัสดีตอนเช้า ${state.profile.name}`, "เห็นงานที่ต้องส่งและนัดชีวิตในภาพเดียว แล้วเลือกว่าจะทำอะไรต่อโดยไม่ต้องจัดทุกอย่างเอง", `<button class="btn btn-primary" type="button" data-action="plan-today">${icon("sparkles")}จัดแผนวันนี้</button><button class="btn btn-secondary" type="button" data-action="open-capture">${icon("plus")}บันทึกงาน</button><button class="btn btn-ghost" type="button" data-action="switch-fresh">ลองเริ่มใช้ครั้งแรก</button>`)}<div class="row wrap" style="margin-bottom:18px"><span class="quiet">มุมมอง</span><div class="segmented" role="tablist" aria-label="ขอบเขตงาน"><button class="segment${state.scope === "all" ? " is-active" : ""}" type="button" data-action="scope" data-value="all" aria-selected="${state.scope === "all"}">ทั้งหมด</button><button class="segment${state.scope === "work" ? " is-active" : ""}" type="button" data-action="scope" data-value="work" aria-selected="${state.scope === "work"}">งาน</button><button class="segment${state.scope === "life" ? " is-active" : ""}" type="button" data-action="scope" data-value="life" aria-selected="${state.scope === "life"}">ชีวิต</button></div><span class="badge badge-success">${allToday.filter((task) => task.done).length}/${allToday.length} เสร็จแล้ว</span></div><div class="today-layout"><div class="today-main"><section><div class="section-title"><span>งานสำคัญวันนี้</span><small>${visibleToday.length} รายการ · ${formatMinutes(selected)}</small></div><div class="card"><div class="stack-sm">${topTasks.length ? topTasks.map((task) => taskRow(task)).join("") : `<div class="empty-state"><div class="empty-compass">${icon("compass")}</div><h3>มุมมองนี้ยังไม่มีงาน</h3><p>เปลี่ยนเป็น “ทั้งหมด” หรือบันทึกงานใหม่เพื่อเริ่มต่อ</p></div>`}</div>${allToday.length > 3 ? `<button class="btn btn-ghost" type="button" data-route="tasks" style="margin-top:14px">ดูงานวันนี้ทั้งหมด ${icon("arrow")}</button>` : ""}</div></section><section class="hero-card"><div class="hero-grid"><div><span class="eyebrow">ทิศทางวันนี้</span><h2>งานส่งศุกร์เดินคู่กับเวลาชีวิตได้</h2><p class="hero-note">เวลางาน 8 ชม. − ช่วงที่ล็อก ${formatMinutes(meetingMinutes)} (รวมชีวิต) − พัก ${formatMinutes(breakMinutes)} = ${formatMinutes(available)} ที่ลงมือได้ เลือกไว้ ${formatMinutes(selected)} เหลือ ${formatMinutes(free)}</p><div class="hero-actions"><button class="btn btn-primary" type="button" data-action="plan-today">${icon("target")}จัด Top 3 วันนี้</button><button class="btn btn-secondary" type="button" data-route="rescue">${icon("refresh")}มีงานแทรก?</button></div></div>${renderCompass()}</div></section>${renderCapacity()}</div><aside class="today-side">${renderDayRail()}<section class="card"><div class="card-header"><div><h2>ทำไมรายการนี้ถึงอยู่ตรงนี้</h2><p>เหตุผลช่วยให้ตัดสินใจได้เร็วขึ้น</p></div>${icon("sparkles")}</div><div class="notice"><span>${icon("flag")}</span><span><strong>ส่งข้อเสนอให้ลูกค้า</strong><br />กำหนดส่งศุกร์และใช้เวลาต่อเนื่อง จึงอยู่ก่อนช่วงที่ล็อกเช้า</span></div><button class="btn btn-ghost" type="button" data-route="focus" style="margin-top:12px">เปิดโหมดโฟกัส ${icon("arrow")}</button></section></aside></div>`;
  }

  function navigate(routeKey) {
    const target = routeKey === "quick" ? "today" : routeKey;
    if (routeKey === "quick" && target !== route) quickAfterRoute = true;
    if (target === route) {
      if (target === "today" && routeKey === "quick") openCaptureModal();
      else render();
      return;
    }
    window.location.hash = target;
  }

  function renderRoute() {
    if (route === "today") return renderToday();
    if (route === "plan") return renderPlan();
    if (route === "calendar") return renderCalendar();
    if (route === "inbox") return renderInbox();
    if (route === "tasks") return renderTasks();
    if (route === "rescue") return renderRescue();
    if (route === "focus") return renderFocus();
    if (extras[route] && typeof extras[route].render === "function") return extras[route].render(api);
    return renderPlaceholder(route);
  }

  function render() {
    route = getRouteFromHash();
    state.route = route;
    saveState();
    renderSidebar();
    renderTopbar();
    renderBottomNav();
    root.innerHTML = renderRoute();
    if (quickAfterRoute) {
      quickAfterRoute = false;
      window.setTimeout(openCaptureModal, 0);
    }
  }

  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalRoot.innerHTML) {
      closeModal();
      return;
    }
    if (event.key !== "Tab" || !modalRoot.innerHTML) return;
    const modal = modalRoot.querySelector(".modal");
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll("button, input, select, textarea, a[href], [tabindex]:not([tabindex=\"-1\"])"));
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
  });

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-modal-backdrop]")) {
      closeModal();
      return;
    }
    const routeTarget = event.target.closest("[data-route]");
    if (routeTarget) {
      event.preventDefault();
      navigate(routeTarget.dataset.route);
      return;
    }
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
  });

  document.addEventListener("change", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (actionTarget) handleAction(actionTarget.dataset.action, actionTarget);
  });

  render();
})();
