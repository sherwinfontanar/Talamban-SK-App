'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '../lib/api';

export default function Masthead({ nav = 'resident' }) {
  const router = useRouter();
  const [user, setUser] = useState(null);

  // Read on mount only — localStorage isn't available during SSR, and this
  // doesn't need to react to changes elsewhere on the page.
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    router.push(nav === 'staff' ? '/login' : '/');
  }

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
            {user ? (
              <>
                <span className="muted">{user.full_name}</span>
                <button className="btn-link" onClick={handleLogout}>
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login">Log in</Link>
            )}
          </nav>
        )}

        {nav === 'staff' && (
          <nav className="masthead-nav">
            <Link href="/staff/dashboard">Dashboard</Link>
            <Link href="/staff/requests">Requests</Link>
            <Link href="/staff/payments">Payments</Link>
            {user && <span className="muted">{user.full_name}</span>}
            <button className="btn-link" onClick={handleLogout}>
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}