'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StatusLookupPage() {
  const router = useRouter();
  const [requestId, setRequestId] = useState('');
  const [email, setEmail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    router.push(`/request/status/${requestId}?guest_email=${email}`);
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '2rem' }}>
      <h1>Check your request status</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label>
          Request ID (from your confirmation email)
          <input required value={requestId} onChange={(e) => setRequestId(e.target.value)} />
        </label>
        <label>
          Email used when requesting
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <button type="submit">View status</button>
      </form>
    </main>
  );
}
