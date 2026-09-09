'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import ConfirmModal from '../../components/ConfirmModal';
import { api, formatDate } from '../../lib/api';

export default function StaffPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState(null);

  // pendingAction: { id, kind: 'verify' | 'reject' }
  const [pendingAction, setPendingAction] = useState(null);

  async function load() {
    try {
      const data = await api.get('/payments');
      setPayments(data.payments);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function viewReceipt(id) {
    try {
      const { url } = await api.get(`/payments/${id}/receipt-url`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err.message);
    }
  }

  async function verify(id, decision, rejection_reason) {
    try {
      await api.patch(`/payments/${id}/verify`, { decision, rejection_reason });
      setPendingAction(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const activePayment = pendingAction ? payments.find((p) => p.id === pendingAction.id) : null;

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Payments</h1>
        <p className="muted">Pending receipts awaiting verification.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="empty-state">No pending payments.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Requester</th>
                <th>Document</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.request_id.slice(0, 8)}</td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{p.requests?.full_name}</td>
                  <td>{p.requests?.document_type?.replace(/_/g, ' ')}</td>
                  <td>₱{p.amount}</td>
                  <td>
                    <button className="btn-link" onClick={() => viewReceipt(p.id)}>
                      View
                    </button>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => setPendingAction({ id: p.id, kind: 'verify' })}
                      >
                        Verify
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setPendingAction({ id: p.id, kind: 'reject' })}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <ConfirmModal
        open={pendingAction?.kind === 'verify'}
        title="Verify this payment?"
        message={activePayment ? `${activePayment.requests?.full_name} — ₱${activePayment.amount}` : undefined}
        confirmLabel="Verify"
        tone="primary"
        onConfirm={() => verify(pendingAction.id, 'verified')}
        onClose={() => setPendingAction(null)}
      />

      <ConfirmModal
        open={pendingAction?.kind === 'reject'}
        title="Reject this payment?"
        message={activePayment ? `${activePayment.requests?.full_name} — ₱${activePayment.amount}` : undefined}
        confirmLabel="Reject"
        tone="danger"
        requireReason
        reasonLabel="Reason for rejection (shown to the resident)"
        onConfirm={(reason) => verify(pendingAction.id, 'rejected', reason)}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}