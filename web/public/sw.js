const CACHE_NAME = 'teklif-ai-v5-notifications-' + new Date().getTime(); // Force update v5 for notifications
const urlsToCache = [
    '/',
    '/proposals',
    '/upload',
    '/chat',
    '/reports',
    '/representatives',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch((err) => {
                console.log('Cache install failed:', err);
            })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip all non-GET requests immediately
    if (event.request.method !== 'GET') return;

    // Skip API, Supabase, and extension requests
    const url = event.request.url;
    if (url.includes('/api/') ||
        url.includes('supabase.co') ||
        url.includes('/functions/') ||
        url.includes('manifest.json') || // Don't cache manifest to avoid auth issues?
        url.includes('chrome-extension')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cached version or fetch from network
                if (response) {
                    return response;
                }
                return fetch(event.request).then((response) => {
                    // Don't cache non-successful responses
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    // Clone and cache the response
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    return response;
                });
            })
    );
});

// Push Event
self.addEventListener('push', function (event) {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: '2',
                url: data.url || '/'
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Görüntüle',
                    icon: '/icons/checkmark.png'
                }
            ]
        };
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification Click Event
self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        }).then(function (clientList) {
            const url = event.notification.data.url;

            // If the app is already open, focus it
            for (const client of clientList) {
                if (('focus' in client))
                    return client.focus();
            }
            // If not open, open a new window
            if (clients.openWindow)
                return clients.openWindow(url);
        })
    );
});
