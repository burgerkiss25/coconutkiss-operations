import { supabaseClient, CONFIG } from "./config.js";

/**
 * Internal helper: always returns a configured Supabase client or throws.
 */
const getClient = () => {
  const client = supabaseClient?.();
  if (!client) {
    // This message should surface in console if config is missing
    throw new Error(
      "Supabase not configured. Please ensure CONFIG.SUPABASE_URL and CONFIG.SUPABASE_ANON_KEY are set in config.js."
    );
  }
  return client;
};

/**
 * Generic table lister with flexible filters.
 * opts:
 *  - select: string (default "*")
 *  - eq: object (e.g. { joint_id: "uuid", active: true })
 *  - order: string (column)
 *  - ascending: boolean (default true)
 *  - limit: number
 */
export const listTable = async (table, opts = {}) => {
  const client = getClient();

  const {
    select = "*",
    eq = {},
    order,
    ascending = true,
    limit,
  } = opts;

  let q = client.from(table).select(select);

  // Apply eq filters only when value is not "" / null / undefined
  if (eq && typeof eq === "object") {
    for (const [key, value] of Object.entries(eq)) {
      if (value === "" || value === null || value === undefined) continue;
      q = q.eq(key, value);
    }
  }

  if (order) q = q.order(order, { ascending });
  if (typeof limit === "number") q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

/**
 * Insert rows into a table.
 */
export const insertRow = async (table, row) => {
  const client = getClient();
  const { data, error } = await client.from(table).insert(row).select();
  if (error) throw error;
  return data?.[0] ?? null;
};

/**
 * Update rows in a table by equality filter.
 */
export const updateRows = async (table, values, eq = {}) => {
  const client = getClient();

  let q = client.from(table).update(values);

  if (eq && typeof eq === "object") {
    for (const [key, value] of Object.entries(eq)) {
      if (value === "" || value === null || value === undefined) continue;
      q = q.eq(key, value);
    }
  }

  const { data, error } = await q.select();
  if (error) throw error;
  return data || [];
};

/**
 * Reference data used across UI (filters, selects).
 */
export const fetchReferenceData = async () => {
  // Keep this resilient: even if one table fails, we still return others.
  const safe = async (fn, fallback) => {
    try {
      return await fn();
    } catch (e) {
      console.warn("fetchReferenceData partial failure:", e?.message || e);
      return fallback;
    }
  };

  const joints = await safe(
    () => listTable("joints", { select: "id,name", order: "name", ascending: true }),
    []
  );

  const suppliers = await safe(
    () => listTable("suppliers", { select: "id,name", order: "name", ascending: true }),
    []
  );

  // Sellers list is optional reference data; sellers tab uses its own query anyway.
  const sellers = await safe(
    () => listTable("sellers", { select: "id,name", order: "name", ascending: true }),
    []
  );

  return { joints, suppliers, sellers };
};

/**
 * Dashboard metrics (required by dashboard.js).
 * Keep it robust: if tables don't exist yet, return zeros instead of crashing the whole app.
 */
export const fetchDashboardMetrics = async (jointId = "") => {
  const client = getClient();

  const safeCount = async (table, filter = {}) => {
    try {
      let q = client.from(table).select("id", { count: "exact", head: true });
      for (const [k, v] of Object.entries(filter)) {
        if (v === "" || v === null || v === undefined) continue;
        q = q.eq(k, v);
      }
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    } catch (e) {
      console.warn(`fetchDashboardMetrics: count failed for ${table}`, e?.message || e);
      return 0;
    }
  };

  // If your schema uses different table names, this still won’t break the UI — it returns 0.
  const filter = jointId ? { joint_id: jointId } : {};

  const deliveries = await safeCount("deliveries", filter);
  const allocations = await safeCount("allocations", filter);
  const payments = await safeCount("payments", filter);
  const audits = await safeCount("audits", filter);

  return {
    deliveries,
    allocations,
    payments,
    audits,
  };
};
