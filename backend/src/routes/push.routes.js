import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';

const router = Router();

// GET /push/vapid-public-key
// Frontend fetches this to register a push subscription with the browser.
router.get('/vapid-public-key', (req, res) => {
  if (!process.env.VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: 'Push notifications are not configured' });
  }
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /push/subscribe
// Body: { request_id, guest_email, subscription: { endpoint, keys: { p256dh, auth } } }
// Scoped to a request rather than a user account, since most requesters are guests.
router.post('/subscribe', async (req, res) => {
  const { request_id, guest_email, subscription } = req.body;
  if (!request_id || !subscription?.endpoint) {
    return res.status(400).json({ error: 'request_id and subscription are required' });
  }

  const { data: request } = await supabase
    .from('requests')
    .select('id, guest_email, user_id')
    .eq('id', request_id)
    .single();

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (guest_email && request.guest_email !== guest_email) {
    return res.status(403).json({ error: 'Not authorized to subscribe to this request' });
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      request_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: 'request_id,endpoint' }
  );

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ok: true });
});

export default router;