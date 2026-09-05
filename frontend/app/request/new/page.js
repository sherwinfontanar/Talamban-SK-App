'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function NewRequestPage() {
  const params = useSearchParams();
  const router = useRouter();
  const documentType = params.get('type') || 'barangay_cert';

  const [form, setForm] = useState({ full_name: '', address: '', age: '', guest_email: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_type: documentType, ...form, age: Number(form.age) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      router.push(`/request/status/${data.request.id}?guest_email=${form.guest_email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem' }}>
      <h1>Request: {documentType.replace('_', ' ')}</h1>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label>
          Full name
          <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </label>
        <label>
          Address
          <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </label>
        <label>
          Age
          <input required type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
        </label>
        <label>
          Email (for status updates and claim code)
          <input required type="email" value={form.guest_email} onChange={(e) => setForm({ ...form, guest_email: e.target.value })} />
        </label>

        {/* TODO: optional file upload fields for proof of billing / valid ID */}

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit request'}
        </button>
      </form>
    </main>
  );
}
