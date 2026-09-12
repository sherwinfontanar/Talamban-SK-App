'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

const COURT_TYPES = ['basketball', 'volleyball', 'badminton', 'pickleball'];

export default function CourtEditModal({ open, court, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed the form whenever a new court is opened for editing.
  useEffect(() => {
    if (open && court) {
      setForm({
        name: court.name,
        court_type: court.court_type,
        location: court.location,
        google_maps_url: court.google_maps_url || '',
        price_amount: court.price_amount ?? '',
        price_unit: court.price_unit || 'per hour',
      });
      setPhoto(null);
      setError(null);
    }
  }, [open, court]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !court || !form) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (photo) formData.append('photo', photo);

      await api.upload(`/courts/${court.id}`, formData, 'PATCH');
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
        <h2 className="modal-title">Edit court</h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="edit-name">Name</label>
            <input
              id="edit-name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="edit-court_type">Type</label>
            <select
              id="edit-court_type"
              value={form.court_type}
              onChange={(e) => setForm({ ...form, court_type: e.target.value })}
            >
              {COURT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="edit-location">Location</label>
            <input
              id="edit-location"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="edit-google_maps_url">Google Maps link</label>
            <input
              id="edit-google_maps_url"
              type="url"
              placeholder="https://maps.google.com/..."
              value={form.google_maps_url}
              onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="edit-price_amount">Price (leave blank if free)</label>
              <input
                id="edit-price_amount"
                type="number"
                min="0"
                step="0.01"
                value={form.price_amount}
                onChange={(e) => setForm({ ...form, price_amount: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="edit-price_unit">Unit</label>
              <input
                id="edit-price_unit"
                placeholder="per hour"
                value={form.price_unit}
                onChange={(e) => setForm({ ...form, price_unit: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="edit-photo">Photo (leave blank to keep current)</label>
            <input
              id="edit-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
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