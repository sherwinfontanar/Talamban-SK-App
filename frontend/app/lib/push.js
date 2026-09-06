import { api } from './api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Registers the service worker, subscribes the browser to push, and saves
// the subscription against this specific request (guests aren't logged in,
// so we scope notifications to a request rather than an account).
export async function subscribeToPush(requestId, guestEmail) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const { publicKey } = await api.get('/push/vapid-public-key');

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await api.post('/push/subscribe', {
    request_id: requestId,
    guest_email: guestEmail || undefined,
    subscription: subscription.toJSON(),
  });
}