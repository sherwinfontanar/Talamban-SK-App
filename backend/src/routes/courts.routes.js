import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const COURT_TYPES = ['pickleball', 'basketball', 'volleyball', 'badminton'];

async function uploadPhoto(file) {
  if (!file) return null;
  const path = `${uuidv4()}-${file.originalname}`;
  const { error } = await supabase.storage
    .from('court-photos')
    .upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error(error.message);

  // court-photos is a public bucket — these are promotional photos, not
  // private documents — so a plain public URL is fine, no signed URL needed.
  const { data } = supabase.storage.from('court-photos').getPublicUrl(path);
  return data.publicUrl;
}

// GET /courts?type=basketball
// Public — no auth required. Residents browse active courts, optionally
// filtered by type. Staff can pass ?include_inactive=1 to manage listings.
router.get('/', async (req, res) => {
  const { type, include_inactive } = req.query;
  const isStaff = ['secretary', 'kagawad'].includes(req.user?.role);

  let query = supabase.from('courts').select('*').order('created_at', { ascending: false });
  if (!(include_inactive && isStaff)) query = query.eq('is_active', true);
  if (type) query = query.eq('court_type', type);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ courts: data });
});

// POST /courts  (staff — add a new court listing)
router.post('/', requireRole('secretary', 'kagawad'), upload.single('photo'), async (req, res) => {
  const { name, court_type, location, google_maps_url, price_amount, price_unit } = req.body;

  if (!name || !court_type || !location) {
    return res.status(400).json({ error: 'name, court_type, and location are required' });
  }
  if (!COURT_TYPES.includes(court_type)) {
    return res.status(400).json({ error: `court_type must be one of ${COURT_TYPES.join(', ')}` });
  }

  let photo_url = null;
  try {
    photo_url = await uploadPhoto(req.file);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const { data, error } = await supabase
    .from('courts')
    .insert({
      name,
      court_type,
      location,
      google_maps_url: google_maps_url || null,
      price_amount: price_amount || null,
      price_unit: price_unit || 'per hour',
      photo_url,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ court: data });
});

// PATCH /courts/:id  (staff — edit details, optionally replace the photo)
router.patch('/:id', requireRole('secretary', 'kagawad'), upload.single('photo'), async (req, res) => {
  const { name, court_type, location, google_maps_url, price_amount, price_unit, is_active } = req.body;

  if (court_type && !COURT_TYPES.includes(court_type)) {
    return res.status(400).json({ error: `court_type must be one of ${COURT_TYPES.join(', ')}` });
  }

  const updatePayload = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = name;
  if (court_type !== undefined) updatePayload.court_type = court_type;
  if (location !== undefined) updatePayload.location = location;
  if (google_maps_url !== undefined) updatePayload.google_maps_url = google_maps_url;
  if (price_amount !== undefined) updatePayload.price_amount = price_amount;
  if (price_unit !== undefined) updatePayload.price_unit = price_unit;
  if (is_active !== undefined) updatePayload.is_active = is_active === 'true' || is_active === true;

  if (req.file) {
    try {
      updatePayload.photo_url = await uploadPhoto(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { data, error } = await supabase
    .from('courts')
    .update(updatePayload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ court: data });
});

// DELETE /courts/:id  (staff — soft delete, keeps the row for history)
router.delete('/:id', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { error } = await supabase
    .from('courts')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;