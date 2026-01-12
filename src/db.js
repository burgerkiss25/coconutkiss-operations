import { supabaseClient } from "./config.js";

/**
 * Returns a configured Supabase client or throws a clear error.
 */
export const getClient = () => {
  const client = supabaseClient?.();
  if (!client) {
    throw new Error("Supabase not configured. Check config.js (SUPABASE_URL / SUPABASE_ANON_KEY).");
  }
  return client;
};

/**
 * Generic table list helper.
 */
export const listTable = async (
  table,
  {
    select = "*",
    eq = null,
    order = null,
    ascending = true,
    limit = null,
  } = {}
) => {
  const client = getClient();

  let q = client.from(table).select(select);

  if (eq && typeof eq === "object") {
    for (const [key, value] of Object.entries(eq)) {
      if (value === "" || value === null || value === undefined) continue;
      q = q.eq(key, value);
    }
  }

  if (order) q = q.order(order, { ascending: !!ascending });
  if (limit) q = q.limit(limit);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
};

export const insertRow = async (table, row) => {
  const client = getClient();
  const { data, error } = await client.from(table).insert(row).select("*");
  if (error) throw error;
  return data?.[0] ?? null;
};

export const updateRow = async (table, match, patch) => {
  const client = getClient();
  let q = client.from(table).update(patch);

  for (const [k, v] of Object.entries(match || {})) {
    q = q.eq(k, v);
  }

  const { data, error } = await q.select("*");
  if (error) throw error;
  return data || [];
};

/**
 * Loads reference data used across tabs/forms.
 */
export const fetchReferenceData = async () => {
  const [joints, suppliers, sellers] = await Promise.all([
    listTable("joints", { select: "id,name", order: "name", ascending: true }),
    listTable("suppliers", { select: "id,name", order: "name", ascending: true }),
    listTable("sellers", { select: "id,name", order: "name", ascending: true }),
  ]);

  return { joints, suppliers, sellers };
};

/* ------------------------------------------------------------
   Backward compatibility exports (Dashboard expects these)
   ------------------------------------------------------------ */

/**
 * Safe count helper: returns 0 if table/permission doesn't exist,
 * so dashboard never crashes the whole app.
 */
const safeCount = async (table) => {
  try {
    const client = getClient();
    const { count, error } = await client
      .from(table)
      .select("*", { count: "exact", head: true });
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
};

/**
 * Dashboard expects this named export.
 * Keep it very defensive: never throw, return a stable object.
 *
 * If you later tell me what fields dashboard.js renders, I’ll align
 * the keys exactly to that UI.
 */
export const fetchDashboardMetrics = async () => {
  const metrics = {
    deliveries_count: 0,
    allocations_count: 0,
    payments_count: 0,
    audits_count: 0,
    events_count: 0,
  };

  // Only fill what exists; otherwise keep zeros.
  metrics.deliveries_count = await safeCount("deliveries");
  metrics.allocations_count = await safeCount("allocations");
  metrics.payments_count = await safeCount("payments");
  metrics.audits_count = await safeCount("audits");
  metrics.events_count = await safeCount("events");

  return metrics;
};
