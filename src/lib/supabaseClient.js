import { createClient } from "@supabase/supabase-js";

// Browser client. The login session is kept on the device so staff stay
// logged in between visits (and inside the home-screen app).
// What each account can read or write is decided by the database's access
// rules — see supabase/migrations/004 and 005.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "ck-store-bj-auth",
    },
  }
);
