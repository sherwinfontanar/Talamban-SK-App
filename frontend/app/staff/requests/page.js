'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import StatusTag from '../../components/StatusTag';
import { api } from '../../lib/api';

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
  const [activeId, setActiveId] = useState(null); // which row has its reject-reason field open
  const [reason, setReason] = useState('');
  const [claimCodeInput, setClaimCodeInput] = useState({});

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
      setActiveId(null);
      setReason('');
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
                    {['submitted', 'under_review'].includes(r.status) && activeId !== r.id && (
                      <div className="table-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => review(r.id, 'approved')}>
                          Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setActiveId(r.id)}>
                          Reject
                        </button>
                      </div>
                    )}

                    {activeId === r.id && (
                      <div style={{ display: 'flex', gap: '0.5rem', minWidth: '220px' }}>
                        <input
                          placeholder="Reason for rejection"
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => review(r.id, 'rejected', reason)}
                          disabled={!reason}
                        >
                          Confirm
                        </button>
                        <button className="btn-link" onClick={() => setActiveId(null)}>
                          Cancel
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
    </div>
  );
}