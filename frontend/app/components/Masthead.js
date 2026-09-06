'use client';

import Link from 'next/link';

export default function Masthead({ nav = 'resident' }) {
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="masthead-brand">
          <span className="masthead-seal" aria-hidden="true">
            SK
          </span>
          <span>
            <div className="masthead-title">Barangay Talamban SK</div>
            <div className="masthead-subtitle">Document Requests</div>
          </span>
        </Link>

        {nav === 'resident' && (
          <nav className="masthead-nav">
            <Link href="/request/status">Check status</Link>
            <Link href="/login">Log in</Link>
          </nav>
        )}

        {nav === 'staff' && (
          <nav className="masthead-nav">
            <Link href="/staff/dashboard">Dashboard</Link>
            <Link href="/staff/requests">Requests</Link>
            <Link href="/staff/payments">Payments</Link>
          </nav>
        )}
      </div>
    </header>
  );
}
