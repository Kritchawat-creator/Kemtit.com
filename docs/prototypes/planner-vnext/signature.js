/* Small, data-bound day rail. The host app owns routing and mutations. */
(function () {
  "use strict";

  function fallbackEscape(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function formatEstimate(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes <= 0) return "ยังไม่ประเมิน";
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      return `ประมาณ ${hours} ชม.${remainder ? ` ${remainder} นาที` : ""}`;
    }
    return `ประมาณ ${minutes} นาที`;
  }

  function formatEventDuration(item) {
    if (!item.start || !item.end) return "ช่วงที่ล็อกไว้";
    const parse = (value) => value.split(":").map(Number);
    const start = parse(item.start);
    const end = parse(item.end);
    const minutes = Math.max(0, (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]));
    return minutes ? `${minutes} นาที` : "ช่วงที่ล็อกไว้";
  }

  function dayRail(api) {
    const state = (api && api.state) || {};
    const esc = (api && typeof api.escape === "function" ? api.escape : fallbackEscape);
    const tasks = Array.isArray(state.tasks) ? state.tasks : [];
    const events = Array.isArray(state.events) ? state.events : [];
    const date = state.todayDate || state.selectedDate || state.demoDate ||
      (events.find((item) => item && item.date) || {}).date ||
      (tasks.find((item) => item && item.plannedDate && !item.inbox) || {}).plannedDate || "";
    const dayTasks = tasks.filter((task) => task && task.plannedDate === date && !task.inbox);
    const dayEvents = events.filter((event) => event && event.date === date && event.start);
    const entries = dayEvents.map((event) => ({ ...event, entryType: "event", time: event.start }))
      .concat(dayTasks.filter((task) => task.plannedTime).map((task) => ({ ...task, entryType: "task", time: task.plannedTime })))
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const firstTask = dayTasks.find((task) => !task.done && task.id) || null;
    const unplaced = dayTasks.filter((task) => !task.plannedTime && task.id);
    const fresh = Boolean(state.firstUse);
    const eventKind = (event) => event.kind === "break" ? "พัก" : event.kind === "meeting" ? "นัด" : "ล็อกไว้";
    const taskAction = firstTask ? `<button class="ks-rail-action" type="button" data-action="focus-task" data-task-id="${esc(firstTask.id)}">เริ่มงานแรก</button>` : "";
    const entryHtml = entries.map((item) => {
      const isTask = item.entryType === "task";
      const title = esc(item.title || "รายการไม่มีชื่อ");
      const kind = isTask ? "ลงมือ" : eventKind(item);
      const meta = isTask ? formatEstimate(item.estimatedMinutes) : `${kind} · ${formatEventDuration(item)}`;
      const copy = isTask && firstTask && item.id === firstTask.id
        ? `<button class="ks-rail-task" type="button" data-action="focus-task" data-task-id="${esc(item.id)}" aria-label="เริ่มงาน: ${title}"><strong>${title}</strong></button>`
        : `<strong>${title}</strong>`;
      return `<li class="ks-rail-item ks-rail-item--${isTask ? "task" : "event"}"><time class="ks-rail-time" datetime="${esc(item.time)}">${esc(item.time)}</time><span class="ks-rail-node" aria-hidden="true"></span><div class="ks-rail-copy"><span class="ks-rail-kind">${kind}</span>${copy}<span class="ks-rail-meta">${esc(meta)}</span></div></li>`;
    }).join("");
    const unplacedHtml = unplaced.length ? `<div class="ks-rail-unplaced"><p><strong>งานที่ยังไม่ลงเวลา</strong> · เลือกจังหวะเมื่อพร้อม</p><p>${unplaced.map((task) => esc(task.title || "รายการไม่มีชื่อ")).join(" · ")}</p></div>` : "";
    const prompt = fresh && !entries.length ? `<div class="ks-rail-prompt"><p>เริ่มจากเรื่องที่อยู่ในหัว แล้วค่อยกำหนดเวลาเมื่อพร้อม</p><button type="button" data-action="open-capture">เขียนสิ่งแรก</button></div>` : "";
    const intro = entries.length ? "งานที่จะลงมือ กับช่วงที่ล็อกไว้จริง" : "ยังไม่มีช่วงเวลาที่ล็อกไว้";
    return `<section class="ks-day-rail" aria-labelledby="ks-day-rail-title"><div class="ks-rail-head"><div><span class="ks-rail-kicker">${fresh ? "เริ่มจากข้อมูลจริง" : "แผนของวันนี้"}</span><h2 id="ks-day-rail-title">${fresh ? "จังหวะวันนี้" : "รอยต่อของวัน"}</h2><p class="ks-rail-intro">${intro}</p></div>${taskAction}</div>${entries.length ? `<ol class="ks-rail-list">${entryHtml}</ol>` : ""}${unplacedHtml}${prompt}</section>`;
  }

  window.KemtitSignature = { dayRail };
})();
