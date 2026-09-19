'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Masthead from '../../components/Masthead';
import { api, formatDate } from '../../lib/api';

export default function NewsDetailPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .get(`/news/${id}`)
      .then((data) => setPost(data.post))
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

  if (!post) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <p className="muted">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content">
        <p className="muted">{formatDate(post.created_at)}</p>
        <h1>{post.title}</h1>
        {post.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photo_url} alt="" style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: '1.25rem' }} />
        )}
        <div style={{ whiteSpace: 'pre-wrap' }}>{post.body}</div>
      </main>
    </div>
  );
}