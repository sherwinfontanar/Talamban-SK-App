'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const DIFFICULTIES = ['easy', 'moderate', 'hard'];

export default function TrailEditModal({ open, trail, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && trail) {
      setForm({
        name: trail.name,
        description: trail.description || '',
        difficulty: trail.difficulty || 'easy',
        estimated_duration: trail.estimated_duration || '',
        starting_point_location: trail.starting_point_location || '',
        starting_point_maps_url: trail.starting_point_maps_url || '',
        getting_there: trail.getting_there || '',
      });
      setPhoto(null);
      setError(null);
    }
  }, [open, trail]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !trail || !form) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (photo) formData.append('cover_photo', photo);

      await api.upload(`/trails/${trail.id}`, formData, 'PATCH');
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
        <h2 className="modal-title">Edit trail</h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="t-name">Name</label>
            <input id="t-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="t-description">Description</label>
            <textarea
              id="t-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="t-difficulty">Difficulty</label>
              <select
                id="t-difficulty"
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="t-duration">Estimated duration</label>
              <input
                id="t-duration"
                placeholder="e.g. 4-6 hours"
                value={form.estimated_duration}
                onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="t-start-loc">Starting point location</label>
            <input
              id="t-start-loc"
              value={form.starting_point_location}
              onChange={(e) => setForm({ ...form, starting_point_location: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="t-start-maps">Starting point Google Maps link</label>
            <input
              id="t-start-maps"
              type="url"
              placeholder="https://maps.google.com/..."
              value={form.starting_point_maps_url}
              onChange={(e) => setForm({ ...form, starting_point_maps_url: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="t-getting-there">Getting there (what to ride)</label>
            <textarea
              id="t-getting-there"
              rows={2}
              placeholder="e.g. Ride a habal-habal from the Talamban terminal to the barangay hall, then walk 10 minutes to the trailhead."
              value={form.getting_there}
              onChange={(e) => setForm({ ...form, getting_there: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="t-photo">Cover photo (leave blank to keep current)</label>
            <input id="t-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </div>

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