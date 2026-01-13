// db.js
import { supabaseClient } from "./config.js";

/**
 * Internal: always get a configured Supabase client
 */
const getClient = () => {
  const client = supabaseClient?.();
  if (!client) {
    // This must be loud, otherwise the UI feels "dead"
    throw new Error(
      "Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in config.js (or window globals)."
    );
  }
  return client;
};

/**
 * Generic SELECT helper
 *
 * Usage:
 *   listTable("sellers", {
 *     select: "id,name",
 *     eq: { joint_id: "uuid" },     // empty/undefined values are ignored
 *     order: "name",
 *     ascending: true,
 *     limit: 200
 *   })
 */
export const listTable = async (
  table,
  {
    select = "*",
    eq = {},
    order = null,
    ascending = true,
    limit = null,
    filters = [], // optional: [{ fn: "gte", col: "start_at", val: "..." }, ...]
  } = {}
) => {
  const client = getClient();

  let q = client.from(table).select(select);

  // Apply eq filters (ignore empty / null / undefined)
  if (eq && typeof eq === "object") {
    for (const [col, val] of Object.entries(eq)) {
      if (val === "" || val === null || val === undefined) continue;
      q = q.eq(col, val);
    }
  }

  // Apply additional filters
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (!f || !f.fn || !f.col) continue;
      const v = f.val;
      if (v === "" || v === null || v === undefined) continue;
      if (typeof q[f.fn] === "function") {
        q = q[f.fn](f.col, v);
      }
    }
  }

  // Order
  if (order) {
    q = q.order(order, { ascending });
  }

  // Limit
  if (typeof limit === "number") {
    q = q.limit(limit);
  }

  const { data, error } = await q;

  if (error) {
    // Surface the real error in console; callers can handle thrown errors if needed
    console.error(`[db.listTable] ${table} failed:`, error);
    throw error;
  }

  return data || [];
};

/**
 * Generic INSERT helper
 */
export const insertTable = async (table, payload, { returning = "*" } = {}) => {
  const client = getClient();

  const { data, error } = await client.from(table).insert(payload).select(returning);

  if (error) {
    console.error(`[db.insertTable] ${table} failed:`, error);
    throw error;
  }

  return data || [];
};

/**
 * Generic UPDATE helper (by id)
 */
export const updateTable = async (table, id, changes, { returning = "*" } = {}) => {
  const client = getClient();

  const { data, error } = await client.from(table).update(changes).eq("id", id).select(returning);

  if (error) {
    console.error(`[db.updateTable] ${table} failed:`, error);
    throw error;
  }

  return data || [];
};

/**
 * Safe helper: returns [] if the table/column doesn't exist (prevents total UI crash during migrations)
 */
const safeList = async (table, opts) => {
  try {
    return await listTable(table, opts);
  } catch (e) {
    // Typical migration issue: relation does not exist / column does not exist
    console.warn(`[db.safeList] returning empty for ${table}:`, e?.message || e);
    return [];
  }
};

/**
 * Reference data used across UI dropdowns etc.
 * Keep this stable: other modules rely on "joints" / "suppliers" being present.
 */
export const fetchReferenceData = async () => {
  const joints = await safeList("joints", { select: "id,name", order: "name", ascending: true });
  const suppliers = await safeList("suppliers", { select: "id,name", order: "name", ascending: true });

  // Sellers base list (assignment logic can be done in sellers.js)
  const sellers = await safeList("sellers", { select: "id,name", order: "name", ascending: true });

  return { joints, suppliers, sellers };
};

/**
 * Dashboard metrics
 * This function MUST exist because dashboard.js imports it.
 *
 * It is defensive: if a table doesn't exist yet, the metric just becomes 0.
 */
export const fetchDashboardMetrics = async () => {
  const client = getClient();

  const metrics = {
    deliveries_today: 0,
    allocations_today: 0,
    payments_today: 0,
    active_events: 0,
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isoTodayStart = todayStart.toISOString();

  // Helper for counting rows (defensive)
  const safeCount = async (table, buildQuery) => {
    try {
      let q = client.from(table).select("id", { count: "exact", head: true });
      if (typeof buildQuery === "function") q = buildQuery(q);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.warn(`[db.fetchDashboardMetrics] count failed for ${table}:`, e?.message || e);
      return 0;
    }
  };

  metrics.deliveries_today = await safeCount("deliveries", (q) => q.gte("created_at", isoTodayStart));
  metrics.allocations_today = await safeCount("allocations", (q) => q.gte("created_at", isoTodayStart));
  metrics.payments_today = await safeCount("payments", (q) => q.gte("created_at", isoTodayStart));

  // Events: treat "active" as events without end time OR with active=true if your schema has it
  metrics.active_events = await safeCount("events", (q) => q.eq("active", true));

  return metrics;
};

/**
 * Upcoming events list
 * This function MUST exist because dashboard.js imports it.
 */
export const fetchUpcomingEvents = async (limit = 5) => {
  const nowIso = new Date().toISOString();

  // Try common schemas:
  // - events(start_at, title, location)
  // - events(event_date, name, location)
  // If nothing matches, return [] instead of crashing.
  const tries = [
    () =>
      safeList("events", {
        select: "id,title,start_at,location,notes",
        filters: [{ fn: "gte", col: "start_at", val: nowIso }],
        order: "start_at",
        ascending: true,
        limit,
      }),
    () =>
      safeList("events", {
        select: "id,name,event_date,location,notes",
        filters: [{ fn: "gte", col: "event_date", val: nowIso }],
        order: "event_date",
        ascending: true,
        limit,
      }),
  ];

  for (const fn of tries) {
    const rows = await fn();
    if (rows && rows.length) return rows;
  }

  return [];
};

/**
 * Optional: helper specifically for seller assignment model (if you use it elsewhere)
 * Will return current assignments (active=true OR end_at/end_ts is null).
 */
export const fetchActiveSellerAssignments = async () => {
  // Your table currently shows columns like:
  // id, seller_id, joint_id, start_at, end_at, active, note (+ you added end_ts)
  const rows = await safeList("seller_assignments", {
    select: "id,seller_id,joint_id,start_at,end_at,end_ts,active,note",
    order: "start_at",
    ascending: false,
    limit: 1000,
  });

  // Normalize "is active"
  return (rows || []).filter((r) => {
    const hasActiveFlag = typeof r.active === "boolean";
    if (hasActiveFlag) return r.active === true;
    // fallback: active if no end time
    return (r.end_at == null) && (r.end_ts == null);
  });
};

