'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function NewsEditModal({ open, post, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && post) {
      setForm({ title: post.title, body: post.body, is_published: post.is_published });
      setPhoto(null);
      setError(null);
    }
  }, [open, post]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !post || !form) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('body', form.body);
      formData.append('is_published', form.is_published);
      if (photo) formData.append('photo', photo);

      await api.upload(`/news/${post.id}`, formData, 'PATCH');
      onSaved?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Edit post</h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="n-title">Title</label>
            <input id="n-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="n-body">Body</label>
            <textarea id="n-body" rows={6} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="n-photo">Photo (leave blank to keep current)</label>
            <input id="n-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
            />
            Published
          </label>

          {error && (
            <div className="notice notice-danger">
              <p>{error}</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}