'use strict';
// Dependency-free integration tests. The DOM adapter implements only the
// browser surface used by this feature; all state changes run through the
// actual core.js and weekly.js code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const decode = value => String(value).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const camel = value => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
class Element {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase(); this.attrs = attrs; this.children = []; this.listeners = {};
    this.dataset = {}; this.parentElement = null; this._value = attrs.value || ''; this.checked = 'checked' in attrs;
    this.open = false; this.hidden = false; this.textContent = ''; this.isConnected = true;
    for (const [key, value] of Object.entries(attrs)) if (key.startsWith('data-')) this.dataset[camel(key.slice(5))] = value;
    this.classList = {
      contains: name => (this.attrs.class || '').split(/\s+/).includes(name),
      add: name => { const values = new Set((this.attrs.class || '').split(/\s+/).filter(Boolean)); values.add(name); this.attrs.class = [...values].join(' '); },
      remove: name => { this.attrs.class = (this.attrs.class || '').split(/\s+/).filter(value => value !== name).join(' '); },
      toggle: (name, force) => { const next = force == null ? !this.classList.contains(name) : force; this.classList[next ? 'add' : 'remove'](name); return next; }
    };
  }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  set innerHTML(html) {
    this._html = html; this.children = [];
    const stack = [this], token = /<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g;
    let match;
    while ((match = token.exec(html))) {
      const piece = match[0];
      if (piece.startsWith('<!--')) continue;
      if (piece.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
      if (piece[0] !== '<') { stack[stack.length - 1].textContent += decode(piece); continue; }
      const tag = /^<([\w-]+)/.exec(piece)?.[1];
      if (!tag) continue;
      const attrs = {}, attr = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      attr.lastIndex = tag.length + 1;
      let found;
      while ((found = attr.exec(piece))) attrs[found[1]] = decode(found[2] ?? found[3] ?? found[4] ?? '');
      const node = new Element(tag, attrs); stack[stack.length - 1].appendChild(node);
      if (!/^(input|br|hr|img|meta|link)$/i.test(tag) && !piece.endsWith('/>')) stack.push(node);
    }
    for (const node of this.querySelectorAll('textarea')) node._value = node.textContent;
    for (const select of this.querySelectorAll('select')) {
      const options = select.querySelectorAll('option');
      const option = options.find(item => 'selected' in item.attrs) || options[0];
      if (option) select._value = option.attrs.value ?? option.textContent;
    }
  }
  get innerHTML() { return this._html || ''; }
  get value() { return this._value; }
  set value(value) { this._value = String(value); }
  get elements() { const out = {}; for (const node of this.querySelectorAll('input,select,textarea')) if (node.attrs.name) out[node.attrs.name] = node; return out; }
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(value => this.matches(value));
    if (selector[0] === '#') return this.attrs.id === selector.slice(1);
    if (selector[0] === '.') return this.classList.contains(selector.slice(1));
    if (selector[0] === '[') { const match = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector); return !!match && match[1] in this.attrs && (match[2] == null || this.attrs[match[1]] === match[2]); }
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { const out = []; const visit = node => { for (const child of node.children) { if (child.matches(selector)) out.push(child); visit(child); } }; visit(this); return out; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async fire(type, props = {}) {
    const event = { target: this, currentTarget: this, preventDefault() {}, ...props };
    for (const listener of this.listeners[type] || []) await listener(event);
    if (this['on' + type]) await this['on' + type](event);
  }
  focus() {}
  setCustomValidity(message) { this.validationMessage = message; }
  reportValidity() { return !this.validationMessage; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

function harness(saved) {
  const body = new Element('body');
  body.innerHTML = '<main id="root"></main><p id="save-status"></p><div id="toast"></div><dialog id="app-dialog"><h2 id="dialog-title"></h2><button id="dialog-close"></button><div id="dialog-body"></div></dialog><div id="print-root"></div>';
  const storage = new Map(saved ? [['curiousstride.workspace.v1', saved]] : []);
  const timers = new Set();
  const document = { body, activeElement: null, hidden: false, getElementById: id => body.querySelector('#' + id), addEventListener() {}, createElement: tag => new Element(tag) };
  const context = vm.createContext({
    console, Date, Math, JSON, Set, Map, URL, Blob, document, crypto: { randomUUID },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setTimeout: (fn, ms) => { const id = setTimeout(fn, ms); timers.add(id); return id; },
    clearTimeout: id => { clearTimeout(id); timers.delete(id); },
    FormData: class { constructor(form) { this.form = form; } get(name) { return this.form.elements[name]?.value ?? null; } }
  });
  context.window = context; context.addEventListener = () => {}; context.print = () => {};
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/core.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/weekly.js'), 'utf8'), context);
  const CS = context.CS, root = body.querySelector('#root');
  let route = 'weekly', cleanup;
  CS.render = () => { if (cleanup) cleanup(); cleanup = null; if (route === 'weekly') cleanup = CS.pages.weekly(root); };
  CS.navigate = value => { route = value; CS.render(); };
  CS.confirm = async () => true;
  CS.render();
  return {
    CS, root, storage, route: () => route,
    node: selector => { const node = body.querySelector(selector); assert.ok(node, 'Expected element ' + selector); return node; },
    set: async (selector, value) => { const node = body.querySelector(selector); assert.ok(node); node.value = value; await node.fire('input'); },
    close: () => { if (cleanup) cleanup(); for (const id of timers) clearTimeout(id); }
  };
}

async function addTask(h, title = 'Practise a technical skill', day = '1') {
  await h.node('#weekly-add').fire('click');
  await h.set('#weekly-task-title', title);
  await h.set('#weekly-task-day', day);
  await h.set('#weekly-task-time', '10:00');
  await h.set('#weekly-task-category', 'Learning');
  await h.node('#weekly-task-form').fire('submit');
  return h.CS.getWeek().tasks[0];
}

test('weekly activity lifecycle uses real storage, forms and state', async () => {
  const h = harness();
  try {
    const task = await addTask(h);
    assert.equal(task.title, 'Practise a technical skill'); assert.equal(task.day, 1); assert.equal(task.time, '10:00'); assert.equal(task.category, 'Learning');
    await h.node('[data-edit]').fire('click');
    await h.set('#weekly-task-title', 'Practise process simulation');
    await h.set('#weekly-task-day', '3');
    await h.node('#weekly-task-form').fire('submit');
    assert.equal(task.title, 'Practise process simulation'); assert.equal(task.day, 3);
    const complete = h.node('[data-complete]'); complete.checked = true; await complete.fire('change');
    assert.equal(task.done, true); assert.ok(h.node('.weekly-task').classList.contains('is-done'));
    const undo = h.node('[data-complete]'); undo.checked = false; await undo.fire('change'); assert.equal(task.done, false);
    await h.node('[data-edit]').fire('click'); await h.node('#weekly-delete-task').fire('click');
    assert.equal(h.CS.getWeek().tasks.length, 0);
  } finally { h.close(); }
});

test('dragging moves the existing activity; repeated carry does not duplicate it', async () => {
  const h = harness();
  try {
    const task = await addTask(h), originalId = task.id;
    const transfer = { setData() {}, effectAllowed: '', dropEffect: '' };
    await h.node('.weekly-task').fire('dragstart', { dataTransfer: transfer });
    await h.node('[data-day="4"]').fire('drop', { dataTransfer: transfer });
    assert.equal(task.day, 4); assert.equal(task.id, originalId);
    const oldWeek = h.CS.getWeek();
    const carry = h.node('#weekly-carry');
    await Promise.all([carry.fire('click'), carry.fire('click')]);
    assert.equal(oldWeek.tasks.length, 0);
    await h.node('#weekly-next').fire('click');
    const nextWeek = Object.values(h.CS.state.weeks).find(week => week.tasks.length);
    assert.equal(nextWeek.tasks.length, 1); assert.equal(nextWeek.tasks[0].id, originalId); assert.equal(nextWeek.tasks[0].day, 4);
  } finally { h.close(); }
});

test('priorities, reviews and tasks survive a storage reload with literal user text', async () => {
  const h = harness(); let restored;
  try {
    await h.set('#weekly-priority-0', 'Explore <a> new direction');
    await h.set('#weekly-review-4', 'I made room for rest & learning.');
    await addTask(h, 'Review "my" CV <today>', '0');
    h.CS.flush();
    restored = harness(h.storage.get(h.CS.storageKey));
    assert.equal(restored.CS.getWeek().priorities[0], 'Explore <a> new direction');
    assert.equal(restored.CS.getWeek().review[4], 'I made room for rest & learning.');
    assert.equal(restored.CS.getWeek().tasks[0].title, 'Review "my" CV <today>');
    assert.ok(restored.root.innerHTML.includes('Review &quot;my&quot; CV &lt;today&gt;'));
    assert.equal(restored.CS.storageError, undefined);
  } finally { restored?.close(); h.close(); }
});

test('planning from another tool keeps that tool open and uses this week', async () => {
  const h = harness();
  try {
    h.CS.navigate('career');
    h.CS.addWeeklyTask('Learn spreadsheet formulas', 'Learning');
    assert.equal(h.node('#weekly-task-title').value, 'Learn spreadsheet formulas');
    await h.node('#weekly-task-form').fire('submit');
    assert.equal(h.route(), 'career');
    assert.equal(h.CS.getWeek().tasks[0].category, 'Learning');
    assert.equal(h.CS.getWeek().tasks[0].title, 'Learn spreadsheet formulas');
  } finally { h.close(); }
});
