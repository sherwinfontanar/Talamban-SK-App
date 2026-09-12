'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Masthead from '../../components/Masthead';
import ConfirmModal from '../../components/ConfirmModal';
import TrailEditModal from '../../components/TrailEditModal';
import { api } from '../../lib/api';

const DIFFICULTIES = ['easy', 'moderate', 'hard'];

const EMPTY_FORM = {
  name: '',
  description: '',
  difficulty: 'easy',
  estimated_duration: '',
  starting_point_location: '',
  starting_point_maps_url: '',
  getting_there: '',
};

export default function StaffTrailsPage() {
  const [trails, setTrails] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState(null);
  const [editingTrail, setEditingTrail] = useState(null);

  async function load() {
    try {
      const data = await api.get('/trails?include_inactive=1');
      setTrails(data.trails);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAddSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (photo) formData.append('cover_photo', photo);

      await api.upload('/trails', formData);
      setForm(EMPTY_FORM);
      setPhoto(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id) {
    try {
      await api.del(`/trails/${id}`);
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
        <h1>Trails</h1>
        <p className="muted">Manage hiking trail guides shown to residents. Checkpoints are managed from each trail's page.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="content--form" style={{ padding: 0, margin: '0 0 2rem' }}>
          <h2>Add a trail</h2>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
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
              <label htmlFor="estimated_duration">Estimated duration</label>
              <input
                id="estimated_duration"
                placeholder="e.g. 4-6 hours"
                value={form.estimated_duration}
                onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="starting_point_location">Starting point location</label>
            <input
              id="starting_point_location"
              value={form.starting_point_location}
              onChange={(e) => setForm({ ...form, starting_point_location: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="starting_point_maps_url">Starting point Google Maps link</label>
            <input
              id="starting_point_maps_url"
              type="url"
              placeholder="https://maps.google.com/..."
              value={form.starting_point_maps_url}
              onChange={(e) => setForm({ ...form, starting_point_maps_url: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="getting_there">Getting there (what to ride)</label>
            <textarea
              id="getting_there"
              rows={2}
              placeholder="e.g. Ride a habal-habal from the Talamban terminal to the barangay hall, then walk 10 minutes to the trailhead."
              value={form.getting_there}
              onChange={(e) => setForm({ ...form, getting_there: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="photo">Cover photo</label>
            <input id="photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add trail'}
          </button>
        </form>

        <h2>Listings</h2>
        {trails.length === 0 ? (
          <div className="empty-state">No trails added yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {trails.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.difficulty || '—'}</td>
                  <td>{t.estimated_duration || '—'}</td>
                  <td>{t.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <div className="table-actions">
                      <Link href={`/staff/trails/${t.id}`} className="btn-link">
                        Checkpoints
                      </Link>
                      <button className="btn-link" onClick={() => setEditingTrail(t)}>
                        Edit
                      </button>
                      {t.is_active && (
                        <button className="btn btn-danger btn-sm" onClick={() => setDeactivatingId(t.id)}>
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

      <TrailEditModal open={Boolean(editingTrail)} trail={editingTrail} onClose={() => setEditingTrail(null)} onSaved={load} />

      <ConfirmModal
        open={Boolean(deactivatingId)}
        title="Deactivate this trail?"
        message="It will be hidden from residents but kept in your records."
        confirmLabel="Deactivate"
        tone="danger"
        onConfirm={() => handleDeactivate(deactivatingId)}
        onClose={() => setDeactivatingId(null)}
      />
    </div>
  );
}