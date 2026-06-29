const CACHE_NAME = 'ledger-v16'; // 更新版本號

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 安裝時，只乖乖快取本地的檔案，絕對不碰外部 CDN 避免報錯崩潰
      return cache.addAll([
        './',
        './index.html',
        './manifest.json'
      ]);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // 啟動時，無情刪除所有舊版本的快取，確保容量不被佔用
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // 只處理 HTTP/HTTPS 的 GET 請求，忽略 chrome-extension 等怪異請求
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 1. 如果快取裡面有 (包含之前有網路時順手存下來的 Tailwind 或 Lucide)，直接給！
      if (cachedResponse) {
        return cachedResponse;
      }

      // 2. 如果快取沒有，就去網路上抓
      return fetch(event.request).then(networkResponse => {
        // 抓回來後，順手存進快取裡備用 (動態快取的核心)
        if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 3. 真的斷網了，且快取也沒有時
        // 如果是要開啟網頁 (navigate)，給他看首頁的快取
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});