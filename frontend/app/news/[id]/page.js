'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Masthead from '../../components/Masthead';
import { api, formatDate, getCurrentUser } from '../../lib/api';

export default function NewsDetailPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState(null);
  const [commentBody, setCommentBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [posting, setPosting] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copy link');

  const user = getCurrentUser();

  function loadComments() {
    api
      .get(`/news/${id}/comments`)
      .then((data) => setComments(data.comments))
      .catch(() => {}); // non-critical — post still shows without comments
  }

  useEffect(() => {
    api
      .get(`/news/${id}`)
      .then((data) => setPost(data.post))
      .catch((err) => setError(err.message));
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: post?.title, url });
      } catch (err) {
        // user cancelled the share sheet — not an error
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Copy link'), 2000);
    } catch (err) {
      setCopyLabel('Copy failed');
    }
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setPosting(true);
    try {
      await api.post(`/news/${id}/comments`, {
        body: commentBody,
        author_name: user ? undefined : authorName,
      });
      setCommentBody('');
      loadComments();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>{formatDate(post.created_at)}</p>
          <button className="btn btn-outline btn-sm" onClick={handleShare}>
            {copyLabel === 'Copy link' ? 'Share' : copyLabel}
          </button>
        </div>
        <h1>{post.title}</h1>
        {post.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.photo_url} alt="" style={{ width: '100%', borderRadius: 'var(--radius)', marginBottom: '1.25rem' }} />
        )}
        <div style={{ whiteSpace: 'pre-wrap', marginBottom: '2rem' }}>{post.body}</div>

        <h2>Comments</h2>

        <form onSubmit={handleCommentSubmit} style={{ marginBottom: '1.5rem' }}>
          {!user && (
            <div className="field">
              <label htmlFor="author_name">Your name</label>
              <input
                id="author_name"
                required
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="comment_body">{user ? `Commenting as ${user.full_name}` : 'Comment'}</label>
            <textarea
              id="comment_body"
              rows={3}
              required
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={posting}>
            {posting ? 'Posting…' : 'Post comment'}
          </button>
        </form>

        {comments === null && <p className="muted">Loading comments…</p>}
        {comments?.length === 0 && <p className="muted">No comments yet — be the first.</p>}
        {comments?.length > 0 && (
          <div className="ledger">
            {comments.map((c) => (
              <div className="ledger-row" key={c.id} style={{ display: 'block' }}>
                <div className="ledger-row-main">
                  <span className="ledger-row-title">{c.author_name}</span>
                  <span className="ledger-row-meta">{formatDate(c.created_at)}</span>
                </div>
                <p style={{ marginTop: '0.4rem', marginBottom: 0 }}>{c.body}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}