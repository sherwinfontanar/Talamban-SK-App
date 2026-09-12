'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Masthead from '../components/Masthead';
import { api } from '../lib/api';

export default function TrailsPage() {
  const [trails, setTrails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get('/trails')
      .then((data) => setTrails(data.trails))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--wide">
        <h1>Hiking trails</h1>
        <p className="muted">Guides to the trailheads around Talamban — how to get there and what to expect along the way.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!trails && !error && <p className="muted">Loading…</p>}

        {trails && trails.length === 0 && <div className="empty-state">No trail guides posted yet.</div>}

        {trails && trails.length > 0 && (
          <div className="court-grid">
            {trails.map((trail) => (
              <TrailCard trail={trail} key={trail.id} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TrailCard({ trail }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = trail.cover_photo_url && !imgFailed;

  return (
    <Link href={`/trails/${trail.id}`} className="trail-card">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={trail.cover_photo_url}
          alt={trail.name}
          className="trail-card-photo"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="trail-card-photo-placeholder">No photo yet</div>
      )}
      <div className="trail-card-body">
        <span className="trail-card-name">{trail.name}</span>
        <span className="trail-card-meta">
          {[trail.difficulty, trail.estimated_duration].filter(Boolean).join(' · ') || 'Details inside'}
        </span>
      </div>
    </Link>
  );
}