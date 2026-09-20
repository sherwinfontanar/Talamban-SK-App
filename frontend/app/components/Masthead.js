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
  const [menuOpen, setMenuOpen] = useState(false);

  // Read on mount only — localStorage isn't available during SSR, and this
  // doesn't need to react to changes elsewhere on the page.
  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    setConfirmingLogout(false);
    setMenuOpen(false);
    router.push(nav === 'staff' ? '/login' : '/');
  }

  // Staff should land back on their dashboard when clicking the brand,
  // not the resident landing page — otherwise their nav (and the fact
  // they're still logged in) seems to disappear.
  const brandHref = user && STAFF_ROLES.includes(user.role) ? '/staff/dashboard' : '/';

  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href={brandHref} className="masthead-brand" onClick={() => setMenuOpen(false)}>
          <span className="masthead-seal" aria-hidden="true">
            SK
          </span>
          <span>
            <div className="masthead-title">Barangay Talamban SK</div>
            <div className="masthead-subtitle">Community Services</div>
          </span>
        </Link>

        <button
          type="button"
          className="masthead-menu-btn"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? '✕ Close' : '☰ Menu'}
        </button>

        {nav === 'resident' && (
          <nav className={`masthead-nav${menuOpen ? ' is-open' : ''}`}>
            <Link href="/request" onClick={() => setMenuOpen(false)}>Documents</Link>
            <Link href="/courts" onClick={() => setMenuOpen(false)}>Courts</Link>
            <Link href="/trails" onClick={() => setMenuOpen(false)}>Trails</Link>
            <Link href="/facilities" onClick={() => setMenuOpen(false)}>Facilities</Link>
            <Link href="/request/status" onClick={() => setMenuOpen(false)}>Check status</Link>
            {user ? (
              <>
                <Link href="/account" onClick={() => setMenuOpen(false)}>My requests</Link>
                <span className="muted">{user.full_name}</span>
                <button className="btn-link" onClick={() => setConfirmingLogout(true)}>
                  Log out
                </button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
            )}
          </nav>
        )}

        {nav === 'staff' && (
          <nav className={`masthead-nav${menuOpen ? ' is-open' : ''}`}>
            <Link href="/staff/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link href="/staff/requests" onClick={() => setMenuOpen(false)}>Requests</Link>
            <Link href="/staff/payments" onClick={() => setMenuOpen(false)}>Payments</Link>
            <Link href="/staff/courts" onClick={() => setMenuOpen(false)}>Courts</Link>
            <Link href="/staff/trails" onClick={() => setMenuOpen(false)}>Trails</Link>
            <Link href="/staff/news" onClick={() => setMenuOpen(false)}>News</Link>
            <Link href="/staff/facilities" onClick={() => setMenuOpen(false)}>Facilities</Link>
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