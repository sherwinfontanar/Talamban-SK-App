'use client';

import { useEffect, useState } from 'react';
import Masthead from '../components/Masthead';
import { api } from '../lib/api';

const FILTERS = [
  { value: '', label: 'All courts' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'volleyball', label: 'Volleyball' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'pickleball', label: 'Pickleball' },
];

function CourtCard({ court }) {
  // If photo_url is set but the file 404s/403s (e.g. the Storage bucket
  // isn't public, or the file was removed), fall back to the placeholder
  // instead of leaving a broken image icon in the grid.
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = court.photo_url && !imgFailed;

  return (
    <div className="court-card">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={court.photo_url}
          alt={court.name}
          className="court-card-photo"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="court-card-photo-placeholder">No photo yet</div>
      )}
      <div className="court-card-body">
        <span className="court-card-type">{court.court_type}</span>
        <span className="court-card-name">{court.name}</span>
        <span className="court-card-location">{court.location}</span>
        <div className="court-card-footer">
          <span className="court-card-price">
            {court.price_amount ? `₱${court.price_amount} ${court.price_unit}` : 'Free'}
          </span>
          {court.google_maps_url && (
            <a href={court.google_maps_url} target="_blank" rel="noopener noreferrer" className="btn-link">
              Get directions
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CourtsPage() {
  const [courts, setCourts] = useState(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const query = filter ? `?type=${filter}` : '';
    api
      .get(`/courts${query}`)
      .then((data) => setCourts(data.courts))
      .catch((err) => setError(err.message));
  }, [filter]);

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--wide">
        <h1>Sports courts</h1>
        <p className="muted">Facilities around the barangay, with directions and rates.</p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!courts && !error && <p className="muted">Loading…</p>}

        {courts && courts.length === 0 && (
          <div className="empty-state">No courts listed yet for this filter.</div>
        )}

        {courts && courts.length > 0 && (
          <div className="court-grid">
            {courts.map((court) => (
              <CourtCard court={court} key={court.id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}