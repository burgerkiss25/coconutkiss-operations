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

// ============================================================================
// GENERIC HELPERS (THIS is what your other modules expect)
// ============================================================================

/**
 * Insert a row into any table.
 * Usage expected by other modules: insertRow("table_name", { ...fields })
 */
export async function insertRow(table, row) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  return await safeExec(
    async () => {
      const payload = { ...(row || {}) };

      // Common safe default if table has created_at
      if (payload.created_at === undefined) payload.created_at = nowIso();

      const { data, error } = await supabase.from(table).insert(payload).select("*").single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: `insertRow failed for table ${table}` },
    `insertRow(${table})`
  );
}

/**
 * Update rows by simple equality filters.
 * updateRow("table", {field: value}, {id: 123})  -> updates where id=123
 */
export async function updateRow(table, patch, whereEq = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  return await safeExec(
    async () => {
      let q = supabase.from(table).update(patch || {}).select("*");
      for (const [k, v] of Object.entries(whereEq || {})) q = q.eq(k, v);
      const { data, error } = await q;
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: `updateRow failed for table ${table}` },
    `updateRow(${table})`
  );
}

/**
 * Delete rows by simple equality filters.
 */
export async function deleteRow(table, whereEq = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, count: 0, error: "Supabase not configured" };

  return await safeExec(
    async () => {
      let q = supabase.from(table).delete({ count: "exact" });
      for (const [k, v] of Object.entries(whereEq || {})) q = q.eq(k, v);
      const { error, count } = await q;
      if (error) return { ok: false, count: 0, error: error.message };
      return { ok: true, count: count ?? 0 };
    },
    { ok: false, count: 0, error: `deleteRow failed for table ${table}` },
    `deleteRow(${table})`
  );
}

/**
 * Select rows with optional equality filters, ordering, limit.
 * selectRows("table", {joint_id: "..."}, { orderBy: "created_at", asc: false, limit: 50 })
 */
export async function selectRows(table, whereEq = {}, opts = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, rows: [], error: "Supabase not configured" };

  const { orderBy = null, asc = true, limit = null } = opts || {};

  return await safeExec(
    async () => {
      let q = supabase.from(table).select("*");
      for (const [k, v] of Object.entries(whereEq || {})) q = q.eq(k, v);
      if (orderBy) q = q.order(orderBy, { ascending: !!asc });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) return { ok: false, rows: [], error: error.message };
      return { ok: true, rows: data || [] };
    },
    { ok: false, rows: [], error: `selectRows failed for table ${table}` },
    `selectRows(${table})`
  );
}

/**
 * Select single row with equality filters.
 */
export async function selectOne(table, whereEq = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  return await safeExec(
    async () => {
      let q = supabase.from(table).select("*");
      for (const [k, v] of Object.entries(whereEq || {})) q = q.eq(k, v);
      const { data, error } = await q.single();
      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: `selectOne failed for table ${table}` },
    `selectOne(${table})`
  );
}

// ============================================================================
// DASHBOARD
// ============================================================================

export async function fetchDashboardMetrics() {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, metrics: emptyDashboardMetrics(), error: "Supabase not configured" };

  return await safeExec(
    async () => {
      const metrics = emptyDashboardMetrics();

      const d = await supabase.from("deliveries").select("id", { count: "exact", head: true });
      if (!d.error && typeof d.count === "number") metrics.deliveriesCount = d.count;

      const s = await supabase.from("sellers").select("id", { count: "exact", head: true });
      if (!s.error && typeof s.count === "number") metrics.sellersCount = s.count;

      const sp = await supabase.from("suppliers").select("id", { count: "exact", head: true });
      if (!sp.error && typeof sp.count === "number") metrics.suppliersCount = sp.count;

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

  return await safeExec(
    async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      let q = supabase
        .from("events")
        .select("*")
        .gte("start_at", todayIso)
        .order("start_at", { ascending: true })
        .limit(limit);

      let { data, error } = await q;
      if (!error) return { ok: true, rows: data || [] };

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

// ============================================================================
// EVENTS
// ============================================================================

export async function createEventWithPricing(payload) {
  // Use generic insertRow for consistency
  return await insertRow("events", payload);
}

// ============================================================================
// PAYMENTS / REPORTS
// ============================================================================

export async function createPaymentWithPin(payload) {
  return await insertRow("payments", payload);
}

// ============================================================================
// STOCK / DELIVERIES
// ============================================================================

export async function createDelivery(payload) {
  return await insertRow("deliveries", payload);
}

export async function fetchDeliveries({ joint_id, limit = 50 } = {}) {
  if (joint_id) return await selectRows("deliveries", { joint_id }, { orderBy: "created_at", asc: false, limit });
  return await selectRows("deliveries", {}, { orderBy: "created_at", asc: false, limit });
}

// ============================================================================
// SELLERS / ASSIGNMENTS
// ============================================================================

export async function fetchSellers() {
  return await selectRows("sellers", {}, { orderBy: "name", asc: true });
}

export async function assignSellerToJoint({ seller_id, joint_id, note = null } = {}) {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, row: null, error: "Supabase not configured" };

  return await safeExec(
    async () => {
      await supabase
        .from("seller_assignments")
        .update({ active: false, end_at: nowIso() })
        .eq("seller_id", seller_id)
        .eq("active", true);

      const insertRowPayload = {
        seller_id,
        joint_id,
        start_at: nowIso(),
        end_at: null,
        active: true,
        note,
      };

      const { data, error } = await supabase
        .from("seller_assignments")
        .insert(insertRowPayload)
        .select("*")
        .single();

      if (error) return { ok: false, row: null, error: error.message };
      return { ok: true, row: data };
    },
    { ok: false, row: null, error: "Failed to assign seller" },
    "assignSellerToJoint"
  );
}

// ============================================================================
// JOINTS / SUPPLIERS
// ============================================================================

export async function fetchJoints() {
  return await selectRows("joints", {}, { orderBy: "name", asc: true });
}

export async function fetchSuppliers() {
  return await selectRows("suppliers", {}, { orderBy: "name", asc: true });
}

// ============================================================================
// EXPORT STABILIZERS (keep app from breaking on missing imports)
// ============================================================================

export async function fetchStock() {
  // If your stock.js expects this, we keep it non-crashing.
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
