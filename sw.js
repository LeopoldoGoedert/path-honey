const CACHE='path-honey-v1-6';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./assets/bioglow-campo-rgb.jpg','./assets/bioglow-campo-web.jpg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const clone=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return resp}).catch(()=>caches.match('./index.html')))));
