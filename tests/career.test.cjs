/* Run: node tests/career.test.cjs
 * Dependency-free integration checks of the real core and career event handlers.
 * A small DOM adapter supplies event targets; these are not browser layout tests.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor() { this.listeners = new Map(); this.innerHTML = ''; this.textContent = ''; this.value = ''; this.dataset = {}; this.children = new Map(); this.classList = {toggle() {}, add() {}, remove() {}}; this.elements = {url: {focus() {}}}; this.open = false; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, event = {}) { event.currentTarget = this; event.preventDefault ||= () => {}; for (const fn of [...(this.listeners.get(type) || [])]) fn(event); if (typeof this['on' + type] === 'function') this['on' + type](event); }
  querySelector(selector) { if (!this.children.has(selector)) this.children.set(selector, new Element()); return this.children.get(selector); }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  focus() {}
  click() { this.emit('click'); }
  remove() {}
}

const nodes = new Map();
const document = {
  getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
  addEventListener() {}, removeEventListener() {}, hidden: false,
  createElement() { return new Element(); }, body: {appendChild() {}}, activeElement: null
};
const storage = new Map();
let counter = 0;
const sandbox = {
  document, console, URL, Blob, Date, Math, JSON, Object, Array, String, Number, Set, RegExp, Promise,
  setTimeout, clearTimeout,
  crypto: {randomUUID: () => 'test-' + (++counter)},
  localStorage: {getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)},
  FormData: class { constructor(form) { this.values = Object.entries(form.values); } [Symbol.iterator]() { return this.values[Symbol.iterator](); } },
  addEventListener() {}, removeEventListener() {}, print() {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);
const rootPath = path.resolve(__dirname, '..');
vm.runInContext(fs.readFileSync(path.join(rootPath, 'js/core.js'), 'utf8'), sandbox, {filename: 'core.js'});
vm.runInContext(fs.readFileSync(path.join(rootPath, 'js/career.js'), 'utf8'), sandbox, {filename: 'career.js'});
const CS = sandbox.CS;
const root = new Element();
let modal, dispose, confirmResult = true, confirmationCount = 0, planned;
CS.modal = (title, html, onMount) => { modal = new Element(); modal.title = title; modal.innerHTML = html; if (onMount) onMount(modal); };
CS.closeModal = () => {};
CS.confirm = async () => { confirmationCount++; return confirmResult; };
CS.toast = () => {};
CS.addWeeklyTask = (title, category) => { planned = {title, category}; };
CS.render = () => { if (dispose) dispose(); dispose = CS.pages.career(root); };
CS.render();

function click(action, id) {
  const target = {dataset: {careerAction: action, id}, closest: selector => selector === '[data-career-action]' ? target : null};
  root.emit('click', {target});
}
function selectTab(tab) {
  const target = {dataset: {careerTab: tab}, closest: selector => selector === '[data-career-tab]' ? target : null};
  root.emit('click', {target});
}
function submit(values) { const form = modal.querySelector('form'); form.values = values; form.emit('submit'); }
function input(id, value, dataset = {}) {
  root.emit('input', {target: {id, value, dataset, matches: s => s === '[data-exploration-answer]' && dataset.explorationAnswer !== undefined}});
}
function change(id, value, dataset = {}) {
  root.emit('change', {target: {id, value, dataset, matches: s => (s === '[data-application-status]' && dataset.applicationStatus !== undefined) || (s === '[data-skill-status]' && dataset.skillStatus !== undefined)}});
}
const nextTick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  assert.match(root.innerHTML, /Your career journey starts here/);
  assert.doesNotMatch(root.innerHTML, /Saved opportunities/);
  click('add-application');
  const values = {company: 'Test & Sons', title: 'Graduate <Engineer>', status: 'Interested', date: '', location: '', url: '', interview: '', notes: ''};
  submit(values);
  assert.equal(CS.state.applications.length, 1);
  assert.match(root.innerHTML, /Graduate &lt;Engineer&gt;/);
  assert.match(root.innerHTML, /Test &amp; Sons/);
  const appId = CS.state.applications[0].id;
  click('edit-application', appId);
  submit({...values, status: 'Interview', date: '2026-11-07', location: 'Dubai', url: 'https://example.com/role', interview: '2026-11-09T10:00', notes: 'Prepare two examples.'});
  assert.equal(CS.state.applications[0].status, 'Interview');
  assert.equal(CS.state.applications[0].notes, 'Prepare two examples.');
  click('details', appId);
  assert.match(modal.innerHTML, /rel="noopener noreferrer"/);
  assert.match(modal.innerHTML, /https:\/\/example.com\/role/);
  click('edit-application', appId);
  submit({...values, url: 'javascript:alert(1)'});
  assert.match(modal.querySelector('#career-form-error').textContent, /http/);
  assert.equal(CS.state.applications[0].url, 'https://example.com/role');
  click('view-board');
  assert.equal((root.innerHTML.match(/class="career-board-column"/g) || []).length, 7);
  change('', 'Offer received', {applicationStatus: appId});
  assert.equal(CS.state.applications[0].status, 'Offer received');
  input('career-search', 'no-match');
  assert.match(root.querySelector('#career-applications-content').innerHTML, /No matching opportunities/);
  click('clear-filters');
  change('career-filter', 'Rejected');
  assert.match(root.querySelector('#career-applications-content').innerHTML, /No matching opportunities/);
  click('clear-filters');

  selectTab('skills'); click('add-skill');
  submit({name: 'Excel', reason: 'Understand data.', target: '2026-12-01', status: 'Not started'});
  assert.equal(CS.state.skills.length, 1);
  const skillId = CS.state.skills[0].id;
  change('', 'In progress', {skillStatus: skillId});
  assert.equal(CS.state.skills[0].status, 'In progress');
  click('edit-skill', skillId);
  submit({name: 'Excel analysis', reason: 'Build a small model.', target: '', status: 'Completed'});
  assert.equal(CS.state.skills[0].name, 'Excel analysis');
  click('plan-skill', skillId);
  assert.deepEqual(planned, {title: 'Practise Excel analysis', category: 'Learning'});

  selectTab('explore');
  input('', 'Thermodynamics', {explorationAnswer: '0'});
  assert.equal(CS.state.exploration.answers[0], 'Thermodynamics');
  click('add-idea'); submit({type: 'Role', title: 'Process engineer', notes: 'Learn about daily work.'});
  assert.equal(CS.state.exploration.items.length, 1);
  const ideaId = CS.state.exploration.items[0].id;
  click('edit-idea', ideaId); submit({type: 'Industry', title: 'Renewable energy', notes: 'Explore entry roles.'});
  assert.equal(CS.state.exploration.items[0].type, 'Industry');
  click('plan-idea', ideaId);
  assert.deepEqual(planned, {title: 'Explore: Renewable energy', category: 'Career'});
  CS.flush();
  const restored = CS.validate(JSON.parse(storage.get(CS.storageKey)));
  assert.equal(restored.applications[0].company, 'Test & Sons');
  assert.equal(restored.skills[0].status, 'Completed');
  assert.equal(restored.exploration.answers[0], 'Thermodynamics');
  assert.equal(restored.exploration.items[0].title, 'Renewable energy');
  const backup = CS.backup();
  assert.equal(backup.app, 'CuriousStride');
  assert.equal(CS.validate(backup.data).applications.length, 1);

  confirmResult = false;
  click('delete-idea', ideaId); await nextTick();
  assert.equal(CS.state.exploration.items.length, 1);
  confirmResult = true;
  click('delete-idea', ideaId); await nextTick();
  assert.equal(CS.state.exploration.items.length, 0);
  selectTab('skills'); click('delete-skill', skillId); await nextTick();
  assert.equal(CS.state.skills.length, 0);
  selectTab('applications'); click('delete-application', appId); await nextTick();
  assert.equal(CS.state.applications.length, 0);
  assert.equal(confirmationCount, 4);
  CS.flush(); if (dispose) dispose();
  console.log('PASS career: application CRUD, safe links, escaped text, seven-stage board, search/filter, skill CRUD/status/planning, career prompt saving, possibility CRUD/planning, cancelled deletion, and storage validation round trip.');
})().catch(error => {console.error(error); process.exitCode = 1;});
