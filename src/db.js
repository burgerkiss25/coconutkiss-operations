import { supabaseClient } from "./config.js";

/* =========================
   INTERNAL HELPERS
========================= */

const getClient = () => {
  const client = supabaseClient();
  if (!client) {
    throw new Error("Supabase not configured");
  }
  return client;
};

const safeSelect = async (query) => {
  const { data, error } = await query;
  if (error) {
    console.warn(error.message);
    return [];
  }
  return data ?? [];
};

/* =========================
   GENERIC CRUD
========================= */

export const listTable = async (table, options = {}) => {
  const client = getClient();
  let q = client.from(table).select(options.select || "*");

  if (options.eq) {
    Object.entries(options.eq).forEach(([k, v]) => {
      if (v !== "" && v !== null && v !== undefined) {
        q = q.eq(k, v);
      }
    });
  }

  if (options.order) {
    q = q.order(options.order, { ascending: options.ascending ?? true });
  }

  return safeSelect(q);
};

export const insertTable = async (table, values) => {
  const client = getClient();
  const { data, error } = await client.from(table).insert(values).select();
  if (error) throw error;
  return data;
};

export const updateTable = async (table, values, match) => {
  const client = getClient();
  const { data, error } = await client.from(table).update(values).match(match).select();
  if (error) throw error;
  return data;
};

/* =========================
   REFERENCE DATA
========================= */

export const fetchReferenceData = async () => {
  const client = getClient();

  const [joints, sellers, suppliers] = await Promise.all([
    safeSelect(client.from("joints").select("*").order("name")),
    safeSelect(client.from("sellers").select("*").order("name")),
    safeSelect(client.from("suppliers").select("*").order("name")),
  ]);

  return { joints, sellers, suppliers };
};

/* =========================
   DASHBOARD
========================= */

export const fetchDashboardMetrics = async () => {
  const client = getClient();

  const [stock, deliveries, payments] = await Promise.all([
    safeSelect(client.from("stock").select("*")),
    safeSelect(client.from("deliveries").select("*")),
    safeSelect(client.from("payments").select("*")),
  ]);

  return {
    stockCount: stock.length,
    deliveriesCount: deliveries.length,
    paymentsCount: payments.length,
  };
};

export const fetchUpcomingEvents = async () => {
  const client = getClient();
  return safeSelect(
    client
      .from("events")
      .select("*")
      .gte("date", new Date().toISOString())
      .order("date", { ascending: true })
  );
};

/* =========================
   SELLER ASSIGNMENTS
========================= */

export const fetchActiveSellerAssignments = async (jointId) => {
  const client = getClient();

  let q = client
    .from("seller_assignments")
    .select("*, sellers(name)")
    .eq("active", true);

  if (jointId) q = q.eq("joint_id", jointId);

  return safeSelect(q);
};

/* =========================
   PAYMENTS
========================= */

export const createPaymentWithPin = async ({
  seller_id,
  joint_id,
  amount,
  pin,
  note,
}) => {
  const client = getClient();

  const { data, error } = await client.from("payments").insert({
    seller_id,
    joint_id,
    amount,
    pin,
    note,
  });

  if (error) throw error;
  return data;
};

/* =========================
   EVENTS
========================= */

export const createEventWithPricing = async ({
  name,
  date,
  joint_id,
  price,
  note,
}) => {
  const client = getClient();

  const { data, error } = await client.from("events").insert({
    name,
    date,
    joint_id,
    price,
    note,
  });

  if (error) throw error;
  return data;
};
