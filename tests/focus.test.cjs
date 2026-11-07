'use strict';

// No dependencies required: node tests/focus.test.cjs
// Exercises the timer against a deterministic clock without waiting in real time.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let now = 1000000;
let sequence = 0;
const intervals = new Map();
const NativeDate = Date;
class ClockDate extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}

const state = {
  focus: {
    settings: { focus: 1, short: 1, long: 1, sound: false, history: true },
    task: 'Read one chapter',
    sessions: []
  }
};
const CS = {
  state,
  pages: {},
  uid: () => String(++sequence),
  touch() {},
  toast() {},
  save: () => true,
  flush: () => true
};
const window = {
  CS,
  setInterval(fn) { const id = ++sequence; intervals.set(id, fn); return id; },
  clearInterval(id) { intervals.delete(id); },
  setTimeout: () => ++sequence,
  clearTimeout() {},
  addEventListener() {}
};
const context = {
  window,
  document: { addEventListener() {} },
  Date: ClockDate,
  Math,
  Number,
  String,
  console
};
vm.createContext(context);

// Expose closure functions only inside this isolated test VM. The delivered
// browser file stays unchanged and does not expose testing APIs.
const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'focus.js'), 'utf8');
assert.match(source, /\}\)\(\);\s*$/, 'Timer script must end with its IIFE.');
const instrumented = source.replace(/\}\)\(\);\s*$/, `
  window.timerTest = {
    toggle, tick, reset, ensureSource,
    remaining: () => remaining,
    running: () => running,
    setMode: value => { mode = value; reset(); }
  };
})();`);
vm.runInContext(instrumented, context, { filename: 'focus.js' });
const timer = window.timerTest;

function advance(milliseconds) {
  now += milliseconds;
  // A delayed browser callback must use the elapsed time, not one interval tick.
  for (const callback of [...intervals.values()]) callback();
}

timer.ensureSource();
assert.equal(timer.remaining(), 60000, 'Uses the configured focus duration.');
timer.toggle();
assert.equal(intervals.size, 1, 'Starting creates exactly one ticking interval.');
advance(15000);
assert.equal(timer.remaining(), 45000, 'A delayed tick accounts for elapsed time.');

timer.toggle();
assert.equal(timer.running(), false, 'Pausing stops the running session.');
assert.equal(intervals.size, 0, 'Pausing releases the ticking interval.');
advance(10000);
assert.equal(timer.remaining(), 45000, 'Paused time does not count against the session.');

timer.toggle();
assert.equal(intervals.size, 1, 'Resuming creates just one ticking interval.');
advance(45000);
assert.equal(state.focus.sessions.length, 1, 'A completed focus session is recorded.');
assert.equal(state.focus.sessions[0].task, 'Read one chapter', 'History retains the session task.');
assert.equal(state.focus.sessions[0].minutes, 1, 'History records the configured duration.');
assert.equal(intervals.size, 0, 'Completion releases the ticking interval.');
timer.tick();
assert.equal(state.focus.sessions.length, 1, 'A completed session cannot be recorded twice.');

timer.toggle();
assert.equal(timer.remaining(), 60000, 'Starting again restores the full duration.');
timer.reset();
assert.equal(timer.running(), false, 'Reset stops a running session.');
assert.equal(timer.remaining(), 60000, 'Reset restores the configured duration.');
assert.equal(intervals.size, 0, 'Reset releases the ticking interval.');

timer.setMode('short');
timer.toggle();
advance(60000);
assert.equal(state.focus.sessions.length, 1, 'Breaks are excluded from focus session history.');

state.focus.settings.history = false;
timer.setMode('focus');
timer.toggle();
advance(60000);
assert.equal(state.focus.sessions.length, 1, 'Turning history off prevents new history entries.');

timer.toggle();
CS.resetFocus();
assert.equal(intervals.size, 0, 'Workspace reset releases the ticking interval.');
assert.equal(timer.running(), false, 'Workspace reset stops an old session.');

console.log('PASS: focus timer elapsed time, pause/resume, completion, history controls, reset, and interval cleanup.');
