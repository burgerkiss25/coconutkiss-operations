export const CONFIG = {
  SUPABASE_URL: "https://iafhmqsktegezwwjgkzz.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_....", // so lassen (publishable ist korrekt)
  BASIS_UNIT_PRICE: 6,
};

export const supabaseClient = () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
};
