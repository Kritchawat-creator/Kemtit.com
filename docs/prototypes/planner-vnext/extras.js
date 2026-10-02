(() => {
  "use strict";

  const DEMO_DATE = "22 กันยายน 2026";
  const DEMO_ISO_DATE = "2026-09-22";
  const DEMO_WEEK = "สัปดาห์ 21–27 กันยายน 2026";

  const CORE_ROUTES = [
    ["today", "วันนี้", "calendar"],
    ["plan", "วางแผน", "target"],
    ["calendar", "ปฏิทิน", "calendar"],
    ["inbox", "กล่องเข้า", "inbox"],
    ["tasks", "งานทั้งหมด", "check"],
    ["rescue", "ปรับแผน", "compass"],
    ["focus", "โหมดโฟกัส", "clock"],
  ];

  const EXTRA_ROUTE_TITLES = {
    goals: "เป้าหมาย",
    "goal-detail": "รายละเอียดเป้าหมาย",
    projects: "โปรเจกต์",
    "project-detail": "รายละเอียดโปรเจกต์",
    routine: "รูทีน",
    finance: "การเงิน",
    reviews: "ทบทวนสัปดาห์",
    insights: "อินไซต์",
    settings: "ตั้งค่า",
    sales: "ตัวเลขผู้ขาย",
    entries: "บันทึกผล",
    more: "ดูทุกหน้า",
    onboarding: "เริ่มต้นใช้งาน",
    login: "เข้าสู่ระบบ",
  };

  const EXTRA_ICONS = {
    goals: "target",
    "goal-detail": "target",
    projects: "folder",
    "project-detail": "folder",
    routine: "check",
    finance: "wallet",
    reviews: "heart",
    insights: "chart",
    settings: "settings",
    sales: "chart",
    entries: "sparkles",
    more: "menu",
    onboarding: "compass",
    login: "home",
  };

  const SEED_TASKS = [
    {
      id: "task-brief",
      title: "ส่งโครงร่างข้อเสนอให้ลูกค้า",
      duration: 90,
      plannedDate: "2026-09-22",
      deadline: "2026-09-25",
      priority: "high",
      done: false,
      projectId: "project-client",
      goalId: "goal-product",
    },
    {
      id: "task-assets",
      title: "คัดภาพสำหรับหน้าร้าน",
      duration: 60,
      plannedDate: "2026-09-22",
      deadline: "2026-09-24",
      priority: "medium",
      done: true,
      projectId: "project-client",
      goalId: "goal-product",
    },
    {
      id: "task-invoice",
      title: "ตรวจใบแจ้งหนี้รอบเดือน",
      duration: 30,
      plannedDate: "2026-09-23",
      deadline: "2026-09-26",
      priority: "medium",
      done: false,
      projectId: "project-client",
      goalId: "goal-product",
    },
    {
      id: "task-weekly-review",
      title: "ทบทวนงานค้างและเลือกงานสำคัญ",
      duration: 45,
      plannedDate: "2026-09-22",
      deadline: "2026-09-22",
      priority: "high",
      done: false,
      projectId: "project-personal",
      goalId: "goal-rest",
    },
    {
      id: "task-customer-call",
      title: "โทรเช็กความต้องการลูกค้า",
      duration: 30,
      plannedDate: "2026-09-24",
      deadline: "2026-09-24",
      priority: "medium",
      done: false,
      projectId: "project-client",
      goalId: "goal-product",
    },
    {
      id: "task-rest",
      title: "เดินเล่นหลังเลิกงาน",
      duration: 30,
      plannedDate: "2026-09-22",
      deadline: "2026-09-22",
      priority: "low",
      done: false,
      projectId: "project-personal",
      goalId: "goal-rest",
    },
  ];

  const SEED_GOALS = [
    {
      id: "goal-product",
      title: "เปิดตัวชุดข้อเสนอใหม่",
      description: "ทำข้อเสนอให้พร้อมคุยกับลูกค้ากลุ่มแรก โดยไม่เร่งจนเกินกำลัง",
      outcome: 42,
      target: "มีข้อเสนอที่ลูกค้านัดคุยต่ออย่างน้อย 3 ราย",
      milestone: [
        { id: "brief", label: "สรุปปัญหาลูกค้า", done: true },
        { id: "offer", label: "ทำโครงร่างข้อเสนอ", done: false },
        { id: "pilot", label: "คุยกับลูกค้ากลุ่มแรก", done: false },
        { id: "learn", label: "บันทึกบทเรียนและปรับข้อเสนอ", done: false },
      ],
      nextAction: "ส่งโครงร่างข้อเสนอให้ลูกค้า",
    },
    {
      id: "goal-rest",
      title: "มีช่วงพักที่รักษาได้จริง",
      description: "วางขอบเขตเลิกงานและเก็บพลังไว้สำหรับวันถัดไป",
      outcome: 65,
      target: "เลิกงานตรงเวลา 4 วันในสัปดาห์นี้",
      milestone: [
        { id: "boundary", label: "กำหนดเวลาเลิกงาน", done: true },
        { id: "walk", label: "มีช่วงพักสั้นระหว่างวัน", done: true },
        { id: "repeat", label: "ทำซ้ำให้ครบ 4 วัน", done: false },
      ],
      nextAction: "เดินเล่นหลังเลิกงาน",
    },
  ];

  const SEED_PROJECTS = [
    {
      id: "project-client",
      title: "ข้อเสนอสำหรับลูกค้าใหม่",
      context: "งานรับเงิน · ลูกค้ากลุ่มทดลอง",
      description: "รวมงานที่ต้องทำก่อนคุยรอบแรก เพื่อเห็นขอบเขตและเวลาที่ต้องใช้",
      status: "กำลังเดินหน้า",
      due: "25 ก.ย. 2026",
      nextMove: "ส่งโครงร่างข้อเสนอ",
      color: "lavender",
    },
    {
      id: "project-personal",
      title: "สัปดาห์ที่ทำงานไหว",
      context: "ชีวิตส่วนตัว · พลังงาน",
      description: "ทดลองจัดงานและพักให้สอดคล้องกับเวลาที่มีจริง",
      status: "ทดลอง",
      due: "27 ก.ย. 2026",
      nextMove: "ทบทวนงานค้างวันศุกร์",
      color: "peach",
    },
  ];

  const escapeFallback = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const uniqueId = (prefix) => {
    const random = typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function" ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return `${prefix}-${random}`;
  };

  const e = (api, value) =>
    typeof api.escape === "function" ? api.escape(String(value ?? "")) : escapeFallback(value);

  const icon = (api, name) => {
    if (typeof api.icon === "function") return api.icon(name);
    return `<span class="ex-icon-fallback" aria-hidden="true">•</span>`;
  };

  const cls = (condition, className) => (condition ? ` ${className}` : "");

  const button = (api, action, label, options = {}) => {
    const classes = options.className || "btn btn-secondary";
    const attrs = [`data-action="${e(api, action)}"`];
    if (options.id !== undefined) attrs.push(`data-id="${e(api, options.id)}"`);
    if (options.value !== undefined) attrs.push(`data-value="${e(api, options.value)}"`);
    if (options.ariaLabel) attrs.push(`aria-label="${e(api, options.ariaLabel)}"`);
    if (options.disabled) attrs.push("disabled");
    return `<button type="button" class="${classes}" ${attrs.join(" ")}>${
      options.icon ? `${icon(api, options.icon)}<span>${e(api, label)}</span>` : e(api, label)
    }</button>`;
  };

  const link = (api, route, label, options = {}) =>
    `<a class="${options.className || "btn btn-ghost"}" href="#${e(api, route)}"${
      options.ariaLabel ? ` aria-label="${e(api, options.ariaLabel)}"` : ""
    }>${options.icon ? `${icon(api, options.icon)}<span>${e(api, label)}</span>` : e(api, label)}</a>`;

  const badge = (api, label, tone = "") =>
    `<span class="badge${tone ? ` badge-${e(api, tone)}` : ""}">${e(api, label)}</span>`;

  const progress = (api, value, label) => {
    const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="ex-progress-wrap"><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safeValue}" aria-label="${e(
      api,
      label,
    )}"><span style="width:${safeValue}%"></span></div><span class="ex-progress-value">${safeValue}%</span></div>`;
  };

  const metric = (api, value, label, note = "") =>
    `<div class="metric ex-metric"><strong>${e(api, value)}</strong><span>${e(api, label)}</span>${
      note ? `<small>${e(api, note)}</small>` : ""
    }</div>`;

  const page = (api, title, lead, body, options = {}) => `
    <div class="ex-page">
      <div class="page-heading ex-heading">
        <div>
          ${options.eyebrow ? `<p class="eyebrow">${e(api, options.eyebrow)}</p>` : ""}
          <h1>${e(api, title)}</h1>
          ${lead ? `<p class="lead">${e(api, lead)}</p>` : ""}
        </div>
        ${options.actions ? `<div class="ex-heading-actions">${options.actions}</div>` : ""}
      </div>
      ${body}
    </div>`;

  const card = (body, options = {}) =>
    `<section class="card ex-card${options.className ? ` ${options.className}` : ""}"${
      options.labelledBy ? ` aria-labelledby="${options.labelledBy}"` : ""
    }>${body}</section>`;

  const sectionTitle = (api, title, note = "", actionHtml = "") => `
    <div class="section-title ex-section-title"><div><h2>${e(api, title)}</h2>${
      note ? `<p class="muted">${e(api, note)}</p>` : ""
    }</div>${actionHtml}</div>`;

  const taskDuration = (task) => Number(task?.duration ?? task?.estimatedMinutes ?? 0) || 0;

  const ensureExtra = (state) => {
    if (!state.extra || typeof state.extra !== "object") state.extra = {};
    const extra = state.extra;
    const firstUse = state.firstUse === true;
    if (!extra.demoDate) extra.demoDate = DEMO_DATE;
    if (!Array.isArray(extra.tasks)) {
      extra.tasks = firstUse ? [] : Array.isArray(state.tasks) && state.tasks.length ? state.tasks : SEED_TASKS.map((task) => ({ ...task }));
    }
    if (Array.isArray(state.tasks) && state.tasks.length && extra.tasks !== state.tasks) extra.tasks = state.tasks;
    if (!Array.isArray(extra.goals)) extra.goals = firstUse ? [] : SEED_GOALS.map((goal) => ({ ...goal, milestone: goal.milestone.map((step) => ({ ...step })) }));
    if (!Array.isArray(extra.projects)) extra.projects = firstUse ? [] : SEED_PROJECTS.map((project) => ({ ...project }));
    if (!extra.selectedGoalId) extra.selectedGoalId = "goal-product";
    if (!extra.selectedProjectId) extra.selectedProjectId = "project-client";
    if (!extra.goalTaskLinks || typeof extra.goalTaskLinks !== "object") extra.goalTaskLinks = firstUse ? {} : { "goal-product": ["task-proposal", "task-brief", "task-sales", "task-assets", "task-invoice", "task-customer-call"], "goal-rest": ["task-walk", "task-rest", "task-weekly-review"] };
    if (!extra.projectTaskLinks || typeof extra.projectTaskLinks !== "object") extra.projectTaskLinks = firstUse ? {} : { "project-client": ["task-proposal", "task-brief", "task-sales", "task-assets", "task-invoice", "task-customer-call"], "project-personal": ["task-walk", "task-rest", "task-weekly-review"] };
    if (!Array.isArray(extra.nextWeekCommitments)) extra.nextWeekCommitments = [];
    if (!extra.routineChecks || typeof extra.routineChecks !== "object") {
      extra.routineChecks = firstUse ? { mon: false, tue: false, wed: false, thu: false, fri: false, sat: false, sun: false } : { mon: true, tue: true, wed: false, thu: false, fri: false, sat: false, sun: false };
    }
    if (!extra.finance || typeof extra.finance !== "object" || !Array.isArray(extra.finance.bills)) {
      extra.finance = firstUse ? { bills: [], expenses: [] } : {
        bills: [
          { id: "bill-hosting", title: "โฮสติ้งร้านค้า", due: "24 ก.ย. 2026", amount: 420, paid: false },
          { id: "bill-internet", title: "อินเทอร์เน็ตบ้าน", due: "28 ก.ย. 2026", amount: 690, paid: true },
        ],
        expenses: [{ id: "expense-internet", title: "อินเทอร์เน็ตบ้าน", date: "2026-09-20", amount: 690, sourceBillId: "bill-internet" }],
        budget: 35000,
      };
    }
    if (!Array.isArray(extra.reviews)) {
      extra.reviews = firstUse ? [] : [
        { id: "review-win-1", type: "win", text: "เลือกงานหลักก่อนเปิดกล่องเข้า ทำให้เริ่มได้เร็วขึ้น" },
        { id: "review-blocker-1", type: "blocker", text: "ข้อเสนอใช้เวลานานกว่าที่คาด เพราะยังไม่ล็อกขอบเขต" },
      ];
    }
    if (!extra.insights || typeof extra.insights !== "object") extra.insights = { planned: firstUse ? 0 : 330, completed: firstUse ? 0 : 210, applied: false };
    if (!extra.settings || typeof extra.settings !== "object") {
      extra.settings = {
        workingStart: "09:00",
        workingEnd: "17:30",
        breakMinutes: 60,
        calendar: "ยังไม่เชื่อมต่อ",
        line: "ยังไม่เชื่อมต่อ",
      };
    }
    if (!extra.sales || typeof extra.sales !== "object") extra.sales = { enabled: false, revenue: firstUse ? 0 : 28500, outstanding: firstUse ? 0 : 9200, clients: firstUse ? 0 : 3 };
    if (!Array.isArray(extra.entries)) {
      extra.entries = firstUse ? [] : [
        { id: "entry-1", date: "2026-09-15", value: 3, note: "ช่วงที่ทำงานสำคัญได้โดยไม่เร่ง" },
        { id: "entry-2", date: "2026-09-18", value: 4, note: "มีเวลาพักก่อนงานถัดไป" },
        { id: "entry-3", date: "2026-09-21", value: 2, note: "มีงานแทรกหลายรายการ" },
      ];
    }
    if (!extra.onboarding || typeof extra.onboarding !== "object") extra.onboarding = { role: "ผู้ทำงานอิสระ", focus: "เลือกงานสำคัญ", starter: "เริ่มจากวันนี้" };
    if (typeof extra.demoLoggedIn !== "boolean") extra.demoLoggedIn = false;
    if (!Array.isArray(extra.plans)) extra.plans = [];
    return extra;
  };

  const data = (api) => ensureExtra(api.state || {});

  const tasks = (api) => {
    const extra = data(api);
    const stateTasks = api.state && api.state.tasks;
    if (Array.isArray(stateTasks) && (api.state.firstUse === true || stateTasks.length > 0)) extra.tasks = stateTasks;
    return extra.tasks;
  };

  const findTask = (api, id) => tasks(api).find((task) => String(task.id) === String(id));

  const taskDeadline = (task) => task?.deadline || task?.dueDate || "ยังไม่กำหนด";

  const taskPriority = (task) => {
    const priority = String(task?.priority || "").toLowerCase();
    if (priority === "high" || priority === "สูง") return "สำคัญ";
    if (priority === "low" || priority === "ต่ำ") return "เบา";
    return "วางแผน";
  };

  const goalTasks = (api, goalId) => {
    const all = tasks(api);
    const explicit = data(api).goalTaskLinks?.[goalId] || [];
    return all.filter((task) => task.goalId === goalId || explicit.includes(task.id));
  };

  const projectTasks = (api, projectId) => {
    const all = tasks(api);
    const explicit = data(api).projectTaskLinks?.[projectId] || [];
    return all.filter((task) => task.projectId === projectId || explicit.includes(task.id));
  };

  const proposalTask = (api) =>
    findTask(api, "task-proposal") || findTask(api, "task-brief") || tasks(api).find((task) => !task.done) || tasks(api)[0];

  const goal = (api, id) => data(api).goals.find((item) => item.id === id) || data(api).goals[0];

  const project = (api, id) => data(api).projects.find((item) => item.id === id) || data(api).projects[0];

  const refresh = (api, message) => {
    if (message && typeof api.toast === "function") api.toast(message);
    if (typeof api.render === "function") api.render();
  };

  const openModal = (api, title, html) => {
    if (typeof api.openModal === "function") api.openModal(title, html);
  };

  const localInput = (el, selector) => {
    const form = el?.closest("form");
    return form?.querySelector(selector) || document.querySelector(selector);
  };

  const pageGoals = (api) => {
    const extra = data(api);
    const goalCount = extra.goals.length;
    const activeGoal = extra.goals[0];
    const goalCards = extra.goals.length
      ? extra.goals
          .map((item) => {
            const related = goalTasks(api, item.id);
            const done = related.filter((task) => task.done).length;
            const next = item.nextAction;
            return card(`
              <div class="card-header ex-card-header"><div><span class="ex-icon-tile">${icon(api, "target")}</span><div><h3>${e(api, item.title)}</h3><p class="muted">${e(api, item.target)}</p></div></div>${badge(api, "ตัวอย่างกำลังเดินหน้า", "success")}</div>
              <div class="ex-goal-progress-row"><div><span class="muted">ผลลัพธ์ที่อยากเห็น</span><strong>${e(api, `${item.outcome}%`)}</strong></div><div><span class="muted">งานที่เสร็จ</span><strong>${e(api, `${done}/${related.length}`)}</strong></div></div>
              ${progress(api, item.outcome, "ความคืบหน้าผลลัพธ์ตัวอย่าง")}
              <div class="ex-next-action"><span class="muted">ก้าวถัดไป</span><strong>${e(api, next)}</strong></div>
              <div class="row ex-card-actions">${button(api, "open-goal", "ดูเส้นทางเป้าหมาย", { className: "btn btn-primary", id: item.id, icon: "arrow" })}</div>
            `, { className: "ex-goal-card" });
          })
          .join("")
      : card(`<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "target")}</span><h2>ยังไม่มีเป้าหมาย</h2><p class="muted">เริ่มจากผลลัพธ์ที่อยากเห็น แล้วเลือกงานก้าวแรกได้ทันที</p><div class="row ex-card-actions">${button(api, "new-goal", "เพิ่มเป้าหมายตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${link(api, "today", "กลับไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></div>`, { className: "ex-empty-card" });
    const clearNextActions = extra.goals.filter((item) => String(item.nextAction || "").trim()).length;
    const goalHeader = goalCount ? `<div class="grid-3 ex-stat-grid">${metric(api, goalCount, "เป้าหมายที่กำลังเดินหน้า", "ข้อมูลตัวอย่าง")}${metric(api, clearNextActions, "งานถัดไปที่ชัดเจน", "นับเฉพาะข้อความที่บันทึกแล้ว")}${metric(api, `${activeGoal.outcome}%`, "ผลลัพธ์ของเป้าหมายหลัก", "แยกจากจำนวนงานที่เสร็จ")}</div>${sectionTitle(api, "เส้นทางที่กำลังดูแล", "ความคืบหน้าผลลัพธ์และความคืบหน้างานเป็นคนละสัญญาณ", button(api, "new-goal", "เพิ่มเป้าหมายทดลอง", { className: "btn btn-secondary", icon: "plus" }))}` : "";
    const body = `
      ${goalHeader}
      <div class="grid-2 ex-goal-grid">${extra.goals.length ? goalCards : `<div class="ex-grid-span">${goalCards}</div>`}</div>
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "sparkles")}</span><div><h3>อ่านตัวเลขให้ถูกความหมาย</h3><p class="muted">ตัวอย่างนี้ไม่สรุปว่าผู้ใช้ทำงานดีขึ้นจากเปอร์เซ็นต์งานที่เสร็จ ผลลัพธ์ต้องบันทึกแยกและต้องมีหลักฐานจริงก่อนใช้ตัดสินใจ</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "เป้าหมาย", "มองภาพปลายทาง แล้วเลือกก้าวถัดไปที่ทำได้ในเวลาจริง", body, { eyebrow: `ทิศทาง · ${DEMO_DATE}` });
  };

  const pageGoalDetail = (api) => {
    const extra = data(api);
    if (!extra.goals.length) {
      const body = `${card(`<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "target")}</span><h2>ยังไม่มีเป้าหมายในเดโม</h2><p class="muted">เริ่มจากผลลัพธ์เล็ก ๆ แล้วเพิ่ม next action ได้ทันที</p><div class="row ex-card-actions">${link(api, "goals", "เพิ่มเป้าหมายตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${link(api, "today", "กลับไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></div>`, { className: "ex-empty-card" })}`;
      return page(api, "รายละเอียดเป้าหมาย", "เริ่มจากข้อมูลที่พร้อม แล้วค่อยเติมรายละเอียดเมื่อจำเป็น", body, { eyebrow: "รายละเอียดเป้าหมาย" });
    }
    const item = goal(api, extra.selectedGoalId);
    const related = goalTasks(api, item.id);
    const done = related.filter((task) => task.done).length;
    const activeStep = item.milestone.find((step) => !step.done);
    const steps = item.milestone
      .map((step, index) => `<li class="ex-milestone${cls(step.done, "is-done")}${cls(activeStep && step.id === activeStep.id, "is-current")}"${step.done ? "" : ` aria-current="${activeStep && step.id === activeStep.id ? "step" : "false"}"`}><span class="ex-milestone-marker">${step.done ? icon(api, "check") : e(api, index + 1)}</span><span>${e(api, step.label)}</span></li>`)
      .join("");
    const goalOptions = extra.goals
      .map((candidate) => `<option value="${e(api, candidate.id)}"${candidate.id === item.id ? " selected" : ""}>${e(api, candidate.title)}</option>`)
      .join("");
    const body = `
      <div class="ex-inline-select"><label class="field"><span>เลือกเป้าหมายในข้อมูลทดลอง</span><select data-action="select-goal" aria-label="เลือกเป้าหมาย">${goalOptions}</select></label></div>
      ${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile">${icon(api, "target")}</span><div><h2>${e(api, item.title)}</h2><p class="muted">${e(api, item.description)}</p></div></div>${badge(api, "เป้าหมายหลัก", "success")}</div>
        <div class="grid-2 ex-detail-metrics">${metric(api, `${item.outcome}%`, "ผลลัพธ์ที่บันทึก", "ตัวอย่างเพื่อสาธิต")}${metric(api, `${done}/${related.length}`, "งานที่ทำเสร็จ", "ไม่ใช้แทนผลลัพธ์")}</div>
        ${progress(api, item.outcome, "ความคืบหน้าผลลัพธ์")}
        <div class="row ex-card-actions">${button(api, "record-outcome", "บันทึกผลลัพธ์ตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${button(api, "add-goal-action", "เพิ่ม next action", { className: "btn btn-secondary", icon: "plus" })}</div>`, { className: "ex-hero-card" })}
      <div class="grid-2 ex-detail-grid">
        ${card(`${sectionTitle(api, "เส้นทาง milestone", "ความคืบหน้าที่ต้องผ่านทีละจุด") }<ol class="ex-milestone-list">${steps}</ol>`, { className: "ex-milestone-card" })}
        ${card(`${sectionTitle(api, "งานที่ผูกกับเป้าหมาย", `${related.length} งาน · ดูว่าแรงที่ใช้กำลังพาไปทางไหน`) }<div class="stack ex-task-stack">${related.map((task) => `<div class="list-row ex-task-row"><button type="button" class="ex-check-button${cls(task.done, "is-done")}" data-action="toggle-goal-task" data-id="${e(api, task.id)}" aria-label="${e(api, task.done ? "ทำไม่เสร็จ" : "ทำเสร็จ")}">${task.done ? icon(api, "check") : ""}</button><div><strong>${e(api, task.title)}</strong><span class="muted">${e(api, `${taskDuration(task)} นาที · ส่ง ${taskDeadline(task)}`)}</span></div>${badge(api, taskPriority(task), String(task.priority || "").toLowerCase() === "สูง" || String(task.priority || "").toLowerCase() === "high" ? "warning" : "")}</div>`).join("")}</div>`, { className: "ex-task-card" })}
      </div>
    `;
    return page(api, item.title, "แยกเส้นทาง milestone ออกจากจำนวนงาน เพื่อเห็นว่าความคืบหน้าคืออะไร", body, { eyebrow: "รายละเอียดเป้าหมาย" });
  };

  const pageProjects = (api) => {
    const extra = data(api);
    const projectCards = extra.projects.length
      ? extra.projects
          .map((item) => {
            const count = projectTasks(api, item.id).length;
            return card(`<div class="card-header ex-card-header"><div><span class="ex-project-dot ex-project-dot-${e(api, item.color)}"></span><div><h2>${e(api, item.title)}</h2><p class="muted">${e(api, item.context)}</p></div></div>${badge(api, item.status, item.status === "กำลังเดินหน้า" ? "success" : "warning")}</div><p>${e(api, item.description)}</p><div class="ex-project-meta"><span>${icon(api, "clock")} ${e(api, `ถึง ${item.due}`)}</span><span>${icon(api, "check")} ${e(api, `${count} งาน`)}</span></div><div class="ex-next-action"><span class="muted">next move</span><strong>${e(api, item.nextMove)}</strong></div><div class="row ex-card-actions">${button(api, "open-project", "เปิดบริบท", { className: "btn btn-primary", id: item.id, icon: "arrow" })}</div>`, { className: "ex-project-card" });
          })
          .join("")
      : card(`<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "folder")}</span><h2>ยังไม่มีโปรเจกต์</h2><p class="muted">สร้างบริบทสั้น ๆ เพื่อรวมงานที่เกี่ยวข้องและเลือก next move ได้ง่ายขึ้น</p><div class="row ex-card-actions">${button(api, "new-project", "สร้างโปรเจกต์ตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${link(api, "today", "กลับไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></div>`, { className: "ex-empty-card" });
    const projectHeader = extra.projects.length ? `<div class="grid-3 ex-stat-grid">${metric(api, extra.projects.length, "โปรเจกต์ที่เปิดอยู่", "บริบทตัวอย่าง")}${metric(api, tasks(api).filter((task) => !task.done).length, "งานที่ยังต้องดูแล", "ทุกบริบท")}${metric(api, extra.projects.filter((item) => item.nextMove).length, "โปรเจกต์ที่มี next move", "เพื่อไม่ให้รายการค้างเฉย ๆ")}</div>${sectionTitle(api, "บริบทของงาน", "โปรเจกต์ช่วยตอบว่างานนี้อยู่ในเรื่องอะไรและกำลังพาไปไหน", button(api, "new-project", "สร้างโปรเจกต์ทดลอง", { className: "btn btn-secondary", icon: "plus" }))}` : "";
    const body = `
      ${projectHeader}
      <div class="grid-2 ex-project-grid">${extra.projects.length ? projectCards : `<div class="ex-grid-span">${projectCards}</div>`}</div>
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "folder")}</span><div><h3>โปรเจกต์ไม่ใช่รายการแยกจากงาน</h3><p class="muted">ในต้นแบบ งานเดิมคง task ID เดิมและถูกแสดงซ้ำในบริบทที่เกี่ยวข้อง เพื่อให้การทำงานและการทบทวนพูดถึงชิ้นเดียวกัน</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "โปรเจกต์", "เห็นเหตุผลและบริบทของงาน ก่อนเลือกว่าจะทำอะไรต่อ", body, { eyebrow: `บริบท · ${DEMO_DATE}` });
  };

  const pageProjectDetail = (api) => {
    const extra = data(api);
    if (!extra.projects.length) {
      const body = `${card(`<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "folder")}</span><h2>ยังไม่มีโปรเจกต์ในเดโม</h2><p class="muted">สร้างบริบทสั้น ๆ เพื่อรวมงานที่เกี่ยวข้องไว้ด้วยกัน</p><div class="row ex-card-actions">${link(api, "projects", "สร้างโปรเจกต์ตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${link(api, "today", "กลับไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></div>`, { className: "ex-empty-card" })}`;
      return page(api, "รายละเอียดโปรเจกต์", "เริ่มจากบริบทที่ช่วยตัดสินใจได้เร็วขึ้น", body, { eyebrow: "รายละเอียดโปรเจกต์" });
    }
    const item = project(api, extra.selectedProjectId);
    const related = projectTasks(api, item.id);
    const planned = related.reduce((total, task) => total + taskDuration(task), 0);
    const done = related.filter((task) => task.done).length;
    const body = `
      ${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-${e(api, item.color)}">${icon(api, "folder")}</span><div><h2>${e(api, item.title)}</h2><p class="muted">${e(api, item.context)}</p></div></div>${badge(api, item.status, "success")}</div><p>${e(api, item.description)}</p><div class="grid-3 ex-stat-grid ex-stat-grid-compact">${metric(api, `${done}/${related.length}`, "งานที่เสร็จ")}${metric(api, `${planned} นาที`, "เวลาที่วางไว้")}${metric(api, item.due, "กำหนดส่งโปรเจกต์")}</div><div class="ex-next-action"><span class="muted">next move</span><strong>${e(api, item.nextMove)}</strong></div>`, { className: "ex-hero-card" })}
      ${sectionTitle(api, "งานในบริบทนี้", "กดวงกลมเพื่อสาธิตการเปลี่ยนสถานะของ task เดิม")}
      ${card(`<div class="stack ex-task-stack">${related.map((task) => `<div class="list-row ex-task-row"><button type="button" class="ex-check-button${cls(task.done, "is-done")}" data-action="toggle-project-task" data-id="${e(api, task.id)}" aria-label="${e(api, task.done ? "ทำไม่เสร็จ" : "ทำเสร็จ")}">${task.done ? icon(api, "check") : ""}</button><div><strong>${e(api, task.title)}</strong><span class="muted">${e(api, `${taskDuration(task)} นาที · กำหนดส่ง ${taskDeadline(task)}`)}</span></div><span class="ex-task-priority ex-task-priority-${e(api, String(task.priority || "medium").toLowerCase())}">${e(api, taskPriority(task))}</span></div>`).join("")}</div>`, { className: "ex-task-card" })}
      <div class="row ex-footer-actions">${link(api, "projects", "กลับไปโปรเจกต์", { className: "btn btn-secondary", icon: "arrow" })}${link(api, "tasks", "ดูงานทั้งหมด", { className: "btn btn-ghost", icon: "check" })}</div>
    `;
    return page(api, item.title, "เลือกงานจากบริบทเดียวกัน แล้วกลับไปวางในวันที่มีแรงพอ", body, { eyebrow: "รายละเอียดโปรเจกต์" });
  };

  const pageRoutine = (api) => {
    const extra = data(api);
    const days = [
      ["mon", "จ.", "21 ก.ย."],
      ["tue", "อ.", "22 ก.ย."],
      ["wed", "พ.", "23 ก.ย."],
      ["thu", "พฤ.", "24 ก.ย."],
      ["fri", "ศ.", "25 ก.ย."],
      ["sat", "ส.", "26 ก.ย."],
      ["sun", "อา.", "27 ก.ย."],
    ];
    const checked = Object.values(extra.routineChecks).filter(Boolean).length;
    const body = `
      <div class="grid-3 ex-stat-grid">${metric(api, `${checked}/7`, "รอบที่ทำแล้ว", "ตัวอย่างสัปดาห์นี้")}${metric(api, "30 นาที", "เวลาต่อรอบ", "ปรับได้ภายหลัง")}${metric(api, "พุธ", "รอบถัดไป", "ถ้ายังไม่ติดนัด")}</div>
      ${card(`${sectionTitle(api, "รูทีนประจำสัปดาห์", DEMO_WEEK, badge(api, `${checked} รอบ`, "success"))}<div class="ex-week-grid">${days.map(([id, short, date]) => `<button type="button" class="ex-day-cell${cls(extra.routineChecks[id], "is-checked")}" data-action="toggle-routine" data-id="${e(api, id)}" aria-pressed="${Boolean(extra.routineChecks[id])}"><span>${e(api, short)}</span><strong>${extra.routineChecks[id] ? icon(api, "check") : "–"}</strong><small>${e(api, date)}</small></button>`).join("")}</div>`, { className: "ex-routine-card" })}
      <div class="grid-2 ex-detail-grid"><div class="card ex-card"><h2>ทำให้รอบนี้เข้ากับวันจริง</h2><p class="muted">รูทีนเป็นตัวเลือกที่ช่วยให้วางแผนง่ายขึ้น ถ้าวันนี้มีงานด่วน ให้ข้ามรอบนี้ได้โดยไม่สร้างงานค้างปลอม</p><div class="row ex-card-actions">${extra.routineExtraBreak ? badge(api, "เพิ่มช่วงพักในเดโมแล้ว", "success") : button(api, "routine-add", "เพิ่มช่วงพัก 10 นาที", { className: "btn btn-secondary", icon: "plus" })}</div></div><div class="card ex-card"><h2>สิ่งที่ควรเห็นในวันถัดไป</h2><ul class="ex-check-list"><li>${icon(api, "check")} รอบเช้าไม่ชนกับนัด</li><li>${icon(api, "check")} กดข้ามแล้วรอบอื่นยังคงเดิม</li><li>${icon(api, "check")} วันที่เป็นตัวอย่าง ไม่ใช่ข้อมูลผู้ใช้จริง</li></ul></div></div>
    `;
    return page(api, "รูทีน", "ทำซ้ำในระดับที่พอดีกับชีวิตจริง และให้การข้ามมีความหมาย", body, { eyebrow: `จังหวะ · ${DEMO_DATE}` });
  };

  const pageFinance = (api) => {
    const extra = data(api);
    const finance = extra.finance;
    const expenseTotal = finance.expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const budget = Number(finance.budget) || 0;
    const billContent = finance.bills.length
      ? `<div class="stack ex-bill-stack">${finance.bills.map((bill) => `<div class="list-row ex-bill-row"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "wallet")}</span><div class="ex-bill-info"><strong>${e(api, bill.title)}</strong><span class="muted">ครบกำหนด ${e(api, bill.due)}</span></div><strong class="ex-money">฿${e(api, bill.amount.toLocaleString("th-TH"))}</strong><div>${bill.paid ? badge(api, "จำลองจ่ายแล้ว", "success") : button(api, "pay-bill", "จำลองจ่าย", { className: "btn btn-secondary", id: bill.id, icon: "check" })}${bill.paid ? button(api, "undo-bill", "ยกเลิกเดโม", { className: "btn btn-ghost ex-inline-button", id: bill.id }) : ""}</div></div>`).join("")}</div>`
      : `<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "wallet")}</span><h2>ยังไม่มีบิลในเดโม</h2><p class="muted">เพิ่มบิลตัวอย่างหนึ่งรายการ แล้วลองกดจำลองจ่ายเพื่อดูรายจ่ายที่เพิ่มครั้งเดียว</p><div class="row ex-card-actions">${button(api, "add-demo-bill", "เพิ่มบิลตัวอย่าง", { className: "btn btn-primary", icon: "plus" })}${link(api, "today", "กลับไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></div>`;
    const body = `
      <div class="grid-3 ex-stat-grid">${metric(api, `฿${expenseTotal.toLocaleString("th-TH")}`, "รายจ่ายที่บันทึก", finance.expenses.length ? "รวมข้อมูลตัวอย่าง" : "ยังไม่มีข้อมูล")}${metric(api, `฿${finance.bills.filter((bill) => !bill.paid).reduce((sum, bill) => sum + bill.amount, 0).toLocaleString("th-TH")}`, "บิลที่ยังไม่จำลองจ่าย", finance.bills.length ? "ตัดสินใจเองได้" : "เพิ่มบิลตัวอย่างได้")}${metric(api, budget ? `฿${budget.toLocaleString("th-TH")}` : "—", "งบเดือนตัวอย่าง", budget ? "ไม่ได้เชื่อมธนาคาร" : "ยังไม่ได้ตั้ง")}</div>
      ${sectionTitle(api, "บิลและรายจ่าย", "การกดจำลองจ่ายจะเพิ่มรายจ่ายเพียงครั้งเดียวตาม bill ID")}
      ${card(billContent, { className: "ex-bill-card" })}
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-peach">${icon(api, "sparkles")}</span><div><h2>ขอบเขตของเดโมการเงิน</h2><p class="muted">ยอดทั้งหมดเป็นข้อมูลตัวอย่าง การจำลองจ่ายแก้เฉพาะ state ใน browser ไม่ส่งเงิน ไม่อ่านธนาคาร และไม่ถือเป็นหลักฐานว่าจ่ายจริง</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "การเงิน", "เห็นบิลในบริบทของแผน และทดลองผลต่อยอดรายจ่ายอย่างปลอดภัย", body, { eyebrow: `ตัวเลขตัวอย่าง · ${DEMO_DATE}` });
  };

  const reviewTask = (api) => tasks(api).find((task) => task.id === "task-weekly-review") || tasks(api).find((task) => !task.done);

  const pageReviews = (api) => {
    const extra = data(api);
    const task = reviewTask(api);
    const wins = extra.reviews.filter((item) => item.type === "win");
    const blockers = extra.reviews.filter((item) => item.type === "blocker");
    const carryover = extra.nextWeekCommitments.includes(task?.id);
    const winsContent = wins.length ? `<div class="stack ex-reflection-list">${wins.map((item) => `<div class="ex-reflection-item ex-reflection-win"><span>${icon(api, "check")}</span><p>${e(api, item.text)}</p></div>`).join("")}</div>` : `<div class="empty-state ex-mini-empty"><p>ยังไม่มี win ในข้อมูลนี้</p><p class="muted">เริ่มจากงานที่คุณเลือกทำสำเร็จ แล้วค่อยเติมเหตุผลสั้น ๆ ในรอบจริง</p></div>`;
    const blockersContent = blockers.length ? `<div class="stack ex-reflection-list">${blockers.map((item) => `<div class="ex-reflection-item ex-reflection-blocker"><span>${icon(api, "clock")}</span><p>${e(api, item.text)}</p></div>`).join("")}</div>` : `<div class="empty-state ex-mini-empty"><p>ยังไม่มี blocker ในข้อมูลนี้</p><p class="muted">ถ้ามีงานติดขัด ใช้การย้าย task เดิมด้านล่างเพื่อเริ่มปรับแผน</p></div>`;
    const carryoverContent = task ? `<div><strong>${e(api, task.title)}</strong><span class="muted">${e(api, `${taskDuration(task)} นาที · กำหนดส่ง ${taskDeadline(task)}`)}</span></div>${carryover ? button(api, "review-undo-move", "นำกลับวันเดิม", { className: "btn btn-secondary", id: task.id }) : button(api, "review-move-next-week", "ย้ายไปสัปดาห์หน้า", { className: "btn btn-primary", id: task.id, icon: "arrow" })}` : `<div class="empty-state ex-mini-empty"><p>ยังไม่มีงานค้างให้ย้าย</p><p class="muted">บันทึกงานแรกจากวันนี้ แล้วกลับมาทบทวนเมื่อมีสิ่งที่ต้องตัดสินใจ</p><div class="row ex-card-actions">${link(api, "today", "บันทึกงานแรก", { className: "btn btn-secondary", icon: "plus" })}</div></div>`;
    const body = `
      <div class="ex-review-intro"><span class="ex-icon-tile">${icon(api, "heart")}</span><div><strong>${e(api, DEMO_WEEK)}</strong><p class="muted">ใช้ข้อมูลเพื่อเลือกการตัดสินใจครั้งถัดไป ไม่ใช่เพื่อสรุป productivity ของคน</p></div></div>
      <div class="grid-2 ex-review-grid"><div>${card(`${sectionTitle(api, "สิ่งที่เดินหน้า", "เขียนให้เฉพาะเจาะจงกับสัปดาห์นี้") }${winsContent}`, { className: "ex-review-card" })}</div><div>${card(`${sectionTitle(api, "สิ่งที่ติดขัด", "ใช้เป็นข้อมูลสำหรับปรับแผน") }${blockersContent}`, { className: "ex-review-card" })}</div></div>
      ${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "arrow")}</span><div><h2>งานที่อยากย้ายไปสัปดาห์หน้า</h2><p class="muted">ใช้ task เดิมและ task ID เดิม เพื่อไม่ให้เกิดรายการซ้ำ</p></div></div>${carryover ? badge(api, "อยู่สัปดาห์หน้าแล้ว", "success") : ""}</div><div class="ex-carryover-row">${carryoverContent}</div>`, { className: "ex-carryover-card" })}
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "calendar")}</span><div><h2>การทบทวนที่จบด้วยแผน</h2><p class="muted">เมื่อย้ายสำเร็จ งานเดิมจะถูกทำเครื่องหมายให้แสดงในแผนสัปดาห์หน้า โดยคง task เดิมและไม่สร้างรายการซ้ำ การบันทึกนี้เป็น local demo เท่านั้น</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "ทบทวนสัปดาห์", "ดู wins และ blockers แล้วตัดสินใจเรื่องเดียวที่ช่วยให้สัปดาห์หน้าเริ่มง่ายขึ้น", body, { eyebrow: `ทบทวน · ${DEMO_DATE}` });
  };

  const pageInsights = (api) => {
    const extra = data(api);
    const insight = extra.insights;
    const difference = Math.max(0, insight.planned - insight.completed);
    const insightTask = proposalTask(api);
    const hasTimeData = insight.planned > 0 || insight.completed > 0;
    const insightBody = hasTimeData
      ? `${card(`${sectionTitle(api, "planned เทียบกับ completed", "ข้อมูลตัวอย่างเพื่อให้เห็นว่าควรเก็บสองค่าแยกกัน") }<div class="ex-time-bars"><div class="ex-time-bar-row"><span>วางไว้</span><div class="ex-time-bar"><span style="width:100%"></span></div><strong>${e(api, `${insight.planned} นาที`)}</strong></div><div class="ex-time-bar-row"><span>ทำเสร็จ</span><div class="ex-time-bar ex-time-bar-peach"><span style="width:${Math.round((insight.completed / Math.max(insight.planned, 1)) * 100)}%"></span></div><strong>${e(api, `${insight.completed} นาที`)}</strong></div></div>`, { className: "ex-insight-chart" })}${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "sparkles")}</span><div><h2>ข้อเสนอที่แก้ไขได้</h2><p class="muted">กันเวลาสำหรับงานข้อเสนอให้สั้นลงหนึ่งช่วง แล้วดูว่าการตัดสินใจเหมาะกับวันจริงหรือไม่</p></div></div>${insight.applied ? badge(api, "เพิ่มในแผนทดลองแล้ว", "success") : ""}</div><p class="ex-plan-copy">ข้อเสนอ: วางช่วง <strong>90 นาที</strong> สำหรับ “${e(api, insightTask?.title || "งานสำคัญ") }” ในวันที่ 23 ก.ย. 2026</p><div class="row ex-card-actions">${insight.applied ? button(api, "remove-insight-plan", "นำออกจากแผนทดลอง", { className: "btn btn-secondary" }) : button(api, "apply-insight-plan", "เพิ่มเป็นแผนทดลอง", { className: "btn btn-primary", icon: "arrow" })}</div>`, { className: "ex-plan-card" })}`
      : card(`<div class="empty-state ex-starter-state"><span class="ex-icon-tile">${icon(api, "chart")}</span><h2>ยังไม่มีข้อมูลเวลาที่บันทึก</h2><p class="muted">เริ่มจากเลือกงานในวันนี้ แล้วกลับมาดู planned เทียบกับ completed เมื่อมีข้อมูลจริงในเดโม</p><div class="row ex-card-actions">${link(api, "today", "ไปเลือกงานวันนี้", { className: "btn btn-primary", icon: "calendar" })}${link(api, "entries", "เพิ่มบันทึกตัวอย่าง", { className: "btn btn-ghost", icon: "plus" })}</div></div>`, { className: "ex-empty-card" });
    const body = `
      <div class="grid-3 ex-stat-grid">${metric(api, `${insight.planned} นาที`, "เวลาที่วางไว้", "planned time")}${metric(api, `${insight.completed} นาที`, "เวลาที่ทำเครื่องหมายเสร็จ", "completed time")}${metric(api, `${difference} นาที`, "ช่องว่างที่เห็น", "ไม่ใช่คะแนนประสิทธิภาพ")}</div>
      ${insightBody}
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-peach">${icon(api, "chart")}</span><div><h2>อ่านข้อมูลแบบระวัง</h2><p class="muted">เวลาที่วางไว้และเวลาที่ทำเสร็จต่างกันได้จากงานแทรกหรือการประมาณที่คลาดเคลื่อน ตัวอย่างนี้ไม่อ้างว่าเกิดประโยชน์จริงกับผู้ใช้</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "อินไซต์", "เปลี่ยนบันทึกเวลาให้เป็นคำถามที่ช่วยวางแผน ไม่ใช่คำตัดสิน", body, { eyebrow: `อินไซต์ · ${DEMO_DATE}` });
  };

  const pageSettings = (api) => {
    const extra = data(api);
    const setting = extra.settings;
    const connectionBadge = (value) => badge(api, value, value === "ยังไม่เชื่อมต่อ" ? "warning" : "success");
    const body = `
      ${card(`<form class="stack ex-settings-form" data-form="settings"><div class="card-header ex-card-header"><div><span class="ex-icon-tile">${icon(api, "settings")}</span><div><h2>เวลาทำงาน</h2><p class="muted">ใช้เป็นขอบเขตประกอบการวางแผน เดโมยังไม่ตั้ง calendar จริง</p></div></div></div><div class="grid-2"><label class="field"><span>เริ่มงาน</span><input class="input" name="workingStart" type="time" value="${e(api, setting.workingStart)}" /></label><label class="field"><span>เลิกงาน</span><input class="input" name="workingEnd" type="time" value="${e(api, setting.workingEnd)}" /></label></div><label class="field"><span>พักรวมต่อวัน (นาที)</span><input class="input" name="breakMinutes" type="number" min="0" max="240" value="${e(api, setting.breakMinutes)}" /></label><div class="row ex-card-actions">${button(api, "save-settings", "บันทึกการตั้งค่าเดโม", { className: "btn btn-primary", icon: "check" })}</div></form>`, { className: "ex-settings-card" })}
      <details class="ex-advanced-settings"><summary>ตั้งค่าขั้นสูงและการเชื่อมต่อ (เดโม)</summary><div class="grid-2 ex-integration-grid">${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "calendar")}</span><div><h2>ปฏิทิน</h2><p class="muted">แสดงสถานะขอบเขต integration เท่านั้น</p></div></div>${connectionBadge(setting.calendar)}</div><p class="muted">ในต้นแบบไม่มีการอ่านหรือเขียน event จากบัญชีภายนอก</p><div class="row ex-card-actions">${button(api, "demo-connect-calendar", setting.calendar === "ยังไม่เชื่อมต่อ" ? "จำลองสถานะเชื่อมต่อ" : "รีเซ็ตสถานะเดโม", { className: "btn btn-secondary" })}</div>`, { className: "ex-integration-card" })}${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-peach">${icon(api, "heart")}</span><div><h2>LINE</h2><p class="muted">ช่องทางแจ้งเตือนในอนาคต</p></div></div>${connectionBadge(setting.line)}</div><p class="muted">ไม่มีการส่งข้อความ ไม่มี OAuth และไม่มีการเชื่อมบัญชีจริงในต้นแบบนี้</p><div class="row ex-card-actions">${button(api, "demo-connect-line", setting.line === "ยังไม่เชื่อมต่อ" ? "จำลองสถานะเชื่อมต่อ" : "รีเซ็ตสถานะเดโม", { className: "btn btn-secondary" })}</div>`, { className: "ex-integration-card" })}</div><div class="ex-advanced-note">${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "check")}</span><div><h2>สิ่งที่บันทึกได้ในเดโม</h2><p class="muted">เวลาเริ่ม–เลิกงานและสถานะจำลองถูกเก็บใน browser ของต้นแบบเท่านั้น การเชื่อมต่อจริงต้องผ่าน consent, OAuth, sync และ readback ที่ตรวจสอบได้</p></div></div>`, { className: "ex-callout" })}</div></details>
    `;
    return page(api, "ตั้งค่า", "กำหนดเวลาที่ระบบควรเคารพ และดูขอบเขตการเชื่อมต่ออย่างโปร่งใส", body, { eyebrow: `การควบคุม · ${DEMO_DATE}` });
  };

  const pageSales = (api) => {
    const extra = data(api);
    const sales = extra.sales;
    const body = sales.enabled
      ? `<div class="ex-optional-label">บริบทผู้ขายเปิดอยู่ในข้อมูลทดลอง ${button(api, "sales-hide", "ซ่อนบริบทผู้ขาย", { className: "btn btn-ghost" })}</div><div class="grid-3 ex-stat-grid">${metric(api, `฿${sales.revenue.toLocaleString("th-TH")}`, "ยอดรับตัวอย่าง", "ไม่ใช่ยอดจริง")}${metric(api, `฿${sales.outstanding.toLocaleString("th-TH")}`, "ยอดค้างตัวอย่าง", "ใช้เพื่อสาธิต")}${metric(api, sales.clients, "ลูกค้าที่กำลังคุย", "ไม่ผูกบัญชี")}</div>${card(`<div class="card-header ex-card-header"><div><span class="ex-icon-tile ex-icon-tile-peach">${icon(api, "chart")}</span><div><h2>ขายงานโดยไม่เสียภาพวัน</h2><p class="muted">ตัวเลขเป็นบริบทเสริมสำหรับผู้ขายที่เลือกเปิดเอง</p></div></div>${badge(api, "ข้อมูลตัวอย่าง", "warning")}</div><p class="muted">หน้าต้นแบบนี้ยังไม่มีการอ่าน payment provider, ออกใบเสร็จ หรือสรุปกำไรจริง</p><div class="row ex-card-actions">${button(api, "sales-hide", "ปิดบริบทผู้ขาย", { className: "btn btn-secondary" })}</div>`, { className: "ex-sales-card" })}`
      : `${card(`<div class="ex-optional-empty"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "chart")}</span><div><h2>บริบทผู้ขายเป็นตัวเลือก</h2><p class="muted">ถ้าคุณรับงานหรือขายของ ให้เปิดตัวเลขตัวอย่างเพื่อดูว่าข้อมูลการขายควรช่วยตัดสินใจเรื่องเวลาอย่างไร การข้ามหน้านี้ไม่ทำให้ planner ใช้งานไม่ได้</p><div class="row ex-card-actions">${button(api, "sales-enable", "เปิดตัวเลขตัวอย่าง", { className: "btn btn-primary", icon: "arrow" })}</div></div></div>`, { className: "ex-optional-card" })}${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "heart")}</span><div><h2>ขอบเขตที่ชัดเจน</h2><p class="muted">ตัวเลขเชิงธุรกิจเป็นข้อมูลตัวอย่าง ไม่ใช่รายงานการขายของผู้ใช้และไม่มีผลต่อบัญชีจริง</p></div></div>`, { className: "ex-callout" })}`;
    return page(api, "ตัวเลขผู้ขาย", "เปิดบริบทเท่าที่จำเป็น เพื่อให้การวางแผนไม่หลุดจากงานที่ต้องรับผิดชอบ", body, { eyebrow: `ตัวเลือก · ${DEMO_DATE}` });
  };

  const pageEntries = (api) => {
    const extra = data(api);
    const sorted = [...extra.entries].sort((a, b) => a.date.localeCompare(b.date));
    const max = Math.max(...sorted.map((item) => Number(item.value) || 0), 1);
    const body = `
      ${sectionTitle(api, "ประวัติบันทึกตัวอย่าง", "ค่าที่กรอกเองช่วยให้เห็นแนวโน้ม แต่ยังไม่ใช่ผลวัดประสิทธิผล", button(api, "new-entry", "เพิ่มบันทึก", { className: "btn btn-primary", icon: "plus" }))}
      ${card(`<div class="ex-entry-chart" role="img" aria-label="กราฟค่าบันทึกตัวอย่างตามวันที่">${sorted.map((item) => `<div class="ex-entry-bar"><div class="ex-entry-bar-track"><span style="height:${Math.round(((Number(item.value) || 0) / max) * 100)}%"></span></div><strong>${e(api, item.value)}</strong><small>${e(api, item.date.slice(5).replace("-", "/"))}</small></div>`).join("")}</div>`, { className: "ex-entry-chart-card" })}
      ${card(`<div class="stack ex-entry-list">${sorted.map((item) => `<div class="list-row ex-entry-row"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "sparkles")}</span><div><strong>${e(api, item.note)}</strong><span class="muted">${e(api, item.date)} · ค่าตัวอย่าง ${e(api, item.value)}/5</span></div><button type="button" class="btn btn-ghost ex-delete-button" data-action="delete-entry" data-id="${e(api, item.id)}" aria-label="ลบบันทึก ${e(api, item.date)}">${icon(api, "x")}</button></div>`).join("")}</div>`, { className: "ex-entry-list-card" })}
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-peach">${icon(api, "chart")}</span><div><h2>เก็บ metric ให้ตรงกับคำถาม</h2><p class="muted">บันทึกนี้ถามว่า “วันนี้งานสำคัญเดินหน้าแค่ไหน” ไม่ได้แปลว่าผู้ใช้มี productivity สูงหรือต่ำ และไม่ควรใช้แทน outcome ของเป้าหมาย</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "บันทึกผล", "เพิ่มบริบทเล็ก ๆ ให้การทบทวนมีข้อมูล โดยยังแยกข้อเท็จจริงจากการตีความ", body, { eyebrow: `หลักฐาน · ${DEMO_DATE}` });
  };

  const pageMore = (api) => {
    const core = CORE_ROUTES.map(([route, title, iconName]) => ({ route, title, iconName, group: "แกนหลัก" }));
    const extras = Object.entries(EXTRA_ROUTE_TITLES).map(([route, title]) => ({ route, title, iconName: EXTRA_ICONS[route], group: "หน้าประกอบ" }));
    const routes = [...core, ...extras];
    const body = `
      <div class="ex-directory-note"><span class="ex-icon-tile">${icon(api, "menu")}</span><div><strong>21 หน้าสำหรับสำรวจแนวคิด</strong><p class="muted">ลิงก์ทั้งหมดเป็นหน้าต้นแบบ ข้อมูลยังเป็นเดโมและไม่เชื่อมระบบจริง</p></div></div>
      <div class="grid-3 ex-directory-grid">${routes.map((item, index) => card(`<a class="ex-directory-link" href="#${e(api, item.route)}"><span class="ex-directory-number">${e(api, index + 1)}</span><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, item.iconName)}</span><span><strong>${e(api, item.title)}</strong><small>${e(api, item.group)}</small></span><span class="ex-directory-arrow">${icon(api, "chevron")}</span></a>`, { className: "ex-directory-card" })).join("")}</div>
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "search")}</span><div><h2>เริ่มจากเส้นทางที่สอดคล้องกับคำถาม</h2><p class="muted">Today, Plan, Calendar, Inbox, Tasks, Rescue และ Focus เป็นแกนหลัก ส่วนหน้าอื่นช่วยตรวจบริบท เป้าหมาย และการทบทวน</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "ดูทุกหน้า", "สารบัญของต้นแบบ 21 หน้าหลักและหน้าประกอบ", body, { eyebrow: `สารบัญ · ${DEMO_DATE}` });
  };

  const pageOnboarding = (api) => {
    const extra = data(api);
    const selection = extra.onboarding;
    const choice = (name, label, value, active) => `<button type="button" class="ex-choice${cls(active, "is-selected")}" data-action="onboarding-select" data-value="${e(api, value)}" data-id="${e(api, name)}" aria-pressed="${Boolean(active)}"><span>${active ? icon(api, "check") : ""}</span><strong>${e(api, label)}</strong></button>`;
    const starter = card(`<form class="stack ex-onboarding-starter" data-form="onboarding-starter"><div class="card-header ex-card-header"><div><span class="ex-icon-tile">${icon(api, "calendar")}</span><div><h2>เริ่มจากงานเดียว</h2><p class="muted">พิมพ์ครั้งเดียวแล้วไปต่อที่วันนี้ได้เลย ตัวเลือกด้านล่างเป็นทางเลือกเสริม</p></div></div></div><label class="field"><span>เรื่องที่อยากเริ่มวันนี้ (ไม่บังคับ)</span><input class="input" name="starterTitle" placeholder="เช่น ตอบข้อความลูกค้าที่ค้างไว้" autocomplete="off" /></label><div class="row ex-card-actions">${button(api, "onboarding-suggest", "ใช้ตัวอย่างแนะนำ", { className: "btn btn-secondary", icon: "sparkles" })}${button(api, "onboarding-start", "เริ่มในวันนี้", { className: "btn btn-primary", icon: "arrow" })}${button(api, "onboarding-skip", "ข้ามไปวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div></form>`, { className: "ex-onboarding-starter-card" });
    const body = `
      ${starter}
      ${card(`<div class="ex-stepper" aria-label="ขั้นตอนเริ่มต้นใช้งาน"><span class="is-current">1</span><i></i><span>2</span><i></i><span>3</span></div><div class="ex-onboarding-copy"><p class="eyebrow">เลือกเท่าที่อยากบอก</p><h2>เริ่มจากวันที่คุณต้องจัดการก่อน</h2><p class="muted">ทุกตัวเลือกเป็นข้อมูลทดลอง เปลี่ยนได้ภายหลังและข้าม integration ได้</p></div><div class="ex-onboarding-section"><h3>บทบาทที่ใกล้เคียง</h3><div class="ex-choice-grid">${choice("role", "ผู้ทำงานอิสระ", "ผู้ทำงานอิสระ", selection.role === "ผู้ทำงานอิสระ")}${choice("role", "เจ้าของร้านเล็ก", "เจ้าของร้านเล็ก", selection.role === "เจ้าของร้านเล็ก")}${choice("role", "จัดการชีวิตส่วนตัว", "จัดการชีวิตส่วนตัว", selection.role === "จัดการชีวิตส่วนตัว")}</div></div><div class="ex-onboarding-section"><h3>สิ่งที่อยากโฟกัสก่อน</h3><div class="ex-choice-grid">${choice("focus", "เลือกงานสำคัญ", "เลือกงานสำคัญ", selection.focus === "เลือกงานสำคัญ")}${choice("focus", "จัดเวลาตามงานจริง", "จัดเวลาตามงานจริง", selection.focus === "จัดเวลาตามงานจริง")}${choice("focus", "ทบทวนแล้วเริ่มใหม่", "ทบทวนแล้วเริ่มใหม่", selection.focus === "ทบทวนแล้วเริ่มใหม่")}</div></div><div class="ex-onboarding-section"><h3>ทางเริ่มต้น</h3><div class="ex-choice-grid">${choice("starter", "เริ่มจากวันนี้", "เริ่มจากวันนี้", selection.starter === "เริ่มจากวันนี้")}${choice("starter", "นำเข้าทีหลัง", "นำเข้าทีหลัง", selection.starter === "นำเข้าทีหลัง")}</div></div><div class="row ex-card-actions">${button(api, "save-onboarding", "บันทึกตัวเลือกเดโม", { className: "btn btn-primary", icon: "arrow" })}${button(api, "onboarding-skip", "ข้ามไปดูวันนี้", { className: "btn btn-ghost", icon: "calendar" })}</div>`, { className: "ex-onboarding-card" })}
      ${card(`<div class="ex-note"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "heart")}</span><div><h2>เริ่มเล็กก็ได้</h2><p class="muted">ไม่จำเป็นต้องสร้าง goal, project หรือเชื่อม LINE ก่อน จึงจะทดลองเลือกงานสำหรับวันนี้ได้</p></div></div>`, { className: "ex-callout" })}
    `;
    return page(api, "เริ่มต้นใช้งาน", "เลือกบริบทเท่าที่พร้อม แล้วให้ planner ช่วยเริ่มจากก้าวเล็ก ๆ", body, { eyebrow: `เริ่มต้น · ${DEMO_DATE}` });
  };

  const pageLogin = (api) => {
    const extra = data(api);
    const body = `
      <div class="ex-login-layout"><div class="ex-login-art"><span class="ex-icon-tile">${icon(api, "compass")}</span><p class="eyebrow">Kemtit Planner VNext</p><h2>กลับมาจัดวันให้พอดีกับชีวิตจริง</h2><p class="muted">หน้านี้จำลองหน้าตา login เพื่อทดสอบเส้นทางเท่านั้น ไม่มีการตรวจข้อมูลหรือสร้าง session</p></div>${card(`<form class="stack ex-login-card" data-form="login"><div class="ex-login-header"><span class="ex-icon-tile ex-icon-tile-soft">${icon(api, "home")}</span><h2>เข้าสู่ระบบ</h2><p class="muted">เดโมเท่านั้น · ไม่มีการส่งข้อมูลออกจาก browser</p></div><button type="button" class="btn ex-google-button" data-action="google-signin" aria-haspopup="dialog" aria-label="เข้าสู่ระบบด้วย Google"><img src="assets/google-sign-in-standard-white.png" alt="" aria-hidden="true" /></button><p class="ex-google-note">จำลองใน prototype เท่านั้น · ไม่เชื่อมบัญชี Google</p><div class="ex-login-divider" role="presentation"><span>หรือดำเนินการด้วยอีเมลเดโม</span></div><label class="field"><span>อีเมลสำหรับเดโม</span><input class="input" type="email" name="email" value="demo@example.test" autocomplete="off" /></label>${button(api, "demo-login", extra.demoLoggedIn ? "อยู่ในโหมดเดโมแล้ว" : "ดำเนินการด้วยอีเมล", { className: "btn btn-primary ex-full-button", icon: "arrow" })}<p class="ex-login-footnote">ไม่ใช่การ auth จริง และไม่มีการบันทึกบัญชี</p></form>`, { className: "ex-login-card-shell" })}</div>
      <div class="row ex-footer-actions">${link(api, "today", "กลับไปดูวันนี้", { className: "btn btn-secondary", icon: "calendar" })}${link(api, "onboarding", "ไปเริ่มต้นใช้งาน", { className: "btn btn-ghost", icon: "compass" })}</div>
    `;
    return page(api, "เข้าสู่ระบบ", "เส้นทางสำหรับทดสอบเท่านั้น ไม่ใช่ authentication จริง", body, { eyebrow: `เดโม · ${DEMO_DATE}` });
  };

  const route = (title, render, action, eyebrow) => ({ title, render, action, eyebrow });

  const handleGoalAction = (action, el, api) => {
    const extra = data(api);
    if (action === "open-goal") {
      extra.selectedGoalId = el?.dataset?.id || extra.selectedGoalId;
      api.navigate("goal-detail");
    } else if (action === "new-goal") {
      openModal(api, "เพิ่มเป้าหมายทดลอง", `<form class="stack ex-modal-form" data-form="new-goal"><label class="field"><span>ชื่อเป้าหมาย</span><input class="input" name="title" placeholder="เช่น มีเวลาพักที่รักษาได้" /></label><label class="field"><span>ผลลัพธ์ที่อยากเห็น</span><input class="input" name="target" placeholder="เขียนเป็นสิ่งที่ตรวจได้" /></label><div class="row ex-modal-actions">${button(api, "save-goal", "เพิ่มในเดโม", { className: "btn btn-primary" })}${button(api, "close-modal", "ยกเลิก", { className: "btn btn-ghost" })}</div></form>`);
    } else if (action === "save-goal") {
      const title = localInput(el, '[name="title"]')?.value?.trim();
      const target = localInput(el, '[name="target"]')?.value?.trim();
      if (!title) {
        if (typeof api.toast === "function") api.toast("กรุณาใส่ชื่อเป้าหมายก่อนบันทึก");
        return;
      }
      const id = `goal-demo-${extra.goals.length + 1}`;
      extra.goals.push({ id, title, description: "เป้าหมายที่เพิ่มในข้อมูลทดลอง", outcome: 0, target: target || "ยังไม่ได้กำหนดผลลัพธ์", milestone: [{ id: "start", label: "กำหนดก้าวแรก", done: false }], nextAction: "" });
      extra.selectedGoalId = id;
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "เพิ่มเป้าหมายในเดโมแล้ว");
    }
  };

  const handleGoalDetailAction = (action, el, api) => {
    const extra = data(api);
    if (action === "select-goal") {
      extra.selectedGoalId = el?.value || extra.selectedGoalId;
      refresh(api);
    } else if (action === "toggle-goal-task") {
      const task = findTask(api, el?.dataset?.id);
      if (task) {
        task.done = !task.done;
        refresh(api, task.done ? "ทำเครื่องหมายงานในเดโมแล้ว" : "นำเครื่องหมายงานออกแล้ว");
      }
    } else if (action === "accept-goal-next") {
      const item = goal(api, extra.selectedGoalId);
      const next = goalTasks(api, extra.selectedGoalId).find((task) => !task.done);
      if (!next) {
        if (typeof api.toast === "function") api.toast("ยังไม่มี task ให้เลือก · บันทึกงานแรกจากวันนี้ก่อน");
        return;
      }
      item.nextAction = next.title;
      extra.goalNextTaskId = next.id;
      if (!next.plannedDate) next.plannedDate = "2026-09-23";
      if (Object.prototype.hasOwnProperty.call(next, "plannedTime") && !next.plannedTime) next.plannedTime = "09:00";
      refresh(api, "เลือก task เดิมเป็นก้าวถัดไปแล้ว");
    } else if (action === "record-outcome") {
      const item = goal(api, extra.selectedGoalId);
      openModal(api, "บันทึกผลลัพธ์ตัวอย่าง", `<form class="stack ex-modal-form" data-form="outcome"><p class="muted">${e(api, item.title)} · ค่าเดิม ${e(api, `${item.outcome}%`)}</p><label class="field"><span>ผลลัพธ์ที่เห็น (%)</span><input class="input" name="outcome" type="number" min="0" max="100" value="${e(api, item.outcome)}" /></label><div class="row ex-modal-actions">${button(api, "save-outcome", "บันทึกในเดโม", { className: "btn btn-primary" })}${button(api, "close-modal", "ยกเลิก", { className: "btn btn-ghost" })}</div></form>`);
    } else if (action === "add-goal-action") {
      openModal(api, "เพิ่ม next action", `<form class="stack ex-modal-form" data-form="goal-action"><label class="field"><span>งานถัดไป</span><input class="input" name="nextAction" placeholder="เขียนเป็นคำกริยาและผลลัพธ์" /></label><div class="row ex-modal-actions">${button(api, "save-goal-action", "บันทึกในเดโม", { className: "btn btn-primary" })}${button(api, "close-modal", "ยกเลิก", { className: "btn btn-ghost" })}</div></form>`);
    } else if (action === "save-outcome") {
      const item = goal(api, extra.selectedGoalId);
      const value = Number(localInput(el, '[name="outcome"]')?.value);
      if (item && Number.isFinite(value)) item.outcome = Math.max(0, Math.min(100, value));
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "บันทึกผลลัพธ์ตัวอย่างแล้ว");
    } else if (action === "save-goal-action") {
      const item = goal(api, extra.selectedGoalId);
      const nextAction = localInput(el, '[name="nextAction"]')?.value?.trim();
      if (!nextAction) {
        if (typeof api.toast === "function") api.toast("กรุณาใส่ next action ก่อนบันทึก");
        return;
      }
      item.nextAction = nextAction;
      const taskId = `task-goal-${Date.now()}`;
      tasks(api).push({ id: taskId, title: nextAction, area: "งาน", type: "work", estimatedMinutes: 30, duration: 30, dueDate: null, deadline: null, plannedDate: DEMO_ISO_DATE, plannedTime: null, done: false, inbox: false, priority: "กลาง", project: null, goalId: item.id, reason: "next action จากรายละเอียดเป้าหมาย" });
      if (!Array.isArray(extra.goalTaskLinks[item.id])) extra.goalTaskLinks[item.id] = [];
      extra.goalTaskLinks[item.id].push(taskId);
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "เพิ่ม next action เป็น task เดิมในเดโมแล้ว");
    }
  };

  const handleProjectAction = (action, el, api) => {
    const extra = data(api);
    if (action === "open-project") {
      extra.selectedProjectId = el?.dataset?.id || extra.selectedProjectId;
      api.navigate("project-detail");
    } else if (action === "new-project") {
      openModal(api, "สร้างโปรเจกต์ทดลอง", `<form class="stack ex-modal-form" data-form="new-project"><label class="field"><span>ชื่อโปรเจกต์</span><input class="input" name="title" placeholder="เช่น งานปรับแพ็กเกจ" /></label><label class="field"><span>บริบท</span><input class="input" name="context" placeholder="งานรับเงิน · ลูกค้ากลุ่มทดลอง" /></label><div class="row ex-modal-actions">${button(api, "save-project", "เพิ่มในเดโม", { className: "btn btn-primary" })}${button(api, "close-modal", "ยกเลิก", { className: "btn btn-ghost" })}</div></form>`);
    } else if (action === "save-project") {
      const title = localInput(el, '[name="title"]')?.value?.trim();
      const context = localInput(el, '[name="context"]')?.value?.trim();
      if (!title) {
        if (typeof api.toast === "function") api.toast("กรุณาใส่ชื่อโปรเจกต์ก่อนบันทึก");
        return;
      }
      const id = `project-demo-${extra.projects.length + 1}`;
      extra.projects.push({ id, title, context: context || "บริบทตัวอย่าง", description: "โปรเจกต์ที่เพิ่มในข้อมูลทดลอง", status: "ทดลอง", due: "ยังไม่กำหนด", nextMove: "เพิ่มงานแรก", color: "lavender" });
      extra.selectedProjectId = id;
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "เพิ่มโปรเจกต์ในเดโมแล้ว");
    }
  };

  const handleProjectDetailAction = (action, el, api) => {
    if (action === "toggle-project-task") {
      const task = findTask(api, el?.dataset?.id);
      if (task) {
        task.done = !task.done;
        refresh(api, task.done ? "ทำเครื่องหมายงานในเดโมแล้ว" : "นำเครื่องหมายงานออกแล้ว");
      }
    }
  };

  const handleRoutineAction = (action, el, api) => {
    const extra = data(api);
    if (action === "toggle-routine") {
      const id = el?.dataset?.id;
      if (id) {
        extra.routineChecks[id] = !extra.routineChecks[id];
        refresh(api, extra.routineChecks[id] ? "ทำเครื่องหมายรูทีนแล้ว" : "ยกเลิกรอบนี้ในเดโมแล้ว");
      }
    } else if (action === "routine-add") {
      const routineTaskId = "task-routine-break";
      const routineTask = tasks(api).find((task) => task.id === routineTaskId);
      if (!routineTask) {
        tasks(api).push({ id: routineTaskId, title: "พัก 10 นาทีระหว่างช่วงงาน", area: "สุขภาพ", type: "life", estimatedMinutes: 10, duration: 10, dueDate: null, deadline: null, plannedDate: "2026-09-23", plannedTime: "11:45", done: false, inbox: false, priority: "ต่ำ", project: null, reason: "ช่วงพักจากรูทีนตัวอย่าง" });
      }
      extra.routineExtraBreak = true;
      refresh(api, "เพิ่มช่วงพัก 10 นาทีในแผนตัวอย่างแล้ว");
    }
  };

  const handleFinanceAction = (action, el, api) => {
    const finance = data(api).finance;
    if (action === "add-demo-bill") {
      finance.bills.push({ id: `bill-demo-${Date.now()}`, title: "บิลตัวอย่างสำหรับทดสอบ", due: "30 ก.ย. 2026", amount: 500, paid: false });
      refresh(api, "เพิ่มบิลตัวอย่างแล้ว");
      return;
    }
    const bill = finance.bills.find((item) => item.id === el?.dataset?.id);
    if (!bill) return;
    if (action === "pay-bill") {
      if (!bill.paid) {
        bill.paid = true;
        if (!finance.expenses.some((item) => item.sourceBillId === bill.id)) {
          finance.expenses.push({ id: `expense-${bill.id}`, title: bill.title, date: "2026-09-22", amount: bill.amount, sourceBillId: bill.id });
        }
        refresh(api, "จำลองจ่ายแล้ว และเพิ่มรายจ่ายครั้งเดียวในเดโม");
      }
    } else if (action === "undo-bill") {
      bill.paid = false;
      finance.expenses = finance.expenses.filter((item) => item.sourceBillId !== bill.id);
      refresh(api, "ยกเลิกการจำลองจ่ายแล้ว");
    }
  };

  const handleReviewsAction = (action, el, api) => {
    const extra = data(api);
    const task = findTask(api, el?.dataset?.id) || reviewTask(api);
    if (!task) return;
    if (action === "review-move-next-week") {
      const targetDate = "2026-09-28";
      const deadline = task?.dueDate || task?.deadline || "";
      const movesPastDeadline = /^\d{4}-\d{2}-\d{2}$/.test(String(deadline)) && String(deadline) < targetDate;
      const deadlineWarning = movesPastDeadline ? `<div class="notice warning">กำหนดส่ง ${e(api, taskDeadline(task))} มาก่อนวันที่ย้าย ระบบจะคง deadline เดิมไว้และแสดงความเสี่ยงให้ตรวจเอง</div>` : "";
      openModal(api, "ย้ายงานไปสัปดาห์หน้าไหม", `<div class="stack ex-modal-form"><p>งาน <strong>${e(api, task.title)}</strong> จะใช้ task ID เดิม และตั้งวันที่วางแผนเป็น 28 ก.ย. 2026</p><p class="muted">การย้ายนี้เป็นการเปลี่ยนข้อมูลในต้นแบบเท่านั้น</p>${deadlineWarning}<div class="row ex-modal-actions">${button(api, "review-confirm-move", "ยืนยันการย้าย", { className: "btn btn-primary", id: task.id })}${button(api, "close-modal", "กลับไปตรวจอีกครั้ง", { className: "btn btn-ghost" })}</div></div>`);
    } else if (action === "review-confirm-move") {
      if (!extra.reviewOriginalDates || typeof extra.reviewOriginalDates !== "object") extra.reviewOriginalDates = {};
      if (!Object.prototype.hasOwnProperty.call(extra.reviewOriginalDates, task.id)) extra.reviewOriginalDates[task.id] = task.plannedDate ?? null;
      if (!extra.nextWeekCommitments.includes(task.id)) extra.nextWeekCommitments.push(task.id);
      task.plannedDate = "2026-09-28";
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "ย้ายงานเดิมไปสัปดาห์หน้าแล้ว");
    } else if (action === "review-undo-move") {
      extra.nextWeekCommitments = extra.nextWeekCommitments.filter((id) => id !== task.id);
      if (extra.reviewOriginalDates && Object.prototype.hasOwnProperty.call(extra.reviewOriginalDates, task.id)) {
        task.plannedDate = extra.reviewOriginalDates[task.id];
        delete extra.reviewOriginalDates[task.id];
      }
      refresh(api, "นำงานกลับวันเดิมในเดโมแล้ว");
    }
  };

  const handleInsightsAction = (action, el, api) => {
    const extra = data(api);
    if (action === "apply-insight-plan") {
      const task = proposalTask(api);
      if (!task) {
        if (typeof api.toast === "function") api.toast("ยังไม่มี task ให้จัดเวลา · บันทึกงานแรกจากวันนี้ก่อน");
        return;
      }
      extra.insights.applied = true;
      task.plannedDate = "2026-09-23";
      if (Object.prototype.hasOwnProperty.call(task, "plannedTime") && !task.plannedTime) task.plannedTime = "09:00";
      if (!extra.plans.some((plan) => plan.taskId === task.id && plan.date === "2026-09-23")) extra.plans.push({ id: "plan-insight-1", taskId: task.id, date: "2026-09-23", duration: 90 });
      refresh(api, "เพิ่มข้อเสนอเป็นแผนทดลองแล้ว");
    } else if (action === "remove-insight-plan") {
      const plan = extra.plans.find((candidate) => candidate.id === "plan-insight-1");
      const task = plan ? findTask(api, plan.taskId) : null;
      extra.insights.applied = false;
      extra.plans = extra.plans.filter((plan) => plan.id !== "plan-insight-1");
      if (task && task.plannedDate === "2026-09-23") task.plannedDate = null;
      refresh(api, "นำข้อเสนอออกจากแผนทดลองแล้ว");
    }
  };

  const handleSettingsAction = (action, el, api) => {
    const extra = data(api);
    if (action === "save-settings") {
      const start = localInput(el, '[name="workingStart"]')?.value;
      const end = localInput(el, '[name="workingEnd"]')?.value;
      const breakMinutes = Number(localInput(el, '[name="breakMinutes"]')?.value);
      if (start) extra.settings.workingStart = start;
      if (end) extra.settings.workingEnd = end;
      if (Number.isFinite(breakMinutes) && breakMinutes >= 0) extra.settings.breakMinutes = breakMinutes;
      refresh(api, "บันทึกเวลาทำงานในเดโมแล้ว");
    } else if (action === "demo-connect-calendar") {
      extra.settings.calendar = extra.settings.calendar === "ยังไม่เชื่อมต่อ" ? "เชื่อมต่อจำลอง" : "ยังไม่เชื่อมต่อ";
      refresh(api, extra.settings.calendar === "เชื่อมต่อจำลอง" ? "เปลี่ยนสถานะ calendar เป็นเดโมแล้ว" : "รีเซ็ตสถานะ calendar เดโมแล้ว");
    } else if (action === "demo-connect-line") {
      extra.settings.line = extra.settings.line === "ยังไม่เชื่อมต่อ" ? "เชื่อมต่อจำลอง" : "ยังไม่เชื่อมต่อ";
      refresh(api, extra.settings.line === "เชื่อมต่อจำลอง" ? "เปลี่ยนสถานะ LINE เป็นเดโมแล้ว" : "รีเซ็ตสถานะ LINE เดโมแล้ว");
    }
  };

  const handleSalesAction = (action, el, api) => {
    const extra = data(api);
    if (action === "sales-enable") {
      extra.sales.enabled = true;
      refresh(api, "เปิดบริบทผู้ขายตัวอย่างแล้ว");
    } else if (action === "sales-hide") {
      extra.sales.enabled = false;
      refresh(api, "ซ่อนบริบทผู้ขายแล้ว");
    }
  };

  const handleEntriesAction = (action, el, api) => {
    const extra = data(api);
    if (action === "new-entry") {
      openModal(api, "เพิ่มบันทึกตัวอย่าง", `<form class="stack ex-modal-form" data-form="new-entry"><label class="field"><span>วันที่</span><input class="input" name="date" type="date" value="2026-09-22" /></label><label class="field"><span>ค่า 1–5</span><input class="input" name="value" type="number" min="1" max="5" value="3" /></label><label class="field"><span>บันทึกสั้น ๆ</span><input class="input" name="note" placeholder="วันนี้ได้เรียนรู้อะไร" /></label><div class="row ex-modal-actions">${button(api, "save-entry", "บันทึกในเดโม", { className: "btn btn-primary" })}${button(api, "close-modal", "ยกเลิก", { className: "btn btn-ghost" })}</div></form>`);
    } else if (action === "delete-entry") {
      extra.entries = extra.entries.filter((item) => item.id !== el?.dataset?.id);
      refresh(api, "ลบบันทึกตัวอย่างแล้ว");
    } else if (action === "save-entry") {
      const date = localInput(el, '[name="date"]')?.value;
      const value = Number(localInput(el, '[name="value"]')?.value);
      const note = localInput(el, '[name="note"]')?.value?.trim();
      if (!date || !Number.isFinite(value) || !note) {
        if (typeof api.toast === "function") api.toast("กรุณากรอกวันที่ ค่า และบันทึกสั้น ๆ");
        return;
      }
      extra.entries.push({ id: uniqueId("entry"), date, value: Math.max(1, Math.min(5, value)), note });
      if (typeof api.closeModal === "function") api.closeModal();
      refresh(api, "เพิ่มบันทึกตัวอย่างแล้ว");
    }
  };

  const handleOnboardingAction = (action, el, api) => {
    const extra = data(api);
    if (action === "onboarding-select") {
      const field = el?.dataset?.id;
      if (field && Object.prototype.hasOwnProperty.call(extra.onboarding, field)) {
        extra.onboarding[field] = el.dataset.value || "";
        refresh(api);
      }
    } else if (action === "onboarding-suggest") {
      const input = localInput(el, '[name="starterTitle"]');
      if (input) {
        input.value = "ตอบข้อความลูกค้าที่ค้างไว้";
        input.focus();
      }
    } else if (action === "onboarding-start") {
      const input = localInput(el, '[name="starterTitle"]');
      const title = input?.value?.trim() || "จัดลำดับงานสำคัญวันนี้";
      if (typeof api.startFresh === "function") api.startFresh();
      const state = api.state || {};
      state.firstUse = true;
      if (!Array.isArray(state.tasks)) state.tasks = [];
      if (!state.tasks.some((task) => task.id === "task-onboarding-starter")) {
        state.tasks.push({ id: "task-onboarding-starter", title, area: "งาน", type: "work", estimatedMinutes: 30, duration: 30, dueDate: null, deadline: null, plannedDate: DEMO_ISO_DATE, plannedTime: null, done: false, inbox: false, priority: "กลาง", project: null, reason: "งานแรกจากการเริ่มต้นใช้งาน" });
      }
      if (typeof api.render === "function") api.render();
    } else if (action === "save-onboarding") {
      refresh(api, "บันทึกตัวเลือกเริ่มต้นในเดโมแล้ว");
    } else if (action === "onboarding-skip") {
      if (typeof api.startFresh === "function") api.startFresh();
      api.navigate("today");
    }
  };

  const handleLoginAction = (action, el, api) => {
    const extra = data(api);
    if (action === "close-modal" || action === "google-cancel") {
      if (handleLoginAction.googleSimulationTimer) {
        window.clearTimeout(handleLoginAction.googleSimulationTimer);
        handleLoginAction.googleSimulationTimer = null;
      }
      extra.googleSignInPending = false;
      if (action === "google-cancel" && typeof api.closeModal === "function") api.closeModal();
      return;
    }
    if (action === "google-signin") {
      if (extra.googleSignInPending) return;
      openModal(api, "เข้าสู่ระบบด้วย Google · เดโม", `<div class="stack ex-google-simulation"><p class="eyebrow">จำลองใน prototype</p><h3>Google sign-in ยังไม่เชื่อมต่อ</h3><p class="muted">เลือก “จำลองสำเร็จ” เพื่อกลับไปที่วันนี้ ข้อมูลงานเดิมยังอยู่เหมือนเดิม</p><div class="ex-google-simulation-note"><strong>ตัวอย่างนี้ยังไม่เชื่อมบัญชีจริง</strong><span>เป็นเพียงหน้าทดลองของ Kemtit และจะไม่เปิดหน้าต่าง Google</span></div><div class="row ex-modal-actions">${button(api, "google-simulate-success", "จำลองสำเร็จ", { className: "btn btn-primary ex-google-simulate" })}${button(api, "google-cancel", "ยกเลิก", { className: "btn btn-ghost" })}</div></div>`);
      return;
    }
    if (action === "google-simulate-success") {
      if (extra.googleSignInPending) return;
      extra.googleSignInPending = true;
      if (el) {
        el.disabled = true;
        el.setAttribute("aria-busy", "true");
        el.textContent = "กำลังจำลอง…";
      }
      handleLoginAction.googleSimulationTimer = window.setTimeout(() => {
        handleLoginAction.googleSimulationTimer = null;
        extra.googleSignInPending = false;
        extra.demoLoggedIn = true;
        if (typeof api.closeModal === "function") api.closeModal();
        if (typeof api.toast === "function") api.toast("จำลองการเข้าสู่ระบบด้วย Google แล้ว · ข้อมูลเดิมยังอยู่", "success");
        if (typeof api.navigate === "function") api.navigate("today");
      }, 260);
      return;
    }
    if (action === "demo-login") {
      extra.demoLoggedIn = true;
      if (typeof api.toast === "function") api.toast("เข้าสู่โหมดเดโมแล้ว ไม่มีการตรวจบัญชีจริง");
      api.navigate("today");
    }
  };

  const sharedAction = (action, el, api) => {
    if (action === "close-modal" && typeof api.closeModal === "function") api.closeModal();
  };

  const routes = {
    goals: route("เป้าหมาย", pageGoals, (action, el, api) => { sharedAction(action, el, api); handleGoalAction(action, el, api); }, "ทิศทาง"),
    "goal-detail": route("รายละเอียดเป้าหมาย", pageGoalDetail, (action, el, api) => { sharedAction(action, el, api); handleGoalDetailAction(action, el, api); }),
    projects: route("โปรเจกต์", pageProjects, (action, el, api) => { sharedAction(action, el, api); handleProjectAction(action, el, api); }, "บริบท"),
    "project-detail": route("รายละเอียดโปรเจกต์", pageProjectDetail, (action, el, api) => { sharedAction(action, el, api); handleProjectDetailAction(action, el, api); }),
    routine: route("รูทีน", pageRoutine, (action, el, api) => { sharedAction(action, el, api); handleRoutineAction(action, el, api); }, "จังหวะ"),
    finance: route("การเงิน", pageFinance, (action, el, api) => { sharedAction(action, el, api); handleFinanceAction(action, el, api); }, "ตัวเลขตัวอย่าง"),
    reviews: route("ทบทวนสัปดาห์", pageReviews, (action, el, api) => { sharedAction(action, el, api); handleReviewsAction(action, el, api); }, "ทบทวน"),
    insights: route("อินไซต์", pageInsights, (action, el, api) => { sharedAction(action, el, api); handleInsightsAction(action, el, api); }, "อินไซต์"),
    settings: route("ตั้งค่า", pageSettings, (action, el, api) => { sharedAction(action, el, api); handleSettingsAction(action, el, api); }, "การควบคุม"),
    sales: route("ตัวเลขผู้ขาย", pageSales, (action, el, api) => { sharedAction(action, el, api); handleSalesAction(action, el, api); }, "ตัวเลือก"),
    entries: route("บันทึกผล", pageEntries, (action, el, api) => { sharedAction(action, el, api); handleEntriesAction(action, el, api); }, "หลักฐาน"),
    more: route("ดูทุกหน้า", pageMore, sharedAction, "สารบัญ"),
    onboarding: route("เริ่มต้นใช้งาน", pageOnboarding, (action, el, api) => { sharedAction(action, el, api); handleOnboardingAction(action, el, api); }, "เริ่มต้น"),
    login: route("เข้าสู่ระบบ", pageLogin, (action, el, api) => { sharedAction(action, el, api); handleLoginAction(action, el, api); }, "เดโม"),
  };

  window.KemtitExtraPages = routes;
})();
