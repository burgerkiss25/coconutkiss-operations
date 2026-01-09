export const CONFIG = {
  SUPABASE_URL: window.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: window.SUPABASE_ANON_KEY || "",
  BASIS_UNIT_PRICE: 6,
};

export const supabaseClient = () => {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    return null;
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
};
