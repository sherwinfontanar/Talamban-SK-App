import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.js';
import { sendStatusEmail, sendReadyForClaimEmail } from '../utils/email.js';
import { sendPushToRequest } from '../utils/push.js';

const router = Router();
router.use(attachUser);

// Files go straight to Supabase Storage (private bucket), not local disk —
// Render's free tier has ephemeral storage that wipes on redeploy.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

const ALLOWED_DOC_KINDS = ['proof_of_billing', 'valid_id', 'other'];

function normalize(str = '') {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// A request's notification email is either the linked account's email or
// the guest_email captured at submission time.
async function getRecipientEmail(request) {
  if (request.guest_email) return request.guest_email;
  if (request.user_id) {
    const { data: user } = await supabase.from('users').select('email').eq('id', request.user_id).single();
    return user?.email ?? null;
  }
  return null;
}

function statusUrlFor(request) {
  const emailParam = request.guest_email ? `?guest_email=${encodeURIComponent(request.guest_email)}` : '';
  return `${process.env.FRONTEND_URL}/request/status/${request.id}${emailParam}`;
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
// Optional resident-uploaded attachments (proof of billing, valid ID).
// multipart/form-data: fields `file` and `file_kind`.
router.post('/:id/documents', upload.single('file'), async (req, res) => {
  const { file_kind } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!ALLOWED_DOC_KINDS.includes(file_kind)) {
    return res.status(400).json({ error: `file_kind must be one of ${ALLOWED_DOC_KINDS.join(', ')}` });
  }

  const { data: request } = await supabase.from('requests').select('id, user_id, guest_email').eq('id', req.params.id).single();
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const isOwner = req.user?.id === request.user_id || req.query.guest_email === request.guest_email;
  if (!isOwner) return res.status(403).json({ error: 'Not authorized to attach files to this request' });

  const path = `${request.id}/${file_kind}-${uuidv4()}-${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from('id-documents')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: doc, error } = await supabase
    .from('request_documents')
    .insert({ request_id: request.id, file_url: path, file_kind })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_logs').insert({
    actor_id: req.user?.id ?? null,
    action: 'request.document_uploaded',
    request_id: request.id,
    details: { file_kind },
  });

  res.status(201).json({ document: doc });
});

// GET /requests/:id/documents/:docId/url  (staff, or the requester viewing their own file)
router.get('/:id/documents/:docId/url', async (req, res) => {
  const { data: request } = await supabase
    .from('requests')
    .select('id, user_id, guest_email')
    .eq('id', req.params.id)
    .single();

  if (!request) return res.status(404).json({ error: 'Request not found' });

  const isOwner = req.user?.id === request.user_id || req.query.guest_email === request.guest_email;
  const isStaff = ['secretary', 'kagawad', 'treasurer'].includes(req.user?.role);
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Not authorized to view this file' });

  const { data: doc } = await supabase
    .from('request_documents')
    .select('file_url')
    .eq('id', req.params.docId)
    .eq('request_id', req.params.id)
    .single();

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { data, error } = await supabase.storage.from('id-documents').createSignedUrl(doc.file_url, 60 * 5);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ url: data.signedUrl });
});

// GET /requests/mine  (logged-in resident — their own request history)
// Placed before GET /:id so Express doesn't treat "mine" as an :id param.
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('requests')
    .select('*, payments(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ requests: data });
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
  let query = supabase
    .from('requests')
    .select('*, request_documents(*)')
    .order('created_at', { ascending: true });
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

  // Notify — never let a notification failure block the response, since the
  // status change itself already succeeded.
  const recipientEmail = await getRecipientEmail(updated);
  if (recipientEmail) {
    if (nextStatus === 'ready_for_claim') {
      sendReadyForClaimEmail(recipientEmail, {
        documentType: updated.document_type,
        claimCode: updated.claim_code,
        statusUrl: statusUrlFor(updated),
      }).catch(() => {});
    } else {
      sendStatusEmail(recipientEmail, {
        documentType: updated.document_type,
        status: nextStatus,
        rejectionReason: updated.rejection_reason,
        statusUrl: statusUrlFor(updated),
      }).catch(() => {});
    }
  }

  sendPushToRequest(updated.id, {
    title: nextStatus === 'ready_for_claim' ? 'Ready for claim' : 'Request update',
    body:
      nextStatus === 'ready_for_claim'
        ? `Your claim code is ${updated.claim_code}`
        : `Your request is now: ${nextStatus.replace(/_/g, ' ')}`,
    url: statusUrlFor(updated),
  }).catch(() => {});

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