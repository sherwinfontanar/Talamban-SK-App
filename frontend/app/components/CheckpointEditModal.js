'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function CheckpointEditModal({ open, trailId, checkpoint, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [photos, setPhotos] = useState([]); // existing photos still attached
  const [newFiles, setNewFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && checkpoint) {
      setForm({
        name: checkpoint.name,
        description: checkpoint.description || '',
        travel_note: checkpoint.travel_note || '',
        google_maps_url: checkpoint.google_maps_url || '',
        order_index: checkpoint.order_index ?? 0,
      });
      setPhotos(checkpoint.trail_checkpoint_photos || []);
      setNewFiles([]);
      setError(null);
    }
  }, [open, checkpoint]);

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') onClose?.();
    }
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open || !checkpoint || !form) return null;

  async function removePhoto(photoId) {
    try {
      await api.del(`/trails/${trailId}/checkpoints/${checkpoint.id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      newFiles.forEach((file) => formData.append('photos', file));

      await api.upload(`/trails/${trailId}/checkpoints/${checkpoint.id}`, formData, 'PATCH');
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
        <h2 className="modal-title">Edit checkpoint</h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="cp-name">Name</label>
            <input id="cp-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="cp-description">Description</label>
            <textarea
              id="cp-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="cp-travel-note">Travel note (what to ride / look for next)</label>
            <textarea
              id="cp-travel-note"
              rows={2}
              value={form.travel_note}
              onChange={(e) => setForm({ ...form, travel_note: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="cp-maps">Google Maps link</label>
            <input
              id="cp-maps"
              type="url"
              value={form.google_maps_url}
              onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="cp-order">Order</label>
            <input
              id="cp-order"
              type="number"
              value={form.order_index}
              onChange={(e) => setForm({ ...form, order_index: e.target.value })}
            />
            <span className="field-hint">Lower numbers appear first in the guide.</span>
          </div>

          {photos.length > 0 && (
            <div className="field">
              <label>Current photos</label>
              <div className="checkpoint-photos">
                {photos.map((photo) => (
                  <div key={photo.id} style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.photo_url} alt="" className="checkpoint-photo" />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ position: 'absolute', top: 4, right: 4, padding: '0.1rem 0.4rem' }}
                      onClick={() => removePhoto(photo.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="cp-photos">Add more photos</label>
            <input
              id="cp-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setNewFiles(Array.from(e.target.files || []))}
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