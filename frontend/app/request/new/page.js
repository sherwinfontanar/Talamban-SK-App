'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Masthead from '../../components/Masthead';
import { api } from '../../lib/api';

const DOCUMENT_LABELS = {
  barangay_cert: 'Barangay Certificate',
  ftjs_cert: 'First Time Jobseeker Certificate',
  indigency_cert: 'Certificate of Indigency',
};

export default function NewRequestPage() {
  const params = useSearchParams();
  const router = useRouter();
  const documentType = params.get('type') || 'barangay_cert';

  const [form, setForm] = useState({ full_name: '', address: '', age: '', purpose: '', guest_email: '' });
  const [proofOfBilling, setProofOfBilling] = useState(null);
  const [validId, setValidId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function uploadIfPresent(requestId, file, kind) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_kind', kind);
    await api.upload(`/requests/${requestId}/documents?guest_email=${form.guest_email}`, formData);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { request, ftjs_flag } = await api.post('/requests', {
        document_type: documentType,
        ...form,
        age: Number(form.age),
      });

      await Promise.all([
        uploadIfPresent(request.id, proofOfBilling, 'proof_of_billing'),
        uploadIfPresent(request.id, validId, 'valid_id'),
      ]);

      const flagNote = ftjs_flag ? '&ftjs_flag=1' : '';
      router.push(`/request/status/${request.id}?guest_email=${form.guest_email}${flagNote}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--form">
        <h1>{DOCUMENT_LABELS[documentType] || documentType}</h1>
        <p className="muted">Fill in your details below. You'll get a reference to check your status.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="age">Age</label>
            <input
              id="age"
              required
              type="number"
              min="0"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="purpose">Purpose</label>
            <input
              id="purpose"
              required
              placeholder="e.g. For employment, for scholarship application"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="guest_email">Email</label>
            <input
              id="guest_email"
              required
              type="email"
              value={form.guest_email}
              onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
            />
            <span className="field-hint">We'll send status updates and your claim code here.</span>
          </div>

          <div className="field">
            <label htmlFor="proof_of_billing">Proof of billing (optional)</label>
            <input
              id="proof_of_billing"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setProofOfBilling(e.target.files?.[0] || null)}
            />
          </div>

          <div className="field">
            <label htmlFor="valid_id">Valid ID (optional)</label>
            <input
              id="valid_id"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setValidId(e.target.files?.[0] || null)}
            />
            <span className="field-hint">Speeds up review, but staff will also verify at claim time.</span>
          </div>

          {error && (
            <div className="notice notice-danger">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </main>
    </div>
  );
}