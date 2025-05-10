// 緩存名稱與版本
const CACHE_NAME = 'chicken-employee-v1';

// 需要緩存的資源
const urlsToCache = [
  '/employee/login',
  '/employee/punch',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('已開啟緩存');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 強制使新的 Service Worker 立即激活
  );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 刪除不是當前版本的舊緩存
          if (cacheName !== CACHE_NAME) {
            console.log('刪除舊緩存:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 使新的 Service Worker 立即接管所有頁面
  );
});

// 攔截網絡請求
self.addEventListener('fetch', (event) => {
  // 如果是 API 請求，優先使用網絡
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // 對於其他資源，使用 "Cache first, falling back to network" 策略
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果在緩存中找到資源，則直接返回
        if (response) {
          return response;
        }

        // 否則從網絡獲取資源
        return fetch(event.request)
          .then((response) => {
            // 檢查是否是有效的響應
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // 需要複製響應以同時將其放入緩存和返回給瀏覽器
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // 如果網絡請求失敗，可以返回特定的離線頁面
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            
            return new Response('Internet connection not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// 處理推送通知
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: {
      url: data.url || '/employee/punch'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// 處理通知點擊
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
}); 