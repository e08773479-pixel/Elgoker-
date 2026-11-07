const CACHE_NAME = "heno-chat-v1";

const CORE_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/auth.js",
  "./js/chat.js",
  "./js/social.js",
  "./js/media.js",
  "./js/calls.js",
  "./js/settings.js"
];

// تثبيت التطبيق وتجهيز الملفات الأساسية
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      await Promise.allSettled(
        CORE_FILES.map(async (file) => {
          try {
            const response = await fetch(file, {
              cache: "reload"
            });

            if (response.ok) {
              await cache.put(file, response);
            }
          } catch (error) {
            console.warn("لم يتم تخزين الملف:", file);
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

// تفعيل النسخة الجديدة وحذف الكاش القديم
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) => key.startsWith("heno-chat-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })()
  );
});

// تحميل الملفات من الكاش أولًا ثم الشبكة
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // لا نتدخل في الطلبات الخارجية أو خدمات Firebase
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
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
        if (request.mode === "navigate") {
          return (
            await caches.match("./index.html")
          ) || new Response(
            "HENO CHAT غير متصل بالإنترنت حاليًا",
            {
              status: 503,
              headers: {
                "Content-Type": "text/plain; charset=utf-8"
              }
            }
          );
        }

        return new Response("", { status: 503 });
      }
    })()
  );
});
