/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

const firebaseConfig = __FIREBASE_CONFIG__;
if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "UniAbuja Readers Hub";
    const options = {
      body: payload.notification?.body || "",
      icon: "/logo-mint.png",
      badge: "/favicon.svg",
      data: payload.data || {},
    };
    self.registration.showNotification(title, options);
  });
}

// ── Offline UTME packs ───────────────────────────────────────────────────────
const UTME_CACHE = "ac-utme-v1";
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isPack = url.origin === self.location.origin && url.pathname.startsWith("/utme/");
  const isMedia = /\/utme\/(media\/|patches$)/.test(url.pathname);
  if (!isPack && !isMedia) return;
  event.respondWith(
    fetch(req).catch(() => caches.open(UTME_CACHE).then((c) => c.match(req.url)).then((hit) => hit || Response.error())),
  );
});

self.addEventListener("notificationclick", (event) => {
  const link = event.notification?.data?.link || "/dashboard/notifications";
  event.notification.close();
  event.waitUntil(self.clients.openWindow(link));
});
