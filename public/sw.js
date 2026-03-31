self.addEventListener('push', event => {
  const data = event.data
    ? event.data.json()
    : { title: "Time's up!", body: '' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin)) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
