import axios from "axios";

// Web push helpers. The whole feature is optional: it only activates when the
// server has VAPID keys configured (GET /public-key → { enabled: true, key })
// AND the browser supports service workers + Notification. Callers must treat
// every export as best-effort.

export const isPushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export const registerServiceWorker = async () => {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch (error) {
    console.log("SW registration failed:", error);
    return null;
  }
};

// { enabled, key } from the server; { enabled: false } on any failure.
export const fetchPushPublicKey = async () => {
  try {
    const res = await axios.get("/api/v1/push/public-key");
    return res.data?.enabled ? { enabled: true, key: res.data.key } : { enabled: false };
  } catch {
    return { enabled: false };
  }
};

// Standard base64url → Uint8Array conversion for applicationServerKey.
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const getCurrentSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
};

// Requests permission if needed, subscribes and registers with the backend.
// Returns the subscription, or null when permission was denied/unavailable.
export const subscribeUser = async (publicKey) => {
  if (!isPushSupported() || !publicKey) return null;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration =
    (await navigator.serviceWorker.getRegistration("/sw.js")) ||
    (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  await axios.post("/api/v1/push/subscribe", subscription.toJSON(), {
    withCredentials: true,
  });
  return subscription;
};

export const unsubscribeUser = async () => {
  const subscription = await getCurrentSubscription();
  if (!subscription) return;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  await axios
    .delete("/api/v1/push/unsubscribe", { data: { endpoint }, withCredentials: true })
    .catch(() => {}); // server cleanup is best-effort; local unsubscribe already done
};
