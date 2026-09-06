'use client';

import { useState } from 'react';
import Masthead from '../components/Masthead';
import { api } from '../lib/api';

export default function SignupPage() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '', address: '', age: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/signup', { ...form, age: Number(form.age) });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="page">
        <Masthead nav="resident" />
        <main className="content content--form">
          <h1>Check your email</h1>
          <p className="muted">
            We sent a verification link to <strong>{form.email}</strong>. Verifying links any
            requests you made as a guest with this email to your new account.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Masthead nav="resident" />
      <main className="content content--form">
        <h1>Create an account</h1>
        <p className="muted">Keep track of every request you've made in one place.</p>

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
            <label htmlFor="email">Email</label>
            <input
              id="email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <span className="field-hint">Use the same email as any past guest requests to link them.</span>
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {error && (
            <div className="notice notice-danger">
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </main>
    </div>
  );
}
