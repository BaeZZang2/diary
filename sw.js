/* 마음결 서비스 워커 — 오프라인 실행용 */
const CACHE = 'maeumgyeol-v76';
/* 앱 화면은 반드시 제대로 받아야 하는 것. 아이콘·설치 정보는 없어도 앱은 돈다. */
const MUST = ['./', './index.html'];
const NICE = ['./manifest.webmanifest', './icon-192.png', './icon-512.png'];

/* 설치할 때는 서버에서 새로 받아온다 (브라우저 캐시를 타지 않도록).
   예전에는 받아온 것이 404 페이지든 서버 오류든 그대로 넣고, 아예 못 받아도
   조용히 넘어간 뒤 새 판으로 갈아탔다. 갈아타면서 멀쩡하던 옛 캐시를 지우므로,
   인터넷이 없을 때 오류 페이지가 앱으로 열리거나 아무것도 안 열릴 수 있었다.
   그래서 꼭 필요한 것이 하나라도 어긋나면 설치를 접는다 — 쓰던 판과 그 캐시가
   그대로 남고, 다음 기회에 다시 시도한다. */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const grab = async u => {
      const r = await fetch(new Request(u, { cache: 'reload' }));
      if (!r.ok) throw new Error(u + ' ' + r.status);
      await c.put(u, r);
    };
    try {
      await Promise.all(MUST.map(grab));
      await Promise.all(NICE.map(u => grab(u).catch(() => { })));
    } catch (err) {
      await caches.delete(CACHE);       /* 반쪽짜리 캐시를 남기지 않는다 */
      throw err;                        /* 설치 실패 — 옛 판이 계속 쓰인다 */
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  /* 서버에서 새로 받아 캐시에 넣고 내준다. 인터넷이 없으면 캐시를 쓴다.
     '404 페이지' 나 '서버 오류' 도 응답은 응답이라 그냥 받으면 멀쩡히 넣어 둔 파일을
     오류 페이지로 덮어쓴다. 그러면 다음에 인터넷이 없을 때 오류 페이지가 앱으로
     열린다. 그래서 제대로 온 응답(res.ok)일 때만 넣고, 아니면 캐시 쪽을 쓴다. */
  const freshFirst = (key, fallbackKey) => e.respondWith(
    fetch(new Request(req.url, { cache: 'no-cache' })).then(res => {
      if (!res.ok) throw new Error('bad response ' + res.status);
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(key, copy)).catch(() => { });
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match(fallbackKey)))
  );

  /* 앱 화면(HTML)은 새 버전을 먼저 확인하고, 인터넷이 없을 때만 캐시를 쓴다.
     캐시부터 쓰면 앱을 고쳐도 다음 실행까지 옛 화면이 계속 보인다. */
  if (req.mode === 'navigate' || req.destination === 'document') {
    freshFirst('./index.html', './index.html');
    return;
  }

  /* 설치 정보(manifest)도 새 것을 먼저 확인한다.
     폰은 홈 화면에 깔린 앱의 설정 — 상단 상태바 색, 이름, 아이콘 — 을 이 파일에서
     읽어 앱 안에 새겨 둔다. 그러고는 가끔 다시 읽으러 온다. 그때 캐시에 있던
     옛 파일을 건네주면 폰은 "바뀐 게 없네" 하고 옛 색을 계속 쓴다.
     실제로 상태바가 예전 어두운 색에서 넘어오지 않던 까닭이 여기에 있었다. */
  if (req.destination === 'manifest' || /manifest\.webmanifest($|\?)/.test(req.url)) {
    freshFirst(req, './manifest.webmanifest');
    return;
  }

  /* 그 밖의 파일(아이콘·글꼴 등)은 캐시를 먼저 쓴다.
     여기서도 제대로 온 것만 넣어 둔다 — 잠깐의 오류를 넣어 두면 계속 그것만 나온다.
     다만 다른 집(글꼴 서버 등)에서 온 것은 속을 들여다볼 수 없게 잠겨 온다(opaque).
     성공인지 실패인지 알 길이 없지만, 이것까지 빼면 글꼴이 오프라인에서 사라진다.
     잠겨 온 것은 예전처럼 그대로 넣어 둔다. */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => { });
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
