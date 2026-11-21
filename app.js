(function () {
  "use strict";

  const BOOKS = window.BOOKS;
  const DONE = BOOKS.length; // 12까지 끝낸 학생 = 수료
  const STORE_KEY = "weekendcamp.v1";
  const GRADES = ["1학년", "2학년", "3학년", "4학년", "5학년", "6학년"];

  // ---------- 저장 ----------
  function seedState() {
    return {
      students: window.SEED_STUDENTS.map(([grade, name, book], i) => ({
        id: "s" + (i + 1),
        grade,
        name,
        level: BOOKS.indexOf(book),
      })),
      stock: Object.assign({}, window.SEED_STOCK),
      log: [],
      nextId: window.SEED_STUDENTS.length + 1,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.students) && s.stock) return s;
      }
    } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
    return seedState();
  }

  let state = load();

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast("저장하지 못했어요. 백업 파일을 받아 두세요.");
    }
  }

  // ---------- 도우미 ----------
  const $ = (sel) => document.querySelector(sel);
  const bookName = (b) => (/^\d/.test(b) ? b + "번" : b);
  const bookLabel = (lv) => (lv >= DONE ? "수료" : BOOKS[lv]);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const now = () => new Date().toISOString();
  const fmtTime = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  let toastTimer;
  function toast(msg, undoFn) {
    const el = $("#toast");
    el.innerHTML = `<span>${esc(msg)}</span>`;
    if (undoFn) {
      const b = document.createElement("button");
      b.textContent = "되돌리기";
      b.className = "toast-undo";
      b.onclick = () => { undoFn(); el.hidden = true; };
      el.appendChild(b);
    }
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 6000);
  }

  // ---------- 진도 올리기 ----------
  // 학생이 지금 책을 다 풀면: 다음 책으로 넘어가고, 다음 책 재고 1권 사용
  function advance(student) {
    if (student.level >= DONE) return { ok: false, msg: `${student.name}: 이미 12까지 모두 끝냈어요` };
    const from = student.level;
    const to = from + 1;
    student.level = to;
    let stockNote = "";
    if (to < DONE) {
      const key = BOOKS[to];
      state.stock[key] = (state.stock[key] || 0) - 1;
      stockNote = state.stock[key] < 0 ? ` · ${key} 재고 부족!` : ` · ${key} 재고 ${state.stock[key]}권 남음`;
    }
    const entry = { id: "l" + Date.now() + Math.random().toString(36).slice(2, 6), type: "advance", sid: student.id, name: student.name, from, to, at: now() };
    state.log.unshift(entry);
    return { ok: true, entry, msg: `${student.name}: ${bookLabel(from)} → ${bookLabel(to)}${stockNote}` };
  }

  function undoEntry(entryId) {
    const idx = state.log.findIndex((e) => e.id === entryId);
    if (idx < 0) return;
    const e = state.log[idx];
    if (e.type === "advance") {
      const s = state.students.find((x) => x.id === e.sid);
      if (s && s.level === e.to) {
        s.level = e.from;
        if (e.to < DONE) state.stock[BOOKS[e.to]] = (state.stock[BOOKS[e.to]] || 0) + 1;
      } else {
        toast(`${e.name}의 진도가 그 뒤에 또 바뀌어서 되돌릴 수 없어요`);
        return;
      }
    } else if (e.type === "receive") {
      state.stock[e.book] = (state.stock[e.book] || 0) - e.count;
    }
    state.log.splice(idx, 1);
    save();
    renderAll();
  }

  function findStudents(token) {
    const exact = state.students.filter((s) => s.name === token);
    if (exact.length) return exact;
    return state.students.filter((s) => s.name.includes(token));
  }

  $("#done-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $("#done-input");
    const tokens = input.value.split(/[\s,，、]+/).map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) return;
    const lines = [];
    const entries = [];
    const missed = [];
    tokens.forEach((t) => {
      const found = findStudents(t);
      if (found.length === 1) {
        const r = advance(found[0]);
        lines.push({ ok: r.ok, msg: r.msg });
        if (r.entry) entries.push(r.entry.id);
      } else if (found.length === 0) {
        lines.push({ ok: false, msg: `'${t}' 학생을 찾지 못했어요` });
        missed.push(t);
      } else {
        lines.push({ ok: false, msg: `'${t}'에 맞는 학생이 여러 명이에요: ${found.map((s) => s.grade + " " + s.name).join(", ")}` });
        missed.push(t);
      }
    });
    save();
    renderAll();
    $("#done-result").innerHTML = lines.map((l) => `<div class="${l.ok ? "ok" : "bad"}">${esc(l.msg)}</div>`).join("");
    input.value = missed.join(" ");
    if (entries.length) {
      toast(`${entries.length}명 다음 책으로 넘어갔어요`, () => entries.slice().reverse().forEach(undoEntry));
    }
    input.focus();
  });

  // ---------- 명단 ----------
  function levelOptions(selected) {
    let html = "";
    for (let i = 0; i <= DONE; i++) html += `<option value="${i}"${i === selected ? " selected" : ""}>${bookLabel(i)}</option>`;
    return html;
  }

  function renderRoster() {
    const q = $("#search").value.trim();
    const g = $("#grade-filter").value;
    const sort = $("#sort").value;
    let list = state.students.filter((s) => (!q || s.name.includes(q)) && (!g || s.grade === g));
    const byName = (a, b) => a.name.localeCompare(b.name, "ko");
    if (sort === "grade") list.sort((a, b) => a.grade.localeCompare(b.grade, "ko") || byName(a, b));
    if (sort === "level") list.sort((a, b) => b.level - a.level || byName(a, b));
    if (sort === "name") list.sort(byName);

    $("#roster-body").innerHTML = list.map((s) => {
      const pct = Math.round((s.level / DONE) * 100);
      return `<tr>
        <td class="muted">${esc(s.grade)}</td>
        <td class="name">${esc(s.name)}</td>
        <td><select class="lv-select lv-${s.level}" data-id="${s.id}" aria-label="${esc(s.name)} 지금 책">${levelOptions(s.level)}</select></td>
        <td class="hide-sm"><div class="bar" title="${s.level}/${DONE}권 완료"><span style="width:${pct}%"></span></div></td>
        <td class="right">${s.level < DONE ? `<button class="btn small" data-adv="${s.id}">완료 →</button>` : `<span class="badge">수료</span>`}</td>
      </tr>`;
    }).join("") || `<tr><td colspan="5" class="muted center">학생이 없어요</td></tr>`;

    $("#name-list").innerHTML = state.students.map((s) => `<option value="${esc(s.name)}">${esc(s.grade)} · ${bookLabel(s.level)}</option>`).join("");
  }

  $("#roster-body").addEventListener("click", (ev) => {
    const id = ev.target.getAttribute("data-adv");
    if (!id) return;
    const s = state.students.find((x) => x.id === id);
    const r = advance(s);
    save();
    renderAll();
    toast(r.msg, r.entry ? () => undoEntry(r.entry.id) : null);
  });

  $("#roster-body").addEventListener("change", (ev) => {
    if (!ev.target.classList.contains("lv-select")) return;
    const s = state.students.find((x) => x.id === ev.target.dataset.id);
    const from = s.level;
    s.level = Number(ev.target.value);
    state.log.unshift({ id: "l" + Date.now(), type: "fix", sid: s.id, name: s.name, from, to: s.level, at: now() });
    save();
    renderAll();
    toast(`${s.name} 진도를 ${bookLabel(s.level)}(으)로 고쳤어요 (재고 변화 없음)`);
  });

  ["#search", "#grade-filter", "#sort"].forEach((sel) => $(sel).addEventListener("input", renderRoster));

  function renderSummary() {
    const counts = new Array(DONE + 1).fill(0);
    state.students.forEach((s) => counts[s.level]++);
    let html = "";
    for (let i = 0; i <= DONE; i++) {
      html += `<div class="chip lv-${i}${counts[i] ? "" : " empty"}"><b>${bookLabel(i)}</b><span>${counts[i]}명</span></div>`;
    }
    $("#level-summary").innerHTML = html;
  }

  // 학생 추가
  $("#add-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const name = $("#add-name").value.trim();
    if (!name) return;
    if (state.students.some((s) => s.name === name)) {
      toast(`${name} 학생이 이미 있어요. 구분할 수 있게 이름 뒤에 글자를 붙여 주세요 (예: ${name}B)`);
      return;
    }
    state.students.push({ id: "s" + state.nextId++, grade: $("#add-grade").value, name, level: Number($("#add-level").value) });
    state.log.unshift({ id: "l" + Date.now(), type: "add", name, at: now() });
    $("#add-name").value = "";
    save();
    renderAll();
    toast(`${name} 학생을 추가했어요`);
  });

  // ---------- 재고 ----------
  function renderStock() {
    $("#stock-grid").innerHTML = BOOKS.map((b) => {
      const v = state.stock[b] || 0;
      return `<label class="stock-cell${v < 0 ? " neg" : v === 0 ? " zero" : ""}">
        <span class="stock-book">${b}</span>
        <input type="number" inputmode="numeric" data-book="${b}" value="${v}" aria-label="${b} 재고">
        <span class="stock-unit">권</span>
      </label>`;
    }).join("");
  }

  $("#stock-grid").addEventListener("change", (ev) => {
    const b = ev.target.dataset.book;
    if (!b) return;
    const v = parseInt(ev.target.value, 10);
    const old = state.stock[b] || 0;
    state.stock[b] = isNaN(v) ? 0 : v;
    state.log.unshift({ id: "l" + Date.now(), type: "setStock", book: b, from: old, to: state.stock[b], at: now() });
    save();
    renderAll();
  });

  $("#recv-btn").addEventListener("click", () => {
    const b = $("#recv-book").value;
    const n = parseInt($("#recv-count").value, 10);
    if (!n || n < 1) return;
    state.stock[b] = (state.stock[b] || 0) + n;
    const entry = { id: "l" + Date.now(), type: "receive", book: b, count: n, at: now() };
    state.log.unshift(entry);
    save();
    renderAll();
    toast(`${b} ${n}권 입고 · 재고 ${state.stock[b]}권`, () => undoEntry(entry.id));
  });

  // ---------- 구매 계획 ----------
  // 책 i가 필요한 인원 = 앞으로 h단계 안에 책 i에 도착할 학생 수
  //   (지금 i-h ~ i-1 단계를 풀고 있는 학생들)
  function buyPlan() {
    const h = Number($("#horizon").value) || 1;
    const buffer = Math.max(0, parseInt($("#buffer").value, 10) || 0);
    const counts = new Array(DONE + 1).fill(0);
    state.students.forEach((s) => counts[s.level]++);
    return BOOKS.map((b, i) => {
      let need = 0;
      for (let k = Math.max(0, i - h); k < i; k++) need += counts[k];
      const stock = state.stock[b] || 0;
      const target = need > 0 ? need + buffer : 0;
      const buy = Math.max(0, target - stock);
      return { book: b, need, stock, buy };
    });
  }

  function renderBuy() {
    const plan = buyPlan();
    const total = plan.reduce((a, r) => a + r.buy, 0);
    $("#buy-body").innerHTML = plan.map((r) => `<tr class="${r.buy ? "need" : ""}">
      <td class="name">${r.book}</td>
      <td>${r.need}명</td>
      <td class="${r.stock < 0 ? "neg-text" : ""}">${r.stock}권</td>
      <td><b>${r.buy ? r.buy + "권" : "-"}</b></td>
    </tr>`).join("");
    $("#buy-total").innerHTML = total
      ? `모두 <b>${total}권</b>을 사야 해요 · ${plan.filter((r) => r.buy).map((r) => `${bookName(r.book)} ${r.buy}권`).join(", ")}`
      : `지금 재고로 충분해요`;
  }

  ["#buffer", "#horizon"].forEach((sel) => $(sel).addEventListener("input", renderBuy));

  $("#copy-buy").addEventListener("click", () => {
    const plan = buyPlan().filter((r) => r.buy);
    const text = plan.length ? plan.map((r) => `${bookName(r.book)}: ${r.buy}권`).join("\n") + `\n합계: ${plan.reduce((a, r) => a + r.buy, 0)}권` : "살 책 없음";
    const done = () => toast("주문 목록을 복사했어요");
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => toast(text));
    else toast(text);
  });

  // ---------- 기록 ----------
  function logText(e) {
    switch (e.type) {
      case "advance": return `${e.name}: ${bookLabel(e.from)} 완료 → ${bookLabel(e.to)}`;
      case "fix": return `${e.name}: 진도 수정 ${bookLabel(e.from)} → ${bookLabel(e.to)}`;
      case "receive": return `${e.book} ${e.count}권 입고`;
      case "setStock": return `${e.book} 재고 ${e.from} → ${e.to}권`;
      case "add": return `${e.name} 학생 추가`;
      default: return "";
    }
  }

  function renderLog() {
    const items = state.log.slice(0, 200);
    $("#log-list").innerHTML = items.length
      ? items.map((e) => `<li><time>${fmtTime(e.at)}</time><span>${esc(logText(e))}</span>${e.type === "advance" || e.type === "receive" ? `<button class="link" data-undo="${e.id}">되돌리기</button>` : ""}</li>`).join("")
      : `<li class="muted">아직 기록이 없어요</li>`;
  }

  $("#log-list").addEventListener("click", (ev) => {
    const id = ev.target.getAttribute("data-undo");
    if (id) undoEntry(id);
  });

  // ---------- 백업 ----------
  function download(filename, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const today = () => new Date().toISOString().slice(0, 10);

  $("#export-json").addEventListener("click", () => download(`주말캠프-백업-${today()}.json`, JSON.stringify(state, null, 2), "application/json"));
  $("#export-csv").addEventListener("click", () => {
    const rows = [["학년", "이름", "지금 책"], ...state.students.map((s) => [s.grade, s.name, bookLabel(s.level)])];
    rows.push([], ["책", "재고"], ...BOOKS.map((b) => [b, state.stock[b] || 0]));
    download(`주말캠프-명단-${today()}.csv`, "﻿" + rows.map((r) => r.join(",")).join("\n"), "text/csv");
  });
  $("#import-json").addEventListener("change", (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    file.text().then((t) => {
      const s = JSON.parse(t);
      if (!s || !Array.isArray(s.students) || !s.stock) throw new Error();
      state = s;
      save();
      renderAll();
      toast("백업을 불러왔어요");
    }).catch(() => toast("백업 파일을 읽지 못했어요"));
    ev.target.value = "";
  });

  // ---------- 탭 ----------
  function showTab(name) {
    document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== "tab-" + name));
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.tab === name));
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  }
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  // ---------- 시작 ----------
  function fillSelects() {
    $("#grade-filter").innerHTML += GRADES.map((g) => `<option>${g}</option>`).join("");
    $("#add-grade").innerHTML = GRADES.map((g) => `<option>${g}</option>`).join("");
    $("#add-level").innerHTML = BOOKS.map((b, i) => `<option value="${i}">${b}</option>`).join("");
    $("#recv-book").innerHTML = BOOKS.map((b) => `<option>${b}</option>`).join("");
  }

  function renderAll() {
    renderSummary();
    renderRoster();
    renderStock();
    renderBuy();
    renderLog();
  }

  fillSelects();
  renderAll();
  const start = location.hash.slice(1);
  showTab(["progress", "stock", "buy", "log"].includes(start) ? start : "progress");
})();
