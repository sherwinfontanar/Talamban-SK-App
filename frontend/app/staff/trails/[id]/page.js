'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Masthead from '../../../components/Masthead';
import ConfirmModal from '../../../components/ConfirmModal';
import CheckpointEditModal from '../../../components/CheckpointEditModal';
import { api } from '../../../lib/api';

const EMPTY_FORM = { name: '', description: '', travel_note: '', google_maps_url: '', order_index: 0 };

export default function StaffTrailCheckpointsPage() {
  const { id: trailId } = useParams();
  const [trail, setTrail] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingCheckpoint, setEditingCheckpoint] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    try {
      const data = await api.get(`/trails/${trailId}`);
      setTrail(data.trail);
      setCheckpoints(data.checkpoints);
      setForm((f) => ({ ...f, order_index: data.checkpoints.length }));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailId]);

  async function handleAddSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      files.forEach((file) => formData.append('photos', file));

      await api.upload(`/trails/${trailId}/checkpoints`, formData);
      setFiles([]);
      await load();
      setForm({ ...EMPTY_FORM, order_index: checkpoints.length + 1 });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.del(`/trails/${trailId}/checkpoints/${id}`);
      setDeletingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!trail && !error) {
    return (
      <div className="page">
        <Masthead nav="staff" />
        <main className="content content--wide">
          <p className="muted">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Masthead nav="staff" />
      <main className="content content--wide">
        <p>
          <Link href="/staff/trails">← All trails</Link>
        </p>
        <h1>{trail?.name} — checkpoints</h1>
        <p className="muted">Add waypoints in the order hikers should follow them.</p>

        {error && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleAddSubmit} className="content--form" style={{ padding: 0, margin: '0 0 2rem' }}>
          <h2>Add a checkpoint</h2>

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
              placeholder="e.g. Take the left fork at the bamboo grove, ride a habal-habal for 15 minutes to the next stop."
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

          <div className="field">
            <label htmlFor="cp-photos">Photos</label>
            <input
              id="cp-photos"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add checkpoint'}
          </button>
        </form>

        <h2>Checkpoints</h2>
        {checkpoints.length === 0 ? (
          <div className="empty-state">No checkpoints added yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Photos</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((cp) => (
                <tr key={cp.id}>
                  <td>{cp.order_index}</td>
                  <td>{cp.name}</td>
                  <td>{cp.trail_checkpoint_photos?.length ?? 0}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-link" onClick={() => setEditingCheckpoint(cp)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeletingId(cp.id)}>
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

      <CheckpointEditModal
        open={Boolean(editingCheckpoint)}
        trailId={trailId}
        checkpoint={editingCheckpoint}
        onClose={() => setEditingCheckpoint(null)}
        onSaved={load}
      />

      <ConfirmModal
        open={Boolean(deletingId)}
        title="Delete this checkpoint?"
        message="This removes it and its photos permanently — there's no undo."
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => handleDelete(deletingId)}
        onClose={() => setDeletingId(null)}
      />
    </div>
  );
}