'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Masthead from '../components/Masthead';
import ConfirmModal from '../components/ConfirmModal';
import { api, getCurrentUser } from '../lib/api';

const FACILITY_META = {
  gym: { label: 'Gym', note: 'No stated capacity — informational count only.' },
  coworking_computer: { label: 'Co-working computers', note: 'Sessions auto-expire after 2 hours.' },
  coworking_table: { label: 'Co-working tables', note: 'Shared seating.' },
};

export default function FacilitiesPage() {
  const [occupancy, setOccupancy] = useState(null);
  const [mySessions, setMySessions] = useState({}); // facility -> session, only when logged in
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});

  // pendingAction: { facility, kind: 'checkin' | 'checkout' } while the confirm modal is open
  const [pendingAction, setPendingAction] = useState(null);

  const user = getCurrentUser();

  function loadOccupancy() {
    api
      .get('/facilities/occupancy')
      .then((data) => setOccupancy(data.occupancy))
      .catch((err) => setError(err.message));
  }

  function loadMine() {
    if (!user) return;
    api
      .get('/facilities/mine')
      .then((data) => {
        const byFacility = {};
        for (const s of data.sessions) byFacility[s.facility] = s;
        setMySessions(byFacility);
      })
      .catch(() => {}); // not critical to first render
  }

  useEffect(() => {
    loadOccupancy();
    loadMine();
    const interval = setInterval(loadOccupancy, 20000); // keep counts reasonably live
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCheckIn(facility) {
    setBusy({ ...busy, [facility]: true });
    setError(null);
    try {
      const { log } = await api.post('/facilities/checkin', { facility });
      setMySessions((prev) => ({ ...prev, [facility]: log }));
      loadOccupancy();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy((prev) => ({ ...prev, [facility]: false }));
      setPendingAction(null);
    }
  }

  async function handleCheckOut(facility) {
    const session = mySessions[facility];
    if (!session) return;
    setBusy({ ...busy, [facility]: true });
    setError(null);
    try {
      await api.post(`/facilities/checkout/${session.id}`, {});
      setMySessions((prev) => {
        const next = { ...prev };
        delete next[facility];
        return next;
      });
      loadOccupancy();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy((prev) => ({ ...prev, [facility]: false }));
      setPendingAction(null);
    }
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--wide">
        <h1>Barangay hall facilities</h1>
        <p className="muted">Check in when you start using the gym or co-working space, and check out when you leave.</p>

        {!user && (
          <div className="notice">
            <p>
              <Link href="/login">Log in</Link> to check in — this keeps sessions tied to an actual
              account rather than a typed-in name.
            </p>
          </div>
        )}

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!occupancy && !error && <p className="muted">Loading…</p>}

        {occupancy && (
          <div className="facility-grid">
            {occupancy.map((o) => {
              const meta = FACILITY_META[o.facility];
              const mySession = mySessions[o.facility];
              return (
                <div className="facility-card" key={o.facility}>
                  <span className="facility-card-label">{meta.label}</span>
                  <span className="facility-card-count">
                    {o.count}
                    {o.capacity !== null && <span className="facility-card-capacity"> / {o.capacity}</span>}
                  </span>
                  <span className="field-hint">{meta.note}</span>

                  {user && (
                    <div style={{ marginTop: '0.75rem' }}>
                      {mySession ? (
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setPendingAction({ facility: o.facility, kind: 'checkout' })}
                          disabled={busy[o.facility]}
                        >
                          {busy[o.facility] ? 'Checking out…' : 'Check out'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setPendingAction({ facility: o.facility, kind: 'checkin' })}
                          disabled={busy[o.facility]}
                        >
                          {busy[o.facility] ? 'Checking in…' : 'Check in'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <ConfirmModal
        open={pendingAction?.kind === 'checkin'}
        title={`Check in to ${pendingAction ? FACILITY_META[pendingAction.facility].label : ''}?`}
        message="This marks you as currently at this facility until you check out."
        confirmLabel="Check in"
        tone="primary"
        onConfirm={() => handleCheckIn(pendingAction.facility)}
        onClose={() => setPendingAction(null)}
      />

      <ConfirmModal
        open={pendingAction?.kind === 'checkout'}
        title={`Check out of ${pendingAction ? FACILITY_META[pendingAction.facility].label : ''}?`}
        confirmLabel="Check out"
        tone="primary"
        onConfirm={() => handleCheckOut(pendingAction.facility)}
        onClose={() => setPendingAction(null)}
      />
    </div>
  );
}