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
      // ignore empty filter values
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
 * Keep it light: only what the UI needs.
 */
export const fetchReferenceData = async () => {
  const [joints, suppliers, sellers] = await Promise.all([
    listTable("joints", { select: "id,name", order: "name", ascending: true }),
    listTable("suppliers", { select: "id,name", order: "name", ascending: true }),
    listTable("sellers", { select: "id,name", order: "name", ascending: true }),
  ]);

  return { joints, suppliers, sellers };
};
