// ChatCity Service Worker — Firebase Messaging
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAVKGyPWWQzEWfwkOwhwXabD3HbuLQz-qA",
  authDomain: "chatcity-63c68.firebaseapp.com",
  databaseURL: "https://chatcity-63c68-default-rtdb.firebaseio.com",
  projectId: "chatcity-63c68",
  storageBucket: "chatcity-63c68.appspot.com",
  messagingSenderId: "961766102206",
  appId: "1:961766102206:web:e8f0f8c7b8e3d5c4a2b1c0"
});

const messaging = firebase.messaging();

console.log('🔔 Service Worker: FCM initialized');

messaging.onBackgroundMessage(payload => {
  console.log('📬 [BG] Background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'ChatCity';
  const notificationOptions = {
    body: payload.notification?.body || 'New message',
    icon: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3048/3048122.png',
    tag: 'chatcity-notification',
    requireInteraction: false,
    click_action: payload.notification?.clickAction || 'home.html'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', event => {
  console.log('👆 Notification clicked');
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('home.html');
      }
    })
  );
});
