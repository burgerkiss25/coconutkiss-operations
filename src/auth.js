import { supabaseClient } from "./config.js";
import { updateConnectionState, renderRole } from "./ui.js";

export let currentUser = null;

const setAuthUI = (user) => {
  currentUser = user || null;

  // falls du Rollen aus profiles ziehst, bleibt das hier minimal:
  renderRole(user?.email || "", user ? "admin" : "");
};

const showAuthError = (msg) => {
  const el = document.getElementById("authError");
  if (el) {
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
  } else if (msg) {
    // fallback
    console.error(msg);
  }
};

export const initAuth = async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    updateConnectionState(false);
    showAuthError("Supabase not configured.");
    return;
  }

  updateConnectionState(true);

  // Session laden
  const { data: sessionData } = await supabase.auth.getSession();
  setAuthUI(sessionData?.session?.user ?? null);

  // Auth changes
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthUI(session?.user ?? null);
  });

  // Sign-in form handler (IDs defensiv)
  const form =
    document.getElementById("signInForm") ||
    document.querySelector("form[data-auth='signin']") ||
    document.querySelector("form");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // 🔥 verhindert das “alles wird gelöscht”
    showAuthError("");

    const emailEl =
      document.getElementById("email") ||
      document.getElementById("emailInput") ||
      form.querySelector("input[type='email']");

    const passEl =
      document.getElementById("password") ||
      document.getElementById("pin") ||
      document.getElementById("date") ||
      form.querySelector("input[type='password']") ||
      form.querySelector("input[type='text']");

    const email = (emailEl?.value || "").trim();
    const password = (passEl?.value || "").trim();

    if (!email || !password) {
      showAuthError("Please enter email and password/date.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        showAuthError(error.message);
        return;
      }
      setAuthUI(data?.user ?? null);
    } catch (err) {
      showAuthError(err?.message || "Login failed.");
    }
  });

  // Logout button (optional)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      setAuthUI(null);
    });
  }
};
