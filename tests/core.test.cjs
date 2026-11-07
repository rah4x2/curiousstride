'use strict';
// Tests the production storage/validation/dialog helpers, using no browser packages.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/core.js'),'utf8');
function setup(saved){
  const timers=new Map(),events={},elements=new Map(),closeEvents=[];
  let id=0,writes=0,stored=saved||null,unavailable=false;
  function el(name){if(elements.has(name))return elements.get(name);const e={textContent:'',innerHTML:'',hidden:false,open:false,isConnected:true,classList:{toggle(){}},addEventListener(t,f){(this.listeners||={})[t]=f;},querySelector(s){return el(s);},focus(){},showModal(){this.open=true;},close(){this.open=false;closeEvents.push(()=>this.listeners?.close?.());}};elements.set(name,e);return e;}
  const doc={hidden:false,activeElement:el('active'),getElementById:el,addEventListener:(t,f)=>events['doc:'+t]=f};
  const context={console,document:doc,Date,Math,Number,JSON,URL,Blob,Set,Map,Error,String,Object,Array,Promise,crypto:require('node:crypto').webcrypto,setTimeout:f=>{timers.set(++id,f);return id;},clearTimeout:n=>timers.delete(n),localStorage:{getItem(){if(unavailable)throw Error('blocked');return stored;},setItem(k,v){if(unavailable)throw Error('quota');stored=v;writes++;}},addEventListener:(t,f)=>events[t]=f};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);context.CS.render=()=>{};context.CS.navigate=()=>{};
  return {CS:context.CS,events,el,doc,flushTimers(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn());},closeQueue(){closeEvents.splice(0).forEach(fn=>fn());},get stored(){return stored;},get writes(){return writes;},setUnavailable(){unavailable=true;}};
}
test('storage debounces, flushes on exit, and does not rewrite on later exits without changes',()=>{
  const h=setup();h.CS.state.focus.task='A small step';h.CS.save();h.CS.save();assert.equal(h.writes,0);h.events.pagehide();assert.equal(h.writes,1);assert.equal(JSON.parse(h.stored).focus.task,'A small step');h.events.pagehide();assert.equal(h.writes,1);
});
test('external-change lock cancels pending writes and preserves the in-memory backup',()=>{
  const h=setup();h.CS.state.focus.task='Unsaved work';h.CS.save();h.CS.lockSaving();h.flushTimers();h.events.pagehide();assert.equal(h.writes,0);assert.equal(h.CS.backup().data.focus.task,'Unsaved work');assert.equal(h.CS.flush(),false);assert.equal(h.writes,0);const copy=JSON.parse(JSON.stringify(h.CS.backup()));assert.equal(h.CS.restore(copy),true);assert.equal(h.writes,1);
});
test('malformed local data is preserved and cannot be silently overwritten',()=>{
  const h=setup('{broken original');assert.match(h.CS.storageError,/could not be read/);h.CS.save();h.flushTimers();assert.equal(h.stored,'{broken original');assert.equal(h.writes,0);let recovered;h.CS.download=(name,text)=>recovered=text;h.CS.exportOriginal();assert.equal(recovered,'{broken original');h.CS.clear();assert.equal(JSON.parse(h.stored).version,1);
});
test('storage failure is reported while export stays available',()=>{
  const h=setup();h.setUnavailable();h.CS.state.focus.task='Keep me';assert.equal(h.CS.flush(),false);assert.match(h.CS.storageError,/unavailable or full/);assert.match(h.el('save-status').textContent,/Unable to save/);assert.equal(h.CS.backup().data.focus.task,'Keep me');
});
test('backup validation is atomic, rejects unsafe fields, and round-trips Unicode',()=>{
  const h=setup();h.CS.state.focus.task='مرحبا 🌱';const good=JSON.parse(JSON.stringify(h.CS.backup()));h.CS.restore(good);assert.equal(h.CS.state.focus.task,'مرحبا 🌱');
  const bad=JSON.parse(JSON.stringify(good));bad.data.focus.settings.focus=-1;assert.throws(()=>h.CS.restore(bad));assert.equal(h.CS.state.focus.task,'مرحبا 🌱');
  const future=JSON.parse(JSON.stringify(good));future.data.version=2;assert.throws(()=>h.CS.restore(future));
  const unsafe=JSON.parse(JSON.stringify(good));unsafe.data.applications=[{id:'a',company:'X',title:'Y',date:'',location:'',url:'javascript:alert(1)',status:'Interested',interview:'',notes:'',createdAt:'',updatedAt:''}];assert.throws(()=>h.CS.restore(unsafe));
  const pollution=JSON.parse(JSON.stringify(good));pollution.data.weeks=JSON.parse('{"__proto__":{}}');assert.throws(()=>h.CS.restore(pollution));assert.equal({}.polluted,undefined);
});
test('queued close events do not cancel the next confirmation dialog',async()=>{
  const h=setup();h.CS.modal('Editor','');h.CS.closeModal();const decision=h.CS.confirm('Delete?');h.closeQueue();assert.equal(h.el('app-dialog').open,true);h.el('#confirm-yes').onclick();h.closeQueue();assert.equal(await decision,true);
  const cancelled=h.CS.confirm('Delete again?');h.el('#confirm-no').onclick();h.closeQueue();assert.equal(await cancelled,false);
});
test('interview dates format with time and week keys remain Monday',()=>{
  const h=setup();assert.ok(h.CS.formatDate('2026-11-07T10:00',{dateStyle:'medium',timeStyle:'short'}));assert.equal(h.CS.weekKey('2026-11-08'),'2026-11-02');assert.equal(h.CS.weekKey('2026-11-09'),'2026-11-09');
});
