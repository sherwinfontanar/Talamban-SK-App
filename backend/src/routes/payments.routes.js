import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';
import { sendStatusEmail, sendReadyForClaimEmail } from '../utils/email.js';
import { sendPushToRequest } from '../utils/push.js';

const router = Router();
router.use(attachUser);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

function normalize(str = '') {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

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

// POST /payments/:requestId/receipt
// Resident uploads a receipt for a request that's in 'for_payment' status.
// multipart/form-data: fields `file` and `amount`.
router.post('/:requestId/receipt', upload.single('file'), async (req, res) => {
  const { amount } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { data: request } = await supabase
    .from('requests')
    .select('*')
    .eq('id', req.params.requestId)
    .single();

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!['for_payment', 'payment_rejected'].includes(request.status)) {
    return res.status(400).json({ error: `Cannot upload a receipt for status '${request.status}'` });
  }

  const isOwner = req.user?.id === request.user_id || req.query.guest_email === request.guest_email;
  if (!isOwner) return res.status(403).json({ error: 'Not authorized to pay for this request' });

  // Guard against double-submits (double-click, resubmitted form, or a
  // direct repeat call) creating a second payment while one is already
  // awaiting the treasurer's review.
  const { data: existingPending } = await supabase
    .from('payments')
    .select('id')
    .eq('request_id', request.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingPending) {
    return res.status(409).json({ error: 'A receipt for this request is already pending verification' });
  }

  const path = `${request.id}/receipt-${uuidv4()}-${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, req.file.buffer, { contentType: req.file.mimetype });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({
      request_id: request.id,
      receipt_file_url: path,
      amount: amount || request.fee_amount,
      status: 'pending',
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('requests').update({ status: 'for_payment' }).eq('id', request.id);
  await supabase.from('audit_logs').insert({
    actor_id: req.user?.id ?? null,
    action: 'payment.receipt_uploaded',
    request_id: request.id,
  });

  res.status(201).json({ payment });
});

// GET /payments/:id/receipt-url  (treasurer only — signed URL to a private receipt)
router.get('/:id/receipt-url', requireRole('treasurer'), async (req, res) => {
  const { data: payment } = await supabase.from('payments').select('receipt_file_url').eq('id', req.params.id).single();
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(payment.receipt_file_url, 60 * 5);
  if (error) return res.status(500).json({ error: error.message });

  res.json({ url: data.signedUrl });
});

// GET /payments  (treasurer only — queue of pending receipts)
router.get('/', requireRole('treasurer'), async (req, res) => {
  const { data, error } = await supabase
    .from('payments')
    .select('*, requests(*)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ payments: data });
});

// PATCH /payments/:id/verify  (treasurer — verify or reject a receipt)
router.patch('/:id/verify', requireRole('treasurer'), async (req, res) => {
  const { decision, rejection_reason } = req.body; // 'verified' | 'rejected'
  if (!['verified', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'verified' or 'rejected'" });
  }
  if (decision === 'rejected' && !rejection_reason) {
    return res.status(400).json({ error: 'rejection_reason is required when rejecting' });
  }

  const { data: payment } = await supabase.from('payments').select('*').eq('id', req.params.id).single();
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  await supabase
    .from('payments')
    .update({
      status: decision,
      rejection_reason: decision === 'rejected' ? rejection_reason : null,
      verified_by: req.user.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', payment.id);

  let nextRequestStatus = decision === 'verified' ? 'paid' : 'payment_rejected';
  const updatePayload = { status: nextRequestStatus };

  if (decision === 'rejected') {
    updatePayload.rejection_reason = rejection_reason;
  }

  if (nextRequestStatus === 'paid') {
    // Auto-advance straight to ready_for_claim once paid, generating the claim code.
    updatePayload.status = 'ready_for_claim';
    updatePayload.claim_code = nanoid(10).toUpperCase();
    updatePayload.qr_code_url = await QRCode.toDataURL(updatePayload.claim_code);
  }

  const { data: updatedRequest, error } = await supabase
    .from('requests')
    .update(updatePayload)
    .eq('id', payment.request_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  if (updatedRequest.status === 'ready_for_claim' && updatedRequest.document_type === 'ftjs_cert') {
    await supabase.from('ftjs_issuance_log').insert({
      request_id: updatedRequest.id,
      normalized_name: normalize(updatedRequest.full_name),
    });
  }

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `payment.${decision}`,
    request_id: payment.request_id,
    details: { rejection_reason: rejection_reason ?? null },
  });

  const recipientEmail = await getRecipientEmail(updatedRequest);
  if (recipientEmail) {
    if (updatedRequest.status === 'ready_for_claim') {
      sendReadyForClaimEmail(recipientEmail, {
        documentType: updatedRequest.document_type,
        claimCode: updatedRequest.claim_code,
        statusUrl: statusUrlFor(updatedRequest),
      }).catch(() => {});
    } else {
      sendStatusEmail(recipientEmail, {
        documentType: updatedRequest.document_type,
        status: updatedRequest.status,
        rejectionReason: updatedRequest.rejection_reason,
        statusUrl: statusUrlFor(updatedRequest),
      }).catch(() => {});
    }
  }

  sendPushToRequest(updatedRequest.id, {
    title: updatedRequest.status === 'ready_for_claim' ? 'Ready for claim' : 'Payment update',
    body:
      updatedRequest.status === 'ready_for_claim'
        ? `Your claim code is ${updatedRequest.claim_code}`
        : `Your payment status: ${updatedRequest.status.replace(/_/g, ' ')}`,
    url: statusUrlFor(updatedRequest),
  }).catch(() => {});

  res.json({ request: updatedRequest });
});

export default router;