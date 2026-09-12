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

const DIFFICULTIES = ['easy', 'moderate', 'hard'];

async function uploadToPublicBucket(file) {
  const path = `${uuidv4()}-${file.originalname}`;
  const { error } = await supabase.storage
    .from('trail-photos')
    .upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error(error.message);

  // trail-photos is a public bucket — same reasoning as court-photos:
  // these are promotional/informational images, not private documents.
  const { data } = supabase.storage.from('trail-photos').getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Trails ----------

// GET /trails?include_inactive=1  (public; include_inactive only honored for staff)
router.get('/', async (req, res) => {
  const isStaff = ['secretary', 'kagawad'].includes(req.user?.role);
  let query = supabase.from('trails').select('*').order('created_at', { ascending: false });
  if (!(req.query.include_inactive && isStaff)) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ trails: data });
});

// GET /trails/:id  (public — full guide: trail overview + ordered checkpoints + their photos)
router.get('/:id', async (req, res) => {
  const { data: trail, error } = await supabase.from('trails').select('*').eq('id', req.params.id).single();
  if (error || !trail) return res.status(404).json({ error: 'Trail not found' });

  const { data: checkpoints } = await supabase
    .from('trail_checkpoints')
    .select('*, trail_checkpoint_photos(*)')
    .eq('trail_id', trail.id)
    .order('order_index', { ascending: true });

  // Keep each checkpoint's photos in their own order too.
  const sorted = (checkpoints ?? []).map((c) => ({
    ...c,
    trail_checkpoint_photos: (c.trail_checkpoint_photos ?? []).sort((a, b) => a.order_index - b.order_index),
  }));

  res.json({ trail, checkpoints: sorted });
});

// POST /trails  (staff — create a trail, optional cover photo)
router.post('/', requireRole('secretary', 'kagawad'), upload.single('cover_photo'), async (req, res) => {
  const { name, description, difficulty, estimated_duration, starting_point_location, starting_point_maps_url, getting_there } =
    req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (difficulty && !DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: `difficulty must be one of ${DIFFICULTIES.join(', ')}` });
  }

  let cover_photo_url = null;
  if (req.file) {
    try {
      cover_photo_url = await uploadToPublicBucket(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { data, error } = await supabase
    .from('trails')
    .insert({
      name,
      description: description || null,
      difficulty: difficulty || null,
      estimated_duration: estimated_duration || null,
      starting_point_location: starting_point_location || null,
      starting_point_maps_url: starting_point_maps_url || null,
      getting_there: getting_there || null,
      cover_photo_url,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ trail: data });
});

// PATCH /trails/:id  (staff — edit trail details, optionally replace cover photo)
router.patch('/:id', requireRole('secretary', 'kagawad'), upload.single('cover_photo'), async (req, res) => {
  const {
    name,
    description,
    difficulty,
    estimated_duration,
    starting_point_location,
    starting_point_maps_url,
    getting_there,
    is_active,
  } = req.body;

  if (difficulty && !DIFFICULTIES.includes(difficulty)) {
    return res.status(400).json({ error: `difficulty must be one of ${DIFFICULTIES.join(', ')}` });
  }

  const updatePayload = { updated_at: new Date().toISOString() };
  if (name !== undefined) updatePayload.name = name;
  if (description !== undefined) updatePayload.description = description;
  if (difficulty !== undefined) updatePayload.difficulty = difficulty;
  if (estimated_duration !== undefined) updatePayload.estimated_duration = estimated_duration;
  if (starting_point_location !== undefined) updatePayload.starting_point_location = starting_point_location;
  if (starting_point_maps_url !== undefined) updatePayload.starting_point_maps_url = starting_point_maps_url;
  if (getting_there !== undefined) updatePayload.getting_there = getting_there;
  if (is_active !== undefined) updatePayload.is_active = is_active === 'true' || is_active === true;

  if (req.file) {
    try {
      updatePayload.cover_photo_url = await uploadToPublicBucket(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { data, error } = await supabase
    .from('trails')
    .update(updatePayload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ trail: data });
});

// DELETE /trails/:id  (staff — soft delete)
router.delete('/:id', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { error } = await supabase
    .from('trails')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---------- Checkpoints ----------

// POST /trails/:trailId/checkpoints  (staff — add a checkpoint, with 0+ photos)
router.post(
  '/:trailId/checkpoints',
  requireRole('secretary', 'kagawad'),
  upload.array('photos', 10),
  async (req, res) => {
    const { name, description, travel_note, google_maps_url, order_index } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const { data: checkpoint, error } = await supabase
      .from('trail_checkpoints')
      .insert({
        trail_id: req.params.trailId,
        name,
        description: description || null,
        travel_note: travel_note || null,
        google_maps_url: google_maps_url || null,
        order_index: order_index !== undefined ? Number(order_index) : 0,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const files = req.files || [];
    if (files.length) {
      try {
        const photoRows = await Promise.all(
          files.map(async (file, i) => ({
            checkpoint_id: checkpoint.id,
            photo_url: await uploadToPublicBucket(file),
            order_index: i,
          }))
        );
        await supabase.from('trail_checkpoint_photos').insert(photoRows);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    const { data: withPhotos } = await supabase
      .from('trail_checkpoints')
      .select('*, trail_checkpoint_photos(*)')
      .eq('id', checkpoint.id)
      .single();

    res.status(201).json({ checkpoint: withPhotos });
  }
);

// PATCH /trails/:trailId/checkpoints/:id  (staff — edit fields; new 'photos' files are appended)
router.patch(
  '/:trailId/checkpoints/:id',
  requireRole('secretary', 'kagawad'),
  upload.array('photos', 10),
  async (req, res) => {
    const { name, description, travel_note, google_maps_url, order_index } = req.body;

    const updatePayload = { updated_at: new Date().toISOString() };
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (travel_note !== undefined) updatePayload.travel_note = travel_note;
    if (google_maps_url !== undefined) updatePayload.google_maps_url = google_maps_url;
    if (order_index !== undefined) updatePayload.order_index = Number(order_index);

    const { data: checkpoint, error } = await supabase
      .from('trail_checkpoints')
      .update(updatePayload)
      .eq('id', req.params.id)
      .eq('trail_id', req.params.trailId)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const files = req.files || [];
    if (files.length) {
      const { data: existingPhotos } = await supabase
        .from('trail_checkpoint_photos')
        .select('order_index')
        .eq('checkpoint_id', checkpoint.id)
        .order('order_index', { ascending: false })
        .limit(1);
      const startIndex = (existingPhotos?.[0]?.order_index ?? -1) + 1;

      try {
        const photoRows = await Promise.all(
          files.map(async (file, i) => ({
            checkpoint_id: checkpoint.id,
            photo_url: await uploadToPublicBucket(file),
            order_index: startIndex + i,
          }))
        );
        await supabase.from('trail_checkpoint_photos').insert(photoRows);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    const { data: withPhotos } = await supabase
      .from('trail_checkpoints')
      .select('*, trail_checkpoint_photos(*)')
      .eq('id', checkpoint.id)
      .single();

    res.json({ checkpoint: withPhotos });
  }
);

// DELETE /trails/:trailId/checkpoints/:id  (staff — hard delete, cascades to its photos)
router.delete('/:trailId/checkpoints/:id', requireRole('secretary', 'kagawad'), async (req, res) => {
  const { error } = await supabase
    .from('trail_checkpoints')
    .delete()
    .eq('id', req.params.id)
    .eq('trail_id', req.params.trailId);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// DELETE /trails/:trailId/checkpoints/:checkpointId/photos/:photoId  (staff — remove one photo)
router.delete(
  '/:trailId/checkpoints/:checkpointId/photos/:photoId',
  requireRole('secretary', 'kagawad'),
  async (req, res) => {
    const { error } = await supabase
      .from('trail_checkpoint_photos')
      .delete()
      .eq('id', req.params.photoId)
      .eq('checkpoint_id', req.params.checkpointId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  }
);

export default router;