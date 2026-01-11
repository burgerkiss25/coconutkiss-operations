import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CONFIG = {
  // WICHTIG: Trage hier deine echten Werte ein (so wie bisher in deinem Projekt)
  SUPABASE_URL: window.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "",

  // falls du es in db.js nutzt
  BASIS_UNIT_PRICE: 6,
};

let _client = null;

export const supabaseClient = () => {
  if (_client) return _client;

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return null;
  }

  _client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "coconutkiss-auth",
    },
  });

  return _client;
};
