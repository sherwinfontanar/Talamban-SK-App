'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import StatusTag from '../../components/StatusTag';
import ConfirmModal from '../../components/ConfirmModal';
import { api, formatDate } from '../../lib/api';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'ready_for_claim', label: 'Ready for claim' },
];

export default function StaffRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);
  const [claimCodeInput, setClaimCodeInput] = useState({});

  // pendingAction holds the request the modal is currently confirming:
  // { id, kind: 'approve' | 'reject' }
  const [pendingAction, setPendingAction] = useState(null);

  async function load() {
    try {
      const query = filter ? `?status=${filter}` : '';
      const data = await api.get(`/requests${query}`);
      setRequests(data.requests);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function review(id, decision, rejection_reason) {
    try {
      await api.patch(`/requests/${id}/review`, { decision, rejection_reason });
      setPendingAction(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewDocument(requestId, docId) {
    try {
      const { url } = await api.get(`/requests/${requestId}/documents/${docId}/url`);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err.message);
    }
  }

  async function claim(id) {
    try {
      await api.patch(`/requests/${id}/claim`, { claim_code: claimCodeInput[id] || '' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const activeRequest = pendingAction ? requests.find((r) => r.id === pendingAction.id) : null;

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Requests</h1>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="empty-state">No requests in this view.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Date</th>
                <th>Requester</th>
                <th>Document</th>
                <th>Files</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id.slice(0, 8)}</td>
                  <td>{formatDate(r.created_at)}</td>
                  <td>{r.full_name}</td>
                  <td>{r.document_type.replace(/_/g, ' ')}</td>
                  <td>
                    {r.request_documents?.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {r.request_documents.map((doc) => (
                          <button key={doc.id} className="btn-link" onClick={() => viewDocument(r.id, doc.id)}>
                            {doc.file_kind.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </td>
                  <td>
                    <StatusTag status={r.status} />
                  </td>
                  <td>
                    {['submitted', 'under_review'].includes(r.status) && (
                      <div className="table-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setPendingAction({ id: r.id, kind: 'approve' })}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setPendingAction({ id: r.id, kind: 'reject' })}
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {r.status === 'ready_for_claim' && (
                      <div className="table-actions">
                        <input
                          placeholder="Claim code"
                          className="mono"
                          style={{ width: '110px' }}
                          value={claimCodeInput[r.id] || ''}
                          onChange={(e) => setClaimCodeInput({ ...claimCodeInput, [r.id]: e.target.value })}
                        />
                        <button className="btn btn-primary btn-sm" onClick={() => claim(r.id)}>
                          Mark claimed
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

      <ConfirmModal
        open={pendingAction?.kind === 'approve'}
        title="Approve this request?"
        message={activeRequest ? `${activeRequest.full_name} — ${activeRequest.document_type.replace(/_/g, ' ')}` : undefined}
        confirmLabel="Approve"
        tone="primary"
        onConfirm={() => review(pendingAction.id, 'approved')}
        onClose={() => setPendingAction(null)}
      />

      <ConfirmModal
        open={pendingAction?.kind === 'reject'}
        title="Reject this request?"
        message={activeRequest ? `${activeRequest.full_name} — ${activeRequest.document_type.replace(/_/g, ' ')}` : undefined}
        confirmLabel="Reject"
        tone="danger"
        requireReason
        reasonLabel="Reason for rejection (shown to the resident)"
        onConfirm={(reason) => review(pendingAction.id, 'rejected', reason)}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}