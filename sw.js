const CACHE_NAME = 'ledger-v5';

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 關鍵：只快取整個 scope，自動避開 GitHub 路徑問題
      return cache.add(self.registration.scope);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // 導覽請求（iOS 從主畫面開啟）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(new Request(event.request, { cache: 'no-store' }))
        .catch(() => caches.match(self.registration.scope))
    );
    return;
  }

  // 其他資源
  event.respondWith(
    fetch(new Request(event.request, { cache: 'no-store' }))
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
