// Push notification handler for service worker

self.addEventListener('push', function (event) {
  if (!event.data) {
    console.log('Push event without data');
    return;
  }

  try {
    const payload = event.data.json();
    const title = payload.title || 'SCRAM Driver';
    const options = {
      body: payload.body || '',
      icon: payload.icon || '/pwa-192x192.png',
      badge: payload.badge || '/pwa-192x192.png',
      data: payload.data || {},
      actions: payload.actions || [],
      vibrate: [200, 100, 200],
      tag: payload.data?.type || 'scram-notification',
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error('Error showing notification:', error);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const data = event.notification.data || {};

  // Handle different notification types
  let targetUrl = '/';

  if (data.type === 'ADDRESS_CHANGE_REQUEST') {
    targetUrl = '/route'; // Navigate to route page where address changes are shown
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
