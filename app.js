// Hunter Guide app. Screens: Home, Reserves (reserve → species), Log, Guides, plus the Settings sheet.
// Reserve, species and need-zone data lives in data/hunter-data.js (DATA); guide data is loaded from data/*.json when needed.
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const store={get(k,d){try{return localStorage.getItem('hg1.'+k)||d}catch(e){return d}},set(k,v){try{localStorage.setItem('hg1.'+k,v)}catch(e){}}};
const jget=(k,d)=>{try{const v=JSON.parse(store.get(k,''));return v==null?d:v}catch(e){return d}},jset=(k,v)=>store.set(k,JSON.stringify(v));
const APP_VERSION='0.4',reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let unit=store.get('unit','metric'),clock=store.get('clock','24'),R=null,lastSp=null,built=null,scrollRv=0;
const home=$('#home'),rv=$('#rv'),fv=$('#fv'),lv=$('#lv'),gv=$('#gv'),back=$('#back'),sel=$('#rsel');
const haptic=(ms=10)=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
let screen=null;const navStack=[];
const RESERVES=Object.keys(DATA.reserves),SPECIES=Object.keys(DATA.species).sort();
const short=n=>n.replace(/ (Hunting Reserve|Hunting Preserve|Nepal Hunting Reserve|Game Reserve|National Park|Nature Reserve|Preserve|District|Savanna|Park)$/,'');

// ---------------------------------------------------------------- formatting
const fmt=v=>(+v).toFixed(1).replace(/\.0$/,'');
const kgfmt=kg=>kg==null?'—':unit==='metric'?(+(+kg).toFixed(2))+' kg':(+(kg*2.20462).toFixed(1))+' lb';
const score=v=>v==null?'—':(+v).toLocaleString(undefined,{maximumFractionDigits:2});
const year=d=>d?String(d).slice(0,4):'';
const hm=t=>{if(clock==='24')return t;let [h,m]=t.split(':').map(Number);h%=24;return (h%12||12)+(m?':'+String(m).padStart(2,'0'):'')+(h<12?' am':' pm')};
const hourLabel=h=>hm(String(Math.floor(h)%24).padStart(2,'0')+':'+(h%1?'30':'00'));
const go=(r,s)=>{location.hash='/'+encodeURIComponent(r)+(s?'/'+encodeURIComponent(s):'')};
const nav=h=>{location.hash=h};
function goHome(){location.hash='/'}
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const opts=(a,selv)=>a.map(x=>`<option${x===selv?' selected':''}>${esc(x)}</option>`).join('');
const toastEl=$('#toast');let toastTimer=0;
function toast(msg){toastEl.textContent=msg;toastEl.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastEl.hidden=true},3200)}

// A picture stand-in for each species until real art is added.
const ICONS=[[/bear/i,'🐻'],[/wolf|jackal|coyote/i,'🐺'],[/fox|raccoon dog/i,'🦊'],[/raccoon|coati/i,'🦝'],[/lion|tiger|lynx|bobcat|puma|leopard|jaguar|ocelot/i,'🐆'],[/boar|pig|hog|warthog|peccary/i,'🐗'],[/bison|buffalo|banteng|yak|wildebeest/i,'🦬'],[/goat|ibex|chamois|tahr|sheep|mouflon/i,'🐐'],[/kangaroo/i,'🦘'],[/alligator|crocodile|caiman/i,'🐊'],[/turkey/i,'🦃'],[/goose|duck|teal|mallard|wigeon|pintail|gadwall|goldeneye/i,'🦆'],[/grouse|ptarmigan|quail|pheasant|capercaillie|woodcock/i,'🐦'],[/rabbit|hare|jackrabbit|cottontail/i,'🐇'],[/beaver|capybara/i,'🦫'],[/badger|marten|mink|grison/i,'🦡'],[/haggis/i,'🏴'],[/tapir/i,'🐘'],[/vicuña|vicuna/i,'🦙'],[/moose|elk|deer|caribou|reindeer|rusa|sambar|muntjac|barasingha|kudu|gemsbok|springbok|blackbuck|nilgai|pronghorn|taruca|axis|chital/i,'🦌']];
const icon=n=>(ICONS.find(([re])=>re.test(n))||[0,'🐾'])[1];

// ---------------------------------------------------------------- photos
// Real-animal photos from iNaturalist, only ones under a Creative Commons licence, shown with
// the photographer's credit. data/photos.json (made by tools/import-photos.py or find-photos.py) is used first;
// anything missing from it is looked up in the browser and remembered on this device.
// Pictures are cached by the service worker once seen, so they work offline after that.
const INAT='https://api.inaturalist.org/v1/';
let photoFile=null;const photoMem=jget('photos1',{}),photoWait={};let photoQ=Promise.resolve();
const photoJson=()=>photoFile||(photoFile=fetch('./data/photos.json').then(r=>r.ok?r.json():{}).catch(()=>({})));
const licOk=l=>l&&/^cc/i.test(l);
const pick=p=>p&&licOk(p.license_code)&&p.medium_url?{u:p.medium_url,by:p.attribution||'',lic:p.license_code.toUpperCase()}:null;
async function lookupPhoto(q){
  const get=u=>fetch(INAT+u).then(r=>{if(!r.ok)throw new Error(r.status);return r.json()});
  for(const name of [...new Set([q,q.split(' ').slice(0,2).join(' ')])]){
    const res=(await get('taxa?is_active=true&per_page=5&q='+encodeURIComponent(name))).results||[];
    const t=res.find(x=>x.name.toLowerCase()===name.toLowerCase())||res.find(x=>/species/.test(x.rank));if(!t)continue;
    let ph=pick(t.default_photo);
    if(!ph){const full=((await get('taxa/'+t.id)).results||[])[0];for(const tp of (full&&full.taxon_photos)||[]){ph=pick(tp.photo);if(ph)break}}
    if(ph)return{...ph,link:'https://www.inaturalist.org/taxa/'+t.id};
  }
  return 0;
}
function photoFor(sp){
  if(sp in photoMem)return Promise.resolve(photoMem[sp]);
  return photoWait[sp]||(photoWait[sp]=photoJson().then(f=>{
    if(f[sp])return f[sp];
    const q=DATA.species[sp]?.photo;if(!q)return 0;
    // one lookup at a time, so a full grid doesn't hit iNaturalist's rate limit
    const run=photoQ.then(()=>lookupPhoto(q)).then(p=>{photoMem[sp]=p;jset('photos1',photoMem);return p});
    photoQ=run.catch(()=>{}).then(()=>new Promise(r=>setTimeout(r,250)));return run;
  }).catch(()=>{delete photoWait[sp];return null}));
}
// Fills every [data-photo] box inside el; the emoji stays when there's no photo.
function hydratePhotos(el){
  for(const box of $$('[data-photo]',el)){const sp=box.dataset.photo;delete box.dataset.photo;
    photoFor(sp).then(p=>{if(!p||!box.isConnected)return;const img=new Image();img.alt='';img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';
      img.className='ph';img.onload=()=>{box.querySelectorAll('.emo').forEach(x=>x.remove());box.classList.add('hasPhoto')};img.onerror=()=>img.remove();box.prepend(img);img.src=box.classList.contains('spPhoto')&&p.full?p.full:p.u;
      const cr=box.parentElement&&box.parentElement.querySelector('[data-credit]');if(cr)cr.innerHTML=photoCredit(p)})}
}
const licLink=p=>p.licUrl?`<a href="${esc(p.licUrl)}" target="_blank" rel="noopener">${esc(p.lic)}</a>`:esc(p.lic);
const photoCredit=p=>p?`Photo: ${esc(p.by.replace(/^\(c\)\s*/i,'© '))}${/\bCC\b/.test(p.by)?'':' ('+licLink(p)+')'} via <a href="${esc(p.link)}" target="_blank" rel="noopener">iNaturalist</a>. Real animal, not an in-game picture.`:'';
const pic=(sp,cls='anpic',extra='')=>`<div class="${cls}" data-photo="${esc(sp)}"><span class="emo">${icon(sp)}</span>${extra}</div>`;

// ---------------------------------------------------------------- trophy ratings
const RANKS=['Bronze','Silver','Gold','Diamond','Great One'],RANK_ICON={Bronze:'🥉',Silver:'🥈',Gold:'🥇',Diamond:'💎','Great One':'👑'};
const rankBadge=r=>r?`<span class="rank rank-${esc(r.replace(' ',''))}">${RANK_ICON[r]||''} ${esc(r)}</span>`:'';
function rankFor(sp,sc){ // the game has no threshold for bronze: anything under silver is bronze
  const t=DATA.species[sp]?.trophy;if(sc==null||!t)return null;
  return t.diamond!=null&&sc>=t.diamond?'Diamond':t.gold!=null&&sc>=t.gold?'Gold':t.silver!=null&&sc>=t.silver?'Silver':'Bronze';
}

// ---------------------------------------------------------------- need zones
// Times are "HH:MM-HH:MM" on the in-game clock; a range may run past midnight.
const toH=t=>{const [h,m]=t.split(':').map(Number);return h+(m||0)/60};
function spans(r){const [a,b]=r.split('-').map(toH);let e=b<=a?b+24:b;return e>24?[[a,24],[0,e-24]]:[[a,e]]}
const zonesOf=(rn,sp)=>DATA.zones[rn]?.[sp]||null;
function zoneAt(z,h){if(!z)return null;for(const k of ['feed','drink','rest'])for(const r of z[k]||[])if(spans(r).some(([a,b])=>h>=a&&h<b))return k;return 'none'}
const ZONE_LABEL={feed:'Feeding',drink:'Drinking',rest:'Resting',none:'Roaming'};
function timeline(z,h){
  if(!z)return '<div class="zt"></div>';
  const segs=['rest','drink','feed'].flatMap(k=>(z[k]||[]).flatMap(r=>spans(r).map(([a,b])=>`<i class="${k}" style="left:${a/24*100}%;width:${(b-a)/24*100}%"></i>`)));
  return `<div class="zt" role="img" aria-label="Need zone times">${segs.join('')}${h!=null?`<b style="left:calc(${h/24*100}% - 1px)"></b>`:''}</div>`;
}
const ticks=()=>`<div class="ztTicks">${[0,6,12,18,24].map(h=>`<span>${hourLabel(h%24)}</span>`).join('')}</div>`;
const legend=`<div class="ztLegend"><span style="--c:var(--feed)">Feed</span><span style="--c:var(--drink)">Drink</span><span style="--c:var(--rest)">Rest</span></div>`;
const zoneTag=k=>`<span class="zone zone-${k}">${ZONE_LABEL[k]}</span>`;
let zHour=+store.get('zHour','6');

// ---------------------------------------------------------------- guide data (loaded on demand)
const GD={};
function guide(name){return GD[name]||(GD[name]=fetch('./data/'+name+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).catch(e=>{delete GD[name];throw e}))}
const loadFail='<div class="mutedBox">This guide is not available yet, or it needs the app opened from a web address (or a connection the first time).</div>';
const srcLink=(u,label)=>u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label||new URL(u).hostname.replace(/^www\./,''))}</a>`:'';
const srcList=a=>(a||[]).filter(s=>s&&s.url).map(s=>srcLink(s.url,s.title)).join(' · ');

// ---------------------------------------------------------------- saved progress (this device)
// Log entry: {id, r: reserve, s: species, sc: trophy score or null, w: kg or null, fur, go: Great One, rank, d: 'YYYY-MM-DD', n: note}
const getLog=()=>{const l=jget('log',[]);return Array.isArray(l)?l:[]},saveLog=l=>jset('log',l);
function bestFor(sp,log=getLog(),rn){ // best rating and score logged for a species (optionally in one reserve)
  let rank=null,sc=null,any=false;
  for(const e of log)if(e.s===sp&&(!rn||e.r===rn)){any=true;if(e.rank&&(rank==null||RANKS.indexOf(e.rank)>RANKS.indexOf(rank)))rank=e.rank;if(e.sc!=null&&(sc==null||e.sc>sc))sc=e.sc}
  return any?{rank,sc}:null;
}

// ================================================================ HOME
function buildHome(){
  const go1=SPECIES.filter(s=>DATA.species[s].greatOne).length;
  home.innerHTML=`<section class="homeHero">
    <div class="eyebrow">Your hunting companion</div>
    <h1>Plan your next diamond.</h1>
    <p>Every reserve, animal, need zone and trophy score in <em>theHunter: Call of the Wild</em>, plus Great Ones, weapons, skills, missions and a log for every harvest.</p>
    <div class="stats"><span class="pill"><b class="num">${RESERVES.length}</b> reserves</span><span class="pill"><b class="num">${SPECIES.length}</b> animals</span><span class="pill"><b class="num">${go1}</b> Great Ones</span></div>
  </section>
  <section class="section card moving" id="moving">
    <div class="homeSectionHead"><div><h2>What's moving?</h2><p>Pick a reserve and the in-game time to see who is feeding, drinking or resting.</p></div></div>
    <select id="mReserve" class="select" aria-label="Reserve" style="width:100%">${opts(RESERVES,store.get('reserve',RESERVES[0]))}</select>
    <div class="clockRow"><output id="mHourOut">${hourLabel(zHour)}</output><input id="mHour" type="range" min="0" max="23.5" step="0.5" value="${zHour}" aria-label="In-game time"></div>
    <div id="mOut" class="bitingOut" aria-live="polite"></div>
  </section>
  <section class="homeSearch">
    <label for="homeQuery">Looking for a specific animal?</label>
    <input class="input" id="homeQuery" type="search" placeholder="Search animals by name…" autocomplete="off">
    <div class="homeSearchControls"><select class="select" id="homeReserveFilter" aria-label="Filter by reserve"><option value="">All reserves</option>${opts(RESERVES)}</select><select class="select" id="homeClassFilter" aria-label="Filter by class"><option value="">Any class</option>${[1,2,3,4,5,6,7,8,9].map(c=>`<option value="${c}">Class ${c}</option>`).join('')}</select></div>
    <div class="homeResultsMeta"><span id="homeResultsCount">Search across all reserves</span><button class="homeClear" id="clearHomeSearch" type="button">Clear</button></div>
    <div class="homeResults" id="homeResults" aria-live="polite"></div>
  </section>
  <section class="section" id="reserveDirectory">
    <div class="homeSectionHead"><div><h2>Reserves</h2><p>${RESERVES.length} reserves. Swipe for more.</p></div><button class="homeClear" id="randomSp" type="button">Surprise me</button></div>
    <div class="homeReserveGrid">${RESERVES.map(n=>reserveTile(n,'homeReserve')).join('')}</div>
  </section>`;
  home.oninput=e=>{if(e.target.id==='homeQuery')renderHomeResults();if(e.target.id==='mHour'){zHour=+e.target.value;store.set('zHour',zHour);renderMoving()}};
  home.onchange=e=>{if(/^home(Reserve|Class)Filter$/.test(e.target.id))renderHomeResults();if(e.target.id==='mReserve')renderMoving()};
  home.onclick=e=>{
    const card=e.target.closest('[data-home-reserve]');if(card)go(card.dataset.homeReserve);
    if(e.target.closest('#randomSp')){const s=SPECIES[Math.floor(Math.random()*SPECIES.length)],rs=DATA.species[s].reserves;go(rs[Math.floor(Math.random()*rs.length)],s)}
    if(e.target.closest('#clearHomeSearch')){$('#homeQuery').value='';$('#homeReserveFilter').value='';$('#homeClassFilter').value='';renderHomeResults();$('#homeQuery').focus()}
    const result=e.target.closest('[data-go]');if(result){const [rn,...p]=result.dataset.go.split('::');go(rn,p.join('::'))}
  };
  renderHomeResults();renderMoving();
}
function reserveTile(n,cls){const r=DATA.reserves[n];
  return `<button class="${cls}" data-home-reserve="${esc(n)}" data-r="${esc(n)}"><div class="eyebrow">${esc(r.country||r.region||'')}</div><h3>${esc(short(n))}</h3><p>${r.species.length} animals · ${r.dlc?'DLC':'Base game'}${r.released?' · '+year(r.released):''}</p></button>`}
const cc=c=>`<span class="cc">C${esc(c)}</span>`,gob='<span class="gob">Great One</span>';
function renderHomeResults(){
  const target=$('#homeResults');if(!target)return;
  const q=$('#homeQuery').value.trim().toLowerCase(),rsel=$('#homeReserveFilter').value,cls=$('#homeClassFilter').value;
  const list=SPECIES.filter(s=>{const d=DATA.species[s];return(!q||s.toLowerCase().includes(q)||(d.latin||'').toLowerCase().includes(q))&&(!rsel||d.reserves.includes(rsel))&&(!cls||String(d.class)===cls)});
  const active=q||rsel||cls;
  $('#homeResultsCount').textContent=active?list.length+' animals found':'Search across all reserves';
  if(!active){target.innerHTML='<div class="homeHint">Type an animal\'s name, or pick a reserve or class. Select a result to open its full guide.</div>';return}
  const shown=list.slice(0,24);
  target.innerHTML=shown.length?shown.map(s=>{const d=DATA.species[s],rn=rsel||d.reserves[0];return `<button class="homeResult" data-go="${esc(rn+'::'+s)}"><span><strong>${esc(s)}</strong> ${cc(d.class)} ${d.greatOne?gob:''}<small>${esc(d.difficulty||'')} · Diamond from <span class="num">${score(d.trophy.diamond)}</span></small><small class="homeBait">${esc(d.reserves.map(short).join(', '))}</small></span><span aria-hidden="true">→</span></button>`}).join('')+(list.length>shown.length?`<div class="homeHint">Showing the first ${shown.length} of ${list.length}. Add more letters to narrow it down.</div>`:''):'<div class="mutedBox">No animals found. Try another name or filter.</div>';
}
function renderMoving(){
  const out=$('#mOut');if(!out)return;
  const rn=$('#mReserve').value,h=zHour,order={feed:0,drink:1,rest:2,none:3};$('#mHourOut').textContent=hourLabel(h);
  const rows=DATA.reserves[rn].species.map(s=>({s,z:zoneAt(zonesOf(rn,s),h)})).filter(x=>x.z).sort((a,b)=>order[a.z]-order[b.z]||a.s.localeCompare(b.s));
  out.innerHTML=rows.map(x=>`<button class="actRow" data-ms="${esc(x.s)}">${pic(x.s,'imgFallback ph')}<b>${esc(x.s)}</b>${cc(DATA.species[x.s].class)}${zoneTag(x.z)}</button>`).join('')||'<div class="mutedBox">No need zone times for this reserve yet.</div>';
  out.onclick=e=>{const b=e.target.closest('[data-ms]');if(b)go(rn,b.dataset.ms)};hydratePhotos(out);
}

// ================================================================ RESERVE
let fClass=0;
function buildReserve(){
  const r=DATA.reserves[R],classes=[...new Set(r.species.map(s=>DATA.species[s].class))].sort((a,b)=>a-b);fClass=0;
  rv.innerHTML=`<div class="hero"><div class="eyebrow">${esc([r.country||r.region,r.dlc?(r.dlcName||'DLC'):'Base game'].filter(Boolean).join(' · '))}</div><h1>${esc(R)}</h1>
    ${r.biome?`<p>${esc(r.biome)}</p>`:''}
    <div class="stats"><div class="pill"><b class="num">${r.species.length}</b> animals</div>${r.released?`<div class="pill">Released <span class="num">${esc(r.released)}</span></div>`:''}</div>
    ${r.about?`<p class="note">${esc(r.about)}</p>`:''}</div>
  <div class="section card"><h2>Need zone planner</h2><p class="note" style="margin-top:0">Slide to an in-game time to see where each animal is. Tap a row for its full guide.</p>
    <div class="hourPick"><input type="range" id="zh" min="0" max="23.5" step="0.5" value="${zHour}" aria-label="In-game time"><strong id="zhl" class="num">${hourLabel(zHour)}</strong></div>${legend}<div class="zRows" id="zrows"></div>${ticks()}</div>
  <div class="section"><h2>Animals in ${esc(short(R))}</h2>
    <div class="chipRow" id="classChips"><button class="chip small active" data-fc="0">All classes</button>${classes.map(c=>`<button class="chip small" data-fc="${c}">Class ${c}</button>`).join('')}</div>
    <div class="searchbar"><input id="q" class="input" placeholder="Search animals…"><select class="select" id="fzone"><option value="">Any zone now</option><option value="feed">Feeding now</option><option value="drink">Drinking now</option><option value="rest">Resting now</option></select><select class="select" id="fgo"><option value="">All animals</option><option value="go">Has a Great One</option><option value="todo">No diamond logged</option></select></div><div id="fcount" class="note"></div><div class="grid" id="grid"></div></div>
  <div class="section"><h2>Other reserves</h2><div class="reserveCards">${RESERVES.filter(n=>n!==R).map(n=>reserveTile(n,'reserveCard')).join('')}</div></div>
  ${r.source?`<div class="source">Source: ${srcLink(r.source)}</div>`:''}`;
  rv.oninput=e=>{if(e.target.id==='zh'){zHour=+e.target.value;store.set('zHour',zHour);renderZones();if($('#fzone').value)renderGrid()}else renderGrid()};
  rv.onchange=e=>{if(e.target.id!=='zh')renderGrid()};
  rv.onclick=e=>{const c=e.target.closest('[data-fc]');if(c){fClass=+c.dataset.fc;$$('[data-fc]',rv).forEach(b=>b.classList.toggle('active',b===c));return renderGrid()}
    const f=e.target.closest('[data-sp]'),o=e.target.closest('[data-r]');if(f)go(R,f.dataset.sp);else if(o)go(o.dataset.r)};
  renderZones();renderGrid();
}
function renderZones(){
  const r=DATA.reserves[R];$('#zhl').textContent=hourLabel(zHour);
  $('#zrows').innerHTML=r.species.map(s=>{const z=zonesOf(R,s),k=zoneAt(z,zHour);return `<button class="zRow" data-sp="${esc(s)}" title="${esc(s)}: ${k?ZONE_LABEL[k]:'no data'}"><span>${esc(s)}</span>${timeline(z,zHour)}</button>`}).join('');
}
function renderGrid(){
  const r=DATA.reserves[R],q=$('#q').value.trim().toLowerCase(),zn=$('#fzone').value,g=$('#fgo').value,log=getLog();
  const list=r.species.filter(s=>{const d=DATA.species[s],b=bestFor(s,log);return(!q||s.toLowerCase().includes(q))&&(!fClass||d.class===fClass)&&(!zn||zoneAt(zonesOf(R,s),zHour)===zn)&&(g!=='go'||d.greatOne)&&(g!=='todo'||(b?.rank!=='Diamond'&&b?.rank!=='Great One'))});
  $('#fcount').textContent=`${list.length} of ${r.species.length} animals`+(zn?` at ${hourLabel(zHour)}`:'');
  $('#grid').innerHTML=list.map(s=>{const d=DATA.species[s],b=bestFor(s,log);return `<button class="animal" data-sp="${esc(s)}">${pic(s,'anpic',b?`<span class="gotTag">${b.rank?RANK_ICON[b.rank]:'✓'}</span>`:'')}<div class="anbody"><h3>${esc(s)}</h3><div class="anMeta">${cc(d.class)}<span class="diff">${esc(d.difficulty||'')}</span>${d.greatOne?gob:''}</div></div></button>`}).join('')||'<div class="mutedBox">No animals match those filters.</div>';hydratePhotos($('#grid'));
}
function refresh(){
  $$('[data-u]').forEach(b=>b.classList.toggle('active',b.dataset.u===unit));$$('[data-clock]').forEach(b=>b.classList.toggle('active',b.dataset.clock===clock));
  $$('[data-theme-pick]').forEach(b=>b.classList.toggle('active',b.dataset.themePick===theme));
  if(!rv.hidden&&$('#zrows')){renderZones();renderGrid();$$('.ztTicks',rv).forEach(t=>t.outerHTML=ticks())}
  if(lastSp&&!fv.hidden){built=null;spPage(lastSp)}
  if(!home.hidden&&home.dataset.built)renderMoving();
  if(screen==='log')buildLog();
}

// ================================================================ SPECIES PAGE
const RARE=/rare|great one/i;
function ladder(t){
  const top=t.max||(t.diamond?t.diamond*1.1:1),bar=v=>v==null?0:Math.min(100,v/top*100);
  return `<div class="ladder">${[['bronze','Bronze',null],['silver','Silver',t.silver],['gold','Gold',t.gold],['diamond','Diamond',t.diamond]].map(([k,l,v])=>`<div class="rung m-${k}"><span class="medal"><i></i>${l}</span><span class="track"><span style="width:${bar(v)}%"></span></span><code>${v==null?'–':score(v)}</code></div>`).join('')}
    <div class="rung"><span class="medal" style="color:var(--muted)">Max</span><span></span><code>${t.max==null?'–':score(t.max)}</code></div></div>`;
}
function spPage(s){
  const d=DATA.species[s],key=R+'/'+s;rv.hidden=true;fv.hidden=false;
  if(built===key)return spDyn(s);built=key;
  const t=d.trophy,z=zonesOf(R,s),k=zoneAt(z,zHour);
  const tiers=['Common','Uncommon','Rare','Very Rare','Mission','Great One'],furs=d.furs||[];
  const furHtml=furs.length?[...new Set([...tiers.filter(x=>furs.some(f=>f.rarity===x)),...furs.map(f=>f.rarity)])].map(x=>`<div class="tier">${esc(x||'Other')}</div>`+furs.filter(f=>f.rarity===x).map(f=>`<span class="tag r-${esc(String(x||'').replace(/\s/g,''))}">${esc(f.name)}</span>`).join('')).join(''):'<div class="mutedBox">Not listed yet.</div>';
  const zt=k=>(z&&z[k]&&z[k].length)?z[k].map(r=>r.split('-').map(hm).join('–')).join(', '):'—';
  fv.innerHTML=`<div class="hero"><div class="eyebrow">Class ${esc(d.class)} · ${esc(d.difficulty||'')}</div><h1>${esc(s)}</h1>${d.latin?`<p class="latin">${esc(d.latin)}</p>`:''}
    <div class="facts"><div class="fact"><small>Max level</small><strong>${esc(d.maxLevel??'–')}</strong></div><div class="fact"><small>Max weight</small><strong>${kgfmt(d.maxWeightKg)}</strong></div><div class="fact"><small>Great One</small><strong>${d.greatOne?'Yes':'No'}</strong></div></div>
    <div class="anTools">${d.greatOne?`<button class="toolAction" id="goGuide">Great One guide →</button>`:''}<button class="toolAction" id="ammoGuide">Ammo for this animal →</button></div><div id="fbest" class="note"></div></div>
  <div class="detailgrid section"><div>
    <div class="card">${pic(s,'imageWrap spPhoto')}<div class="note" data-credit></div></div>
    <div class="card" style="margin-top:18px"><div class="homeSectionHead" style="margin:0"><h2>Need zones</h2>${z?`<span class="note" style="margin:0">${esc(short(R))} · ${hourLabel(zHour)} ${zoneTag(k)}</span>`:''}</div>${z?`${timeline(z,zHour)}${ticks()}<div class="zTimes"><div><small style="color:var(--feed)">Feed</small><span>${zt('feed')}</span></div><div><small style="color:var(--drink)">Drink</small><span>${zt('drink')}</span></div><div><small style="color:var(--rest)">Rest</small><span>${zt('rest')}</span></div></div>`:'<div class="mutedBox">No need zone times for this animal yet.</div>'}</div>
    <div class="card" style="margin-top:18px"><h2>Trophy ladder</h2>${ladder(t)}
    <div class="note">Trophy score comes from the animal's antlers, horns, skull or weight. Bronze is anything under silver. Only animals at or near the species' top difficulty level can reach a diamond.</div></div>
  </div><div>
    <div class="card"><h2>Furs</h2>${furHtml}</div>
    <div class="card" style="margin-top:18px"><h2>Ammo that passes integrity</h2>${d.ammo.length?d.ammo.map(a=>`<span class="tag ammo">${esc(a)}</span>`).join(''):'<div class="mutedBox">Not listed yet.</div>'}<div class="note">Ammo rated for this animal's class gives the integrity bonus to your hunter score.</div></div>
    <div class="card" style="margin-top:18px"><h2>Found in</h2>${d.reserves.map(n=>`<button class="chip small${n===R?' active':''}" data-other="${esc(n)}">${esc(short(n))}</button>`).join(' ')}</div>
  </div></div>
  <button class="cta" id="logThis">Log a harvest</button>
  ${d.notes?`<details class="notes"><summary>Data notes</summary><p>${esc(d.notes)}</p></details>`:''}
  <div class="source">Source: ${d.source?srcLink(d.source):'community data'} (community-maintained; may contain errors).</div>`;
  spDyn(s);hydratePhotos(fv);
}
function spDyn(s){const b=bestFor(s);$('#fbest').innerHTML=b?`Your best: ${b.rank?rankBadge(b.rank):'harvested'}${b.sc!=null?' · score '+score(b.sc):''}`:''}
function showSp(s){
  if(s){if(!lastSp)scrollRv=scrollY;spPage(s);if(s!==lastSp)scrollTo(0,0)}
  else{rv.hidden=false;fv.hidden=true;if(lastSp)scrollTo(0,scrollRv)}
  lastSp=s;document.title=(s||R)+' · Hunter Guide';
  if(s)fv.onclick=e=>{
    if(e.target.closest('#logThis'))openLogSheet(R,s);
    if(e.target.closest('#goGuide'))nav('/guides/great-ones/'+encodeURIComponent(s));
    if(e.target.closest('#ammoGuide')){store.set('ammoSpecies',s);nav('/guides/ammo-finder')}
    const o=e.target.closest('[data-other]');if(o)go(o.dataset.other,s);
  };
}

// ================================================================ LOG
const logDlg=$('#logDlg');
function openLogSheet(rn,sp){
  rn=rn||store.get('logReserve',R||RESERVES[0]);
  $('#lgReserve').innerHTML=opts(RESERVES,rn);fillLogSpecies(sp);
  $('#lgScore').value='';$('#lgWeight').value='';$('#lgUnit').textContent=unit==='metric'?'kg':'lb';$('#lgDate').value=today();$('#lgNote').value='';$('#lgGO').checked=false;
  updateLogRank();logDlg.showModal();setTimeout(()=>$('#lgScore').focus(),60);
}
function fillLogSpecies(sp){const sps=DATA.reserves[$('#lgReserve').value].species;$('#lgSpecies').innerHTML=opts(sps,sp&&sps.includes(sp)?sp:sps[0]);fillFurs()}
function fillFurs(){const d=DATA.species[$('#lgSpecies').value];$('#lgFur').innerHTML='<option value="">Not noted</option>'+opts((d.furs||[]).map(f=>f.name));$('#lgGO').closest('label').hidden=!d.greatOne;updateLogRank()}
const num=v=>{const x=parseFloat(String(v).replace(',','.'));return isNaN(x)||x<=0?null:x};
function updateLogRank(){
  const sp=$('#lgSpecies').value,sc=num($('#lgScore').value),t=DATA.species[sp].trophy,go1=$('#lgGO').checked;
  const r=go1?'Great One':rankFor(sp,sc);
  $('#lgAuto').innerHTML=r?`Rating: ${rankBadge(r)}`:'Enter the trophy score to work out the rating.';
  $('#lgHint').textContent=`${sp}: silver from ${score(t.silver)}, gold from ${score(t.gold)}, diamond from ${score(t.diamond)}.`;
}
logDlg.addEventListener('input',e=>{if(e.target.id==='lgScore')updateLogRank()});
logDlg.addEventListener('change',e=>{if(e.target.id==='lgReserve')fillLogSpecies();if(e.target.id==='lgSpecies')fillFurs();if(e.target.id==='lgGO')updateLogRank()});
logDlg.addEventListener('click',e=>{if(e.target.closest('#lgCancel'))logDlg.close()});
$('#logForm').addEventListener('submit',e=>{
  e.preventDefault();
  const rn=$('#lgReserve').value,sp=$('#lgSpecies').value,sc=num($('#lgScore').value),w=num($('#lgWeight').value),go1=$('#lgGO').checked&&DATA.species[sp].greatOne;
  const rank=go1?'Great One':rankFor(sp,sc),log=getLog(),prev=bestFor(sp,log);
  log.push({id:Date.now().toString(36),r:rn,s:sp,sc:sc==null?null:+sc.toFixed(3),w:w==null?null:+(unit==='metric'?w:w/2.20462).toFixed(2),fur:$('#lgFur').value||null,go:go1,rank,d:$('#lgDate').value||today(),n:$('#lgNote').value.trim()});
  saveLog(log);store.set('logReserve',rn);logDlg.close();
  if(go1){const g=new Set(jget('greatOnes',[]));g.add(sp);jset('greatOnes',[...g])}
  const pb=sc!=null&&prev&&(prev.sc==null||sc>prev.sc);
  haptic(rank==='Diamond'||rank==='Great One'?[20,40,20]:15);
  toast(`Logged ${sp}${rank?' · '+RANK_ICON[rank]+' '+rank:''}${pb?' · New personal best!':''}`);
  if(lastSp&&!fv.hidden)spDyn(lastSp);if(!rv.hidden&&$('#grid'))renderGrid();if(screen==='log')buildLog();
});

function buildLog(){
  const log=getLog(),best=new Map();for(const s of SPECIES){const b=bestFor(s,log);if(b)best.set(s,b)}
  const dia=[...best.values()].filter(b=>b.rank==='Diamond'||b.rank==='Great One').length,goTotal=SPECIES.filter(s=>DATA.species[s].greatOne).length,goGot=greatOnesGot();
  const lr=store.get('logFilterReserve',''),lf=store.get('logFilter','all');
  const recent=log.slice().sort((a,b)=>(b.d||'').localeCompare(a.d||'')||String(b.id).localeCompare(String(a.id))).slice(0,30);
  const pool=(lr&&DATA.reserves[lr]?DATA.reserves[lr].species:SPECIES).filter(s=>{const b=best.get(s),top=b&&(b.rank==='Diamond'||b.rank==='Great One');return lf==='all'||(lf==='got'&&b)||(lf==='missing'&&!b)||(lf==='diamond'&&top)||(lf==='nodiamond'&&!top)});
  const rareFur=e=>{const f=e.fur&&(DATA.species[e.s].furs||[]).find(x=>x.name===e.fur);return !!f&&/rare|great one/i.test(f.rarity||'')};
  const rare=log.filter(e=>DATA.species[e.s]&&rareFur(e)).length,diaKills=log.filter(e=>e.rank==='Diamond'||e.rank==='Great One').length;
  const tile=(n,label,cls)=>`<div class="statTile${cls?' '+cls:''}"><strong>${n}</strong><em>${label}</em></div>`;
  const MD={Bronze:['m-bronze','B'],Silver:['m-silver','S'],Gold:['m-gold','G'],Diamond:['m-diamond','D'],'Great One':['m-fabled','★']};
  const dot=r=>{const m=MD[r];return m?`<span class="medalDot ${m[0]}" title="${r}">${m[1]}</span>`:'<span class="medalDot none" title="No rating">–</span>'};
  lv.innerHTML=`<div class="hero"><div class="eyebrow">Saved on this device</div><h1>My log</h1>
    <div class="statTiles">${tile(log.length,'Harvests')}${tile(diaKills,'Diamonds','m-diamond')}${tile(goGot.size+'<small>/'+goTotal+'</small>','Great Ones','m-fabled')}${tile(rare,'Rare furs','m-gold')}</div>
    <div class="homeActions"><button class="primaryAction" id="lgNew">＋ Log a harvest</button><button class="secondaryAction" id="lgBackup">Back up my log</button></div></div>
  <div class="section"><h2>Recent harvests</h2>${recent.length?`<div class="logList">${recent.map(e=>DATA.species[e.s]?`<div class="logRow"><button class="logOpen" data-lo="${esc(e.r+'::'+e.s)}">${dot(e.rank)}<span><strong>${esc(e.s)}</strong><small>${esc(short(e.r))}${e.d?' · '+esc(e.d):''}${e.fur?' · '+esc(e.fur):''}</small>${e.n?`<small class="muted">${esc(e.n)}</small>`:''}</span></button><span class="logMeta">${e.sc!=null?`<code class="sc">${score(e.sc)}</code>`:''}${e.w!=null?`<small class="muted">${kgfmt(e.w)}</small>`:''}</span><span class="logBtns"><button class="iconBtn" data-share="${esc(e.id)}" aria-label="Share this harvest">⤴</button><button class="iconBtn" data-del="${esc(e.id)}" aria-label="Delete this harvest">✕</button></span></div>`:'').join('')}</div>`:'<div class="mutedBox">Nothing logged yet. Tap “Log a harvest” after a kill, or use the button on any species page.</div>'}</div>
  <div class="section"><h2>Collection</h2><div class="ckSummary"><div class="collHead"><span>${best.size} of ${SPECIES.length} species harvested</span><span class="muted">${dia} with a diamond</span></div><span class="bar"><i style="width:${best.size/SPECIES.length*100}%"></i></span></div><p class="note">Your best rating for every species. Tap one to open its guide.</p>
    <div class="chipRow"><button class="chip${lr?'':' active'}" data-lr="">All</button>${RESERVES.map(n=>`<button class="chip${lr===n?' active':''}" data-lr="${esc(n)}">${esc(short(n))}</button>`).join('')}</div>
    <div class="chipRow">${[['all','All'],['got','Harvested'],['missing','Not yet'],['diamond','💎 Diamond'],['nodiamond','No diamond yet']].map(([k,l])=>`<button class="chip small${lf===k?' active':''}" data-lf="${k}">${l}</button>`).join('')}</div>
    <div class="collGrid">${pool.map(s=>{const b=best.get(s),rn=lr||DATA.species[s].reserves[0];return `<button class="collItem${b?' got':''}" data-lo="${esc(rn+'::'+s)}">${pic(s,'imgFallback')}<strong>${esc(s)}</strong><small>${b?(b.rank?RANK_ICON[b.rank]+' '+b.rank:'Harvested')+(b.sc!=null?' · '+score(b.sc):''):'Not yet'}</small></button>`}).join('')||'<div class="mutedBox">Nothing here with this filter.</div>'}</div></div>`;
  hydratePhotos(lv);
}
lv.onclick=e=>{
  const t=e.target;
  if(t.closest('#lgNew'))return openLogSheet();
  if(t.closest('#lgBackup'))return exportBackup();
  const lo=t.closest('[data-lo]');if(lo){const [rn,...p]=lo.dataset.lo.split('::');return go(rn,p.join('::'))}
  const lr=t.closest('[data-lr]');if(lr){store.set('logFilterReserve',lr.dataset.lr);return buildLog()}
  const lf=t.closest('[data-lf]');if(lf){store.set('logFilter',lf.dataset.lf);return buildLog()}
  const del=t.closest('[data-del]');if(del&&confirm('Delete this harvest from your log?')){saveLog(getLog().filter(x=>String(x.id)!==del.dataset.del));haptic();return buildLog()}
  const sh=t.closest('[data-share]');if(sh){const e2=getLog().find(x=>String(x.id)===sh.dataset.share);if(e2)shareHarvest(e2)}
};

// Share card: a picture of the harvest drawn on a canvas, shared with the phone's share sheet or downloaded.
async function shareHarvest(e){
  const W=1080,H=1350,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#2a2a17');bg.addColorStop(1,'#0c0f0b');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.textAlign='center';g.font='360px system-ui,sans-serif';g.fillText(icon(e.s),W/2,560);g.textAlign='left';
  g.fillStyle='#e8873a';g.font='700 40px system-ui,sans-serif';g.fillText('🦌 HUNTER GUIDE',60,100);
  g.fillStyle='#f2f1ea';g.font='800 84px system-ui,sans-serif';g.fillText(e.s,60,800,W-120);
  g.fillStyle='#a7ab9c';g.font='500 40px system-ui,sans-serif';g.fillText([e.r,e.d,e.fur].filter(Boolean).join('  ·  '),60,870,W-120);
  if(e.rank){g.fillStyle={'Great One':'#ead38a',Diamond:'#8fe3ff',Gold:'#e5c96e',Silver:'#d5dde3',Bronze:'#d39a62'}[e.rank]||'#fff';g.font='800 96px system-ui,sans-serif';g.fillText((RANK_ICON[e.rank]||'')+' '+e.rank,60,1040)}
  if(e.sc!=null){g.fillStyle='#f2f1ea';g.font='800 120px system-ui,sans-serif';g.fillText(score(e.sc),60,e.rank?1180:1060)}
  g.fillStyle='#7c8072';g.font='500 30px system-ui,sans-serif';g.fillText('theHunter: Call of the Wild · Vanderholst Studios',60,H-60);
  const blob=await new Promise(res=>c.toBlob(res,'image/png'));if(!blob)return toast('Could not make the picture.');
  const file=new File([blob],(e.s+'-'+(e.d||'harvest')).replace(/[^\w-]+/g,'-')+'.png',{type:'image/png'});
  try{if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:'My '+e.s});return}}catch(err){if(err.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Picture saved to your downloads.');
}

// ---------------------------------------------------------------- backup and restore
const BACKUP_KEYS=['log','greatOnes','missions','collect','skillPlan','unit','clock','theme','reserve'];
function exportBackup(){
  const data={};for(const k of BACKUP_KEYS){const v=store.get(k,null);if(v!=null)data[k]=v}
  const blob=new Blob([JSON.stringify({app:'hunter-guide',version:1,exported:new Date().toISOString(),data},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='hunter-guide-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('Backup saved. Keep the file somewhere safe.');
}
$('#importFile').addEventListener('change',async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const b=JSON.parse(await f.text());if(b.app!=='hunter-guide'||!b.data)throw 0;
    if(!confirm('Replace your log, Great Ones, missions, collectibles and skill plan on this device with this backup?'))return;
    for(const k of BACKUP_KEYS)if(b.data[k]!=null)store.set(k,b.data[k]);
    toast('Backup restored.');setTimeout(()=>location.reload(),700);
  }catch(err){alert('That file is not a Hunter Guide backup.')}
});

// ================================================================ GUIDES
const greatOnesGot=()=>new Set(jget('greatOnes',[]));
const toggleGreatOne=s=>{const g=greatOnesGot();g.has(s)?g.delete(s):g.add(s);jset('greatOnes',[...g]);return g.has(s)};
const guideCard=(href,ic,title,desc,done,total,wide)=>`<a class="guideCard${wide?' wide':''}" href="#${href}"><span class="gIcon">${ic}</span><span><strong>${title}</strong><small>${desc}</small>${total?`<span class="bar"><i style="width:${done/total*100}%"></i></span><small class="muted">${done} of ${total} done</small>`:''}</span><span aria-hidden="true">→</span></a>`;
async function buildGuides(){
  gv.innerHTML=`<div class="hero"><div class="eyebrow">Guides</div><h1>Everything to chase</h1><p>Great Ones, weapons and ammo, skills and perks, missions and collectibles, and how the game's systems work.</p></div><div class="guideCards" id="guideCards"></div>`;
  let M={},C={};try{M=await guide('missions')}catch(e){}try{C=await guide('collectibles')}catch(e){}
  if(screen!=='guides'||!$('#guideCards'))return;
  const md=jget('missions',{}),cd=jget('collect',{}),goList=SPECIES.filter(s=>DATA.species[s].greatOne);
  const groups=o=>Object.entries(o).filter(([k,v])=>DATA.reserves[k]&&Array.isArray(v)).flatMap(([,v])=>v);
  const mTotal=groups(M).reduce((a,g)=>a+(g.missions||[]).length,0),cTotal=groups(C).reduce((a,g)=>a+(g.items||[]).length,0);
  $('#guideCards').innerHTML=guideCard('/guides/ammo-finder','🎯','Ammo finder','Pick an animal and see every ammo that passes integrity, and the weapons that fire it',0,0,1)
    +guideCard('/guides/great-ones','👑','Great Ones',`The ${goList.length} legendary animals and how to make one spawn`,greatOnesGot().size,goList.length)
    +guideCard('/guides/missions','📋','Missions',`${mTotal||'Mission'} missions to tick off`,Object.keys(md).length,mTotal)
    +guideCard('/guides/collectibles','🧭','Collectibles',`${cTotal||'Collectible'} items by reserve`,Object.keys(cd).length,cTotal)
    +guideCard('/guides/weapons','🔫','Weapons & ammo','Every weapon and ammo type with its class range')
    +guideCard('/guides/skills','🧠','Skills & perks','Every skill and perk, with a points planner')
    +guideCard('/guides/how-it-works','📘','How hunting works','Difficulty, trophy scores, need zones, integrity and furs')
    +`<a class="guideCard wide" href="https://callofthewild.thehunter.com" target="_blank" rel="noopener"><span class="gIcon">🌐</span><span><strong>Official site</strong><small>News, patch notes and DLC from Expansive Worlds (opens the website)</small></span><span aria-hidden="true">↗</span></a>`
    +guideCard('/guides/credits','📷','Credits','Who made the logo, who took the animal photos, and where the data comes from',0,0,1);
}
// Credits: every animal photo's photographer and licence (CC BY needs the credit), plus fonts and data.
async function buildCredits(){
  const P=await photoJson();if(screen!=='guide')return;
  const rows=Object.entries(P).sort(([a],[b])=>a.localeCompare(b)).map(([s,p])=>`<tr><td>${esc(s)}</td><td>${esc(p.by)}</td><td>${licLink(p)}</td><td>${p.link?`<a href="${esc(p.link)}" target="_blank" rel="noopener">iNaturalist</a>`:''}</td></tr>`).join('');
  gv.innerHTML=guideTitle('Guides','Credits','The animal photos are real wildlife from iNaturalist photographers, not pictures from the game. Each one is used under the licence shown.')
    +`<div class="section"><h2>Logo</h2><p class="note">Logo made by Serena Da Silva.</p></div>
    <div class="section"><h2>Animal photos</h2>${rows?`<div class="card" style="overflow-x:auto"><table class="ratings"><thead><tr><th>Animal</th><th>Photographer</th><th>Licence</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="mutedBox">The photos are looked up when you open each animal, with the credit under the picture.</div>'}
    <p class="note">CC BY-NC photos may only be used in a free app.</p></div>
    <div class="section"><h2>Fonts</h2><p class="note">Barlow, Barlow Condensed and IBM Plex Mono, under the SIL Open Font License.</p></div>
    <div class="section"><h2>Game data</h2><p class="note">From community sources, credited on each page: CoTW Guide, The Wild Register, the official site and patch notes, Steam guides and fan wikis. Not affiliated with Expansive Worlds.</p></div>`;
}
function guideTitle(eyebrow,title,p){return `<div class="hero slim"><div class="eyebrow">${eyebrow}</div><h1>${title}</h1>${p?`<p>${p}</p>`:''}</div>`}
async function buildGuide(sub){
  gv.innerHTML=guideTitle('Guides','Loading…');
  try{
    if(sub==='great-ones')await buildGreatOnes();
    else if(sub==='missions'||sub==='collectibles')await buildChecklist(sub);
    else if(sub==='weapons'){if(store.get('wTab','finder')==='finder')store.set('wTab','weapons');await buildWeapons()}
    else if(sub==='ammo-finder'){store.set('wTab','finder');await buildWeapons()}
    else if(sub==='skills')await buildSkills();
    else if(sub==='how-it-works')await buildMechanics();
    else if(sub==='credits')await buildCredits();
    else nav('/guides');
  }catch(e){gv.innerHTML=guideTitle('Guides','Guides')+loadFail}
}
gv.onclick=e=>{
  const t=e.target,go1=t.closest('[data-go1]');if(go1)return nav('/guides/great-ones/'+encodeURIComponent(go1.dataset.go1));
  const sp=t.closest('[data-splink]');if(sp){const [rn,...p]=sp.dataset.splink.split('::');return go(rn,p.join('::'))}
  const tg=t.closest('#goToggle');if(tg){const on=toggleGreatOne(tg.dataset.name);haptic(on?[15,30,15]:10);tg.classList.toggle('primary',!on);tg.textContent=on?'✓ Harvested':'＋ Mark as harvested';toast(on?tg.dataset.name+' Great One marked 👑':'Unmarked');return}
};

// Great Ones: a list, and a page per species. great-ones.json adds the details when it is available.
async function goData(){try{const g=await guide('great-ones');return Array.isArray(g)?g:(g.greatOnes||[])}catch(e){return []}}
const goCard=(s,got)=>`<button class="legendCard${got.has(s)?' got':''}" data-go1="${esc(s)}">${pic(s,'imgFallback')}<span><strong>${esc(s)}</strong><small>${esc(DATA.species[s].reserves.map(short).join(', '))}</small></span>${got.has(s)?'<em>✓ Harvested</em>':''}</button>`;
async function buildGreatOnes(){
  const G=await goData();if(screen!=='guide')return;
  const list=[...new Set([...SPECIES.filter(s=>DATA.species[s].greatOne),...G.map(g=>g.species).filter(s=>DATA.species[s])])].sort(),got=greatOnesGot();
  document.title='Great Ones · Hunter Guide';
  gv.innerHTML=guideTitle('Guides','Great Ones',`${got.size} of ${list.length} harvested. Great Ones are the rarest animals in the game: a fabled level with unique furs and the highest trophy scores.`)
    +`<div class="section legendGrid">${list.map(s=>goCard(s,got)).join('')}</div>`+(G.length?'':'<p class="note">More detail on each Great One is on the way.</p>');hydratePhotos(gv);
}
async function buildGreatOne(s){
  const G=await goData();if(screen!=='legend')return;
  const d=DATA.species[s];if(!d){nav('/guides/great-ones');return}
  const g=G.find(x=>x.species===s)||{},got=greatOnesGot().has(s),gfurs=(g.furs&&g.furs.length?g.furs.map(f=>typeof f==='string'?f:f.name):(d.furs||[]).filter(f=>/great one|fabled/i.test(f.name+' '+f.rarity)).map(f=>f.name));
  const reserves=(g.reserves&&g.reserves.length?g.reserves:d.reserves).map(n=>RESERVES.find(r=>r===n||r.startsWith(n)||n.startsWith(r))||n);
  document.title=s+' Great One · Hunter Guide';
  gv.innerHTML=`<div class="hero"><div class="eyebrow">Great One</div><h1>👑 ${icon(s)} ${esc(s)}</h1>
    <div class="stats"><div class="pill">🎯 Class ${esc(d.class)}</div>${g.maxScore!=null?`<div class="pill">🏆 Up to ${score(g.maxScore)}</div>`:d.trophy.max!=null?`<div class="pill">🏆 Normal max ${score(d.trophy.max)}</div>`:''}${g.dateAdded?`<div class="pill">📅 Added ${esc(g.dateAdded)}</div>`:''}</div>
    <div class="anTools"><button class="toolAction${got?'':' primary'}" id="goToggle" data-name="${esc(s)}">${got?'✓ Harvested':'＋ Mark as harvested'}</button>${reserves.filter(n=>DATA.reserves[n]).map(n=>`<button class="toolAction" data-splink="${esc(n+'::'+s)}">${esc(short(n))} guide →</button>`).join('')}</div></div>
  <div class="detailgrid section"><div>
    <div class="card">${pic(s,'imageWrap spPhoto')}<div class="note" data-credit></div><p class="note">A Great One looks like a normal ${esc(s.toLowerCase())}, only bigger and with fabled fur.</p></div>
    <div class="card" style="margin-top:18px"><h2>How to make one spawn</h2>${g.howToSpawn?`<p class="story">${esc(g.howToSpawn)}</p>`:'<div class="mutedBox">Details coming soon.</div>'}${g.notes?`<p class="note">${esc(g.notes)}</p>`:''}</div>
  </div><div>
    <div class="card"><h2>Great One furs</h2>${gfurs.length?gfurs.map(f=>`<span class="tag r-GreatOne">${esc(f)}</span>`).join(''):'<div class="mutedBox">Not listed yet.</div>'}</div>
    <div class="card" style="margin-top:18px"><h2>Where</h2>${reserves.map(n=>`<span class="tag">${esc(n)}</span>`).join('')}</div>
  </div></div>${g.sources?`<div class="source">Sources: ${srcList(g.sources)}</div>`:''}`;
  hydratePhotos(gv);
}

// Missions and collectibles share one tick-off list design.
async function buildChecklist(kind){
  const data=await guide(kind);if(screen!=='guide')return;
  const isM=kind==='missions',key=isM?'missions':'collect',done=jget(key,{});
  const rn=DATA.reserves[store.get(key+'Reserve','')]?store.get(key+'Reserve',''):(R||store.get('reserve',RESERVES[0]));
  const hide=store.get(key+'Hide','')==='1',groups=(data[rn]||[]).filter(g=>!/^Map locations/.test(g.type||''));
  const id=(g,n)=>rn+'|'+g+'|'+n,items=g=>isM?(g.missions||[]).map(m=>m.name):(g.items||[]).map(i=>typeof i==='string'?i:i.name);
  const all=groups.flatMap(g=>items(g).map(n=>id(g.type,n))),doneHere=all.filter(k=>done[k]).length;
  document.title=(isM?'Missions':'Collectibles')+' · Hunter Guide';
  const rw=r=>r?[r.xp?`⭐ ${r.xp} XP`:'',r.cash?`💰 $${r.cash}`:'',r.items?`🎁 ${Array.isArray(r.items)?r.items.join(', '):r.items}`:''].filter(Boolean).join(' · '):'';
  gv.innerHTML=guideTitle('Guides',isM?'Missions':'Collectibles',isM?'Missions for each reserve with their objectives. Tick them off as you go.':'Collectibles in each reserve, grouped by type. Tick them off as you find them.')
  +`<div class="chipRow">${RESERVES.map(n=>`<button class="chip${n===rn?' active':''}" data-ck-reserve="${esc(n)}">${esc(short(n))}</button>`).join('')}</div>
  <div class="card ckSummary"><div><strong>${doneHere} of ${all.length}</strong> ${isM?'missions':'collectibles'} done in ${esc(rn)}</div><span class="bar"><i style="width:${all.length?doneHere/all.length*100:0}%"></i></span>
  <label class="switchLabel"><input type="checkbox" id="ckHide"${hide?' checked':''}> Hide finished</label></div>
  ${groups.length?groups.map(g=>{const its=items(g),gd=its.filter(n=>done[id(g.type,n)]).length;
    const rows=isM?(g.missions||[]).filter(m=>!(hide&&done[id(g.type,m.name)])).map(m=>{const k=id(g.type,m.name),obj=m.objectives||[];
      return `<details class="ckRow${done[k]?' done':''}"><summary><button class="ckBox" data-ck="${esc(k)}" role="checkbox" aria-checked="${!!done[k]}" aria-label="Done: ${esc(m.name)}"></button><span class="ckName">${esc(m.name)}</span><span class="ckMeta">${rw(m.reward)}</span></summary>
        <div class="ckBody">${m.desc?`<p>${esc(m.desc)}</p>`:''}${obj.length?`<ol>${obj.map(o=>`<li>${esc(o)}</li>`).join('')}</ol>`:'<p class="muted">Objectives not listed yet.</p>'}</div></details>`}).join('')
      :its.filter(n=>!(hide&&done[id(g.type,n)])).map(n=>{const k=id(g.type,n);return `<div class="ckRow plain${done[k]?' done':''}"><button class="ckBox" data-ck="${esc(k)}" role="checkbox" aria-checked="${!!done[k]}" aria-label="Found: ${esc(n)}"></button><span class="ckName">${esc(n)}</span></div>`}).join('');
    const extra=!isM&&g.count&&g.count>its.length?`<p class="note">${g.count} in the reserve; ${its.length?its.length+' named so far':'names not listed yet'}.</p>`:'';
    return `<section class="card ckGroup"><h2>${esc(g.type)} ${its.length?`<span class="muted">${gd}/${its.length}</span>`:''}</h2>${g.about?`<p class="note">${esc(g.about)}</p>`:''}${extra}${rows||(its.length?'<div class="mutedBox">All done here. 🎉</div>':'')}</section>`}).join(''):'<div class="mutedBox">Nothing listed for this reserve yet.</div>'}
  ${data.notes?`<details class="notes"><summary>About this data</summary><p>${esc(typeof data.notes==='string'?data.notes:JSON.stringify(data.notes))}</p></details>`:''}
  <div class="source">Sources: ${srcList(data.sources)}</div>`;
  gv.onchange=e=>{if(e.target.id==='ckHide'){store.set(key+'Hide',e.target.checked?'1':'');buildChecklist(kind)}};
  gv.querySelectorAll('[data-ck-reserve]').forEach(b=>b.onclick=()=>{store.set(key+'Reserve',b.dataset.ckReserve);buildChecklist(kind)});
  gv.querySelectorAll('.ckBox').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const d=jget(key,{}),k=b.dataset.ck;
    if(d[k])delete d[k];else d[k]=1;jset(key,d);haptic(8);
    const row=b.closest('.ckRow');row.classList.toggle('done',!!d[k]);b.setAttribute('aria-checked',String(!!d[k]));
    if(hide&&d[k])setTimeout(()=>buildChecklist(kind),250);else{const all2=all.filter(x=>d[x]).length,s=$('.ckSummary',gv);s.firstElementChild.innerHTML=`<strong>${all2} of ${all.length}</strong> ${isM?'missions':'collectibles'} done in ${esc(rn)}`;$('.bar i',s).style.width=(all.length?all2/all.length*100:0)+'%'}});
}

// Weapons & ammo: an ammo finder for any animal, plus the weapon list from weapons.json.
async function buildWeapons(){
  let W=null;try{W=await guide('weapons')}catch(e){}
  if(screen!=='guide')return;
  const tab=store.get('wTab','finder'),weapons=(W&&W.weapons)||[],ammo=(W&&W.ammo)||[];
  document.title='Weapons & ammo · Hunter Guide';
  gv.innerHTML=guideTitle('Guides','Weapons & ammo','Pick an animal to see the ammo that earns the integrity bonus, or browse every weapon.')
  +`<div class="chipRow" role="tablist">${[['finder','Ammo finder'],['weapons','Weapons'],['ammo','Ammo']].map(([k,l])=>`<button class="chip${tab===k?' active':''}" data-wtab="${k}" role="tab" aria-selected="${tab===k}">${l}</button>`).join('')}</div><div id="wBody"></div>
  ${W&&W.sources?`<div class="source">Sources: ${srcList(W.sources)}</div>`:''}`;
  gv.querySelectorAll('[data-wtab]').forEach(b=>b.onclick=()=>{store.set('wTab',b.dataset.wtab);buildWeapons()});
  const body=$('#wBody');
  if(tab==='finder'){
    const s=DATA.species[store.get('ammoSpecies','')]?store.get('ammoSpecies',''):SPECIES[0],d=DATA.species[s];
    const fits=ammo.filter(a=>a.classMin!=null&&a.classMax!=null&&d.class>=a.classMin&&d.class<=a.classMax).map(a=>a.name);
    const rows=weapons.map(w=>({w,a:(w.ammo||[]).filter(x=>fits.includes(x))})).filter(x=>x.a.length);
    body.innerHTML=`<div class="card"><div class="toolFields"><label>Animal<select id="wSp" class="select">${opts(SPECIES,s)}</select></label></div>
      <div class="ghOut"><div class="row"><small>Class</small><strong>${esc(d.class)} · ${esc(d.difficulty||'')}</strong></div>
      ${rows.length?`<div class="row"><small>${rows.length} weapons with ammo rated for class ${esc(d.class)}</small>${rows.map(x=>`<div class="wl"><strong>${esc(x.w.name)}</strong> <em>${esc(x.w.type||'')}</em><div>${esc(x.a.join(', '))}</div></div>`).join('')}</div>`:''}
      ${d.ammo.length?`<div class="row"><small>Integrity ammo from the community chart</small><span>${d.ammo.map(a=>`<span class="tag">${esc(a)}</span>`).join('')}</span></div>`:''}
      ${!rows.length&&!d.ammo.length?'<div class="mutedBox">No ammo listed for this animal yet.</div>':''}</div>
      <p class="note">Ammo rated for the animal's class gives a clean, ethical kill and the integrity bonus to your hunter score. Ammo too light leaves a wounded animal; ammo too heavy damages the trophy.</p></div>`;
    $('#wSp').onchange=e=>{store.set('ammoSpecies',e.target.value);buildWeapons()};
  }else{
    const isW=tab==='weapons',items=isW?weapons:ammo;
    if(!items.length){body.innerHTML='<div class="mutedBox">The full weapon and ammo list is on the way.</div>';return}
    const types=[...new Set(items.map(x=>x.type).filter(Boolean))].sort();
    body.innerHTML=`<div class="searchbar"><input class="input" id="wq" placeholder="Search ${tab}…">${types.length>1?`<select class="select" id="wtype"><option value="">All types</option>${opts(types)}</select>`:''}</div><div id="wcount" class="note"></div><div class="gearGrid" id="wGrid"></div>`;
    const dl=(k,v)=>v==null||v===''||(Array.isArray(v)&&!v.length)?'':`<div><dt>${k}</dt><dd>${esc(Array.isArray(v)?v.map(x=>typeof x==='string'?x:x.name).join(', '):v)}</dd></div>`;
    const draw=()=>{const q=$('#wq').value.trim().toLowerCase(),ty=$('#wtype')?$('#wtype').value:'';
      const list=items.filter(x=>(!q||JSON.stringify(x).toLowerCase().includes(q))&&(!ty||x.type===ty));
      $('#wcount').textContent=`${list.length} of ${items.length}`;
      $('#wGrid').innerHTML=list.map(x=>`<div class="gearItem"><strong>${esc(x.name)}</strong>${x.about?`<small class="muted">${esc(x.about)}</small>`:''}<dl>${isW?dl('Type',x.type)+dl('Action',x.action)+dl('Classes',x.classRange?x.classRange.join('–'):null)+dl('Ammo',x.ammo)+dl('Magazine',x.magazine)+dl('From',x.dlc)+dl('Price',x.price):dl('Type',x.type)+dl('Caliber',x.caliber)+dl('Classes',x.classMin!=null?x.classMin+'–'+x.classMax:null)+dl('Penetration',x.penetration)+dl('Expansion',x.expansion)}</dl>${x.notes?`<small class="muted">${esc(x.notes)}</small>`:''}</div>`).join('')||'<div class="mutedBox">Nothing matches.</div>'};
    body.oninput=draw;body.onchange=draw;draw();
  }
}

// Skills & perks, with a planner: tap + / − to spend points; the plan is saved on this device.
async function buildSkills(){
  const S=await guide('skills');if(screen!=='guide')return;
  const tab=store.get('skTab','skills'),plan=jget('skillPlan',{}),groups=S[tab]||{},cap=tab==='skills'?S.pointsEarned?.maxSkillPoints:S.pointsEarned?.maxPerkPoints;
  const spent=Object.values(groups).flat().reduce((a,x)=>a+(plan[tab+'|'+x.name]||0),0);
  document.title='Skills & perks · Hunter Guide';
  gv.innerHTML=guideTitle('Guides','Skills & perks',esc(S.pointsEarned?.about||''))
  +`<div class="chipRow">${[['skills','Skills'],['perks','Perks']].map(([k,l])=>`<button class="chip${tab===k?' active':''}" data-sktab="${k}">${l}</button>`).join('')}</div>
  <div class="card ckSummary"><div><strong>${spent}${cap?' of '+cap:''}</strong> ${tab==='skills'?'skill':'perk'} points planned</div>${cap?`<span class="bar"><i style="width:${Math.min(100,spent/cap*100)}%"></i></span>`:''}<button class="toolAction" id="skReset">Clear this plan</button></div>
  ${Object.entries(groups).map(([tree,list])=>`<section class="card skTree"><h2>${esc(tree)}</h2>${list.map(x=>{const k=tab+'|'+x.name,p=plan[k]||0;return `<div class="skItem"><div class="skHead"><strong>${esc(x.name)}</strong><span class="skPts"><button class="iconBtn" data-sk="${esc(k)}" data-d="-1" aria-label="Remove a point">−</button><b>${p}/${x.maxPoints??'?'}</b><button class="iconBtn" data-sk="${esc(k)}" data-d="1" data-max="${x.maxPoints??9}" aria-label="Add a point">＋</button></span></div><small>${esc(x.unlock||'')}</small>${(x.levels||[]).some(Boolean)?`<ol>${x.levels.map((l,i)=>`<li class="${i<p?'on':''}">${esc(l||'Effect not listed yet')}</li>`).join('')}</ol>`:''}${x.about?`<small>${esc(x.about)}</small>`:''}</div>`}).join('')}</section>`).join('')}
  <div class="source">Sources: ${srcList(S.sources)} (effects are paraphrased from community sources).</div>`;
  gv.querySelectorAll('[data-sktab]').forEach(b=>b.onclick=()=>{store.set('skTab',b.dataset.sktab);buildSkills()});
  $('#skReset').onclick=()=>{const p=jget('skillPlan',{});for(const k of Object.keys(p))if(k.startsWith(tab+'|'))delete p[k];jset('skillPlan',p);buildSkills()};
  gv.querySelectorAll('[data-sk]').forEach(b=>b.onclick=()=>{const p=jget('skillPlan',{}),k=b.dataset.sk,v=Math.max(0,Math.min(+(b.dataset.max||9),(p[k]||0)+ +b.dataset.d));if(v)p[k]=v;else delete p[k];jset('skillPlan',p);haptic(6);const y=scrollY;buildSkills().then(()=>scrollTo(0,y))});
}

// How it works: renders mechanics.json, whatever its shape (text, lists and tables of values).
async function buildMechanics(){
  const M=await guide('mechanics');if(screen!=='guide')return;
  const title=k=>k.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  const cell=x=>x==null?'—':typeof x==='boolean'?(x?'Yes':'No'):typeof x==='object'?esc(Array.isArray(x)?x.map(y=>typeof y==='object'?Object.values(y).join(' '):y).join(', '):Object.values(x).join(', ')):esc(x);
  const table=v=>{const cols=[...new Set(v.flatMap(o=>Object.keys(o)))].filter(k=>k!=='sources');return `<div style="overflow-x:auto"><table class="ratings"><thead><tr>${cols.map(c=>`<th>${esc(title(c))}</th>`).join('')}</tr></thead><tbody>${v.map(o=>`<tr>${cols.map(c=>`<td>${cell(o[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`};
  const val=v=>v==null?'—':Array.isArray(v)?(v.every(x=>typeof x!=='object')?`<ul>${v.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:table(v.filter(x=>x&&typeof x==='object'))):typeof v==='object'?`<dl>${Object.entries(v).filter(([k])=>k!=='sources').map(([k,x])=>`<dt>${esc(title(k))}</dt><dd>${typeof x==='object'&&x?val(x):esc(x)}</dd>`).join('')}</dl>`:`<p>${esc(v)}</p>`;
  document.title='How it works · Hunter Guide';
  gv.innerHTML=guideTitle('Guides','How it works','The systems behind a good hunt.')
  +Object.entries(M).filter(([k])=>k!=='sources').map(([k,v])=>`<section class="card mech" style="margin-top:14px"><h2>${esc(title(k))}</h2>${val(v)}</section>`).join('')
  +`<div class="source">Sources: ${srcList(M.sources)}</div>`;
}

// ================================================================ ROUTING
const DEPTH={home:0,log:0,guides:0,reserve:1,guide:1,species:2,legend:2};
const TAB_OF={home:'home',log:'log',guides:'guides',guide:'guides',legend:'guides',reserve:'reserve',species:'reserve'};
function setScreen(name){
  const el={home,log:lv,guides:gv,guide:gv,legend:gv,reserve:rv,species:fv}[name];
  if(screen&&screen!==name&&!reduceMotion){const dir=DEPTH[name]>DEPTH[screen]?'fwd':DEPTH[name]<DEPTH[screen]?'back':'fade';
    el.classList.remove('enter-fwd','enter-back','enter-fade');void el.offsetWidth;el.classList.add('enter-'+dir)}
  screen=name;
  $$('[data-tab]').forEach(b=>{const on=b.dataset.tab===TAB_OF[name];b.classList.toggle('active',on);on?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current')});
  back.hidden=!DEPTH[name]||name==='reserve';sel.hidden=!(name==='reserve'||name==='species');
}
const showOnly=el=>{for(const s of [home,rv,fv,lv,gv])s.hidden=s!==el};
function route(){
  const raw=location.hash.slice(1);
  if(navStack.length>1&&navStack[navStack.length-2]===location.hash)navStack.pop();else if(navStack[navStack.length-1]!==location.hash)navStack.push(location.hash);
  const path=decodeURIComponent(raw.startsWith('/')?raw.slice(1):raw).split('/'),top=path[0].toLowerCase();
  const fromTop=!home.hidden||!lv.hidden||!gv.hidden;
  if(!raw||raw==='/'||top===''||top==='home'){
    showOnly(home);setScreen('home');
    if(!home.dataset.built){buildHome();home.dataset.built='1'}else renderMoving();
    document.title='Hunter Guide · Home';scrollTo(0,0);return;
  }
  if(top==='log'){showOnly(lv);setScreen('log');buildLog();document.title='My log · Hunter Guide';scrollTo(0,0);return}
  if(top==='guides'){
    showOnly(gv);const sub=path[1]||'',item=path.slice(2).join('/');
    if(!sub){setScreen('guides');buildGuides();document.title='Guides · Hunter Guide'}
    else if(sub==='great-ones'&&item){setScreen('legend');buildGreatOne(item)}
    else{setScreen('guide');buildGuide(sub)}
    scrollTo(0,0);return;
  }
  showOnly(rv);if(fromTop){lastSp=null;scrollTo(0,0)}
  let rn=path[0];
  if(!DATA.reserves[rn])rn=DATA.reserves[store.get('reserve','')]?store.get('reserve',''):RESERVES[0];
  if(R!==rn){R=rn;store.set('reserve',rn);lastSp=null;built=null;buildReserve();sel.value=rn;scrollTo(0,0)}
  const s=path[1]&&DATA.reserves[R].species.includes(path[1])?path[1]:null;showSp(s);setScreen(s?'species':'reserve');
}
function parentOf(){ // where "back" goes when there is no in-app history
  if(screen==='species')return '/'+encodeURIComponent(R);
  if(screen==='legend')return '/guides/great-ones';
  if(screen==='guide')return '/guides';
  return '/';
}
function goUp(){if(navStack.length>1)history.back();else nav(parentOf())}
sel.innerHTML=opts(RESERVES);
sel.onchange=()=>go(sel.value);back.onclick=()=>nav(parentOf());$('#homeBtn').onclick=goHome;

// ================================================================ SETTINGS, THEME
let theme=store.get('theme','dark');
function applyTheme(){document.documentElement.dataset.theme=theme;
  const light=theme==='light'||(theme==='auto'&&matchMedia('(prefers-color-scheme: light)').matches);
  $('meta[name=theme-color]').setAttribute('content',light?'#f5f4ee':'#0e110d')}
matchMedia('(prefers-color-scheme: light)').addEventListener('change',()=>{if(theme==='auto')applyTheme()});
applyTheme();
const openSettings=()=>{if(!$('#set').open)$('#set').showModal()};
$('#gear').onclick=openSettings;$('#logBtn').onclick=()=>nav('/log');$('#guidesBtn').onclick=()=>nav('/guides');$('#close').onclick=()=>$('#set').close();
$('#set').onclick=e=>{const u=e.target.closest('[data-u]'),c=e.target.closest('[data-clock]'),th=e.target.closest('[data-theme-pick]');
  if(e.target.id==='set')e.target.close();
  if(u){unit=u.dataset.u;store.set('unit',unit)}if(c){clock=c.dataset.clock;store.set('clock',clock)}if(th){theme=th.dataset.themePick;store.set('theme',theme);applyTheme()}
  if(e.target.closest('#exportBtn'))exportBackup();if(e.target.closest('#importBtn'))$('#importFile').click();
  if(u||c||th)refresh()};
addEventListener('hashchange',route);route();refresh();
$('#appVersion').textContent=APP_VERSION;

// Tab bar
$('#tabs').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;haptic(8);const t=b.dataset.tab;
  if(t==='settings')return openSettings();
  if(TAB_OF[screen]===t&&DEPTH[screen]===0||t==='reserve'&&screen==='reserve')return scrollTo({top:0,behavior:'smooth'});
  if(t==='home')goHome();else if(t==='log')nav('/log');else if(t==='guides')nav('/guides');
  else{const rn=R||store.get('reserve','');go(DATA.reserves[rn]?rn:RESERVES[0])}};

// Intro: plays on every launch, tap to skip.
const intro=$('#intro');let introTimer=0;
function endIntro(){if(intro.classList.contains('out'))return;clearTimeout(introTimer);intro.classList.add('out');setTimeout(()=>{intro.hidden=true},450)}
function playIntro(){intro.hidden=false;intro.classList.remove('out','play');void intro.offsetWidth;intro.classList.add('play');clearTimeout(introTimer);introTimer=setTimeout(endIntro,reduceMotion?900:3700)}
intro.onclick=endIntro;introTimer=setTimeout(endIntro,reduceMotion?900:3700);
$('#replayIntro').onclick=()=>{$('#set').close();playIntro()};
$('#creditsBtn').onclick=()=>{$('#set').close();nav('/guides/credits')};

// Swipe from the left edge to go back (installed app only; browsers have their own gesture).
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone){
  let sx=0,sy=0,dx=0,el=null;
  addEventListener('touchstart',e=>{const t=e.touches[0];el=null;if(e.touches.length!==1||t.clientX>24||!DEPTH[screen]||logDlg.open||e.target.closest('input[type=range]'))return;
    sx=t.clientX;sy=t.clientY;dx=0;el={species:fv,reserve:rv,guide:gv,legend:gv}[screen]||null},{passive:true});
  addEventListener('touchmove',e=>{if(!el)return;const t=e.touches[0];dx=t.clientX-sx;
    if(Math.abs(t.clientY-sy)>Math.abs(dx)&&dx<24){el.style.transform=el.style.opacity='';el=null;return}
    el.style.transform=`translateX(${Math.max(0,dx)}px)`;el.style.opacity=1-Math.min(.5,Math.max(0,dx)/500)},{passive:true});
  addEventListener('touchend',()=>{if(!el)return;const v=el;el=null;v.style.transition='transform .2s ease,opacity .2s ease';
    if(dx>90){haptic();goUp()}v.style.transform=v.style.opacity='';setTimeout(()=>{v.style.transition=''},220)});
}

// Offline badge
const offline=$('#offline'),net=()=>{offline.hidden=navigator.onLine};addEventListener('online',net);addEventListener('offline',net);net();
// Service worker: offline support plus an "update ready" prompt when a new release is installed.
if('serviceWorker' in navigator)addEventListener('load',()=>{
  let updating=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updating)location.reload()});
  navigator.serviceWorker.register('./service-worker.js').then(reg=>{
    const offer=w=>{if(!w||!navigator.serviceWorker.controller)return;const u=$('#update');u.hidden=false;
      $('#updateBtn').onclick=()=>{updating=true;u.querySelector('span').textContent='Updating…';w.postMessage('skipWaiting')}};
    offer(reg.waiting);
    reg.addEventListener('updatefound',()=>{const w=reg.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed')offer(w)})});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)reg.update().catch(()=>{})});
  }).catch(()=>{});
});
