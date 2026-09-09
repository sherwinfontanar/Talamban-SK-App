'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Masthead from '../components/Masthead';
import StatusTag from '../components/StatusTag';
import { api, getCurrentUser, formatDate } from '../lib/api';

const FINAL_STATUSES = ['claimed', 'rejected'];

export default function AccountPage() {
  const [user, setUser] = useState(undefined); // undefined = not checked yet, null = not logged in
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
    if (current) {
      api
        .get('/requests/mine')
        .then((data) => setRequests(data.requests))
        .catch((err) => setError(err.message));
    }
  }, []);

  if (user === undefined) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <p className="muted">Loading…</p>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <h1>My requests</h1>
          <div className="notice">
            <p>
              <Link href="/login">Log in</Link> to see your request history. Requests made as a
              guest are linked automatically once you verify your account with the same email.
            </p>
          </div>
        </main>
      </div>
    );
  }

  const current = requests?.filter((r) => !FINAL_STATUSES.includes(r.status)) ?? [];
  const past = requests?.filter((r) => FINAL_STATUSES.includes(r.status)) ?? [];

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content">
        <h1>My requests</h1>
        <p className="muted">Signed in as {user.full_name}.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!requests && !error && <p className="muted">Loading your requests…</p>}

        {requests && (
          <>
            <h2>Current</h2>
            {current.length === 0 ? (
              <div className="empty-state" style={{ marginBottom: '2rem' }}>
                Nothing in progress right now.
              </div>
            ) : (
              <div className="ledger" style={{ marginBottom: '2rem' }}>
                {current.map((r) => (
                  <Link href={`/request/status/${r.id}`} key={r.id} className="ledger-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="ledger-row-main">
                      <span className="ledger-row-title">{r.document_type.replace(/_/g, ' ')}</span>
                      <span className="ledger-row-meta">{formatDate(r.created_at)}</span>
                    </div>
                    <StatusTag status={r.status} />
                  </Link>
                ))}
              </div>
            )}

            <h2>Previous</h2>
            {past.length === 0 ? (
              <div className="empty-state">No completed requests yet.</div>
            ) : (
              <div className="ledger">
                {past.map((r) => (
                  <Link href={`/request/status/${r.id}`} key={r.id} className="ledger-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="ledger-row-main">
                      <span className="ledger-row-title">{r.document_type.replace(/_/g, ' ')}</span>
                      <span className="ledger-row-meta">{formatDate(r.created_at)}</span>
                    </div>
                    <StatusTag status={r.status} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        <p style={{ marginTop: '2rem' }}>
          <Link href="/">Request a new document</Link>
        </p>
      </main>
    </div>
  );
}