'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const STATUS_LABELS = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  for_payment: 'Waiting for payment',
  payment_rejected: 'Payment rejected — please re-upload',
  paid: 'Paid',
  ready_for_claim: 'Ready for claim',
  claimed: 'Claimed',
};

export default function RequestStatusPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const guestEmail = searchParams.get('guest_email');

  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/requests/${id}?guest_email=${guestEmail || ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load request');
        setRequest(data.request);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [id, guestEmail]);

  if (error) return <main style={{ padding: '2rem' }}><p style={{ color: 'crimson' }}>{error}</p></main>;
  if (!request) return <main style={{ padding: '2rem' }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '2rem' }}>
      <h1>Request status</h1>
      <p><strong>Document:</strong> {request.document_type.replace('_', ' ')}</p>
      <p><strong>Status:</strong> {STATUS_LABELS[request.status] || request.status}</p>

      {request.status === 'rejected' && (
        <p style={{ color: 'crimson' }}>Reason: {request.rejection_reason}</p>
      )}

      {request.status === 'for_payment' && (
        <p>Fee: ₱{request.fee_amount}. Upload your receipt to proceed. {/* TODO: upload form */}</p>
      )}

      {request.status === 'ready_for_claim' && (
        <div>
          <p>Your document is ready. Present this code at the barangay hall:</p>
          <h2>{request.claim_code}</h2>
          {request.qr_code_url && <img src={request.qr_code_url} alt="Claim QR code" width={180} />}
        </div>
      )}

      {request.status === 'claimed' && <p>This request has already been claimed. Thank you!</p>}
    </main>
  );
}
