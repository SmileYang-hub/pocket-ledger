const CACHE_NAME = 'ledger-v14';

// 需要快取的外部資源
const EXTERNAL_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Iansui&display=swap'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // 強制立即接管控制權
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 1. 快取你的主程式範圍 (index.html 等同網域資源)
      cache.add(self.registration.scope);
      // 2. 快取外部的 CDN 與字體資源
      return cache.addAll(EXTERNAL_ASSETS);
    }).catch(err => console.log('部分快取失敗，但仍繼續安裝:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      // 刪除舊版本的快取，確保拿到最新版
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // 立即套用新的 Service Worker
});

self.addEventListener('fetch', event => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    // 優先從快取中尋找資源（無論是本地檔案還是外部 CDN）
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // [背景更新策略]：如果快取有，先回傳快取讓畫面秒開。
        // 同時在背景偷偷去網路抓最新版，更新快取，這樣下次重新整理就會是新的。
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* 離線時背景更新失敗屬正常現象，忽略不計 */ });
        
        return cachedResponse;
      }

      // 如果快取沒有（第一次載入），就去網路拿
      return fetch(event.request).then(networkResponse => {
        // 拿到之後，順便存進快取，這樣下次離線就能用了
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 如果完全沒網路且快取也沒有，且是請求網頁本身，則回傳首頁快取
        if (event.request.mode === 'navigate') {
          return caches.match(self.registration.scope);
        }
      });
    })
  );
});