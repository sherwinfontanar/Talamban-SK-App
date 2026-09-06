'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

export default function StaffPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [reason, setReason] = useState('');

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
      setActiveId(null);
      setReason('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

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
                  <td>{p.requests?.full_name}</td>
                  <td>{p.requests?.document_type?.replace(/_/g, ' ')}</td>
                  <td>₱{p.amount}</td>
                  <td>
                    <button className="btn-link" onClick={() => viewReceipt(p.id)}>
                      View
                    </button>
                  </td>
                  <td>
                    {activeId !== p.id ? (
                      <div className="table-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => verify(p.id, 'verified')}>
                          Verify
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setActiveId(p.id)}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', minWidth: '220px' }}>
                        <input
                          placeholder="Reason for rejection"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => verify(p.id, 'rejected', reason)}
                          disabled={!reason}
                        >
                          Confirm
                        </button>
                        <button className="btn-link" onClick={() => setActiveId(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
