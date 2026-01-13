// src/db.js
// Compatibility-first DB layer: guarantees exports so the app loads,
// and performs Supabase ops with safe fallbacks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CONFIG } from "./config.js";

let _client = null;

function getSupabase() {
  if (_client) return _client;

  const url = CONFIG?.SUPABASE_URL;
  const key = CONFIG?.SUPABASE_ANON_KEY;

  if (!url || !key) {
    // DO NOT throw during module import → would break the entire app.
    console.error(
      "[db.js] Supabase not configured. Missing CONFIG.SUPABASE_URL or CONFIG.SUPABASE_ANON_KEY."
    );
    return null;
  }

  _client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  return _client;
}

function nowIso() {
  return new Date().toISOString();
}

async function safeExec(fn, fallbackValue, label) {
  try {
    const res = await fn();
    return res;
  } catch (e) {
    console.error(`[db.js] ${label} failed:`, e);
    return fallbackValue;
  }
}

// ---------- DASHBOARD ----------
export async function fetchDashboardMetrics() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, metrics: emptyDashboardMetrics(), error: "Supabase not configured" };

  // Keep this resilient: if some tables don’t exist yet, return zeros instead of crashing.
  return await safeExec(
    async () => {
      const metrics = emptyDashboardMetrics();

      // Try common tables; each failure is isolated.
      // 1) deliveries count (stock deliveries)
      const d = await supabase.from("deliveries").select("id", { count: "exact", head: true });
      if (!d.error && typeof d.count === "number") metrics.deliveriesCount = d.count;

      // 2) sellers count
      const s = await supabase.from("sellers").select("id", { count: "exact", head: true });
      if (!s.error && typeof s.count === "number") metrics.sellersCount = s.count;

      // 3) suppliers count
      const sp = await supabase.from("suppliers").select("id", { count: "exact", head: true });
      if (!sp.error && typeof sp.count === "number") metrics.suppliersCount = sp.count;

      // 4) joints count
      const j = await supabase.from("joints").select("id", { count: "exact", head: true });
      if (!j.error && typeof j.count === "number") metrics.jointsCount = j.count;

      return { ok: true, metrics };
    },
    { ok: false, metrics: emptyDashboardMetrics(), error: "Failed to fetch metrics" },
    "fetchDashboardMetrics"
  );
}

function emptyDashboardMetrics() {
  return {
    deliveriesCount: 0,
    sellersCount: 0,
    suppliersCount: 0,
    jointsCount: 0,
  };
}

export async function fetchUpcomingEvents(limit = 10) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  // We try multiple date field names to avoid breaking if your schema differs.
  return await safeExec(
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      // Try `start_at` first
      let q = supabase
        .from("events")
        .select("*")
        .gte("start_at", todayIso)
        .order("start_at", { ascending: true })
        .limit(limit);

      let { data, error } = await q;
      if (!error) return { ok: true, rows: data || [] };

      // Fallback: try `event_date`
      q = supabase
        .from("events")
        .select("*")
        .gte("event_date", todayIso)
        .order("event_date", { ascending: true })
        .limit(limit);

      ({ data, error } = await q);
      if (!error) return { ok: true, rows: data || [] };

      console.error("[db.js] fetchUpcomingEvents: events query failed:", error);
      return { ok: false, rows: [], error: error?.message || "Events query failed" };
    },
    { ok: false, rows: [], error: "Failed to fetch upcoming events" },
    "fetchUpcomingEvents"
  );
}

// ---------- EVENTS ----------
export async function createEventWithPricing(payload) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  // Accept broad payload; normalize common fields.
  const row = {
    ...payload,
    created_at: payload?.created_at ?? nowIso(),
  };

  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("events").insert(row).select("*").single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: "Failed to create event" },
    "createEventWithPricing"
  );
}

// ---------- PAYMENTS / REPORTS ----------
export async function createPaymentWithPin(payload) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  const row = {
    ...payload,
    created_at: payload?.created_at ?? nowIso(),
  };

  // Common table name guess: `payments`
  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("payments").insert(row).select("*").single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: "Failed to create payment" },
    "createPaymentWithPin"
  );
}

// ---------- STOCK / DELIVERIES (safe generic helpers) ----------
export async function createDelivery(payload) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  const row = { ...payload, created_at: payload?.created_at ?? nowIso() };

  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("deliveries").insert(row).select("*").single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: "Failed to create delivery" },
    "createDelivery"
  );
}

export async function fetchDeliveries({ joint_id, limit = 50 } = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  return await safeExec(
    async () => {
      let q = supabase.from("deliveries").select("*").order("created_at", { ascending: false }).limit(limit);
      if (joint_id) q = q.eq("joint_id", joint_id);
      const { data, error } = await q;
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: "Failed to fetch deliveries" },
    "fetchDeliveries"
  );
}

// ---------- SELLERS / ASSIGNMENTS ----------
export async function fetchSellers() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("sellers").select("*").order("name", { ascending: true });
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: "Failed to fetch sellers" },
    "fetchSellers"
  );
}

export async function assignSellerToJoint({ seller_id, joint_id, note = null } = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  // Your table currently has start_at/end_at/active (from your screenshot).
  // We insert a new active assignment and (best-effort) close previous active ones.
  return await safeExec(
    async () => {
      // close previous (best-effort)
      await supabase
        .from("seller_assignments")
        .update({ active: false, end_at: nowIso() })
        .eq("seller_id", seller_id)
        .eq("active", true);

      const insertRow = {
        seller_id,
        joint_id,
        start_at: nowIso(),
        end_at: null,
        active: true,
        note,
      };

      const { data, error } = await supabase.from("seller_assignments").insert(insertRow).select("*").single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: "Failed to assign seller" },
    "assignSellerToJoint"
  );
}

// ---------- JOINTS / SUPPLIERS ----------
export async function fetchJoints() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("joints").select("*").order("name", { ascending: true });
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: "Failed to fetch joints" },
    "fetchJoints"
  );
}

export async function fetchSuppliers() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  return await safeExec(
    async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name", { ascending: true });
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: "Failed to fetch suppliers" },
    "fetchSuppliers"
  );
}

// ---------- EXPORT STABILIZERS (so other modules don’t break) ----------
// If your app imports any of these names, it will NOT crash on import anymore.
// They return explicit "not implemented" errors until we wire exact table logic.

export async function fetchStock() {
  return { ok: false, rows: [], error: "fetchStock not implemented yet (schema-specific)" };
}
export async function updateStock() {
  return { ok: false, row: null, error: "updateStock not implemented yet (schema-specific)" };
}
export async function createSeller() {
  return { ok: false, row: null, error: "createSeller not implemented yet (schema-specific)" };
}
export async function updateSeller() {
  return { ok: false, row: null, error: "updateSeller not implemented yet (schema-specific)" };
}
export async function createSupplier() {
  return { ok: false, row: null, error: "createSupplier not implemented yet (schema-specific)" };
}
export async function updateSupplier() {
  return { ok: false, row: null, error: "updateSupplier not implemented yet (schema-specific)" };
}
