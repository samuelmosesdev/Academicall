/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCgl5s7RgyS_xUlLnfOTGcWh0j4eGonOe4",
  authDomain: "uofa-reader.firebaseapp.com",
  projectId: "uofa-reader",
  storageBucket: "uofa-reader.firebasestorage.app",
  messagingSenderId: "997547883188",
  appId: "1:997547883188:web:c956ed41636fc1844675e1",
});

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