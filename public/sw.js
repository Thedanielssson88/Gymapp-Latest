// Service Worker för Gymapp PWA
const CACHE_NAME = 'gymapp-v7-2.5kg-intervals';
const RUNTIME_CACHE = 'gymapp-runtime-v7-2.5kg-intervals';

// Resurser att cache:a direkt vid installation (endast filer som garanterat finns)
const PRECACHE_URLS = [
  '/manifest.json'
];

// Installation - förcacha kritiska resurser
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Precaching app shell');
        return cache.addAll(PRECACHE_URLS).catch(err => {
          console.warn('Service Worker: Precache misslyckades (fortsätter ändå)', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Aktivering - rensa gamla cacher
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Clearing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Network First strategi för API-anrop, Cache First för assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skippa cross-origin requests och chrome-extension
  if (url.origin !== location.origin && !url.origin.includes('supabase.co')) {
    return;
  }

  // Network First för API-anrop (Supabase)
  if (url.origin.includes('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cacha endast GET-requests (POST kan inte cachas)
          if (response.status === 200 && request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback till cache om offline (endast för GET)
          if (request.method === 'GET') {
            return caches.match(request);
          }
          return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Network ONLY för HTML och JavaScript - CACHA ALDRIG (för att undvika gamla versioner)
  if (request.destination === 'document' || url.pathname.endsWith('.js') || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Om offline, visa felmeddelande istället för gammal cache
        return new Response('Offline - kan inte ladda app', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // Cache First för statiska assets (bilder, CSS, etc)
  event.respondWith(
    caches.match(request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // Inte i cache - hämta från nätverk
        return fetch(request).then(response => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
  );
});

// Hantera meddelanden från appen
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
