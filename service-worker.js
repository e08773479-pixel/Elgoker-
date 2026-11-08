
"use strict";

/* =========================================
   HENO CHAT — SERVICE WORKER
   Version: 1.0.2
   Cache: heno-chat-v4
========================================= */

const APP_VERSION = "1.0.2";
const CACHE_PREFIX = "heno-chat-";
const CACHE_NAME = `${CACHE_PREFIX}v4`;

const APP_ROOT = new URL("./", self.registration.scope);

const CORE_FILES = [
  "./",
  "./index.html",
  "./install.html",
  "./styles.css",
  "./manifest.json",
  "./js/app.js",
  "./js/auth.js",
  "./js/chat.js",
  "./js/social.js",
  "./js/media.js",
  "./js/calls.js",
  "./js/settings.js",
  "./pages/settings.html",
  "./pages/profile.html"
];

/* تحويل المسارات إلى روابط داخل نطاق التطبيق */
function appURL(path) {
  return new URL(path, APP_ROOT).href;
}

/* التأكد أن الطلب تابع للتطبيق */
function isAppRequest(request) {
  const url = new URL(request.url);

  return (
    url.origin === self.location.origin &&
    url.href.startsWith(APP_ROOT.href)
  );
}

/* =========================================
   INSTALL
========================================= */

self.addEventListener("install", event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      /* تخزين الملفات المتاحة فقط */
      await Promise.allSettled(
        CORE_FILES.map(async path => {
          const url = appURL(path);

          try {
            const response = await fetch(url, {
              cache: "reload"
            });

            if (response.ok) {
              await cache.put(url, response);
            }
          } catch (error) {
            /* الملف سيُحمّل عند توفر الاتصال */
          }
        })
      );

      await self.skipWaiting();
    })()
  );
});

/* =========================================
   ACTIVATE
========================================= */

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map(async name => {
          if (
            name.startsWith(CACHE_PREFIX) &&
            name !== CACHE_NAME
          ) {
            await caches.delete(name);
          }
        })
      );

      await self.clients.claim();

      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      clients.forEach(client => {
        client.postMessage({
          type: "HENO_UPDATE_ACTIVATED",
          version: APP_VERSION
        });
      });
    })()
  );
});

/* =========================================
   NETWORK FIRST
   للصفحات وملفات HTML
========================================= */

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) return cached;

    const fallback = await cache.match(appURL("./index.html"));

    if (fallback) return fallback;

    return new Response(
      "لا يوجد اتصال بالإنترنت. حاول مرة أخرى.",
      {
        status: 503,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      }
    );
  }
}

/* =========================================
   STALE WHILE REVALIDATE
   للصور وCSS وJavaScript والخطوط
========================================= */

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const update = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cached) {
    update.catch(() => {});
    return cached;
  }

  const fresh = await update;

  if (fresh) return fresh;

  return new Response(
    "تعذر تحميل الملف. تحقق من اتصال الإنترنت.",
    {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
}

/* =========================================
   FETCH
========================================= */

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;
  if (!isAppRequest(request)) return;

  const url = new URL(request.url);

  /* الصفحات */
  if (
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/")
  ) {
    event.respondWith(networkFirst(request));
    return;
  }

  /* الملفات الثابتة */
  event.respondWith(staleWhileRevalidate(request));
});

/* =========================================
   MESSAGES
========================================= */

self.addEventListener("message", event => {
  const data = event.data || {};

  if (data.type === "HENO_SKIP_WAITING") {
    self.skipWaiting();
  }

  if (data.type === "HENO_GET_VERSION") {
    event.source?.postMessage({
      type: "HENO_VERSION",
      version: APP_VERSION,
      cache: CACHE_NAME
    });
  }
});
