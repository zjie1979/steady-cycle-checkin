'use strict';

const STORAGE_KEY = 'steadyCycleCheckin.v1';
const DATE_KEY = 'steadyCycleCheckin.selectedDate';
const PHASES = { regular: '健康饮食', light: '轻断食', free: '随便吃' };
const ICED_AMERICANO = { name: '冰美式', kind: 'drink', portion: '无糖小杯 1 杯', kcal: 10 };
const FOUR_DAY_MENU = [
  { phase: 'regular', meals: [
    ['第一餐', [
      { id: 'double-cheeseburger', name: '双层吉士汉堡', kind: 'food', portion: '麦当劳 1 个', kcal: 429 },
      { ...ICED_AMERICANO, id: 'americano-day-1' }
    ]],
    ['第二餐', [
      { id: 'meat-wrap', name: '美式辣烤肉卷饼', kind: 'food', portion: '同类烤鸡肉卷 1 个，约 208 克', kcal: 420 }
    ]]
  ] },
  { phase: 'light', meals: [
    ['第一餐', [
      { id: 'eggs', name: '鸡蛋', kind: 'food', portion: '水煮 2 个，去壳约 100 克', kcal: 155 },
      { id: 'butter-coffee', name: '黄油咖啡', kind: 'drink', portion: '无糖黑咖啡约 240 毫升＋黄油 10 克', kcal: 74 }
    ]],
    ['加餐', [
      { id: 'tomatoes', name: '小番茄', kind: 'food', portion: '1 把，约 100 克', kcal: 18 }
    ]],
    ['第二餐', [
      { id: 'potato', name: '蒸土豆蘸辣椒粉', kind: 'food', portion: '熟土豆 200 克＋辣椒粉 1 克', kcal: 177 }
    ]]
  ] },
  { phase: 'regular', meals: [
    ['第一餐', [
      { id: 'light-bowl', name: '轻食碗', kind: 'food', portion: '1 碗，按鸡胸肉、糙米饭、蔬菜和油估算', kcal: 410 },
      { ...ICED_AMERICANO, id: 'americano-day-3' }
    ]],
    ['第二餐', [
      { id: 'corn', name: '玉米', kind: 'food', portion: '熟甜玉米 1 根，玉米粒约 100 克', kcal: 96 }
    ]]
  ] },
  { phase: 'free', meals: [
    ['第一餐', [
      { id: 'chicken-pot', name: '鸡公煲', kind: 'food', portion: '1 人份，按带皮鸡腿肉、配菜和用油估算，米饭另计', kcal: 550 }
    ]],
    ['第二餐', [
      { id: 'hot-pot', name: '川渝火锅', kind: 'food', portion: '1 人份，按牛肉、豆腐、蔬菜和油估算，麻酱和主食另计', kcal: 680 }
    ]]
  ] }
];
const FOUR_DAY_PLAN = FOUR_DAY_MENU.map(day => day.phase);
const SOURCE = 'https://www.xiaohongshu.com/explore/68fa5840000000000401392f';
const FAQ = 'https://www.xiaohongshu.com/explore/68e5f878000000000401213c';
const NUTRITION_SOURCES = [
  ['麦当劳中国 · 双层吉士汉堡', 'https://www.mcdonalds.com.cn/product/double-cheeseburger?ivk_sa=1024320u'],
  ['麦当劳中国 · 冰美式', 'https://www.mcdonalds.com.cn/product/Iced-Americano'],
  ['美国农业部 · 食物成分表 SR28', 'https://www.ars.usda.gov/northeast-area/beltsville-md-bhnrc/beltsville-human-nutrition-research-center/methods-and-application-of-food-composition-laboratory/mafcl-site-pages/sr11-sr28/'],
  ['Harvey’s · 同类烤鸡肉卷营养表', 'https://www.harveys.ca/en/nutrition.html']
];
const PAGE_SIZE = 5;
const MAX_PHASES = 14;
const empty = { plan: [], cycle: null, days: {} };
const main = document.querySelector('#main');
const status = document.querySelector('#status');
let state = empty;
let storageIssue = false;
let selectedDate = localDate();
let calendarDate = selectedDate;
let statusTimer;

try {
  const lastDate = sessionStorage.getItem(DATE_KEY);
  const [chosenOn, date] = (lastDate || '').split('/');
  if (chosenOn === calendarDate && validPastDate(date || '')) selectedDate = date;
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
  try { sessionStorage.setItem(DATE_KEY, localDate() + '/' + date); } catch { /* Keep the date for this page. */ }
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

function migrateFourDayOrder() {
  const cycle = state.cycle;
  if (cycle?.mode !== 'four-day' || cycle.plan[0] !== 'light' || cycle.originalOrderFrom) return;
  const lastDate = Object.keys(state.days).reduce((latest, date) => date > latest ? date : latest, localDate());
  const elapsed = (Date.parse(lastDate) - Date.parse(cycle.start)) / 86400000;
  const nextRound = Math.max(0, Math.floor(elapsed / FOUR_DAY_PLAN.length) + 1);
  const originalOrderFrom = dateAt(cycle.start, nextRound * FOUR_DAY_PLAN.length);
  save({ ...state, cycle: { ...cycle, originalOrderFrom } });
}

function cycleWindow(date) {
  const cycle = state.cycle;
  if (!cycle) return null;
  const repeated = cycle.mode === 'four-day';
  const elapsed = (Date.parse(date) - Date.parse(cycle.start)) / 86400000;
  const round = repeated ? Math.max(0, Math.floor(elapsed / cycle.plan.length)) : 0;
  const start = dateAt(cycle.start, round * cycle.plan.length);
  const plan = cycle.originalOrderFrom && start >= cycle.originalOrderFrom ? FOUR_DAY_PLAN : cycle.plan;
  return { start, round, repeated, plan };
}

function phaseAt(date) {
  const cycle = state.cycle;
  const window = cycleWindow(date);
  if (!window) return null;
  const index = window.plan.findIndex((_, i) => dateAt(window.start, i) === date);
  return index < 0 ? null : { index, key: window.plan[index], cycleId: cycle.id, ...window };
}

function menuIndexFor(phase) {
  if (!phase?.repeated) return null;
  // The old cycle starts on the original menu's second day.
  return (phase.index + (phase.plan[0] === 'light' ? 1 : 0)) % FOUR_DAY_MENU.length;
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

function cycleProgress(date = localDate()) {
  const window = cycleWindow(date);
  if (!window) return [];
  return window.plan.map((_, i) => {
    const entry = state.days[dateAt(window.start, i)];
    return entry?.cycleId === state.cycle.id && entry.checked;
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

function mealRows(index, foods = null) {
  const checked = new Map(foods?.map(item => [item.presetId, item.kcal]));
  const rows = FOUR_DAY_MENU[index].meals.flatMap(([meal, items]) => items.map(item => {
    const text = `<span><strong>${item.name}</strong><small class="muted">${meal} · ${item.portion}</small></span>
      <span class="meal-kcal">约 ${checked.get(item.id) ?? item.kcal} 大卡</span>`;
    return foods === null
      ? `<li class="row meal-row preview">${text}</li>`
      : `<li><label class="row meal-row">
          <input type="checkbox" id="preset-${item.id}" data-preset="${item.id}" ${checked.has(item.id) ? 'checked' : ''}>
          ${text}
        </label></li>`;
  }));
  return `<ul class="stack">${rows.join('')}</ul>`;
}

function today() {
  const day = dayAt(selectedDate);
  const phase = phaseAt(selectedDate);
  const progress = phase ? cycleProgress(selectedDate) : [];
  const completed = progress.filter(Boolean).length;
  const phaseTitle = PHASES[day.phase] || '自由记录';
  const cycleLabel = phase?.repeated ? `第 ${phase.round + 1} 轮` : '自订循环';
  const summary = phase ? `${cycleLabel} · 第 ${phase.index + 1} / ${progress.length} 天` : '选择日期，记录当天的饮食和感受';
  const menuIndex = menuIndexFor(phase);
  return `<h1>饮食打卡</h1>
    <label>记录日期<input id="selected-date" type="date" value="${selectedDate}" max="${localDate()}"></label>
    <section class="hero">
      <span class="pill">${day.checked ? '已打卡' : '待记录'}</span>
      <h2>${phaseTitle}</h2><p>${summary}</p>
      ${progress.length ? `<p>${completed === progress.length ? '本轮已完成' : `本轮已打卡 ${completed} / ${progress.length} 天`}</p>` : ''}
    </section>
    <section class="card today-totals">
      <div class="split"><h2>当天热量</h2><span class="muted">${day.foods.length} 项</span></div>
      ${totals(day.foods)}
    </section>
    ${menuIndex === null ? '' : `<section class="card">
      <div class="split"><h2>食谱打卡</h2><span class="muted">原帖第 ${menuIndex + 1} 天</span></div>
      ${mealRows(menuIndex, day.foods)}
      <p class="meal-note muted">勾选即按参考份量计入。份量不同时，可手动添加。</p>
    </section>`}
    <div class="actions"><a class="btn primary" href="#add">添加食物或饮品</a><a class="btn" href="#detail">明细和备注</a></div>
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
      <div>${escapeText(item.name)}<br><span class="muted">${item.kind === 'drink' ? '饮品' : '食物'} · ${item.kcal === null ? '热量待填' : `${item.presetId ? '约 ' : ''}${item.kcal} 大卡`}</span></div>
      <button type="button" data-action="remove-food" data-index="${current * PAGE_SIZE + i}" aria-label="移除 ${escapeText(item.name)}">移除</button>
    </li>`).join('')}</ul>` : '<p class="note">当天还没有饮食条目。</p>'}
    ${pagination('detail', current, pageCount)}
    <a class="btn block" href="#add">添加食物或饮品</a></section>
    <form class="card" id="note-form"><label>当天备注<textarea name="note" rows="2" maxlength="300" placeholder="记录感受或调整">${escapeText(day.note)}</textarea></label>
    <button type="submit" class="btn block">保存备注</button></form>`;
}

function plan() {
  const cycle = state.cycle;
  const window = cycleWindow(localDate());
  const progress = cycleProgress();
  const lastRecord = Object.keys(state.days).sort().pop();
  const earliest = lastRecord ? dateAt(lastRecord, 1) : '';
  const start = earliest > localDate() ? earliest : localDate();
  return `<h1>我的循环</h1>
    ${cycle ? `<section class="hero">
      <span class="pill">${progress.every(Boolean) ? '本轮已完成' : window.repeated ? `第 ${window.round + 1} 轮` : '自订循环'}</span>
      <h2>${window.repeated ? '四天循环' : `自订 ${cycle.plan.length} 天`}</h2>
      <p>${window.start} 至 ${dateAt(window.start, cycle.plan.length - 1)} · 已打卡 ${progress.filter(Boolean).length} / ${progress.length}</p>
      <ol class="dots" aria-label="每日打卡进度">${progress.map((done, i) =>
        `<li class="${done ? 'done' : ''}" aria-label="第 ${i+1} 天${done ? '已完成' : '未完成'}">${i+1}</li>`
      ).join('')}</ol>
      ${cycle.originalOrderFrom > localDate() ? `<p>${cycle.originalOrderFrom} 起按原帖日序开始新一轮。</p>` : ''}
    </section>` : ''}
    <section class="card">
      <h2>四天日序</h2>
      <ol class="stack" aria-label="四天循环日序">${FOUR_DAY_PLAN.map((key, i) =>
        `<li><a class="row split menu-link" href="#menu/${i}"><span>第 ${i+1} 天</span><strong>${PHASES[key]}</strong><span class="muted">食谱 ›</span></a></li>`
      ).join('')}</ol>
      <p class="note">第 5 天回到第 1 天的健康饮食。按日期轮转，漏打卡也照常排到下一天。</p>
      ${!window?.repeated ? `<form id="fixed-start-form">
        <label>开始日期<input name="start" type="date" required ${earliest ? `min="${earliest}"` : ''} value="${start}"></label>
        ${earliest ? '<p class="muted">新一轮从已有记录之后开始。</p>' : ''}
        <button class="primary block" type="submit">${cycle ? '改用四天循环' : '开始四天循环'}</button>
      </form>` : ''}
      ${cycle ? '<button class="btn block" type="button" data-action="end-cycle">结束循环</button>' : ''}
    </section>
    <a class="btn block" href="#edit-plan">自订日序</a>`;
}

function menu(page = 0) {
  const index = Math.min(page, FOUR_DAY_MENU.length - 1);
  const day = menuIndexFor(phaseAt(selectedDate)) === index ? dayAt(selectedDate) : null;
  return `<a class="back" href="#plan">‹ 返回循环</a><h1>第 ${index + 1} 天 · ${PHASES[FOUR_DAY_PLAN[index]]}</h1>
    ${day ? `<section class="card today-totals">
      <div class="split"><h2>当天热量</h2><span class="muted">${selectedDate}</span></div>
      ${totals(day.foods)}
    </section>` : ''}
    <section class="card">
      <h2>${day ? '食谱打卡' : '原帖食谱示例'}</h2>
      ${mealRows(index, day?.foods ?? null)}
      ${day ? '<p class="meal-note muted">勾选即按参考份量计入。</p>' : '<p class="meal-note muted">开始四天循环后，可在「今日」勾选对应日期的食谱。</p>'}
      <a class="btn block" href="${SOURCE}" target="_blank" rel="noopener noreferrer">查看小红书原帖</a>
      ${pagination('menu', index, FOUR_DAY_MENU.length)}
    </section>`;
}

function editPlan() {
  const cap = state.plan.length >= MAX_PHASES ? 'disabled' : '';
  const cycle = state.cycle;
  const end = cycle ? dateAt(cycle.start, cycle.plan.length - 1) : '';
  const canStart = cycle?.mode !== 'four-day' && (!cycle || end < localDate() || cycleProgress().every(Boolean));
  const start = end >= localDate() ? dateAt(end, 1) : localDate();
  return `<a class="back" href="#plan">‹ 返回循环</a><h1>自订日序</h1>
    <p class="muted">按顺序添加阶段，最多 ${MAX_PHASES} 天。设置会用于下一轮。</p>
    <div class="actions"><button type="button" data-action="add-regular" ${cap}>＋健康饮食</button><button type="button" data-action="add-light" ${cap}>＋轻断食</button></div>
    <ol class="stack">${state.plan.map((key, i) => `<li class="card row split">
      <div>第 ${i+1} 天 · ${PHASES[key]}</div>
      ${i > 0 ? `<button type="button" data-action="up-phase" data-index="${i}" aria-label="上移第 ${i+1} 天">↑</button>` : ''}
      <button type="button" data-action="remove-phase" data-index="${i}" aria-label="移除第 ${i+1} 天">移除</button>
    </li>`).join('')}</ol>
    ${!state.plan.length ? '<p class="note">还没有阶段，点击上面的按钮开始添加。</p>' : ''}
    ${canStart && state.plan.length >= 2 ? `<form class="card" id="start-form">
      <label>开始日期<input name="start" type="date" required ${cycle ? `min="${dateAt(end, 1)}"` : ''} value="${start}"></label>
      <button class="primary block" type="submit">开始自订循环</button>
    </form>` : ''}`;
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
      <p class="muted">日序和食谱示例来自八戒的小主（SAWYER）于 2025-10-25 发布的稳健版四日食谱。</p>
      <a class="btn block" href="${SOURCE}" target="_blank" rel="noopener noreferrer">查看小红书四日食谱</a>
      <a class="btn block" href="${FAQ}" target="_blank" rel="noopener noreferrer">查看作者答疑</a>
    </section>
    <details class="card">
      <summary>食谱热量怎么算</summary>
      <p class="meal-note muted">双吉和小杯冰美式按麦当劳中国标示的 1796 和 41 千焦换算（大卡 = 千焦 ÷ 4.184）。卷饼用同类烤鸡肉卷作参考，其余按食物成分表估算。</p>
      <ul class="stack muted">
        <li>轻食碗按熟鸡胸肉 100 克、熟糙米饭 120 克、熟西兰花 150 克、油 5 克计算。</li>
        <li>鸡公煲按带皮熟鸡腿肉 180 克、洋葱 50 克、青椒 50 克、油 10 克、酱油 15 克计算。</li>
        <li>火锅按熟牛肉 150 克、北豆腐 100 克、蔬菜 200 克、随食物摄入的油和蘸料油合计 10 克计算。</li>
      </ul>
      <ul class="stack muted">${NUTRITION_SOURCES.map(([name, url]) =>
        `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${name}</a></li>`
      ).join('')}</ul>
      <p class="meal-note muted">合计显示已记录的摄入量。外食的实际份量、食材和用油可能不同。</p>
    </details>
    <section class="card"><h2>添加到 iPhone 主屏幕</h2><p class="muted">用 Safari 打开本页，点「分享」→「添加到主屏幕」→「添加」。</p></section>
    <section class="card"><h2>本机存储</h2><p class="muted">饮食记录只保存在此浏览器。清除网站数据后会丢失。首次在线打开后可离线使用。</p></section>
    <p class="muted">个人记录工具 · 与原帖作者无关联</p>`;
}

const views = { today, add, detail, plan, menu, 'edit-plan': editPlan, records, about };

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
  const current = ({ add: 'today', detail: 'today', menu: 'plan', 'edit-plan': 'plan' })[route] || route;
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
  const presetId = event.target.dataset.preset;
  if (presetId) {
    const index = menuIndexFor(phaseAt(selectedDate));
    const preset = FOUR_DAY_MENU[index]?.meals.flatMap(([, items]) => items).find(item => item.id === presetId);
    if (!preset) return;
    const { foods } = dayAt(selectedDate);
    const checked = event.target.checked;
    const next = foods.filter(item => item.presetId !== presetId);
    if (checked) {
      const { name, kind, kcal } = preset;
      next.push(foods.find(item => item.presetId === presetId) || { name, kind, kcal, presetId });
    }
    if (updateDay(selectedDate, { foods: next })) {
      announce(`${checked ? '已计入' : '已取消'}${preset.name}，当天已记 ${kcal(next)} 大卡`);
    }
    render();
    document.getElementById(`preset-${presetId}`)?.focus({ preventScroll: true });
    return;
  }
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
      const completed = phaseAt(selectedDate) ? cycleProgress(selectedDate) : [];
      const finished = completed.length > 0 && completed.every(Boolean);
      announce(day.checked ? '已取消打卡' : finished ? '本轮循环已完成' : '已保存当天打卡');
    }
  } else if (action === 'remove-food') {
    if (!confirm('移除这项饮食记录？')) return;
    updateDay(selectedDate, { foods: day.foods.filter((_, i) => i !== Number(index)) });
  } else if (action === 'end-cycle') {
    if (!confirm('结束当前循环？已保存的每日记录会保留。')) return;
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
  } else if (form.id === 'start-form' || form.id === 'fixed-start-form') {
    const start = String(values.get('start'));
    const fixed = form.id === 'fixed-start-form';
    const days = fixed ? FOUR_DAY_PLAN : state.plan;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || dateAt(start, 0) !== start || days.length < 2) return;
    if (fixed && Object.keys(state.days).some(date => date >= start)) {
      announce('请选择已有记录之后的开始日期。');
      return;
    }
    const cycle = { start, id: crypto.randomUUID(), plan: [...days], mode: fixed ? 'four-day' : 'custom' };
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const today = localDate();
  if (today !== calendarDate && selectedDate === calendarDate && main.dataset.route === 'today') {
    selectDate(today);
    render(true);
  }
  calendarDate = today;
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

migrateFourDayOrder();
render(true);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => announce('暂时无法启用离线使用。'));
}
