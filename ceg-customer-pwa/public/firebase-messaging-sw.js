// firebase-messaging-sw.js

// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID" // Optional
};

firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || '新通知';
  const notificationOptions = {
    body: payload.notification?.body || '您有一條新消息',
    icon: payload.notification?.icon || '/icons/icon-192x192.png', // Default icon
    data: payload.data // Pass along data for click action
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Optional: Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification.data);
  event.notification.close();

  const data = event.notification.data || {};
  const clickPath = data.clickPath; // 優先使用 clickPath
  const orderId = data.orderId; // 作為備用或附加信息

  let targetUrl = '/'; // 默認打開根路徑

  if (clickPath) {
    targetUrl = clickPath;
  } else if (orderId) {
    // 如果沒有 clickPath 但有 orderId，可以構建一個默認的訂單相關路徑
    // 確保這個路徑與 PWA 的路由匹配
    targetUrl = `/order/${orderId}?fromNotification=true`; 
  }
  // 如果 PWA 期望總是以 /?params=value 的形式打開，則需要調整 targetUrl 的構建
  // 例如: targetUrl = `/?fromNotification=true${orderId ? '&orderId='+orderId : ''}${clickPath ? '&path='+clickPath : ''}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 檢查是否有已打開的 PWA 窗口
      for (const client of clientList) {
        // 這裡的 URL 比較可能需要更精確，取決於 PWA 的部署方式和 base URL
        // 如果 client.url 可以是 PWA 的任何內部路徑，則直接聚焦並嘗試導航
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          try {
            // 嘗試導航到目標 URL，如果 client 支持 navigate
            if (typeof client.navigate === 'function') {
              return client.navigate(targetUrl).then(c => c.focus());
            }
            // 否則，僅聚焦
            return client.focus(); 
          } catch (e) {
            console.warn("Error focusing or navigating client:", e);
            // 如果聚焦或導航失敗，則嘗試打開新窗口作為回退
            return clients.openWindow(targetUrl);
          }
        }
      }
      // 如果沒有已打開的 PWA 窗口，或者聚焦/導航失敗，則打開一個新窗口
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
}); 