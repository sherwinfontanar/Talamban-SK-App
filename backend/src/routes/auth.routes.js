import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';
import { sendVerificationEmail } from '../utils/email.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function signVerificationToken(email) {
  return jwt.sign({ email, purpose: 'verify-email' }, process.env.JWT_SECRET, { expiresIn: '24h' });
}

// POST /auth/signup
// Creates a resident account and emails a verification link. Guest requests
// made with this email are only linked to the account AFTER verification —
// see /auth/verify-email — so no one can claim someone else's history just
// by signing up with a guessed email.
router.post('/signup', async (req, res) => {
  const { email, password, full_name, address, age } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'email, password, and full_name are required' });
  }

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'Account already exists for this email' });

  const password_hash = await bcrypt.hash(password, 10);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ email, password_hash, full_name, address, age, role: 'resident' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const token = signVerificationToken(email);
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendVerificationEmail(email, verifyUrl);

  res.status(201).json({ message: 'Account created. Check your email to verify.', userId: user.id });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { data: user } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

  if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user);
  res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } });
});

// POST /auth/verify-email
// Body: { token } — the token from the emailed link. Marks the account
// verified and links any guest requests matching that email to it.
router.post('/verify-email', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'This verification link is invalid or has expired' });
  }
  if (payload.purpose !== 'verify-email') {
    return res.status(400).json({ error: 'Invalid token' });
  }

  const { data: user } = await supabase.from('users').select('*').eq('email', payload.email).maybeSingle();
  if (!user) return res.status(404).json({ error: 'Account not found' });

  await supabase
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', user.id);

  // Link past guest requests made with this email, now that it's confirmed
  // to belong to this account.
  const { data: linked } = await supabase
    .from('requests')
    .update({ user_id: user.id })
    .eq('guest_email', user.email)
    .is('user_id', null)
    .select('id');

  const authToken = signToken(user);
  res.json({
    message: 'Email verified',
    linkedRequests: linked?.length ?? 0,
    token: authToken,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
  });
});

export default router;