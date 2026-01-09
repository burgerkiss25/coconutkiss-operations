export const CONFIG = {
  SUPABASE_URL: window.SUPABASE_URL || "https://iafhmqsktegezwwjgkzz.supabase.co",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "DEIN_SB_PUBLISHABLE_KEY_HIER",
  BASIS_UNIT_PRICE: 6,
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
