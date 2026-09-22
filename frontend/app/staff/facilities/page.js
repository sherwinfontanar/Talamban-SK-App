'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import { api, formatDate } from '../../lib/api';

const FACILITY_LABELS = {
  gym: 'Gym',
  coworking_computer: 'Co-working computer',
  coworking_table: 'Co-working table',
};

function elapsedLabel(checkedInAt) {
  const ms = Date.now() - new Date(checkedInAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function StaffFacilitiesPage() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [geofenceForm, setGeofenceForm] = useState(null);
  const [geofenceSaving, setGeofenceSaving] = useState(false);
  const [geofenceSaved, setGeofenceSaved] = useState(false);

  function load() {
    api
      .get('/facilities/active')
      .then((data) => setSessions(data.sessions))
      .catch((err) => setError(err.message));
  }

  function loadGeofence() {
    api
      .get('/facilities/geofence')
      .then((data) =>
        setGeofenceForm({
          latitude: data.geofence.latitude,
          longitude: data.geofence.longitude,
          radius_meters: data.geofence.radius_meters,
        })
      )
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    loadGeofence();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, []);

  async function handleGeofenceSubmit(e) {
    e.preventDefault();
    setGeofenceSaving(true);
    setGeofenceSaved(false);
    setError(null);
    try {
      await api.patch('/facilities/geofence', geofenceForm);
      setGeofenceSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeofenceSaving(false);
    }
  }

  async function handleCheckOut(id) {
    setBusyId(id);
    try {
      await api.post(`/facilities/checkout/${id}`, {});
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Facilities</h1>
        <p className="muted">
          Everyone currently checked in. Computer sessions past 2 hours no longer count toward capacity
          automatically, but still show here until checked out — use this to clear them out.
        </p>

        {geofenceForm && (
          <form
            onSubmit={handleGeofenceSubmit}
            className="content--form"
            style={{ padding: 0, margin: '0 0 2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--hairline)' }}
          >
            <h2>Check-in location</h2>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Residents must be within this radius to check in. Browser GPS can drift, especially
              indoors — widen the radius if legitimate check-ins are getting rejected on-site.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="g-lat">Latitude</label>
                <input
                  id="g-lat"
                  type="number"
                  step="any"
                  value={geofenceForm.latitude}
                  onChange={(e) => setGeofenceForm({ ...geofenceForm, latitude: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="g-lng">Longitude</label>
                <input
                  id="g-lng"
                  type="number"
                  step="any"
                  value={geofenceForm.longitude}
                  onChange={(e) => setGeofenceForm({ ...geofenceForm, longitude: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="g-radius">Radius (meters)</label>
                <input
                  id="g-radius"
                  type="number"
                  min="10"
                  value={geofenceForm.radius_meters}
                  onChange={(e) => setGeofenceForm({ ...geofenceForm, radius_meters: e.target.value })}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={geofenceSaving}>
              {geofenceSaving ? 'Saving…' : 'Save'}
            </button>
            {geofenceSaved && <span className="muted" style={{ marginLeft: '0.75rem' }}>Saved.</span>}
          </form>
        )}

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!sessions && !error && <p className="muted">Loading…</p>}

        {sessions?.length === 0 && <div className="empty-state">No one is currently checked in.</div>}

        {sessions?.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>Facility</th>
                <th>Name</th>
                <th>Checked in</th>
                <th>Elapsed</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {FACILITY_LABELS[s.facility]}
                    {!s.still_active && <span className="muted"> (expired)</span>}
                  </td>
                  <td>{s.visitor_name}</td>
                  <td>{formatDate(s.checked_in_at)}</td>
                  <td>{elapsedLabel(s.checked_in_at)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => handleCheckOut(s.id)} disabled={busyId === s.id}>
                      {busyId === s.id ? 'Checking out…' : 'Check out'}
                    </button>
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