'use strict';

const STORAGE_KEY = 'steadyCycleCheckin.v1';
const DATE_KEY = 'steadyCycleCheckin.selectedDate';
const PHASES = { regular: '健康饮食日', light: '轻断食日' };
const SOURCE = 'https://www.xiaohongshu.com/explore/68e5f878000000000401213c';
const PAGE_SIZE = 5;
const MAX_PHASES = 14;
const empty = { plan: [], cycle: null, days: {} };
const main = document.querySelector('#main');
const status = document.querySelector('#status');
let state = empty;
let storageIssue = false;
let selectedDate = localDate();
let statusTimer;

try {
  const lastDate = sessionStorage.getItem(DATE_KEY);
  if (lastDate && validPastDate(lastDate)) selectedDate = lastDate;
} catch { /* Keep the default date when session storage is unavailable. */ }

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.plan) || !parsed.days || typeof parsed.days !== 'object') throw new Error('Invalid data');
    state = parsed;
  }
} catch {
  storageIssue = true;
}

function localDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, i) => String(part).padStart(i ? 2 : 4, '0')).join('-');
}

function dateAt(start, offset) {
  const date = new Date(start + 'T12:00:00');
  date.setDate(date.getDate() + offset);
  return localDate(date);
}

function validPastDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dateAt(value, 0) === value && value <= localDate();
}

function selectDate(date) {
  selectedDate = date;
  try { sessionStorage.setItem(DATE_KEY, date); } catch { /* Keep the date for this page. */ }
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function announce(message) {
  status.textContent = message;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { status.textContent = ''; }, 3500);
}

function save(next) {
  if (storageIssue) {
    announce('本机记录暂时无法读取，请换回原浏览器或检查存储设置。');
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    announce('本机保存失败，请检查浏览器的存储空间。');
    return false;
  }
}

function phaseAt(date) {
  const cycle = state.cycle;
  if (!cycle) return null;
  const index = cycle.plan.findIndex((_, i) => dateAt(cycle.start, i) === date);
  return index < 0 ? null : { index, key: cycle.plan[index], cycleId: cycle.id };
}

function dayAt(date) {
  const saved = state.days[date];
  const phase = phaseAt(date);
  return {
    foods: saved?.foods || [],
    note: saved?.note || '',
    checked: !!saved?.checked && (!phase || saved.cycleId === phase.cycleId),
    phase: phase?.key || saved?.phase || '',
    cycleId: phase?.cycleId || saved?.cycleId || null
  };
}

function updateDay(date, change) {
  const entry = { ...dayAt(date), ...change };
  return save({ ...state, days: { ...state.days, [date]: entry } });
}

function cycleProgress() {
  if (!state.cycle) return [];
  const { start, plan, id } = state.cycle;
  return plan.map((_, i) => {
    const entry = state.days[dateAt(start, i)];
    return entry?.cycleId === id && entry.checked;
  });
}

function kcal(values) {
  return Math.round(values.reduce((sum, item) => sum + (item.kcal ?? 0), 0) * 10) / 10;
}

function totals(foods) {
  const unknown = foods.filter(item => item.kcal === null).length;
  const food = kcal(foods.filter(item => item.kind === 'food'));
  const drink = kcal(foods.filter(item => item.kind === 'drink'));
  return `<div class="numbers">
    <div><span>食物</span><strong>${food}</strong></div>
    <div><span>饮品</span><strong>${drink}</strong></div>
    <div><span>已记合计 · 大卡</span><strong>${kcal(foods)}</strong></div>
  </div>${unknown ? `<p class="muted">${unknown} 项未填热量，未计入合计。</p>` : ''}`;
}

function today() {
  const day = dayAt(selectedDate);
  const phase = phaseAt(selectedDate);
  const progress = cycleProgress();
  const completed = progress.filter(Boolean).length;
  const phaseTitle = PHASES[day.phase] || '自由记录';
  const summary = phase ? `自订循环 · 第 ${phase.index + 1} / ${progress.length} 天` : '选择日期，记录当天的饮食和感受';
  return `<h1>饮食打卡</h1>
    <label>记录日期<input id="selected-date" type="date" value="${selectedDate}" max="${localDate()}"></label>
    <section class="hero">
      <span class="pill">${day.checked ? '已打卡' : '待记录'}</span>
      <h2>${phaseTitle}</h2><p>${summary}</p>
      ${progress.length ? `<p>${completed === progress.length ? '本轮已完成' : `本轮已打卡 ${completed} / ${progress.length} 天`}</p>` : ''}
    </section>
    <section class="card">
      <div class="split"><h2>当天热量</h2><span class="muted">${day.foods.length} 项</span></div>
      ${totals(day.foods)}
      <div class="actions"><a class="btn primary" href="#add">添加食物或饮品</a><a class="btn" href="#detail">明细和备注</a></div>
    </section>
    <button class="btn block" type="button" data-action="check">${day.checked ? '取消当天打卡' : '完成当天打卡'}</button>
    ${state.cycle ? '' : '<a class="btn block" href="#plan">设置我的循环</a>'}`;
}

function add() {
  return `<a class="back" href="#today">‹ 返回今日</a><h1>添加饮食</h1><p class="muted">${selectedDate}</p>
    <form class="card" id="food-form">
      <label>名称<input name="name" maxlength="50" required placeholder="如熟米饭、牛奶"></label>
      <label>类别<select name="kind"><option value="food">食物</option><option value="drink">饮品</option></select></label>
      <label>这份食物或饮品的热量（大卡）<input name="kcal" type="number" inputmode="decimal" min="0" max="9999" step="0.1" placeholder="未知可留空"></label>
      <p class="muted">可按包装营养表和实际吃掉的份量换算。</p>
      <button class="primary block" type="submit">保存这项</button>
    </form>`;
}

function detail(page = 0) {
  const day = dayAt(selectedDate);
  const pageCount = Math.max(1, Math.ceil(day.foods.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = day.foods.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  return `<a class="back" href="#today">‹ 返回今日</a><h1>当天明细</h1><p class="muted">${selectedDate}</p>
    <section class="card">${totals(day.foods)}
    ${visible.length ? `<ul class="stack">${visible.map((item, i) => `<li class="row split">
      <div>${escapeText(item.name)}<br><span class="muted">${item.kind === 'drink' ? '饮品' : '食物'} · ${item.kcal === null ? '热量待填' : `${item.kcal} 大卡`}</span></div>
      <button type="button" data-action="remove-food" data-index="${current * PAGE_SIZE + i}" aria-label="移除 ${escapeText(item.name)}">移除</button>
    </li>`).join('')}</ul>` : '<p class="note">当天还没有饮食条目。</p>'}
    ${pagination('detail', current, pageCount)}
    <a class="btn block" href="#add">添加食物或饮品</a></section>
    <form class="card" id="note-form"><label>当天备注<textarea name="note" rows="2" maxlength="300" placeholder="记录感受或调整">${escapeText(day.note)}</textarea></label>
    <button type="submit" class="btn block">保存备注</button></form>`;
}

function plan() {
  const cycle = state.cycle;
  const progress = cycleProgress();
  const finished = progress.length > 0 && progress.every(Boolean);
  const end = cycle ? dateAt(cycle.start, cycle.plan.length - 1) : '';
  const canStart = !cycle || end < localDate() || finished;
  const start = end >= localDate() ? dateAt(end, 1) : localDate();
  return `<h1>我的循环</h1><p class="muted">按你保存的顺序安排每一天。</p>
    ${cycle ? `<section class="hero">
      <span class="pill">${finished ? '已完成' : '最近一轮'}</span><h2>${cycle.plan.length} 天循环</h2>
      <p>${cycle.start} 至 ${end} · 已打卡 ${progress.filter(Boolean).length} / ${progress.length}</p>
      <ol class="dots" aria-label="每日打卡进度">${progress.map((done, i) =>
        `<li class="${done ? 'done' : ''}" aria-label="第 ${i+1} 天${done ? '已完成' : '未完成'}">${i+1}</li>`
      ).join('')}</ol>
    </section>` : ''}
    <section class="card">
      <div class="split"><h2>自订日序</h2><a class="btn" href="#edit-plan">调整顺序</a></div>
      <p class="muted">${state.plan.length ? `已设 ${state.plan.length} 天 · ${state.plan.map(key => PHASES[key]).join(' → ')}` : '添加至少两个阶段后可开启循环。'}</p>
      <p class="note">稳健版完整日序待核实。此处按你设置的顺序执行。</p>
      ${canStart && state.plan.length >= 2 ? `<form id="start-form">
        <label>开始日期<input name="start" type="date" required ${cycle ? `min="${dateAt(end, 1)}"` : ''} value="${start}"></label>
        <button class="primary block" type="submit">${cycle ? '开始下一轮' : '开始一轮'}</button>
      </form>` : ''}
      ${cycle && !canStart ? '<button class="btn block" type="button" data-action="end-cycle">结束本轮</button>' : ''}
    </section>`;
}

function editPlan() {
  const cap = state.plan.length >= MAX_PHASES ? 'disabled' : '';
  return `<a class="back" href="#plan">‹ 返回循环</a><h1>设置日序</h1>
    <p class="muted">按顺序添加阶段，最多 ${MAX_PHASES} 天。设置会用于下一轮。</p>
    <div class="actions"><button type="button" data-action="add-regular" ${cap}>＋健康饮食日</button><button type="button" data-action="add-light" ${cap}>＋轻断食日</button></div>
    <ol class="stack">${state.plan.map((key, i) => `<li class="card row split">
      <div>第 ${i+1} 天 · ${PHASES[key]}</div>
      ${i > 0 ? `<button type="button" data-action="up-phase" data-index="${i}" aria-label="上移第 ${i+1} 天">↑</button>` : ''}
      <button type="button" data-action="remove-phase" data-index="${i}" aria-label="移除第 ${i+1} 天">移除</button>
    </li>`).join('')}</ol>
    ${!state.plan.length ? '<p class="note">还没有阶段，点击上面的按钮开始添加。</p>' : ''}`;
}

function pagination(route, page, count) {
  if (count <= 1) return '';
  return `<div class="actions">
    ${page ? `<a class="btn" href="#${route}/${page - 1}">上一页</a>` : '<span></span>'}
    ${page + 1 < count ? `<a class="btn" href="#${route}/${page + 1}">下一页</a>` : '<span></span>'}
  </div><p class="muted">第 ${page + 1} / ${count} 页</p>`;
}

function records(page = 0) {
  const entries = Object.entries(state.days).sort(([a], [b]) => b.localeCompare(a));
  const count = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const current = Math.min(page, count - 1);
  return `<h1>历史记录</h1><p class="muted">点击日期可查看或补记。</p>
    <section class="card">
    ${entries.length ? `<ul class="history">${entries.slice(current*PAGE_SIZE, (current+1)*PAGE_SIZE).map(([date, day]) => `<li>
      <a href="#day/${date}"><span>${date}<br><small>${PHASES[day.phase] || '自由记录'} · ${day.checked ? '已打卡' : '未打卡'}</small></span>
      <span>已记 ${kcal(day.foods)} 大卡 ›</span></a>
    </li>`).join('')}</ul>` : '<p class="muted">还没有记录。</p>'}
    ${pagination('records', current, count)}</section>`;
}

function about() {
  return `<h1>说明</h1>
    <section class="card"><h2>稳健版来源</h2>
      <p class="muted">八戒的小主（SAWYER）于 2025-10-09 发布稳健版答疑，提到健康饮食和轻断食。她在评论里确认饮品热量也计入。</p>
      <a class="btn block" href="${SOURCE}" target="_blank" rel="noopener noreferrer">查看小红书原帖</a>
      <p class="note">完整循环顺序仍待核实。全天只吃黄瓜与米饭的说法也未核实。App 使用自订日序和实际记录，不设热量达标线。</p>
    </section>
    <section class="card"><h2>添加到 iPhone 主屏幕</h2><p class="muted">用 Safari 打开本页，点「分享」→「添加到主屏幕」→「添加」。</p></section>
    <section class="card"><h2>本机存储</h2><p class="muted">饮食记录只保存在此浏览器。清除网站数据后会丢失。首次在线打开后可离线使用。</p></section>
    <p class="muted">个人记录工具 · 与原帖作者无关联</p>`;
}

const views = { today, add, detail, plan, 'edit-plan': editPlan, records, about };

function render(resetScroll = false) {
  let [route = 'today', param = '0'] = (location.hash.slice(1) || 'today').split('/');
  if (route === 'day') {
    if (validPastDate(param)) selectDate(param);
    route = 'detail';
    param = '0';
  }
  if (!Object.hasOwn(views, route)) route = 'today';
  const page = /^\d+$/.test(param) ? Number(param) : 0;
  const top = resetScroll ? 0 : main.scrollTop;
  main.innerHTML = (storageIssue ? '<p class="note" role="alert">本机记录暂时无法读取，保存已暂停。</p>' : '') + views[route](page);
  main.dataset.route = route;
  main.scrollTop = top;
  const current = ({ add: 'today', detail: 'today', 'edit-plan': 'plan' })[route] || route;
  document.querySelectorAll('nav a').forEach(link => {
    if (link.hash === '#' + current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function go(route) {
  const hash = '#' + route;
  if (location.hash === hash) render(true);
  else location.hash = hash;
}

main.addEventListener('change', event => {
  if (event.target.id !== 'selected-date') return;
  if (validPastDate(event.target.value)) selectDate(event.target.value);
  else announce('请选择今天或更早的有效日期。');
  render();
});

main.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, index } = button.dataset;
  const day = dayAt(selectedDate);
  if (action === 'check') {
    if (updateDay(selectedDate, { checked: !day.checked })) {
      const completed = cycleProgress();
      const finished = completed.length > 0 && completed.every(Boolean);
      announce(day.checked ? '已取消打卡' : finished ? '本轮循环已完成' : '已保存当天打卡');
    }
  } else if (action === 'remove-food') {
    if (!confirm('移除这项饮食记录？')) return;
    updateDay(selectedDate, { foods: day.foods.filter((_, i) => i !== Number(index)) });
  } else if (action === 'end-cycle') {
    if (!confirm('结束本轮循环？已保存的每日记录会保留。')) return;
    save({ ...state, cycle: null });
  } else {
    const phases = [...state.plan];
    if (action.startsWith('add-') && phases.length < MAX_PHASES) phases.push(action.slice(4));
    if (action === 'remove-phase') phases.splice(Number(index), 1);
    if (action === 'up-phase') {
      const i = Number(index);
      [phases[i - 1], phases[i]] = [phases[i], phases[i - 1]];
    }
    save({ ...state, plan: phases });
  }
  render();
});

main.addEventListener('submit', event => {
  event.preventDefault();
  const form = event.target;
  const values = new FormData(form);
  if (form.id === 'food-form') {
    const name = String(values.get('name')).trim();
    if (!name) { announce('请填写食物或饮品名称。'); return; }
    const input = String(values.get('kcal'));
    const item = { name, kind: values.get('kind'), kcal: input === '' ? null : Number(input) };
    if (updateDay(selectedDate, { foods: [...dayAt(selectedDate).foods, item] })) {
      announce('饮食已保存');
      go('today');
    }
  } else if (form.id === 'note-form') {
    if (updateDay(selectedDate, { note: String(values.get('note')).trim() })) announce('备注已保存');
  } else if (form.id === 'start-form') {
    const start = String(values.get('start'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || dateAt(start, 0) !== start || state.plan.length < 2) return;
    const cycle = { start, id: crypto.randomUUID(), plan: [...state.plan] };
    if (save({ ...state, cycle })) {
      selectDate(start <= localDate() ? start : localDate());
      announce('循环已安排');
      go('today');
    }
  }
});

window.addEventListener('hashchange', () => {
  render(true);
  main.focus({ preventScroll: true });
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !event.newValue || storageIssue) return;
  try { state = JSON.parse(event.newValue); render(); } catch { /* Keep the last readable state. */ }
});
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, event => event.preventDefault(), { passive: false });
}
document.addEventListener('touchmove', event => {
  if (event.touches.length > 1) event.preventDefault();
}, { passive: false });

render(true);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => announce('暂时无法启用离线使用。'));
}
