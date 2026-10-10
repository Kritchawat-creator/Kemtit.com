/* Standalone design prototype. No network calls or production data access. */
"use strict";
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const TODAY = "2026-10-09",
  KEY = "kemtit-life-planner-review-v1";
const pages = {
  today: ["เริ่มจากสิ่งสำคัญ", "แผนวันนี้"],
  overview: ["เลือกทิศทางที่เหมาะกับคุณ", "ภาพรวมชีวิต"],
  calendar: ["ให้เวลากับสิ่งที่คุณเลือก", "ปฏิทิน"],
  goals: ["เริ่มด้วยก้าวที่ทำได้", "ตั้งเป้าหมาย"],
  review: ["เรียนรู้แล้วค่อยปรับ", "ทบทวนสัปดาห์"],
};
const seed = () => ({
  tasks: [
    {
      id: "t1",
      title: "เตรียมผลงานสำหรับร้าน",
      duration: 60,
      goal: "g1",
      date: TODAY,
      time: 600,
      done: false,
      photos: [],
      steps: [
        { title: "เลือกผลงาน 3 ชิ้น", done: true },
        { title: "ตรวจรายละเอียดสินค้า", done: false },
      ],
    },
    {
      id: "t2",
      title: "เดินเล่นหลังเลิกงาน",
      duration: 30,
      goal: "g2",
      date: null,
      time: null,
      done: false,
      photos: [],
      steps: [],
    },
    {
      id: "t3",
      title: "อ่านหนังสือบทที่ตั้งใจไว้",
      duration: 45,
      goal: "g3",
      date: null,
      time: null,
      done: false,
      photos: [],
      steps: [],
    },
    {
      id: "t4",
      title: "จัดมุมทำงานให้พร้อมสำหรับสัปดาห์ใหม่",
      duration: 30,
      goal: "g1",
      date: null,
      time: null,
      done: false,
      photos: [],
      steps: [],
    },
  ],
  groups: [],
  goals: [
    { id: "g1", title: "งานที่มีความหมาย", area: "งาน", next: "ทำผลงานที่พร้อมส่งให้ลูกค้า" },
    { id: "g2", title: "มีเวลาดูแลตัวเอง", area: "สุขภาพ", next: "หาเวลาเดินเล่นที่สะดวก" },
    {
      id: "g3",
      title: "เรียนรู้อย่างต่อเนื่อง",
      area: "พัฒนาตัวเอง",
      next: "อ่านทีละบทโดยไม่เร่งตัวเอง",
    },
  ],
  focus: { [TODAY]: ["t1"] },
  review: ["", "", ""],
});
let data;
try {
  data = JSON.parse(localStorage.getItem(KEY)) || seed();
} catch {
  data = seed();
}
data.focus ||= {};
let selectedGoal = null;
let page = pages[location.hash.slice(1)] ? location.hash.slice(1) : "today",
  date = TODAY,
  calendarMode = "grid",
  previous = null,
  dialogType = "",
  activeId = "",
  step = 0,
  goalDraft = {},
  dragId = null,
  hovered = null,
  entered = 0,
  toastTimer;
const time = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dayText = (d) =>
  new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", weekday: "short" }).format(
    new Date(d + "T12:00:00"),
  );
const week = () => {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(x.getDate() + i);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  });
};
const task = (id) => data.tasks.find((t) => t.id === id);
const groupOf = (id) => data.groups.find((g) => g.members.includes(id));
function notify(text, undo = false) {
  clearTimeout(toastTimer);
  $("#message").innerHTML =
    `<span>${esc(text)}</span>${undo ? '<button id="undo">ย้อนกลับ</button>' : ""}`;
  $("#message").classList.add("show");
  if (undo) $("#undo").onclick = undoChange;
  toastTimer = setTimeout(() => $("#message").classList.remove("show"), 9000);
}
function commit(change, label) {
  if ($("#fail").checked) {
    $("#fail").checked = false;
    notify("จำลอง: บันทึกไม่สำเร็จ ข้อมูลยังอยู่ตำแหน่งเดิม");
    return false;
  }
  const before = structuredClone(data);
  change();
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    data = before;
    notify("พื้นที่เบราว์เซอร์ไม่พอ กรุณาลดจำนวนหรือขนาดรูป");
    return false;
  }
  previous = before;
  renderLifePlannerMockup();
  notify(label + " · บันทึกในต้นแบบแล้ว", true);
  return true;
}
function undoChange() {
  if (!previous) return;
  const before = structuredClone(data);
  data = previous;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    data = before;
    notify("ย้อนกลับไม่ได้เพราะพื้นที่เบราว์เซอร์");
    return;
  }
  previous = null;
  renderLifePlannerMockup();
  notify("ย้อนกลับแล้ว");
}
function card(t) {
  const g = groupOf(t.id);
  return `<article class="card ${t.done ? "done" : ""}" data-card="${t.id}" data-drop-card="${t.id}">${t.photos.length ? `<img class="cover" src="${esc(t.photos[0])}" alt="ภาพปกของ ${esc(t.title)}">` : ""}<div class="card-body"><div class="card-top"><button class="handle" draggable="false" data-drag="${t.id}" aria-label="ลาก ${esc(t.title)}">⠿</button><button class="title-button" data-action="detail" data-id="${t.id}">${esc(t.title)}</button></div><div class="meta">${t.date ? esc(dayText(t.date)) + " · " + (t.time == null ? "ยังไม่จัดเวลา" : time(t.time) + "–" + time(t.time + t.duration)) : "ยังไม่จัดเวลา"} · ${t.duration} นาที ${g ? `<span class="badge">${esc(g.name)}</span>` : ""}</div><div class="card-actions"><button data-action="focus" data-id="${t.id}" aria-pressed="${(data.focus[date] || []).includes(t.id)}">${(data.focus[date] || []).includes(t.id) ? "สำคัญวันนี้ ✓" : "เลือกเป็นสิ่งสำคัญ"}</button><button data-action="schedule" data-id="${t.id}">จัดเวลา</button><button data-action="group" data-id="${t.id}">จัดกลุ่ม</button><button data-action="done" data-id="${t.id}">${t.done ? "คืนเป็นยังไม่เสร็จ" : "ทำเสร็จ"}</button></div></div></article>`;
}
function tray() {
  const visibleTasks = data.tasks.filter((t) => !selectedGoal || t.goal === selectedGoal);
  let grouped = new Set(selectedGoal ? [] : data.groups.flatMap((g) => g.members));
  return `<section class="panel"><div class="panel-head"><h2>การ์ดงาน</h2><span class="badge">${visibleTasks.length} รายการ</span></div>${selectedGoal ? `<p class="notice">งานของ ${esc(data.goals.find((g) => g.id === selectedGoal)?.title)} <button data-action="clearFilter">ดูงานทั้งหมด</button></p>` : ""}<p class="muted">ลากจุดจับไปช่องเวลา หรือค้างทับการ์ดเพื่อรวมกลุ่ม</p><div class="cards">${(selectedGoal
    ? []
    : data.groups
  )
    .map(
      (g) =>
        `<section class="folder" data-drop-group="${g.id}"><div class="panel-head"><h3>${esc(g.name)} <small>${g.members.length} งาน</small></h3><button class="link" data-action="folder" data-id="${g.id}">เปิดกลุ่ม</button></div><div class="folder-preview">${g.members
          .slice(0, 4)
          .map((id) => `<span class="mini">${esc(task(id)?.title)}</span>`)
          .join("")}</div></section>`,
    )
    .join("")}${
    visibleTasks
      .filter((t) => !grouped.has(t.id))
      .map(card)
      .join("") ||
    (!data.groups.length
      ? '<div class="empty">เริ่มจากงานหนึ่งอย่างที่อยากทำ<br><button data-action="new">เพิ่มงานแรก</button></div>'
      : "")
  }</div></section>`;
}
function calendar(single = false) {
  const days = single || innerWidth <= 850 ? [date] : week();
  const bar = week()
    .map(
      (d) =>
        `<button class="${d === date ? "selected" : ""}" data-action="day" data-id="${d}"><span>${dayText(d).split(" ")[0]}</span>${Number(d.slice(-2))}${d === TODAY ? "<span>วันนี้</span>" : ""}</button>`,
    )
    .join("");
  const blocks = data.tasks
    .filter((t) => t.date === date && t.time != null)
    .sort((a, b) => a.time - b.time);
  let grid = `<div class="grid" style="--days:${days.length}"><div class="grid-head">เวลา</div>${days.map((d) => `<div class="grid-head">${esc(dayText(d))}</div>`).join("")}`;
  for (let h = 8; h < 20; h++) {
    grid += `<div class="hour">${time(h * 60)}</div>`;
    for (const d of days) {
      grid += `<div class="slot" data-drop-date="${d}" data-drop-time="${h * 60}">${data.tasks
        .filter((t) => t.date === d && Math.floor(t.time / 60) === h && t.time != null)
        .map(
          (t) =>
            `<button class="block" style="--top:${(t.time % 60) * 1.2}px;--height:${t.duration * 1.2}px" data-action="detail" data-id="${t.id}" draggable="false" data-drag="${t.id}" aria-label="${esc(t.title)} ${time(t.time)} ถึง ${time(t.time + t.duration)}">${esc(t.title)}<br><small>${time(t.time)}–${time(t.time + t.duration)}${t.done ? " · เสร็จแล้ว" : ""}</small></button>`,
        )
        .join(
          "",
        )}${d === TODAY && h === 14 ? '<div class="now-line" style="--now:21.6px"><span>ตอนนี้ 14:18 · จำลอง</span></div>' : ""}</div>`;
    }
  }
  grid += "</div>";
  return `<section class="panel calendar-panel"><div class="panel-head"><h2>${single ? "ตารางวันนี้" : esc(dayText(date))}</h2><span class="badge">เวลาที่จัดไว้</span></div><div class="weekbar">${bar}</div><div class="view-tabs"><button data-action="mode" data-id="grid" aria-pressed="${calendarMode === "grid"}">ตารางเวลา</button><button data-action="mode" data-id="agenda" aria-pressed="${calendarMode === "agenda"}">รายการเรียงเวลา</button></div>${calendarMode === "grid" ? `<div class="timeline">${grid}</div>` : `<div class="agenda">${blocks.map((t) => `<div class="agenda-item"><small>${time(t.time)}<br>${t.duration} นาที</small><div><button class="title-button" data-action="detail" data-id="${t.id}">${esc(t.title)}</button><p class="meta">${time(t.time)}–${time(t.time + t.duration)}</p></div><button data-action="schedule" data-id="${t.id}">ย้าย</button></div>`).join("") || '<p class="empty">วันนี้ยังไม่มีช่วงเวลาที่จัดไว้</p>'}</div>`}</section>`;
}
function overview() {
  return `<p class="muted">เลือกเรื่องที่อยากให้คืบหน้า แล้วลงมือด้วยงานที่ทำได้จริง</p><div class="goal-grid">${data.goals
    .map((g, i) => {
      const ts = data.tasks.filter((t) => t.goal === g.id),
        done = ts.filter((t) => t.done).length;
      return `<article class="goal-card"><div class="goal-symbol">${["↗", "◯", "✦"][i % 3]}</div><span class="badge">${esc(g.area)}</span><h2>${esc(g.title)}</h2><p>${esc(g.next)}</p><small>${ts.length ? `งานที่เชื่อมเสร็จ ${done} จาก ${ts.length}` : "ยังไม่มีงานที่เชื่อม"}</small><div class="progress"><div style="width:${ts.length ? (done / ts.length) * 100 : 0}%"></div></div><button data-action="goalTasks" data-id="${g.id}">ดูงานที่เชื่อม</button></article>`;
    })
    .join(
      "",
    )}</div><p class="notice">ความคืบหน้าจากงานที่เชื่อมในตัวอย่างนี้ ไม่ใช่คะแนนชีวิตหรือผลลัพธ์สุขภาพ</p><button class="primary" data-action="wizard">เพิ่มเป้าหมายด้วยตัวช่วย</button>`;
}
function focusPanel() {
  const chosen = (data.focus[date] || []).map(task).filter(Boolean);
  return `<section class="focus-panel" aria-label="สิ่งสำคัญวันนี้"><h2>สิ่งสำคัญวันนี้ <small>เลือกได้ไม่เกิน 3 งาน</small></h2><div class="focus-list">${chosen.map((t) => `<button data-action="detail" data-id="${t.id}">${t.done ? "✓ " : ""}${esc(t.title)}</button>`).join("") || '<p class="muted">เลือกงานหนึ่งอย่างจากการ์ดด้านล่างเพื่อเริ่มต้น</p>'}</div></section>`;
}
function renderLifePlannerMockup() {
  const names = {
    today: "วันนี้",
    overview: "ภาพรวมชีวิต",
    calendar: "ปฏิทิน",
    goals: "ตั้งเป้าหมาย",
    review: "ทบทวน",
  };
  $("nav").innerHTML = Object.keys(pages)
    .map(
      (k) =>
        `<a class="${k === page ? "active" : ""}" href="#${k}" ${k === page ? 'aria-current="page"' : ""}>${names[k]}</a>`,
    )
    .join("");
  $("#eyebrow").textContent = pages[page][0];
  $("#heading").textContent =
    page === "today" && date !== TODAY ? "แผน " + dayText(date) : pages[page][1];
  const total = data.tasks.filter((t) => t.date === date),
    done = total.filter((t) => t.done).length,
    minutes = total.filter((t) => t.time != null).reduce((n, t) => n + t.duration, 0);
  if (page === "today" || page === "calendar")
    $("#screen").innerHTML =
      `<div class="summary"><div><strong>${done}/${total.length}</strong> งานที่มีวันในแผนนี้เสร็จ</div><div><strong>${minutes}</strong> นาทีที่จัดไว้</div></div>${page === "today" ? focusPanel() : ""}<div class="layout">${tray()}${calendar(page === "today")}</div>`;
  else if (page === "overview") $("#screen").innerHTML = overview();
  else if (page === "goals")
    $("#screen").innerHTML =
      `<section class="panel review"><h2>เรื่องหนึ่งที่คุณอยากให้ดีขึ้น</h2><p>เริ่มจากความตั้งใจ แล้วเลือกก้าวแรกที่ทำได้ ตัวช่วย 3 ขั้นนี้เลือกใช้ได้</p><button class="primary" data-action="wizard">เริ่มตั้งเป้าหมาย</button><p class="muted">1 เลือกทิศทาง → 2 เลือกก้าวแรก → 3 ตรวจแผนก่อนสร้าง</p></section>`;
  else
    $("#screen").innerHTML =
      `<section class="panel review"><h2>กลับมาดูสัปดาห์ของคุณ</h2><p>งานที่เสร็จ ${data.tasks.filter((t) => t.done).length} จากงานทั้งหมด ${data.tasks.length} ในข้อมูลตัวอย่าง · เวลาในตารางคือเวลาที่วางไว้</p>${["อะไรคืบหน้าในสัปดาห์นี้", "อะไรทำให้แผนติดขัด", "สัปดาห์หน้าจะปรับอะไร"].map((q, i) => `<label>${q}<textarea data-review="${i}">${esc(data.review[i])}</textarea></label>`).join("")}<button class="primary" data-action="reviewSave">บันทึกการทบทวน</button></section>`;
}
function openDialog(type, id = "") {
  dialogType = type;
  activeId = id;
  $("#formError").textContent = "";
  $("#previous").hidden = true;
  $("#submit").hidden = false;
  const t = task(id);
  let html = "";
  if (type === "new") {
    html =
      '<label class="field">ชื่องาน<input name="title" required maxlength="180" placeholder="สิ่งเล็ก ๆ ที่คุณอยากทำ"></label><label class="field">เวลาที่คาดว่าจะใช้ (นาที)<input name="duration" type="number" min="15" max="240" step="15" value="30" required></label><label class="field">รูปภาพแรกจะเป็นปก<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><small>เฉพาะตัวอย่าง: รวมไม่เกิน 3 MB · รูปอยู่ในเบราว์เซอร์นี้</small>';
  }
  if (type === "schedule") {
    html = `<h3>${esc(t.title)}</h3><label class="field">วัน<input name="date" type="date" value="${t.date || date}" required></label><label class="field">เวลาเริ่ม<input name="time" type="time" value="${time(t.time ?? 600)}" step="900" required></label><label class="field">ระยะเวลาที่จอง (นาที)<input name="duration" type="number" value="${t.duration}" min="15" max="240" step="15" required></label><p class="muted">เปลี่ยนช่วงเวลาของการ์ดเดิม ไม่สร้างงานซ้ำ</p>`;
  }
  if (type === "group") {
    html = `<p>${esc(t.title)}</p><label class="field">เลือกการ์ดหรือกลุ่ม<select name="target">${data.tasks
      .filter((x) => x.id !== id)
      .map((x) => `<option value="task:${x.id}">${esc(x.title)}</option>`)
      .join(
        "",
      )}${data.groups.map((g) => `<option value="group:${g.id}">กลุ่ม: ${esc(g.name)}</option>`).join("")}</select></label>${groupOf(id) ? '<button type="button" data-action="ungroup" data-id="' + id + '">นำออกจากกลุ่ม</button>' : ""}`;
    if (data.tasks.length < 2 && !data.groups.length) {
      html += "<p>เพิ่มอีกหนึ่งการ์ดเพื่อสร้างกลุ่ม</p>";
      $("#submit").hidden = true;
    }
  }
  if (type === "detail") {
    html = `${t.photos.length ? `<img class="detail-cover" src="${esc(t.photos[0])}" alt="ภาพปก">` : ""}<h3>${esc(t.title)}</h3><p>${t.date ? esc(dayText(t.date)) + " · " + (t.time == null ? "ยังไม่จัดเวลา" : time(t.time) + "–" + time(t.time + t.duration)) : "ยังไม่จัดเวลา"}</p><button type="button" data-action="schedule" data-id="${id}">เปลี่ยนวันเวลา</button>${t.time != null ? `<button type="button" data-action="unschedule" data-id="${id}">ยกเลิกช่วงเวลา</button>` : ""}<details open><summary>งานย่อย ${t.steps.filter((x) => x.done).length} จาก ${t.steps.length}</summary><div class="checklist">${t.steps.map((s, i) => `<label><input type="checkbox" data-step="${i}" ${s.done ? "checked" : ""}>${esc(s.title)}</label>`).join("") || '<p class="muted">ไม่มีงานย่อยในตัวอย่างนี้</p>'}</div></details><label class="field">เพิ่มรูป<input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>${t.photos.length ? '<button type="button" data-action="removeCover" data-id="' + id + '">นำภาพปกแรกออก</button>' : ""}`;
  }
  if (type === "folder") {
    const g = data.groups.find((x) => x.id === id);
    html = `<label class="field">ชื่อกลุ่ม<input name="name" value="${esc(g.name)}" required maxlength="80"></label><div class="cards">${g.members.map((x) => card(task(x))).join("")}</div><button type="button" data-action="dissolve" data-id="${id}">ยุบกลุ่มและคืนการ์ด</button>`;
  }
  $("#dialogTitle").textContent = {
    new: "เพิ่มการ์ดงาน",
    schedule: "จัดวันและเวลา",
    group: "จัดกลุ่มการ์ด",
    detail: "รายละเอียดงาน",
    folder: "กลุ่มงาน",
  }[type];
  $("#fields").innerHTML = html;
  $("#submit").textContent = "บันทึก";
  if (!$("#editor").open) $("#editor").showModal();
}
function schedule(id, d, start, duration) {
  if (start < 480 || start + duration > 1200) {
    notify("ต้นแบบแสดงช่วง 08:00–20:00 กรุณาเลือกเวลาในช่วงนี้");
    return false;
  }
  if (
    data.tasks.some(
      (t) =>
        t.id !== id &&
        t.date === d &&
        t.time != null &&
        start < t.time + t.duration &&
        start + duration > t.time,
    )
  ) {
    notify("ช่วงเวลานี้ทับซ้อน กรุณาเลือกช่องว่างอื่น");
    return false;
  }
  return commit(
    () => Object.assign(task(id), { date: d, time: start, duration }),
    "จัดเวลา " + time(start) + "–" + time(start + duration),
  );
}
function removeMember(id) {
  data.groups.forEach((g) => (g.members = g.members.filter((x) => x !== id)));
  data.groups = data.groups.filter((g) => g.members.length);
}
function combine(id, targetId, kind = "task") {
  if (id === targetId && kind === "task") return false;
  const destination =
    kind === "group" ? data.groups.find((g) => g.id === targetId) : groupOf(targetId);
  if (destination?.members.includes(id)) {
    notify("การ์ดอยู่ในกลุ่มนี้แล้ว");
    return false;
  }
  return commit(() => {
    removeMember(id);
    if (destination) destination.members.push(id);
    else data.groups.push({ id: crypto.randomUUID(), name: "กลุ่มใหม่", members: [targetId, id] });
  }, "จัดกลุ่มการ์ด");
}
function wizard() {
  dialogType = "wizard";
  $("#dialogTitle").textContent = `ตั้งเป้าหมาย · ขั้น ${step + 1} จาก 3`;
  $("#formError").textContent = "";
  $("#previous").hidden = step === 0;
  $("#submit").hidden = false;
  $("#submit").textContent = step === 2 ? "ยืนยันสร้างแผน" : "ถัดไป";
  $("#fields").innerHTML =
    step === 0
      ? `<label class="field">อยากเห็นอะไรดีขึ้น<input name="goal" required maxlength="180" value="${esc(goalDraft.goal)}" placeholder="เช่น มีเวลาสำหรับการเรียนรู้"></label>`
      : step === 1
        ? `<label class="field">ก้าวแรกที่จะทำ<input name="next" required maxlength="180" value="${esc(goalDraft.next)}" placeholder="เช่น อ่านหนึ่งบท"></label>`
        : `<p class="notice">จะสร้างเป้าหมาย 1 รายการ และงานแรก 1 การ์ด<br>ยังไม่ได้จองเวลา</p><h3>${esc(goalDraft.goal)}</h3><p>${esc(goalDraft.next)}</p>`;
  if (!$("#editor").open) $("#editor").showModal();
}
async function readPhotos(files) {
  const list = Array.from(files);
  if (list.length > 5 || list.reduce((n, f) => n + f.size, 0) > 3 * 1024 * 1024)
    throw Error("เลือกไม่เกิน 5 รูป รวมไม่เกิน 3 MB");
  if (list.some((f) => !["image/jpeg", "image/png", "image/webp"].includes(f.type)))
    throw Error("ต้นแบบรองรับ JPEG, PNG และ WebP");
  return Promise.all(
    list.map(
      (f) =>
        new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = () => rej(Error("อ่านรูปไม่สำเร็จ"));
          r.readAsDataURL(f);
        }),
    ),
  );
}
let submitting = false;
$("#form").onsubmit = async (e) => {
  e.preventDefault();
  if (submitting) return;
  submitting = true;
  $("#submit").disabled = true;
  const submittedType = dialogType;
  const submittedId = activeId;
  const f = new FormData(e.target);
  $("#formError").textContent = "";
  try {
    let success = false;
    if (dialogType === "new") {
      if (!String(f.get("title")).trim()) throw Error("กรุณาระบุชื่องาน");
      const photos = await readPhotos($("#fields input[type=file]").files);
      if (!$("#editor").open || dialogType !== submittedType || activeId !== submittedId) return;
      success = commit(
        () =>
          data.tasks.push({
            id: crypto.randomUUID(),
            title: f.get("title").trim(),
            duration: Number(f.get("duration")),
            date: null,
            time: null,
            done: false,
            photos,
            steps: [],
            goal: null,
          }),
        "เพิ่มการ์ด",
      );
    } else if (dialogType === "schedule") {
      const [h, m] = f.get("time").split(":").map(Number);
      success = schedule(activeId, f.get("date"), h * 60 + m, Number(f.get("duration")));
    } else if (dialogType === "group") {
      const [kind, id] = String(f.get("target")).split(":");
      success = combine(activeId, id, kind);
    } else if (dialogType === "folder") {
      if (!String(f.get("name")).trim()) throw Error("กรุณาระบุชื่อกลุ่ม");
      success = commit(
        () => (data.groups.find((g) => g.id === activeId).name = f.get("name").trim()),
        "เปลี่ยนชื่อกลุ่ม",
      );
    } else if (dialogType === "detail") {
      const photos = await readPhotos($("#fields input[type=file]").files);
      if (!$("#editor").open || dialogType !== submittedType || activeId !== submittedId) return;
      if (task(activeId).photos.length + photos.length > 5) throw Error("รวมได้ไม่เกิน 5 รูป");
      success = photos.length
        ? commit(() => task(activeId).photos.push(...photos), "เพิ่มรูป")
        : true;
    } else if (dialogType === "wizard") {
      if (step < 2) {
        if (!String(f.get(step === 0 ? "goal" : "next")).trim())
          throw Error("กรุณาระบุข้อความก่อนดำเนินต่อ");
        goalDraft[step === 0 ? "goal" : "next"] = String(
          f.get(step === 0 ? "goal" : "next"),
        ).trim();
        step++;
        wizard();
        return;
      }
      success = commit(() => {
        const id = crypto.randomUUID();
        data.goals.push({ id, title: goalDraft.goal, area: "สิ่งที่เลือก", next: goalDraft.next });
        data.tasks.push({
          id: crypto.randomUUID(),
          title: goalDraft.next,
          duration: 30,
          date: null,
          time: null,
          done: false,
          photos: [],
          steps: [],
          goal: id,
        });
      }, "สร้างเป้าหมายและก้าวแรก");
    }
    if (success) $("#editor").close();
    else
      $("#formError").textContent =
        $("#message span")?.textContent || "ยังไม่ได้บันทึกการเปลี่ยนแปลง";
  } catch (error) {
    $("#formError").textContent = error.message;
  } finally {
    submitting = false;
    $("#submit").disabled = false;
  }
};
document.addEventListener("click", (e) => {
  if (suppressDragClick) {
    suppressDragClick = false;
    e.preventDefault();
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case "focus": {
      const ids = data.focus[date] || [];
      if (!ids.includes(id) && ids.length >= 3) {
        notify("เลือกสิ่งสำคัญได้ไม่เกิน 3 งานในวันนี้");
        break;
      }
      commit(
        () => (data.focus[date] = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
        "เลือกสิ่งสำคัญ",
      );
      break;
    }
    case "new":
      openDialog("new");
      break;
    case "detail":
    case "schedule":
    case "group":
    case "folder":
      openDialog(b.dataset.action, id);
      break;
    case "done":
      commit(() => (task(id).done = !task(id).done), "เปลี่ยนสถานะงาน");
      break;
    case "day":
      date = id;
      $("#date").value = id;
      renderLifePlannerMockup();
      break;
    case "mode":
      calendarMode = id;
      renderLifePlannerMockup();
      break;
    case "ungroup":
      if (commit(() => removeMember(id), "นำออกจากกลุ่ม")) $("#editor").close();
      break;
    case "dissolve":
      if (
        commit(
          () => (data.groups = data.groups.filter((g) => g.id !== id)),
          "ยุบกลุ่มโดยเก็บงานไว้",
        )
      )
        $("#editor").close();
      break;
    case "unschedule":
      commit(() => Object.assign(task(id), { time: null }), "ยกเลิกช่วงเวลา");
      openDialog("detail", id);
      break;
    case "removeCover":
      commit(() => task(id).photos.shift(), "นำภาพแรกออก");
      openDialog("detail", id);
      break;
    case "wizard":
      step = 0;
      goalDraft = {};
      wizard();
      break;
    case "goalTasks":
      selectedGoal = id;
      location.hash = "today";
      renderLifePlannerMockup();
      break;
    case "clearFilter":
      selectedGoal = null;
      renderLifePlannerMockup();
      break;
    case "reviewSave": {
      const values = Array.from(document.querySelectorAll("[data-review]"), (x) => x.value);
      commit(() => (data.review = values), "บันทึกการทบทวน");
      break;
    }
  }
});
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-step]")) {
    const i = Number(e.target.dataset.step);
    const checked = e.target.checked;
    const saved = commit(() => (task(activeId).steps[i].done = checked), "บันทึกงานย่อย");
    if (!saved) {
      e.target.checked = task(activeId).steps[i].done;
      $("#formError").textContent = $("#message span")?.textContent;
    }
    const current = task(activeId);
    $("#fields summary").textContent =
      `งานย่อย ${current.steps.filter((s) => s.done).length} จาก ${current.steps.length}`;
  }
});
$("#add").onclick = () => openDialog("new");
$("#close").onclick = () => $("#editor").close();
$("#previous").onclick = () => {
  const f = new FormData($("#form"));
  if (step === 1) goalDraft.next = String(f.get("next") || "");
  step--;
  wizard();
};
$("#date").onchange = (e) => {
  date = e.target.value || TODAY;
  renderLifePlannerMockup();
};
$("#backToday").onclick = () => {
  $("#date").value = date = TODAY;
  renderLifePlannerMockup();
};
$("#scenario").onchange = (e) => {
  const mode = e.target.value;
  commit(() => {
    selectedGoal = null;
    data = seed();
    if (mode === "empty") {
      data.tasks = [];
      data.groups = [];
      data.goals = [];
      data.focus = {};
    }
    if (mode === "busy")
      for (let i = 0; i < 15; i++)
        data.tasks.push({
          id: "extra" + i,
          title: `งานตัวอย่าง ${i + 1} · ตรวจความชัดเจนของชื่องานภาษาไทยที่ยาวและมีหลายรายละเอียด`,
          duration: 30,
          date: null,
          time: null,
          photos: [],
          steps: [],
          done: false,
          goal: null,
        });
  }, "เปลี่ยนชุดข้อมูลจำลอง");
};
window.addEventListener("hashchange", () => {
  page = pages[location.hash.slice(1)] ? location.hash.slice(1) : "today";
  renderLifePlannerMockup();
});
window.addEventListener("resize", () => {
  if (touch) clearTimeout(touch.timer);
  touch = null;
  endDrag();
  renderLifePlannerMockup();
});
function dropTarget(x, y) {
  return document
    .elementFromPoint(x, y)
    ?.closest("[data-drop-date],[data-drop-group],[data-drop-card]");
}
function hover(target) {
  if (hovered === target) return;
  hovered?.classList.remove("drop-active");
  hovered = target;
  entered = performance.now();
  if (target) target.classList.add("drop-active");
}
function finishDrop(x, y) {
  const target = dropTarget(x, y);
  if (!target || !dragId) return;
  if (target.dataset.dropDate) {
    const rect = target.getBoundingClientRect();
    const quarter = Math.min(3, Math.max(0, Math.floor((y - rect.top) / 18)));
    schedule(
      dragId,
      target.dataset.dropDate,
      Number(target.dataset.dropTime) + quarter * 15,
      task(dragId).duration,
    );
  } else if (target.dataset.dropGroup) combine(dragId, target.dataset.dropGroup, "group");
  else if (performance.now() - entered >= 450) combine(dragId, target.dataset.dropCard);
  else notify("ค้างทับการ์ดสักครู่เพื่อรวมกลุ่ม หรือใช้ปุ่มจัดกลุ่ม");
}
function endDrag() {
  if (touch) clearTimeout(touch.timer);
  touch = null;
  hovered?.classList.remove("drop-active");
  document.querySelectorAll(".dragging").forEach((x) => x.classList.remove("dragging"));
  dragId = null;
  hovered = null;
  $("#ghost").hidden = true;
}
document.addEventListener("dragstart", (e) => {
  const h = e.target.closest("[data-drag]");
  if (!h) return;
  dragId = h.dataset.drag;
  e.dataTransfer.setData("text/plain", dragId);
  e.dataTransfer.effectAllowed = "move";
  h.classList.add("dragging");
});
document.addEventListener("dragover", (e) => {
  if (!dragId) return;
  e.preventDefault();
  hover(dropTarget(e.clientX, e.clientY));
});
document.addEventListener("drop", (e) => {
  if (!dragId) return;
  e.preventDefault();
  finishDrop(e.clientX, e.clientY);
  endDrag();
});
document.addEventListener("dragend", endDrag);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") endDrag();
});
let touch = null;
let suppressDragClick = false;
function startPointerDrag() {
  if (!touch) return;
  touch.active = true;
  dragId = touch.handle.dataset.drag;
  touch.handle.setPointerCapture(touch.id);
  touch.handle.classList.add("dragging");
  $("#ghost").textContent = task(dragId).title;
  $("#ghost").hidden = false;
}
document.addEventListener("pointerdown", (e) => {
  const handle = e.target.closest("[data-drag]");
  if (!handle || e.button !== 0) return;
  touch = {
    id: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    handle,
    active: false,
    mouse: e.pointerType === "mouse",
    timer: null,
  };
  if (!touch.mouse) touch.timer = setTimeout(startPointerDrag, 220);
});
document.addEventListener(
  "pointermove",
  (e) => {
    if (!touch || touch.id !== e.pointerId) return;
    if (!touch.active) {
      const moved = Math.hypot(e.clientX - touch.startX, e.clientY - touch.startY);
      if (touch.mouse && moved > 6) startPointerDrag();
      else if (!touch.mouse && moved > 10) {
        clearTimeout(touch.timer);
        touch = null;
        return;
      } else return;
    }
    e.preventDefault();
    $("#ghost").style.left = Math.max(0, Math.min(innerWidth - 180, e.clientX + 12)) + "px";
    $("#ghost").style.top = Math.max(0, e.clientY - 55) + "px";
    hover(dropTarget(e.clientX, e.clientY));
    if (e.clientY > innerHeight - 50) window.scrollBy(0, 18);
    else if (e.clientY < 50) window.scrollBy(0, -18);
    const scroller = document.querySelector(".timeline");
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (e.clientY > r.bottom - 30) scroller.scrollTop += 14;
      else if (e.clientY < r.top + 30) scroller.scrollTop -= 14;
    }
  },
  { passive: false },
);
document.addEventListener("pointerup", (e) => {
  if (!touch || touch.id !== e.pointerId) return;
  clearTimeout(touch.timer);
  if (touch.active) {
    suppressDragClick = true;
    setTimeout(() => {
      suppressDragClick = false;
    }, 0);
    finishDrop(e.clientX, e.clientY);
  }
  touch = null;
  endDrag();
});
document.addEventListener("pointercancel", () => {
  if (touch) clearTimeout(touch.timer);
  touch = null;
  endDrag();
});
renderLifePlannerMockup();
