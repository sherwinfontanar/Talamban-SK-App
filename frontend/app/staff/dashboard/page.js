'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

export default function StaffDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/admin/dashboard').then(setStats).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Dashboard</h1>

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

            <h2>By document type</h2>
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
          </>
        )}
      </main>
    </div>
  );
}
