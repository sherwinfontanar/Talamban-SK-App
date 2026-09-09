import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser, requireRole('secretary', 'kagawad', 'treasurer'));

const RANGE_MS = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function rangeStartFor(range) {
  const ms = RANGE_MS[range];
  return ms ? new Date(Date.now() - ms).toISOString() : null;
}

// GET /admin/dashboard?range=day|week|month|all
// Basic counts for the transparency dashboard. Optimize with a Postgres
// view or materialized view later if this gets slow.
router.get('/dashboard', async (req, res) => {
  const range = ['day', 'week', 'month'].includes(req.query.range) ? req.query.range : 'all';
  const rangeStart = rangeStartFor(range);

  let requestsQuery = supabase
    .from('requests')
    .select('status, document_type, created_at, claimed_at');
  if (rangeStart) requestsQuery = requestsQuery.gte('created_at', rangeStart);
  const { data: requests, error: requestsError } = await requestsQuery;
  if (requestsError) return res.status(500).json({ error: requestsError.message });

  // Fees collected = actual verified payments, not a request's claim status.
  // A payment can be verified well before the resident picks up the
  // document, so counting only 'claimed' requests understated this.
  let paymentsQuery = supabase.from('payments').select('amount, verified_at').eq('status', 'verified');
  if (rangeStart) paymentsQuery = paymentsQuery.gte('verified_at', rangeStart);
  const { data: verifiedPayments, error: paymentsError } = await paymentsQuery;
  if (paymentsError) return res.status(500).json({ error: paymentsError.message });

  // Pending payments is a live queue size, not a historical stat — always
  // shown as-is regardless of the selected range.
  const { data: pendingPayments } = await supabase.from('payments').select('id').eq('status', 'pending');

  const byStatus = {};
  const byDocType = {};
  let turnaroundSumMs = 0;
  let turnaroundCount = 0;

  for (const r of requests ?? []) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byDocType[r.document_type] = (byDocType[r.document_type] || 0) + 1;
    if (r.status === 'claimed' && r.claimed_at) {
      turnaroundSumMs += new Date(r.claimed_at) - new Date(r.created_at);
      turnaroundCount += 1;
    }
  }

  const totalCollected = (verifiedPayments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  res.json({
    range,
    by_status: byStatus,
    by_document_type: byDocType,
    pending_payments_count: pendingPayments?.length ?? 0,
    total_fees_collected: totalCollected,
    avg_turnaround_hours: turnaroundCount
      ? Math.round(turnaroundSumMs / turnaroundCount / 1000 / 60 / 60)
      : null,
  });
});

// GET /admin/document-settings  (view/edit fee amounts — e.g. indigency cert fee once decided)
router.get('/document-settings', async (req, res) => {
  const { data, error } = await supabase.from('document_settings').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ document_settings: data });
});

router.patch('/document-settings/:documentType', requireRole('secretary'), async (req, res) => {
  const { fee_amount, requires_payment, is_active } = req.body;
  const { data, error } = await supabase
    .from('document_settings')
    .update({ fee_amount, requires_payment, is_active, updated_at: new Date().toISOString() })
    .eq('document_type', req.params.documentType)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ document_settings: data });
});

export default router;