'use strict';

// Dependency-free behavioral integration tests. A small event/markup fixture
// exercises the production core and Clarity code; it is not a browser or a
// layout/accessibility audit. Run with: node --test tests/clarity.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { randomUUID } = require('node:crypto');

const coreSource = fs.readFileSync(path.join(__dirname, '../js/core.js'), 'utf8');
const claritySource = fs.readFileSync(path.join(__dirname, '../js/clarity.js'), 'utf8');
const storageKey = 'curiousstride.workspace.v1';
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'"
}[entity]));

class EventTargetFixture {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
  async emit(type, event = {}) {
    for (const listener of Array.from(this.listeners.get(type) || [])) await listener(event);
  }
}

class ElementFixture extends EventTargetFixture {
  constructor(tag = 'div', attrs = {}, value = '') {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.id = attrs.id || '';
    this.dataset = Object.fromEntries(Object.entries(attrs)
      .filter(([key]) => key.startsWith('data-'))
      .map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase()), value]));
    this.value = value;
    this.textContent = '';
    this.disabled = Object.hasOwn(attrs, 'disabled');
    this.hidden = false;
    this.isConnected = true;
    this.children = [];
    const classes = new Set((attrs.class || '').split(/\s+/));
    this.classList = {
      toggle: (name, force) => {
        const enabled = force === undefined ? !classes.has(name) : Boolean(force);
        if (enabled) classes.add(name); else classes.delete(name);
        return enabled;
      },
      contains: name => classes.has(name)
    };
  }
  set innerHTML(html) {
    this.html = html;
    this.children = [];
    const tags = /<(button|textarea|input)\b([^>]*)>/g;
    for (const match of html.matchAll(tags)) {
      const attrs = {};
      for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = decode(attr[2] || '');
      let value = attrs.value || '';
      if (match[1] === 'textarea') {
        const start = match.index + match[0].length;
        value = decode(html.slice(start, html.indexOf('</textarea>', start)));
      }
      this.children.push(new ElementFixture(match[1], attrs, value));
    }
  }
  get innerHTML() { return this.html || ''; }
  querySelector(selector) {
    if (selector.startsWith('#')) return this.children.find(child => child.id === selector.slice(1)) || null;
    const attr = selector.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) return this.children.find(child => Object.hasOwn(child.attrs, attr[1]) && (attr[2] === undefined || child.attrs[attr[1]] === attr[2])) || null;
    return this.children.find(child => child.tagName.toLowerCase() === selector) || null;
  }
  contains(element) { return this.children.includes(element); }
  closest(selector) { return selector.toUpperCase() === this.tagName ? this : null; }
  focus() { this.focused = true; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
}

function makeClock() {
  let now = 0;
  let nextId = 1;
  const pending = new Map();
  return {
    setTimeout(callback, delay = 0) {
      const id = nextId++;
      pending.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { pending.delete(id); },
    tick(ms) {
      const target = now + ms;
      let next;
      while ((next = Array.from(pending.entries()).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]) && next[1].at <= target) {
        now = next[1].at;
        pending.delete(next[0]);
        next[1].callback();
      }
      now = target;
    }
  };
}

function createHarness(storage = new Map()) {
  const clock = makeClock();
  const root = new ElementFixture();
  const windowEvents = new EventTargetFixture();
  const document = new EventTargetFixture();
  const elements = new Map();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new ElementFixture('div', { id }));
    return elements.get(id);
  };
  let printCalls = 0;
  const context = vm.createContext({
    console, Date, URL, Blob, crypto: { randomUUID },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    removeEventListener: windowEvents.removeEventListener.bind(windowEvents),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value)
    },
    document,
    print: () => printCalls++
  });
  context.window = context;
  vm.runInContext(coreSource, context, { filename: 'core.js' });
  vm.runInContext(claritySource, context, { filename: 'clarity.js' });
  const CS = context.CS;
  const confirmations = [];
  const decisions = [];
  const handoffs = [];
  CS.confirm = async message => {
    confirmations.push(message);
    assert.ok(decisions.length, 'Each delete action must receive an explicit test decision');
    return decisions.shift();
  };
  CS.addWeeklyTask = (title, category) => handoffs.push({ title, category });
  CS.navigate = () => {};
  let cleanup = CS.pages.clarity(root);
  CS.render = () => { cleanup(); cleanup = CS.pages.clarity(root); };

  return {
    CS, root, clock, storage, confirmations, decisions, handoffs,
    get printed() { return printCalls; },
    printHTML: () => document.getElementById('print-root').innerHTML,
    async click(selector) {
      const button = root.querySelector(selector);
      assert.ok(button, `Expected visible control ${selector}`);
      assert.equal(button.disabled, false, `Control ${selector} must be enabled`);
      await root.emit('click', { target: button });
    },
    async type(id, value) {
      const field = root.querySelector('#' + id);
      assert.ok(field, `Expected visible field ${id}`);
      field.value = value;
      await root.emit('input', { target: field });
    },
    field: id => root.querySelector('#' + id),
    stored: () => JSON.parse(storage.get(storageKey)),
    pagehide: () => windowEvents.emit('pagehide'),
    dispose: () => cleanup()
  };
}

test('all four categories create separate valid optional reflections', async () => {
  const h = createHarness();
  assert.match(h.root.innerHTML, /A fresh page is waiting/);
  for (let category = 0; category < 4; category++) {
    await h.click(`[data-category="${category}"]`);
    const record = h.CS.state.reflections[0];
    assert.equal(record.category, category);
    assert.equal(record.complete, false);
    assert.deepEqual(Array.from(record.answers), ['', '', '', '', '']);
    assert.match(h.root.innerHTML, /Question 1 of 5/);
    await h.click('[data-clarity="library"]');
  }
  assert.equal(new Set(h.CS.state.reflections.map(record => record.id)).size, 4);
  assert.equal(h.CS.validate(h.CS.state).reflections.length, 4);
  h.dispose();
});

test('autosaved text survives a fresh app instance and continuation preserves skipped answers', async () => {
  const storage = new Map();
  const h = createHarness(storage);
  await h.click('[data-category="0"]');
  await h.type('clarity-answer', 'Finding my footing after university.');
  h.clock.tick(600);
  assert.equal(h.stored().reflections[0].answers[0], 'Finding my footing after university.');
  const id = h.CS.state.reflections[0].id;
  h.dispose();

  const resumed = createHarness(storage);
  await resumed.click(`[data-open="${id}"]`);
  assert.match(resumed.root.innerHTML, /Question 2 of 5/);
  await resumed.click('[data-clarity="previous"]');
  assert.equal(resumed.field('clarity-answer').value, 'Finding my footing after university.');
  await resumed.type('clarity-answer', 'A small revision.');
  await resumed.click('[data-clarity="next"]');
  await resumed.click('[data-clarity="next"]');
  assert.match(resumed.root.innerHTML, /Question 3 of 5/);
  assert.equal(resumed.CS.state.reflections[0].answers[1], '');
  assert.equal(resumed.stored().reflections[0].answers[0], 'A small revision.');
  resumed.dispose();
});

test('pagehide and route cleanup flush the most recent keystrokes without waiting for debounce', async () => {
  const h = createHarness();
  await h.click('[data-category="1"]');
  await h.type('clarity-answer', 'Typed immediately before closing.');
  await h.pagehide();
  assert.equal(h.stored().reflections[0].answers[0], 'Typed immediately before closing.');
  await h.type('clarity-answer', 'Typed immediately before switching tools.');
  h.dispose();
  assert.equal(h.stored().reflections[0].answers[0], 'Typed immediately before switching tools.');
});

test('summary, editing, PDF handoff, completion and weekly handoff retain exact text safely', async () => {
  const h = createHarness();
  const answer = '<img src=x onerror="alert(1)">\nA little more direction & space.';
  await h.click('[data-category="2"]');
  await h.type('clarity-answer', answer);
  for (let index = 0; index < 5; index++) await h.click('[data-clarity="next"]');
  assert.match(h.root.innerHTML, /A moment of clarity/);
  assert.equal((h.root.innerHTML.match(/class="clarity-summary-answer"/g) || []).length, 5);
  assert.match(h.root.innerHTML, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(h.root.innerHTML, /<img src=x/);
  assert.equal(h.root.querySelector('[data-clarity="plan"]').disabled, true);
  await h.type('clarity-focus', 'Research environmental engineering roles.');
  await h.click('[data-clarity="plan"]');
  assert.deepEqual(h.handoffs, [{ title: 'Research environmental engineering roles.', category: 'Personal' }]);
  await h.click('[data-clarity="print"]');
  assert.equal(h.printed, 1);
  assert.match(h.printHTML(), /Research environmental engineering roles/);
  assert.doesNotMatch(h.printHTML(), /<img src=x/);
  await h.click('[data-step="0"]');
  assert.equal(h.field('clarity-answer').value, answer);
  await h.type('clarity-answer', 'Updated perspective.');
  for (let index = 0; index < 5; index++) await h.click('[data-clarity="next"]');
  await h.click('[data-clarity="finish"]');
  const record = h.CS.state.reflections[0];
  assert.equal(record.complete, true);
  assert.equal(record.answers[0], 'Updated perspective.');
  await h.click(`[data-open="${record.id}"]`);
  assert.match(h.root.innerHTML, /A moment of clarity/);
  assert.equal(h.field('clarity-focus').value, 'Research environmental engineering roles.');
  h.dispose();
});

test('deletion waits for confirmation, preserves cancellation, and does not remove other reflections', async () => {
  const h = createHarness();
  await h.click('[data-category="0"]');
  const firstId = h.CS.state.reflections[0].id;
  await h.click('[data-clarity="library"]');
  await h.click('[data-category="3"]');
  const secondId = h.CS.state.reflections[0].id;
  await h.click('[data-clarity="library"]');
  h.decisions.push(false);
  await h.click(`[data-delete="${firstId}"]`);
  assert.equal(h.CS.state.reflections.length, 2);
  h.decisions.push(true);
  await h.click(`[data-delete="${firstId}"]`);
  assert.equal(h.confirmations.length, 2);
  assert.equal(h.CS.state.reflections.length, 1);
  assert.equal(h.CS.state.reflections[0].id, secondId);
  h.clock.tick(300);
  assert.equal(h.stored().reflections[0].id, secondId);
  h.dispose();
});

test('reflection backup roundtrip uses the production schema and rejects malformed data atomically', async () => {
  const h = createHarness();
  await h.click('[data-category="3"]');
  await h.type('clarity-answer', 'Explore research and development.');
  await h.click('[data-clarity="library"]');
  const backup = JSON.parse(JSON.stringify(h.CS.backup()));
  const restored = createHarness();
  assert.equal(restored.CS.restore(backup), true);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.CS.state.reflections)), backup.data.reflections);
  assert.deepEqual(restored.stored().reflections, backup.data.reflections);
  const invalid = JSON.parse(JSON.stringify(backup));
  invalid.data.reflections[0].category = 99;
  assert.throws(() => restored.CS.restore(invalid), /not a valid CuriousStride/);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.CS.state.reflections)), backup.data.reflections);
  const badAnswers = JSON.parse(JSON.stringify(backup));
  badAnswers.data.reflections[0].answers = ['Only one prompt'];
  assert.throws(() => restored.CS.restore(badAnswers), /not a valid CuriousStride/);
  h.dispose(); restored.dispose();
});
