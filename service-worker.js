
const CACHE_NAME = "heno-chat-v3";

const CORE_FILES = [
  "./",
  "./index.html",
  "./install.html",
  "./styles.css",
  "./manifest.json",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./js/app.js",
  "./js/auth.js",
  "./js/chat.js",
  "./js/social.js",
  "./js/media.js",
  "./js/calls.js",
  "./js/settings.js"
];

// تثبيت الإصدار الجديد
self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        CORE_FILES.map(async file => {
          try {
            const response = await fetch(file, {
              cache: "reload"
            });

            if (response.ok) {
              await cache.put(file, response);
            }
          } catch (error) {
            console.warn("[HENO] Cache skipped:", file);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

// تفعيل الإصدار الجديد وحذف الإصدارات القديمة
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith("heno-chat-") &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// الصفحات: الشبكة أولًا
// الملفات: الكاش أولًا بعد تحميل الإصدار الجديد
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      if (request.mode === "navigate") {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);

          if (response.ok) {
            await cache.put(request, response.clone());
          }

          return response;
        } catch (error) {
          return (
            await caches.match(request)
          ) || (
            await caches.match("./index.html")
          ) || new Response("أنت غير متصل بالإنترنت", {
            status: 503
          });
        }
      }

      const cached = await caches.match(request);

      if (cached) return cached;

      try {
        const response = await fetch(request);

        if (response.ok && response.type === "basic") {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }

        return response;
      } catch (error) {
        return new Response("", { status: 503 });
      }
    })()
  );
});
