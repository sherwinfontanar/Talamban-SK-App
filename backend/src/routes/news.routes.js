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

async function uploadToPublicBucket(file) {
  const path = `${uuidv4()}-${file.originalname}`;
  const { error } = await supabase.storage
    .from('news-photos')
    .upload(path, file.buffer, { contentType: file.mimetype });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from('news-photos').getPublicUrl(path);
  return data.publicUrl;
}

// GET /news?include_unpublished=1  (public feed; include_unpublished only honored for the secretary)
router.get('/', async (req, res) => {
  const isSecretary = req.user?.role === 'secretary';
  let query = supabase.from('news_posts').select('*').order('created_at', { ascending: false });
  if (!(req.query.include_unpublished && isSecretary)) query = query.eq('is_published', true);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data });
});

// GET /news/:id  (public for published posts; unpublished only visible to the secretary)
router.get('/:id', async (req, res) => {
  const { data: post, error } = await supabase.from('news_posts').select('*').eq('id', req.params.id).single();
  if (error || !post) return res.status(404).json({ error: 'Post not found' });

  if (!post.is_published && req.user?.role !== 'secretary') {
    return res.status(404).json({ error: 'Post not found' });
  }
  res.json({ post });
});

// POST /news  (secretary only)
router.post('/', requireRole('secretary'), upload.single('photo'), async (req, res) => {
  const { title, body, is_published } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  let photo_url = null;
  if (req.file) {
    try {
      photo_url = await uploadToPublicBucket(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { data, error } = await supabase
    .from('news_posts')
    .insert({
      title,
      body,
      photo_url,
      is_published: is_published === undefined ? true : is_published === 'true' || is_published === true,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ post: data });
});

// PATCH /news/:id  (secretary only — edit fields, optionally replace photo, toggle publish)
router.patch('/:id', requireRole('secretary'), upload.single('photo'), async (req, res) => {
  const { title, body, is_published } = req.body;

  const updatePayload = { updated_at: new Date().toISOString() };
  if (title !== undefined) updatePayload.title = title;
  if (body !== undefined) updatePayload.body = body;
  if (is_published !== undefined) updatePayload.is_published = is_published === 'true' || is_published === true;

  if (req.file) {
    try {
      updatePayload.photo_url = await uploadToPublicBucket(req.file);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const { data, error } = await supabase
    .from('news_posts')
    .update(updatePayload)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ post: data });
});

// DELETE /news/:id  (secretary only — hard delete; no compliance reason to retain a removed post)
router.delete('/:id', requireRole('secretary'), async (req, res) => {
  const { error } = await supabase.from('news_posts').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ---------- Comments ----------

// GET /news/:id/comments  (public)
router.get('/:id/comments', async (req, res) => {
  const { data, error } = await supabase
    .from('news_comments')
    .select('*')
    .eq('post_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json({ comments: data });
});

// POST /news/:id/comments  (public — guest with a name, or a logged-in resident/staff account)
router.post('/:id/comments', async (req, res) => {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'body is required' });

  let author_name = req.body.author_name?.trim();

  if (req.user) {
    // Logged-in accounts don't need to type a name — use the one on file.
    const { data: user } = await supabase.from('users').select('full_name').eq('id', req.user.id).single();
    author_name = user?.full_name || author_name;
  }

  if (!author_name) return res.status(400).json({ error: 'author_name is required when not logged in' });

  const { data, error } = await supabase
    .from('news_comments')
    .insert({
      post_id: req.params.id,
      user_id: req.user?.id ?? null,
      author_name,
      body: body.trim(),
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ comment: data });
});

// DELETE /news/:id/comments/:commentId  (secretary only — moderation)
router.delete('/:id/comments/:commentId', requireRole('secretary'), async (req, res) => {
  const { error } = await supabase
    .from('news_comments')
    .delete()
    .eq('id', req.params.commentId)
    .eq('post_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;