'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import ConfirmModal from '../../components/ConfirmModal';
import NewsEditModal from '../../components/NewsEditModal';
import { api, formatDate } from '../../lib/api';

const EMPTY_FORM = { title: '', body: '' };

export default function StaffNewsPage() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [statsForm, setStatsForm] = useState(null);
  const [statsSaving, setStatsSaving] = useState(false);
  const [statsSaved, setStatsSaved] = useState(false);

  async function load() {
    try {
      const data = await api.get('/news?include_unpublished=1');
      setPosts(data.posts);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadStats() {
    try {
      const data = await api.get('/barangay-stats');
      setStatsForm({
        population: data.stats.population ?? '',
        population_year: data.stats.population_year ?? '',
        source_label: data.stats.source_label ?? '',
        source_url: data.stats.source_url ?? '',
      });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    loadStats();
  }, []);

  async function handleStatsSubmit(e) {
    e.preventDefault();
    setStatsSaving(true);
    setStatsSaved(false);
    setError(null);
    try {
      await api.patch('/barangay-stats', statsForm);
      setStatsSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatsSaving(false);
    }
  }

  async function handleAddSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('body', form.body);
      if (photo) formData.append('photo', photo);

      await api.upload('/news', formData);
      setForm(EMPTY_FORM);
      setPhoto(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.del(`/news/${id}`);
      setDeletingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>News</h1>
        <p className="muted">Posted here shows on the resident landing page. Only the Secretary can post.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        {statsForm && (
          <form
            onSubmit={handleStatsSubmit}
            className="content--form"
            style={{ padding: 0, margin: '0 0 2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--hairline)' }}
          >
            <h2>Population stat</h2>
            <p className="muted" style={{ fontSize: '0.85rem' }}>
              Shown on the resident dashboard. There's no live PSA API for this — update it manually
              whenever a new census count is released.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="s-population">Population</label>
                <input
                  id="s-population"
                  type="number"
                  min="0"
                  value={statsForm.population}
                  onChange={(e) => setStatsForm({ ...statsForm, population: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="s-year">Census year</label>
                <input
                  id="s-year"
                  type="number"
                  value={statsForm.population_year}
                  onChange={(e) => setStatsForm({ ...statsForm, population_year: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="s-label">Source label</label>
              <input
                id="s-label"
                placeholder="e.g. PSA 2024 Census of Population and Housing (POPCEN)"
                value={statsForm.source_label}
                onChange={(e) => setStatsForm({ ...statsForm, source_label: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="s-url">Source link</label>
              <input
                id="s-url"
                type="url"
                value={statsForm.source_url}
                onChange={(e) => setStatsForm({ ...statsForm, source_url: e.target.value })}
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={statsSaving}>
              {statsSaving ? 'Saving…' : 'Save'}
            </button>
            {statsSaved && <span className="muted" style={{ marginLeft: '0.75rem' }}>Saved.</span>}
          </form>
        )}

        <form onSubmit={handleAddSubmit} className="content--form" style={{ padding: 0, margin: '0 0 2rem' }}>
          <h2>New post</h2>

          <div className="field">
            <label htmlFor="title">Title</label>
            <input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="body">Body</label>
            <textarea id="body" rows={6} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="photo">Photo (optional)</label>
            <input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Posting…' : 'Post'}
          </button>
        </form>

        <h2>Posts</h2>
        {posts.length === 0 ? (
          <div className="empty-state">No posts yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{formatDate(p.created_at)}</td>
                  <td>{p.is_published ? 'Published' : 'Unpublished'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-link" onClick={() => setEditingPost(p)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeletingId(p.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <NewsEditModal open={Boolean(editingPost)} post={editingPost} onClose={() => setEditingPost(null)} onSaved={load} />

      <ConfirmModal
        open={Boolean(deletingId)}
        title="Delete this post?"
        message="This removes it permanently — there's no undo."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => handleDelete(deletingId)}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}