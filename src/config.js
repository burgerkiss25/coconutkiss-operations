import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const CONFIG = {
  // WICHTIG: Trage hier deine echten Werte ein (so wie bisher in deinem Projekt)
  SUPABASE_URL: window.SUPABASE_URL || "https://iafhmqsktegezwwjgkzz.supabase.co",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhZmhtcXNrdGVnZXp3d2pna3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDk4NjEsImV4cCI6MjA4MzQ4NTg2MX0.CGbpBGD60WeJmQ2OHl_XkKZteLvz13czdQWr4tM0v8E",

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
