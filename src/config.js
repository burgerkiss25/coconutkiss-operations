export const CONFIG = {
  SUPABASE_URL: window.SUPABASE_URL || "https://afhmqsktegezwvjgkzz.supabase.co
",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "sb_publishable_SRL1qRkPGfGdpGO2wn07TA_939_NCo4",
  BASIS_UNIT_PRICE: 6,
};

export const supabaseClient = () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
};
