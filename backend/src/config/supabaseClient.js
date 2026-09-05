import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// The backend always uses the SERVICE ROLE key. This bypasses Row Level
// Security, which is intentional: all access control (who can see/edit
// what) is enforced in our Express middleware, not in Supabase directly.
// Never send this key to the frontend.
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);
