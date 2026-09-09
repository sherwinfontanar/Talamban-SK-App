'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

const RANGES = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
];

export default function StaffDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState('week');

  useEffect(() => {
    setStats(null);
    api
      .get(`/admin/dashboard?range=${range}`)
      .then(setStats)
      .catch((err) => setError(err.message));
  }, [range]);

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Dashboard</h1>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {RANGES.map((r) => (
            <button
              key={r.value}
              className={range === r.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!stats && !error && <p className="muted">Loading…</p>}

        {stats && (
          <>
            <div className="stat-grid">
              <div className="stat-cell">
                <div className="stat-value">{stats.pending_payments_count}</div>
                <div className="stat-label">Pending payments</div>
              </div>
              <div className="stat-cell">
                <div className="stat-value">₱{stats.total_fees_collected}</div>
                <div className="stat-label">Fees collected</div>
              </div>
              <div className="stat-cell">
                <div className="stat-value">{stats.avg_turnaround_hours ?? '—'}</div>
                <div className="stat-label">Avg. turnaround (hrs)</div>
              </div>
            </div>

            <h2>By status</h2>
            {Object.keys(stats.by_status).length === 0 ? (
              <div className="empty-state" style={{ marginBottom: '2rem' }}>No requests in this range.</div>
            ) : (
              <table className="table" style={{ marginBottom: '2rem' }}>
                <tbody>
                  {Object.entries(stats.by_status).map(([status, count]) => (
                    <tr key={status}>
                      <td>{status.replace(/_/g, ' ')}</td>
                      <td style={{ textAlign: 'right' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h2>By document type</h2>
            {Object.keys(stats.by_document_type).length === 0 ? (
              <div className="empty-state">No requests in this range.</div>
            ) : (
              <table className="table">
                <tbody>
                  {Object.entries(stats.by_document_type).map(([type, count]) => (
                    <tr key={type}>
                      <td>{type.replace(/_/g, ' ')}</td>
                      <td style={{ textAlign: 'right' }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </main>
    </div>
  );
}