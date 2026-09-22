import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser);

const FACILITIES = ['gym', 'coworking_computer', 'coworking_table'];
const CAPACITY = { gym: null, coworking_computer: 3, coworking_table: 11 }; // null = no stated cap

const COMPUTER_LIMIT_HOURS = 2;

// Haversine distance in meters between two lat/lng points.
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// How much extra slack to give a device's reported GPS accuracy before
// trusting it — capped so a wildly inaccurate reading (e.g. IP-based
// fallback on a laptop with no GPS chip) can't defeat the geofence entirely.
const MAX_ACCURACY_BONUS_METERS = 100;

// A session counts as "currently occupying" a slot if it hasn't been
// checked out, AND — for computers specifically — it's still within the
// 2-hour limit. This is computed here rather than stored, so a forgotten
// checkout on a computer stops counting against capacity on its own,
// without needing a cron job.
function isActive(log) {
  if (log.checked_out_at) return false;
  if (log.facility === 'coworking_computer') {
    const ageMs = Date.now() - new Date(log.checked_in_at).getTime();
    return ageMs < COMPUTER_LIMIT_HOURS * 60 * 60 * 1000;
  }
  return true;
}

// GET /facilities/occupancy  (public — just the counts, no names)
router.get('/occupancy', async (req, res) => {
  const { data, error } = await supabase
    .from('facility_usage_logs')
    .select('*')
    .is('checked_out_at', null);

  if (error) return res.status(500).json({ error: error.message });

  const counts = { gym: 0, coworking_computer: 0, coworking_table: 0 };
  for (const log of data) {
    if (isActive(log)) counts[log.facility] += 1;
  }

  res.json({
    occupancy: FACILITIES.map((facility) => ({
      facility,
      count: counts[facility],
      capacity: CAPACITY[facility],
    })),
  });
});

// GET /facilities/mine  (logged-in resident — their own active sessions,
// so the frontend doesn't need to guess via localStorage)
router.get('/mine', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('facility_usage_logs')
    .select('*')
    .eq('user_id', req.user.id)
    .is('checked_out_at', null);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data.filter(isActive) });
});

// GET /facilities/geofence  (public — so the frontend can show a sensible
// error/distance before even trying, though the server check below is
// the actual enforcement)
router.get('/geofence', async (req, res) => {
  const { data, error } = await supabase.from('facility_geofence').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ geofence: data });
});

// PATCH /facilities/geofence  (staff — secretary/kagawad; tune after on-site testing)
router.patch('/geofence', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { latitude, longitude, radius_meters } = req.body;

  const updatePayload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
  if (latitude !== undefined) updatePayload.latitude = Number(latitude);
  if (longitude !== undefined) updatePayload.longitude = Number(longitude);
  if (radius_meters !== undefined) updatePayload.radius_meters = Number(radius_meters);

  const { data, error } = await supabase
    .from('facility_geofence')
    .update(updatePayload)
    .eq('id', 1)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ geofence: data });
});

// POST /facilities/checkin  (requires login AND being within the geofence)
// Body: { facility, latitude, longitude, accuracy }
router.post('/checkin', requireAuth, async (req, res) => {
  const { facility, latitude, longitude, accuracy } = req.body;
  if (!FACILITIES.includes(facility)) {
    return res.status(400).json({ error: `facility must be one of ${FACILITIES.join(', ')}` });
  }
  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Location is required to check in' });
  }

  const { data: geofence } = await supabase.from('facility_geofence').select('*').eq('id', 1).single();
  if (geofence) {
    const distance = distanceMeters(Number(latitude), Number(longitude), geofence.latitude, geofence.longitude);
    const allowance = geofence.radius_meters + Math.min(Number(accuracy) || 0, MAX_ACCURACY_BONUS_METERS);
    if (distance > allowance) {
      return res.status(403).json({
        error: `You need to be at the barangay hall to check in (you're about ${Math.round(distance)}m away).`,
      });
    }
  }

  const { data: user } = await supabase.from('users').select('full_name').eq('id', req.user.id).single();

  const { data, error } = await supabase
    .from('facility_usage_logs')
    .insert({ facility, user_id: req.user.id, visitor_name: user?.full_name || 'Resident' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ log: data });
});

// POST /facilities/checkout/:id  (the session's own account, or staff)
router.post('/checkout/:id', requireAuth, async (req, res) => {
  const { data: log } = await supabase.from('facility_usage_logs').select('*').eq('id', req.params.id).single();
  if (!log) return res.status(404).json({ error: 'Session not found' });

  const isOwner = log.user_id === req.user.id;
  const isStaff = ['secretary', 'kagawad'].includes(req.user.role);
  if (!isOwner && !isStaff) return res.status(403).json({ error: 'Not authorized to check out this session' });

  if (log.checked_out_at) return res.status(400).json({ error: 'Already checked out' });

  const { data, error } = await supabase
    .from('facility_usage_logs')
    .update({ checked_out_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ log: data });
});

// GET /facilities/active  (staff — secretary/kagawad; oversight + manual checkout for stale sessions)
router.get('/active', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { data, error } = await supabase
    .from('facility_usage_logs')
    .select('*')
    .is('checked_out_at', null)
    .order('checked_in_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ sessions: data.map((log) => ({ ...log, still_active: isActive(log) })) });
});

export default router;