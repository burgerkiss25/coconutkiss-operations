export const CONFIG = {
  SUPABASE_URL: window.SUPABASE_URL || "https://iafhmqsktegezwwjgkzz.supabase.co",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "DEIN_SB_PUBLISHABLE_KEY_HIER",
  BASIS_UNIT_PRICE: 6,eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhZmhtcXNrdGVnZXp3d2pna3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5MDk4NjEsImV4cCI6MjA4MzQ4NTg2MX0.CGbpBGD60WeJmQ2OHl_XkKZteLvz13czdQWr4tM0v8E
};

export const supabaseClient = () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return null;

  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
