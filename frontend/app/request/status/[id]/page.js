'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Masthead from '../../../components/Masthead';
import StatusTag from '../../../components/StatusTag';
import { api } from '../../../lib/api';
import { subscribeToPush } from '../../../lib/push';

export default function RequestStatusPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const guestEmail = searchParams.get('guest_email') || '';
  const ftjsFlag = searchParams.get('ftjs_flag') === '1';

  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [pushState, setPushState] = useState('idle'); // idle | subscribing | subscribed | error
  const [pushError, setPushError] = useState(null);

  async function load() {
    try {
      const data = await api.get(`/requests/${id}?guest_email=${guestEmail}`);
      setRequest(data.request);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleReceiptUpload(e) {
    e.preventDefault();
    if (!receiptFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', receiptFile);
      formData.append('amount', request.fee_amount);
      await api.upload(`/payments/${request.id}/receipt?guest_email=${guestEmail}`, formData);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubscribe() {
    setPushState('subscribing');
    setPushError(null);
    try {
      await subscribeToPush(request.id, guestEmail);
      setPushState('subscribed');
    } catch (err) {
      setPushError(err.message);
      setPushState('error');
    }
  }

  if (error) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <p className="muted">Loading…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--form">
        <h1>Your request</h1>

        <div className="ledger" style={{ marginBottom: '1.5rem' }}>
          <div className="ledger-row">
            <div className="ledger-row-main">
              <span className="ledger-row-title">{request.document_type.replace(/_/g, ' ')}</span>
              <span className="ledger-row-meta mono">{request.id}</span>
            </div>
            <StatusTag status={request.status} />
          </div>
        </div>

        {request.status !== 'claimed' && (
          <div className="notice" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <p style={{ margin: 0 }}>Get a notification on this device when your status changes.</p>
            {pushState === 'subscribed' ? (
              <span className="muted">Notifications on</span>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={handleSubscribe} disabled={pushState === 'subscribing'}>
                {pushState === 'subscribing' ? 'Enabling…' : 'Notify me'}
              </button>
            )}
          </div>
        )}
        {pushError && (
          <div className="notice notice-danger">
            <p>{pushError}</p>
          </div>
        )}

        {ftjsFlag && (
          <div className="notice">
            <p>This request was flagged for a possible prior First Time Jobseeker Certificate. Staff will confirm during review.</p>
          </div>
        )}

        {request.status === 'rejected' && (
          <div className="notice notice-danger">
            <p>Reason: {request.rejection_reason}</p>
          </div>
        )}

        {request.status === 'payment_rejected' && (
          <div className="notice notice-danger">
            <p>Your receipt was rejected: {request.rejection_reason}. Please upload a clearer copy below.</p>
          </div>
        )}

        {['for_payment', 'payment_rejected'].includes(request.status) && (
          <form onSubmit={handleReceiptUpload}>
            <h2>Pay the fee</h2>
            <p className="muted">Fee: ₱{request.fee_amount}. Upload your receipt for the treasurer to verify.</p>
            <div className="field">
              <label htmlFor="receipt">Receipt</label>
              <input
                id="receipt"
                type="file"
                accept="image/*,.pdf"
                required
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Uploading…' : 'Upload receipt'}
            </button>
          </form>
        )}

        {request.status === 'ready_for_claim' && (
          <div className="claim-stamp">
            <p className="muted" style={{ marginBottom: '0.25rem' }}>Present this code at the barangay hall</p>
            <div className="claim-stamp-code">{request.claim_code}</div>
            {request.qr_code_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={request.qr_code_url} alt="Claim QR code" width={160} height={160} />
            )}
          </div>
        )}

        {request.status === 'claimed' && (
          <div className="notice">
            <p>This document has already been claimed. Thank you!</p>
          </div>
        )}
      </main>
    </div>
  );
}