import { createClient } from "@supabase/supabase-js";

// Browser / anon client. RLS restricts this to SELECT on the master tables
// and INSERT on stock_movements only.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);
