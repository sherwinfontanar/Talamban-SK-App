import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/supabaseClient.js';

const router = Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /auth/signup
// Creates a resident account. If this email already made guest requests,
// those get linked AFTER email verification (not immediately) — see
// /auth/verify-email below.
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

  // TODO: send verification email (Resend) with a signed link to /auth/verify-email?token=...
  // On verification, run the guest-request linking step:
  //   update requests set user_id = :new_user_id where guest_email = :email and user_id is null

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

// GET /auth/verify-email?token=...
// TODO: verify signed token, set email_verified_at, then link any guest
// requests matching that email to the new user_id.
router.get('/verify-email', async (req, res) => {
  res.status(501).json({ error: 'Not implemented yet' });
});

export default router;
