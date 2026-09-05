import { Router } from 'express';
import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser);

// POST /payments/:requestId/receipt
// Resident uploads a receipt for a request that's in 'for_payment' status.
// TODO: wire up multer + Supabase Storage for the actual file upload.
router.post('/:requestId/receipt', async (req, res) => {
  const { receipt_file_url, amount } = req.body; // file_url comes from a prior Storage upload step

  const { data: request } = await supabase
    .from('requests')
    .select('*')
    .eq('id', req.params.requestId)
    .single();

  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (!['for_payment', 'payment_rejected'].includes(request.status)) {
    return res.status(400).json({ error: `Cannot upload a receipt for status '${request.status}'` });
  }

  const { data: payment, error } = await supabase
    .from('payments')
    .insert({ request_id: request.id, receipt_file_url, amount, status: 'pending' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('requests').update({ status: 'for_payment' }).eq('id', request.id);

  res.status(201).json({ payment });
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

  if (nextRequestStatus === 'paid') {
    // Auto-advance straight to ready_for_claim once paid, generating the claim code.
    updatePayload.status = 'ready_for_claim';
    updatePayload.claim_code = nanoid(10).toUpperCase();
    updatePayload.qr_code_url = await QRCode.toDataURL(updatePayload.claim_code);
    // TODO: send "ready for claim" notification
  }

  const { data: updatedRequest, error } = await supabase
    .from('requests')
    .update(updatePayload)
    .eq('id', payment.request_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('audit_logs').insert({
    actor_id: req.user.id,
    action: `payment.${decision}`,
    request_id: payment.request_id,
    details: { rejection_reason: rejection_reason ?? null },
  });

  res.json({ request: updatedRequest });
});

export default router;
