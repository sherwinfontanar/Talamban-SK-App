'use client';

import { useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function StaffDashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function load() {
      // TODO: attach staff auth token from localStorage/session
      const token = localStorage.getItem('sk_token');
      const res = await fetch(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    }
    load();
  }, []);

  if (!stats) return <main style={{ padding: '2rem' }}>Loading dashboard…</main>;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem' }}>
      <h1>Staff dashboard</h1>

      <section>
        <h2>Requests by status</h2>
        <ul>
          {Object.entries(stats.by_status).map(([status, count]) => (
            <li key={status}>{status}: {count}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Requests by document type</h2>
        <ul>
          {Object.entries(stats.by_document_type).map(([type, count]) => (
            <li key={type}>{type}: {count}</li>
          ))}
        </ul>
      </section>

      <p><strong>Pending payments:</strong> {stats.pending_payments_count}</p>
      <p><strong>Total fees collected:</strong> ₱{stats.total_fees_collected}</p>
      <p><strong>Avg turnaround:</strong> {stats.avg_turnaround_hours ?? 'N/A'} hours</p>

      {/* TODO: link to /staff/requests queue view for review/approve/reject/claim actions */}
    </main>
  );
}
