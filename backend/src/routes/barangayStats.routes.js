import { Router } from 'express';
import { supabase } from '../config/supabaseClient.js';
import { attachUser, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(attachUser);

// GET /barangay-stats  (public)
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('barangay_stats').select('*').eq('id', 1).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ stats: data });
});

// PATCH /barangay-stats  (secretary only — this is official civic info,
// same reasoning as news being secretary-only rather than "any staff")
router.patch('/', requireRole('secretary'), async (req, res) => {
  const { population, population_year, source_label, source_url } = req.body;

  const updatePayload = { updated_by: req.user.id, updated_at: new Date().toISOString() };
  if (population !== undefined) updatePayload.population = population === '' ? null : Number(population);
  if (population_year !== undefined) updatePayload.population_year = population_year === '' ? null : Number(population_year);
  if (source_label !== undefined) updatePayload.source_label = source_label;
  if (source_url !== undefined) updatePayload.source_url = source_url;

  const { data, error } = await supabase
    .from('barangay_stats')
    .update(updatePayload)
    .eq('id', 1)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ stats: data });
});

export default router;