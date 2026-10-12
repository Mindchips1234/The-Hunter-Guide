// Bump V on every release. Installed copies download the new files in the background
// and show an "A new version is ready" banner; tapping Update switches to it.
const V='hunter-guide-v0-3',IMG='hunter-guide-img-v1',SHELL=['./','./index.html','./app.js','./data/hunter-data.js','./data/great-ones.json','./data/weapons.json','./data/skills.json','./data/missions.json','./data/collectibles.json','./data/mechanics.json','./data/photos.json','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./fonts/barlow-condensed-latin-700-normal.woff2','./fonts/barlow-condensed-latin-800-normal.woff2','./fonts/barlow-latin-400-normal.woff2','./fonts/barlow-latin-500-normal.woff2','./fonts/barlow-latin-600-normal.woff2','./fonts/barlow-latin-700-normal.woff2','./fonts/ibm-plex-mono-latin-500-normal.woff2'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))).then(()=>{if(!self.registration.active)return self.skipWaiting()})));
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==IMG).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin||u.pathname.includes('/img/animals/')){
    // Animal photos: cache first so they work offline once seen.
    if(r.destination==='image')e.respondWith(caches.open(IMG).then(c=>c.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok)c.put(r,res.clone()).then(()=>c.keys()).then(k=>{if(k.length>400)c.delete(k[0])});return res}))));
    return;
  }
  // Own files: open instantly from the cache, refresh the cached copy in the background.
  e.respondWith(caches.open(V).then(c=>c.match(r,{ignoreSearch:true}).then(hit=>{
    const net=fetch(r).then(res=>{if(res.ok)c.put(r,res.clone());return res});
    if(hit){e.waitUntil(net.catch(()=>{}));return hit}
    return net.catch(()=>r.mode==='navigate'?c.match('./index.html'):Response.error());
  })));
});
