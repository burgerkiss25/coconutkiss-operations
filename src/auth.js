import { supabaseClient } from "./config.js";
import { updateConnectionState, renderRole } from "./ui.js";

const authSection = document.getElementById("authSection");
const mainSection = document.getElementById("mainSection");
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const logoutBtn = document.getElementById("logoutBtn");

export let currentUser = null;
export let currentProfile = null;

const setAuthView = (signedIn) => {
  authSection?.classList.toggle("hidden", signedIn);
  mainSection?.classList.toggle("hidden", !signedIn);

  document.getElementById("bottomNav")?.classList.toggle("hidden", !signedIn);
  document.getElementById("fab")?.classList.toggle("hidden", !signedIn);
};

export const initAuth = async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    updateConnectionState(false);
    return;
  }

  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user ?? null;
  setAuthView(Boolean(currentUser));
  updateConnectionState(true);
  if (currentUser) {
    await loadProfile();
  }

  supabase.auth.onAuthStateChange(async (_, session) => {
    currentUser = session?.user ?? null;
    setAuthView(Boolean(currentUser));
    if (currentUser) {
      await loadProfile();
    }
  });
};

const loadProfile = async () => {
  const supabase = supabaseClient();
  if (!supabase || !currentUser) {
    return;
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", currentUser.id)
    .single();

  if (error) {
    console.error(error);
    return;
  }

  currentProfile = data;
  renderRole(currentUser.email, data.role);
};

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const supabase = supabaseClient();
  if (!supabase) {
    return;
  }
  const { error } = await supabase.auth.signInWithPassword({
    email: emailInput.value,
    password: passwordInput.value,
  });
  if (error) {
    alert(error.message);
  }
});

logoutBtn?.addEventListener("click", async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    return;
  }
  await supabase.auth.signOut();
});
