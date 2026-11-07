(function () {
  'use strict';
  const KEY = 'curiousstride.workspace.v1';
  const empty = () => ({version:1,reflections:[],applications:[],skills:[],exploration:{answers:['','','','',''],items:[]},weeks:{},focus:{settings:{focus:25,short:5,long:15,sound:false,history:true},task:'',sessions:[]},activity:[]});
  const CS = window.CS = {pages:{}, storageKey:KEY};
  const routes = ['home','clarity','career','weekly','focus'];
  CS.esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  CS.uid = () => window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  CS.today = () => localDate(new Date());
  function localDate(d) {return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
  CS.formatDate = (value,opts) => {const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? value+'T12:00:00' : value); return isNaN(d) ? '' : opts?.timeStyle ? d.toLocaleString(undefined,opts) : d.toLocaleDateString(undefined,opts || {month:'short',day:'numeric',year:'numeric'});};
  CS.weekKey = (d=new Date()) => {d = new Date(typeof d === 'string' && d.length===10 ? d+'T12:00:00' : d); d.setDate(d.getDate()-((d.getDay()+6)%7)); return localDate(d);};
  let state=empty(), blocked=false, original='', saveTimer=null;
  Object.defineProperty(CS,'state',{get:()=>state});
  CS.getWeek = (key=CS.weekKey()) => state.weeks[key] || (state.weeks[key]={priorities:['','',''],tasks:[],review:['','','','','']});

  // Rebuild imported data from known fields; no arbitrary properties enter the workspace.
  function validate(raw) {
    const fail = () => {throw new Error('This is not a valid CuriousStride v1 backup. Your current workspace has not changed.');};
    const obj = x => x && typeof x==='object' && !Array.isArray(x);
    const str = (s,max=50000) => {if(typeof s!=='string'||s.length>max)fail();return s;};
    const num=(n,min,max)=>{if(!Number.isFinite(n)||n<min||n>max)fail();return n;};
    const bool=b=>{if(typeof b!=='boolean')fail();return b;};
    const list=(a,fn,max=10000)=>{if(!Array.isArray(a)||a.length>max)fail();return a.map(fn);};
    const enumVal=(v,values)=>{if(!values.includes(v))fail();return v;};
    const fields=(x,keys)=>{if(!obj(x))fail();const out={};keys.forEach(k=>out[k]=str(x[k]));return out;};
    const fixed=(x,n)=>{if(!Array.isArray(x)||x.length!==n)fail();return x.map(v=>str(v));};
    const date=s=>{str(s,40);if(s&&!Number.isFinite(new Date(s).getTime()))fail();return s;};
    const unique=arr=>{const ids=new Set();arr.forEach(x=>{if(!x.id||ids.has(x.id))fail();ids.add(x.id);});return arr;};
    if(!obj(raw)||raw.version!==1)fail();
    const out=empty();
    out.reflections=unique(list(raw.reflections,x=>{const r=fields(x,['id','focus','createdAt','updatedAt']);r.category=num(x.category,0,3);if(!Number.isInteger(r.category))fail();r.answers=fixed(x.answers,5);r.complete=bool(x.complete);date(r.createdAt);date(r.updatedAt);return r;}));
    out.applications=unique(list(raw.applications,x=>{const r=fields(x,['id','company','title','date','location','url','interview','notes','createdAt','updatedAt']);r.status=enumVal(x.status,['Interested','Preparing application','Applied','Interview','Offer received','Rejected','Withdrawn']);if(r.url){try{if(!['http:','https:'].includes(new URL(r.url).protocol))fail();}catch(e){fail();}}date(r.date);date(r.interview);return r;}));
    out.skills=unique(list(raw.skills,x=>{const r=fields(x,['id','name','reason','target','createdAt','updatedAt']);r.status=enumVal(x.status,['Not started','In progress','Completed']);date(r.target);return r;}));
    if(!obj(raw.exploration))fail();out.exploration.answers=fixed(raw.exploration.answers,5);
    out.exploration.items=unique(list(raw.exploration.items,x=>{const r=fields(x,['id','title','notes']);r.type=enumVal(x.type,['Industry','Role','Question']);return r;}));
    if(!obj(raw.weeks)||Object.keys(raw.weeks).length>5200)fail();
    for(const [k,w] of Object.entries(raw.weeks)){if(!/^\d{4}-\d{2}-\d{2}$/.test(k)||CS.weekKey(k)!==k||!obj(w))fail();out.weeks[k]={priorities:fixed(w.priorities,3),review:fixed(w.review,5),tasks:unique(list(w.tasks,x=>{const r=fields(x,['id','title','time']);r.day=num(x.day,0,6);if(!Number.isInteger(r.day))fail();if(r.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))fail();r.category=enumVal(x.category,['Career','Learning','Personal','Health and wellbeing','Relationships','Other']);r.done=bool(x.done);return r;}))};}
    if(!obj(raw.focus)||!obj(raw.focus.settings))fail();out.focus.task=str(raw.focus.task);const s=raw.focus.settings;
    out.focus.settings={focus:num(s.focus,1,180),short:num(s.short,1,180),long:num(s.long,1,180),sound:bool(s.sound),history:bool(s.history)};
    out.focus.sessions=unique(list(raw.focus.sessions,x=>{const r=fields(x,['id','task','completedAt']);date(r.completedAt);r.minutes=num(x.minutes,0,180);return r;}));
    out.activity=unique(list(raw.activity,x=>{const r=fields(x,['id','label','at']);date(r.at);r.route=enumVal(x.route,routes);return r;},30));
    return out;
  }
  CS.validate=validate;
  try {original=localStorage.getItem(KEY)||'';if(original)state=validate(JSON.parse(original));} catch(e) {blocked=Boolean(original);CS.storageError=blocked?'Your saved workspace could not be read. Export the original data before restoring a backup or clearing this workspace.':'Saving is unavailable in this browser. You can still work here and download a backup before closing.';}
  function status(message,error=false){const el=document.getElementById('save-status');if(el){el.textContent=message;el.classList.toggle('save-error',error);}}
  function persist(){clearTimeout(saveTimer);saveTimer=null;if(blocked){status('Unable to save · export your work',true);return false;}try{localStorage.setItem(KEY,JSON.stringify(state));status('Saved on this device');return true;}catch(e){status('Unable to save · export your work',true);CS.storageError='Browser storage is unavailable or full. Download a backup from Settings & your data before closing.';CS.showStorageError?.();return false;}}
  CS.save=()=>{status('Saving…');clearTimeout(saveTimer);saveTimer=setTimeout(persist,250);return !blocked;};
  CS.flush=persist;
  CS.lockSaving=()=>{clearTimeout(saveTimer);saveTimer=null;blocked=true;status('Saving paused · another tab changed',true);};
  CS.touch=(label,route)=>{state.activity.unshift({id:CS.uid(),label,route:routes.includes(route)?route:'home',at:new Date().toISOString()});state.activity=state.activity.slice(0,30);CS.save();};
  window.addEventListener('pagehide',()=>{if(saveTimer)persist();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&saveTimer)persist();});
  CS.backup=()=>({app:'CuriousStride',version:1,exportedAt:new Date().toISOString(),data:state});
  CS.download=(filename,text,type='application/json')=>{const a=document.createElement('a');const url=URL.createObjectURL(new Blob([text],{type}));a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);};
  CS.exportData=()=>CS.download('curiousstride-backup-'+CS.today()+'.json',JSON.stringify(CS.backup(),null,2));
  CS.exportOriginal=()=>CS.download('curiousstride-recovery.json',original);
  CS.restore=raw=>{const next=validate(raw?.app==='CuriousStride'?raw.data:raw);clearTimeout(saveTimer);state=next;blocked=false;CS.storageError='';CS.resetFocus?.();const ok=persist();CS.showStorageError?.();CS.render();return ok;};
  CS.clear=()=>{clearTimeout(saveTimer);state=empty();blocked=false;original='';CS.storageError='';CS.resetFocus?.();const ok=persist();CS.showStorageError?.();CS.navigate('home');return ok;};

  const paths={home:'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',clarity:'M12 3a7 7 0 0 0-4 12.74V18h8v-2.26A7 7 0 0 0 12 3ZM9 21h6M10 8c.5-1 1.5-1.5 2.5-1.5',career:'M8 7V4h8v3M3 7h18v13H3ZM3 11a22 22 0 0 0 18 0M10 11v4h4v-4',weekly:'M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h1M15 14h1M8 17h1',focus:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',arrow:'M5 12h14m-5-5 5 5-5 5',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',chevron:'m9 5 7 7-7 7',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',edit:'m15 3 6 6-12 12H3v-6ZM13 5l6 6',x:'m6 6 12 12M6 18 18 6',leaf:'M20 3C5 2 1 11 7 17c6 6 15 1 13-14ZM4 21 15 10',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM15 15l6 6',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5h4',menu:'M4 6h16M4 12h16M4 18h16',file:'M14 3H5v18h14V8ZM14 3v5h5M8 12h8M8 16h6',heart:'M12 20 3.5 11.5C-1 5 7 0 12 6c5-6 13-1 8.5 5.5Z',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1'};
  CS.icon=(name,size=20)=>`<svg width="${Number(size)||20}" height="${Number(size)||20}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.leaf}"/></svg>`;
  let toastTimer;
  CS.toast=message=>{const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,4200);};
  const dialog=document.getElementById('app-dialog');let lastFocus,closeCallback;
  CS.closeModal=()=>dialog.close();
  CS.modal=(title,html,onMount)=>{if(closeCallback){const fn=closeCallback;closeCallback=null;fn(false);}if(!dialog.open)lastFocus=document.activeElement;document.getElementById('dialog-title').textContent=title;document.getElementById('dialog-body').innerHTML=html;if(!dialog.open)dialog.showModal();if(onMount)onMount(dialog);};
  document.getElementById('dialog-close').addEventListener('click',CS.closeModal);
  dialog.addEventListener('close',()=>{if(dialog.open)return;if(closeCallback){const fn=closeCallback;closeCallback=null;fn(false);}if(lastFocus?.isConnected)lastFocus.focus();});
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  CS.confirm=message=>new Promise(resolve=>{CS.modal('Just checking',`<p>${CS.esc(message)}</p><div class="modal-actions"><button class="btn" id="confirm-no" type="button">Keep it</button><button class="btn danger" id="confirm-yes" type="button">Confirm</button></div>`,d=>{closeCallback=resolve;d.querySelector('#confirm-no').onclick=()=>d.close();d.querySelector('#confirm-yes').onclick=()=>{closeCallback=null;d.close();resolve(true);};});});
  CS.print=(title,html)=>{document.getElementById('print-root').innerHTML=`<div class="print-brand">CuriousStride.</div><h1>${CS.esc(title)}</h1>${html}<p class="print-footer">A little clarity. A little structure. One step at a time.</p>`;window.print();};
  CS.focusTask=title=>{state.focus.task=String(title);CS.save();CS.navigate('focus');};
})();
