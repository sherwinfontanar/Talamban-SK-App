'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Masthead from '../components/Masthead';
import { api } from '../lib/api';

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState('verifying'); // verifying | done | error
  const [error, setError] = useState(null);
  const [linkedRequests, setLinkedRequests] = useState(0);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('This verification link is missing its token.');
      return;
    }

    api
      .post('/auth/verify-email', { token })
      .then((data) => {
        localStorage.setItem('sk_token', data.token);
        localStorage.setItem('sk_user', JSON.stringify(data.user));
        setLinkedRequests(data.linkedRequests);
        setStatus('done');
      })
      .catch((err) => {
        setError(err.message);
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--form">
        <h1>Email verification</h1>

        {status === 'verifying' && <p className="muted">Verifying your email…</p>}

        {status === 'done' && (
          <div className="notice">
            <p>
              Your email is verified.{' '}
              {linkedRequests > 0
                ? `${linkedRequests} past request${linkedRequests === 1 ? '' : 's'} you made as a guest ${linkedRequests === 1 ? 'is' : 'are'} now linked to your account.`
                : "You're all set."}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="notice notice-danger">
            <p>{error}</p>
          </div>
        )}
      </main>
    </div>
  );
}