'use client';

import { useEffect, useState } from 'react';
import Masthead from '../../components/Masthead';
import ConfirmModal from '../../components/ConfirmModal';
import { api } from '../../lib/api';

const COURT_TYPES = ['basketball', 'volleyball', 'badminton', 'pickleball'];

const EMPTY_FORM = {
  name: '',
  court_type: 'basketball',
  location: '',
  google_maps_url: '',
  price_amount: '',
  price_unit: 'per hour',
};

export default function StaffCourtsPage() {
  const [courts, setCourts] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [editingId, setEditingId] = useState(null); // court id currently being edited, or null for "add new"
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);

  async function load() {
    try {
      const data = await api.get('/courts?include_inactive=1');
      setCourts(data.courts);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(court) {
    setEditingId(court.id);
    setForm({
      name: court.name,
      court_type: court.court_type,
      location: court.location,
      google_maps_url: court.google_maps_url || '',
      price_amount: court.price_amount ?? '',
      price_unit: court.price_unit || 'per hour',
    });
    setPhoto(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setPhoto(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (photo) formData.append('photo', photo);

      if (editingId) {
        await api.upload(`/courts/${editingId}`, formData, 'PATCH');
      } else {
        await api.upload('/courts', formData);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.del(`/courts/${id}`);
      setDeactivatingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <h1>Courts</h1>
        <p className="muted">Manage sports court listings shown to residents.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="content--form" style={{ padding: 0, margin: '0 0 2rem' }}>
          <h2>{editingId ? 'Edit court' : 'Add a court'}</h2>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="court_type">Type</label>
            <select
              id="court_type"
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
            <label htmlFor="location">Location</label>
            <input
              id="location"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="google_maps_url">Google Maps link</label>
            <input
              id="google_maps_url"
              type="url"
              placeholder="https://maps.google.com/..."
              value={form.google_maps_url}
              onChange={(e) => setForm({ ...form, google_maps_url: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="price_amount">Price (leave blank if free)</label>
              <input
                id="price_amount"
                type="number"
                min="0"
                step="0.01"
                value={form.price_amount}
                onChange={(e) => setForm({ ...form, price_amount: e.target.value })}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="price_unit">Unit</label>
              <input
                id="price_unit"
                placeholder="per hour"
                value={form.price_unit}
                onChange={(e) => setForm({ ...form, price_unit: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="photo">Photo{editingId ? ' (leave blank to keep current)' : ''}</label>
            <input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add court'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>

        <h2>Listings</h2>
        {courts.length === 0 ? (
          <div className="empty-state">No courts added yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Location</th>
                <th>Price</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.court_type}</td>
                  <td>{c.location}</td>
                  <td>{c.price_amount ? `₱${c.price_amount} ${c.price_unit}` : 'Free'}</td>
                  <td>{c.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-link" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      {c.is_active && (
                        <button className="btn btn-danger btn-sm" onClick={() => setDeactivatingId(c.id)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>

      <ConfirmModal
        open={Boolean(deactivatingId)}
        title="Deactivate this court?"
        message="It will be hidden from residents but kept in your records."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => handleDeactivate(deactivatingId)}
        onClose={() => setDeactivatingId(null)}
      />
    </div>
  );
}