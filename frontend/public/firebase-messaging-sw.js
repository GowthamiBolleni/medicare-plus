importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Default client configuration for FCM background listeners.
// In production, these fields are overridden by environmental project config.
const firebaseConfig = {
  apiKey: "AIzaSyFakeKeyForPWAReceiveOnlyRemotely",
  authDomain: "medicare-plus.firebaseapp.com",
  projectId: "medicare-plus",
  storageBucket: "medicare-plus.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:mockappid12345"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification ? payload.notification.title : (payload.data ? payload.data.title : "💊 Medicine Reminder");
  const notificationBody = payload.notification ? payload.notification.body : (payload.data ? payload.data.body : "It is time to take your medication.");
  
  const notificationOptions = {
    body: notificationBody,
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data || {},
    actions: [
      { action: 'mark_taken', title: 'Mark Taken' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event);
  event.notification.close();
  
  const action = event.action;
  const medicineId = event.notification.data ? event.notification.data.medicine_id : null;
  
  // Handlers for foreground transitions and app refocusing
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // If we want to navigate them to a specific URL when marking taken, we can do client.navigate(...)
          if (action === 'mark_taken' && medicineId) {
            client.postMessage({ type: 'MARK_MEDICINE_TAKEN', medicineId: medicineId });
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
