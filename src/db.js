// src/db.js
import { supabaseClient, CONFIG } from "./config.js";

/**
 * Internal helper: always get a client or throw a clear error.
 */
const getClient = () => {
  const client = supabaseClient?.();
  if (!client) {
    throw new Error("Supabase not configured. Check config.js (SUPABASE_URL / SUPABASE_ANON_KEY).");
  }
  return client;
};

/**
 * Normalize "eq" filter object:
 * - if value is "" or null/undefined => skip filter
 */
const applyEqFilters = (query, eq) => {
  if (!eq || typeof eq !== "object") return query;
  for (const [col, val] of Object.entries(eq)) {
    if (val === "" || val === null || val === undefined) continue;
    query = query.eq(col, val);
  }
  return query;
};

/**
 * Generic table list helper used across modules.
 *
 * @param {string} table
 * @param {{
 *  select?: string,
 *  eq?: Record<string, any>,
 *  order?: string,
 *  ascending?: boolean,
 *  limit?: number
 * }} opts
 * @returns {Promise<any[]>}
 */
export const listTable = async (table, opts = {}) => {
  try {
    const client = getClient();
    const {
      select = "*",
      eq = null,
      order = null,
      ascending = true,
      limit = null,
    } = opts;

    let q = client.from(table).select(select);
    q = applyEqFilters(q, eq);

    if (order) q = q.order(order, { ascending });
    if (typeof limit === "number") q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn(`listTable(${table}) failed:`, err?.message || err);
    return [];
  }
};

/**
 * Generic insert helper
 */
export const insertRow = async (table, payload, { returning = "representation" } = {}) => {
  const client = getClient();
  const { data, error } = await client.from(table).insert(payload).select().maybeSingle();
  if (error) throw error;
  return returning === "minimal" ? null : data;
};

/**
 * Generic update helper
 */
export const updateRow = async (table, id, patch) => {
  const client = getClient();
  const { data, error } = await client.from(table).update(patch).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * Generic delete helper
 */
export const deleteRow = async (table, id) => {
  const client = getClient();
  const { error } = await client.from(table).delete().eq("id", id);
  if (error) throw error;
  return true;
};

/**
 * Fetch reference data used by dropdowns across tabs.
 * Safe: returns empty arrays on failure.
 */
export const fetchReferenceData = async () => {
  try {
    const [joints, sellers, suppliers] = await Promise.all([
      listTable("joints", { select: "id,name", order: "name", ascending: true }),
      listTable("sellers", { select: "id,name", order: "name", ascending: true }),
      listTable("suppliers", { select: "id,name", order: "name", ascending: true }),
    ]);

    return { joints, sellers, suppliers };
  } catch (err) {
    console.warn("fetchReferenceData failed:", err?.message || err);
    return { joints: [], sellers: [], suppliers: [] };
  }
};

/**
 * Dashboard metrics.
 * IMPORTANT: Keep this export name EXACT because dashboard.js imports it.
 * Safe default: returns zeros if tables/queries fail.
 */
export const fetchDashboardMetrics = async () => {
  try {
    const client = getClient();

    // These are intentionally conservative and won't crash if tables are missing:
    // If a table doesn't exist, Supabase returns an error -> we catch and fallback.

    const safeCount = async (table) => {
      try {
        const { count, error } = await client
          .from(table)
          .select("id", { count: "exact", head: true });
        if (error) throw error;
        return count || 0;
      } catch {
        return 0;
      }
    };

    const [jointsCount, sellersCount, suppliersCount] = await Promise.all([
      safeCount("joints"),
      safeCount("sellers"),
      safeCount("suppliers"),
    ]);

    return {
      jointsCount,
      sellersCount,
      suppliersCount,
    };
  } catch (err) {
    console.warn("fetchDashboardMetrics failed:", err?.message || err);
    return {
      jointsCount: 0,
      sellersCount: 0,
      suppliersCount: 0,
    };
  }
};

/**
 * Upcoming events for dashboard.
 * IMPORTANT: Keep this export name EXACT because dashboard.js imports it.
 * Safe: returns [] if events table doesn't exist yet.
 */
export const fetchUpcomingEvents = async (limit = 5) => {
  try {
    const client = getClient();

    const { data, error } = await client
      .from("events")
      .select("id,title,start_at,end_at,joint_id")
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    // Table might not exist yet -> do not crash app
    console.warn("fetchUpcomingEvents failed:", err?.message || err);
    return [];
  }
};

/**
 * Stock / Operations helpers (optional but useful)
 * These are "safe" wrappers you can use from stock.js / reports.js.
 */

export const recordDelivery = async ({ joint_id, supplier_id = null, quantity, note = null }) => {
  const client = getClient();

  // Adjust table name if your schema differs
  const payload = {
    joint_id,
    supplier_id,
    quantity: Number(quantity),
    note,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("deliveries").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const recordAllocation = async ({ joint_id, seller_id, quantity, note = null }) => {
  const client = getClient();

  const payload = {
    joint_id,
    seller_id,
    quantity: Number(quantity),
    note,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("allocations").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const recordPayment = async ({ joint_id, seller_id, amount, note = null }) => {
  const client = getClient();

  const payload = {
    joint_id,
    seller_id,
    amount: Number(amount),
    note,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("payments").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
};

export const recordAudit = async ({ joint_id, counted, note = null }) => {
  const client = getClient();

  const payload = {
    joint_id,
    counted: Number(counted),
    note,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("audits").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * Utility used in some cost calculations (kept here so older modules don't break)
 */
export const BASIS_UNIT_PRICE = Number(CONFIG?.BASIS_UNIT_PRICE ?? 6);
