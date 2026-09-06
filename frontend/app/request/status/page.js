'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Masthead from '../../components/Masthead';

export default function StatusLookupPage() {
  const router = useRouter();
  const [requestId, setRequestId] = useState('');
  const [email, setEmail] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    router.push(`/request/status/${requestId}?guest_email=${email}`);
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--form">
        <h1>Check your request status</h1>
        <p className="muted">Use the reference and email from your confirmation.</p>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="requestId">Reference number</label>
            <input id="requestId" required value={requestId} onChange={(e) => setRequestId(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="email">Email used when requesting</label>
            <input id="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            View status
          </button>
        </form>
      </main>
    </div>
  );
}
