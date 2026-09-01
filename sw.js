/* 마음결 서비스 워커 — 오프라인 실행용 */
const CACHE = 'maeumgyeol-v43';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

/* 설치할 때는 서버에서 새로 받아온다 (브라우저 캐시를 타지 않도록) */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u =>
        fetch(new Request(u, { cache: 'reload' })).then(r => c.put(u, r)).catch(() => { }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* 앱 화면(HTML)은 새 버전을 먼저 확인하고, 인터넷이 없을 때만 캐시를 쓴다.
     캐시부터 쓰면 앱을 고쳐도 다음 실행까지 옛 화면이 계속 보인다. */
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(new Request(req.url, { cache: 'no-cache' })).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => { });
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  /* 그 밖의 파일(아이콘·글꼴 등)은 캐시를 먼저 쓴다 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => { });
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
