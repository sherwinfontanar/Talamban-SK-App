'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Masthead from './components/Masthead';
import { api, formatDate } from './lib/api';

// Leaflet touches `window` on import, so it can only load client-side.
const BoundaryMap = dynamic(() => import('./components/BoundaryMap'), {
  ssr: false,
  loading: () => <p className="muted">Loading map…</p>,
});

const QUICK_LINKS = [
  { href: '/request', label: 'Request a document', note: 'Barangay cert, indigency, jobseeker' },
  { href: '/courts', label: 'Sports courts', note: 'Basketball, volleyball, badminton, pickleball' },
  { href: '/trails', label: 'Hiking trails', note: 'Guides to the local trailheads' },
  { href: '/facilities', label: 'Gym & co-working', note: 'Check in and see who\'s there' },
];

export default function HomePage() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api
      .get('/news')
      .then((data) => setPosts(data.posts))
      .catch((err) => setError(err.message));
    api
      .get('/barangay-stats')
      .then((data) => setStats(data.stats))
      .catch(() => {}); // non-critical — page works fine without this
  }, []);

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content">
        <h1>Barangay Talamban SK</h1>
        <p className="muted">Announcements, plus quick access to online services.</p>

        {stats?.population && (
          <div className="stat-banner">
            <div>
              <span className="stat-banner-value">{stats.population.toLocaleString()}</span>
              <span className="stat-banner-label">Residents ({stats.population_year} count)</span>
            </div>
            {stats.source_url ? (
              <a href={stats.source_url} target="_blank" rel="noopener noreferrer" className="stat-banner-source">
                {stats.source_label}
              </a>
            ) : (
              <span className="stat-banner-source">{stats.source_label}</span>
            )}
          </div>
        )}

        <div className="quick-links">
          {QUICK_LINKS.map((link) => (
            <Link href={link.href} key={link.href} className="quick-link-card">
              <span className="quick-link-title">{link.label}</span>
              <span className="quick-link-note">{link.note}</span>
            </Link>
          ))}
        </div>

        <h2>Barangay boundary</h2>
        <BoundaryMap />

        <h2 style={{ marginTop: '2rem' }}>News</h2>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {!posts && !error && <p className="muted">Loading…</p>}

        {posts && posts.length === 0 && <div className="empty-state">No news posted yet.</div>}

        {posts && posts.length > 0 && (
          <div className="ledger">
            {posts.map((post) => (
              <Link href={`/news/${post.id}`} key={post.id} className="news-row">
                {post.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.photo_url} alt="" className="news-row-photo" />
                )}
                <div className="news-row-body">
                  <span className="news-row-title">{post.title}</span>
                  <span className="news-row-meta">{formatDate(post.created_at)}</span>
                  <span className="news-row-excerpt">{post.body}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}