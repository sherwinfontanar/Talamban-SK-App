import { Router } from 'express';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser);

function normalize(str = '') {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// POST /requests
// Resident (guest or logged in) submits a new document request.
router.post('/', async (req, res) => {
  const { document_type, full_name, address, age, guest_email, birthdate } = req.body;

  if (!document_type || !full_name || !address || !age) {
    return res.status(400).json({ error: 'document_type, full_name, address, and age are required' });
  }
  if (!req.user && !guest_email) {
    return res.status(400).json({ error: 'guest_email is required when not logged in' });
  }

  const { data: settings } = await supabase
    .from('document_settings')
    .select('*')
    .eq('document_type', document_type)
    .single();

  if (!settings || !settings.is_active) {
    return res.status(400).json({ error: 'Invalid or inactive document type' });
  }

  // First Time Jobseeker guardrail: soft-match against past issuances.
  // We don't hard-block — we flag it so staff make the final call,
  // since ID upload is optional and this match isn't 100% reliable.
  let ftjs_flag = false;
  if (document_type === 'ftjs_cert') {
    const { data: matches } = await supabase
      .from('ftjs_issuance_log')
      .select('id')
      .eq('normalized_name', normalize(full_name))
      .limit(1);
    ftjs_flag = (matches?.length ?? 0) > 0;
  }

  const { data: request, error } = await supabase
    .from('requests')
    .insert({
      user_id: req.user?.id ?? null,
      guest_email: req.user ? null : guest_email,
      document_type,
      full_name,
      address,
      age,
      fee_amount: settings.fee_amount,
      status: 'submitted',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_logs').insert({
    actor_id: req.user?.id ?? null,
    action: 'request.created',
    request_id: request.id,
    details: { document_type, ftjs_flag },
  });

  res.status(201).json({ request, ftjs_flag });
});

// POST /requests/:id/documents
// TODO: multer + Supabase Storage upload for proof_of_billing / valid_id (optional)
router.post('/:id/documents', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet — wire up multer + Supabase Storage' });
});

// GET /requests/:id
// Resident checks status of their own request (by id + guest_email, or by auth).
router.get('/:id', async (req, res) => {
  const { data: request, error } = await supabase
    .from('requests')
    .select('*, request_documents(*), payments(*)')
    .eq('id', req.params.id)
    .single();

  if (error || !request) return res.status(404).json({ error: 'Request not found' });

  const isOwner = req.user?.id === request.user_id || req.query.guest_email === request.guest_email;
  const isStaff = ['secretary', 'kagawad', 'treasurer'].includes(req.user?.role);
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Not authorized to view this request' });

  res.json({ request });
});

// GET /requests  (staff only — list/filter queue)
router.get('/', requireRole('secretary', 'kagawad', 'treasurer'), async (req, res) => {
  const { status, document_type } = req.query;
  let query = supabase.from('requests').select('*').order('created_at', { ascending: true });
  if (status) query = query.eq('status', status);
  if (document_type) query = query.eq('document_type', document_type);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ requests: data });
});

// PATCH /requests/:id/review  (secretary or kagawad — approve/reject)
router.patch('/:id/review', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { decision, rejection_reason } = req.body; // decision: 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
  }
  if (decision === 'rejected' && !rejection_reason) {
    return res.status(400).json({ error: 'rejection_reason is required when rejecting' });
  }

  const { data: request } = await supabase.from('requests').select('*').eq('id', req.params.id).single();
  if (!request) return res.status(404).json({ error: 'Request not found' });

  let nextStatus = decision;
  if (decision === 'approved') {
    const { data: settings } = await supabase
      .from('document_settings')
      .select('requires_payment')
      .eq('document_type', request.document_type)
      .single();
    nextStatus = settings.requires_payment ? 'for_payment' : 'ready_for_claim';
  }

  const updatePayload = {
    status: nextStatus,
    rejection_reason: decision === 'rejected' ? rejection_reason : null,
    reviewed_by: req.user.id,
    reviewed_at: new Date().toISOString(),
  };

  if (nextStatus === 'ready_for_claim') {
    updatePayload.claim_code = nanoid(10).toUpperCase();
    updatePayload.qr_code_url = await QRCode.toDataURL(updatePayload.claim_code);

    if (request.document_type === 'ftjs_cert') {
      await supabase.from('ftjs_issuance_log').insert({
        request_id: request.id,
        normalized_name: normalize(request.full_name),
      });
    }
    // TODO: send "ready for claim" email + push notification with claim_code/qr_code_url
  }

  const { data: updated, error } = await supabase
    .from('requests')
    .update(updatePayload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `request.${decision}`,
    request_id: request.id,
    details: { rejection_reason: rejection_reason ?? null },
  });

  res.json({ request: updated });
});

// PATCH /requests/:id/claim  (secretary — mark claimed by scanning/entering the code)
router.patch('/:id/claim', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { claim_code } = req.body;
  const { data: request } = await supabase.from('requests').select('*').eq('id', req.params.id).single();

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'ready_for_claim') {
    return res.status(400).json({ error: `Cannot claim a request in status '${request.status}'` });
  }
  if (request.claim_code !== claim_code) {
    return res.status(400).json({ error: 'Claim code does not match' });
  }

  const { data: updated, error } = await supabase
    .from('requests')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: 'request.claimed',
    request_id: request.id,
  });

  res.json({ request: updated });
});

export default router;
