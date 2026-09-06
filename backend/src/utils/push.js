import webpush from 'web-push';
import dotenv from 'dotenv';
import { supabase } from '../config/supabaseClient.js';

dotenv.config();

const configured = Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Sends a push notification to every subscription registered for a request.
// Silently no-ops if VAPID keys aren't configured, and prunes subscriptions
// that the browser has since invalidated (410/404 responses).
export async function sendPushToRequest(requestId, payload) {
  if (!configured) {
    console.warn('[push] VAPID keys not set — skipping push notification');
    return;
  }

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('request_id', requestId);

  if (!subs?.length) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('[push] send failed:', err.message);
        }
      }
    })
  );
}