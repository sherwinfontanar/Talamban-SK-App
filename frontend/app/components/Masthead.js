'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, logout } from '../lib/api';
import ConfirmModal from './ConfirmModal';

const STAFF_ROLES = ['secretary', 'kagawad', 'treasurer'];

export default function Masthead({ nav = 'resident' }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // Read on mount only — localStorage isn't available during SSR, and this
  // doesn't need to react to changes elsewhere on the page.
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    setConfirmingLogout(false);
    router.push(nav === 'staff' ? '/login' : '/');
  }

  // Staff should land back on their dashboard when clicking the brand,
  // not the resident landing page — otherwise their nav (and the fact
  // they're still logged in) seems to disappear.
  const brandHref = user && STAFF_ROLES.includes(user.role) ? '/staff/dashboard' : '/';

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href={brandHref} className="masthead-brand">
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
            <Link href="/courts">Courts</Link>
            <Link href="/request/status">Check status</Link>
            {user ? (
              <>
                <Link href="/account">My requests</Link>
                <span className="muted">{user.full_name}</span>
                <button className="btn-link" onClick={() => setConfirmingLogout(true)}>
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
            <Link href="/staff/courts">Courts</Link>
            {user && <span className="muted">{user.full_name}</span>}
            <button className="btn-link" onClick={() => setConfirmingLogout(true)}>
              Log out
            </button>
          </nav>
        )}
      </div>

      <ConfirmModal
        open={confirmingLogout}
        title="Log out?"
        message="You'll need to log in again to continue."
        confirmLabel="Log out"
        tone="danger"
        onConfirm={handleLogout}
        onClose={() => setConfirmingLogout(false)}
      />
    </header>
  );
}