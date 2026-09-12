'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

export default function TrailDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/trails/${id}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content">
          <p className="muted">Loading…</p>
        </main>
      </div>
    );
  }

  const { trail, checkpoints } = data;

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content">
        <h1>{trail.name}</h1>
        {trail.description && <p className="muted">{trail.description}</p>}

        <div className="trail-overview">
          <div className="trail-overview-meta">
            {trail.difficulty && (
              <div className="trail-overview-meta-item">
                <strong>Difficulty</strong>
                {trail.difficulty}
              </div>
            )}
            {trail.estimated_duration && (
              <div className="trail-overview-meta-item">
                <strong>Duration</strong>
                {trail.estimated_duration}
              </div>
            )}
            {trail.starting_point_location && (
              <div className="trail-overview-meta-item">
                <strong>Starting point</strong>
                {trail.starting_point_location}
              </div>
            )}
          </div>

          {trail.starting_point_maps_url && (
            <a href={trail.starting_point_maps_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              Get directions to the trailhead
            </a>
          )}

          {trail.getting_there && (
            <div className="trail-getting-there">
              <strong>Getting there:</strong> {trail.getting_there}
            </div>
          )}
        </div>

        <h2>Checkpoints</h2>
        {checkpoints.length === 0 ? (
          <div className="empty-state">No checkpoints posted yet for this trail.</div>
        ) : (
          <div>
            {checkpoints.map((cp, i) => (
              <div className="checkpoint" key={cp.id}>
                {i < checkpoints.length - 1 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div className="checkpoint-badge">{i + 1}</div>
                    <div className="checkpoint-connector" /> 
                  </div>
                ) : (
                  <div className="checkpoint-badge">{i + 1}</div>
                )}

                <div className="checkpoint-body">
                  <h3 style={{ marginBottom: '0.25rem' }}>{cp.name}</h3>
                  {cp.description && <p className="muted" style={{ marginBottom: '0.25rem' }}>{cp.description}</p>}

                  {cp.trail_checkpoint_photos?.length > 0 && (
                    <div className="checkpoint-photos">
                      {cp.trail_checkpoint_photos.map((photo) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={photo.id} src={photo.photo_url} alt={cp.name} className="checkpoint-photo" />
                      ))}
                    </div>
                  )}

                  {cp.travel_note && (
                    <div className="checkpoint-travel-note">
                      <strong>Next:</strong> {cp.travel_note}
                    </div>
                  )}

                  {cp.google_maps_url && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <a href={cp.google_maps_url} target="_blank" rel="noopener noreferrer" className="btn-link">
                        View on map
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}