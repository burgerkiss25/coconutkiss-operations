// src/db.js
import { CONFIG, supabaseClient } from "./config.js";
import { currentUser } from "./auth.js";

/**
 * Loads reference data used across the app (dropdowns, lists, etc.)
 * Now includes active seller assignments so seller ↔ joint mapping can be flexible.
 */
export const fetchReferenceData = async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    return { joints: [], sellers: [], suppliers: [], assignments: [] };
  }

  const [jointsRes, sellersRes, suppliersRes, assignmentsRes] = await Promise.all([
    supabase.from("joints").select("id,name,is_active").order("name"),
    supabase.from("sellers").select("id,name,is_active").order("name"),
    supabase.from("suppliers").select("id,name,phone_whatsapp,note,is_active").order("name"),
    supabase
      .from("seller_assignments")
      .select("id,seller_id,joint_id,active,start_at,end_at,note")
      .eq("active", true),
  ]);

  return {
    joints: jointsRes.data ?? [],
    sellers: sellersRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
    assignments: assignmentsRes.data ?? [],
  };
};

/**
 * For seller dropdowns that depend on a selected joint:
 * returns the list of ACTIVE sellers assigned to the given joint.
 *
 * NOTE:
 * This requires a FK relationship: seller_assignments.seller_id -> sellers.id
 * If your relationship name is not "sellers" in Supabase, adjust the select:
 *   .select("seller_id, seller: sellers ( id, name, is_active )")
 * or check the exact relationship label in Table Editor.
 */
export const fetchAssignedSellersForJoint = async (jointId) => {
  const supabase = supabaseClient();
  if (!supabase || !jointId) return [];

  const { data, error } = await supabase
    .from("seller_assignments")
    .select("seller_id, sellers ( id, name, is_active )")
    .eq("joint_id", jointId)
    .eq("active", true)
    .order("start_at", { ascending: false });

  if (error) return [];

  return (data ?? [])
    .map((row) => row.sellers)
    .filter(Boolean)
    .filter((s) => s.is_active !== false);
};

export const fetchDashboardMetrics = async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    return { expectedStock: 0, expectedSeller: 0, activity: [] };
  }

  const [deliveriesRes, allocationsRes, paymentsRes] = await Promise.all([
    supabase.from("deliveries").select("qty,created_at").order("created_at", { ascending: false }).limit(5),
    supabase
      .from("allocations")
      .select("qty_basis,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("payments")
      .select("amount_ghs,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const deliveries = deliveriesRes.data ?? [];
  const allocations = allocationsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  const totalDeliveries = deliveries.reduce((sum, row) => sum + (row.qty ?? 0), 0);
  const totalAllocations = allocations.reduce((sum, row) => sum + (row.qty_basis ?? 0), 0);
  const totalPayments = payments.reduce(
    (sum, row) => sum + (row.amount_ghs ?? 0) / CONFIG.BASIS_UNIT_PRICE,
    0
  );

  const activity = [
    ...deliveries.map((row) => ({ type: "Delivery", created_at: row.created_at })),
    ...allocations.map((row) => ({ type: "Allocation", created_at: row.created_at })),
    ...payments.map((row) => ({ type: "Payment", created_at: row.created_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    expectedStock: totalDeliveries - totalAllocations,
    expectedSeller: totalAllocations - totalPayments,
    activity: activity.slice(0, 6),
  };
};

export const fetchUpcomingEvents = async () => {
  const supabase = supabaseClient();
  if (!supabase) {
    return [];
  }
  const now = new Date();
  const inSeven = new Date();
  inSeven.setDate(now.getDate() + 7);

  const { data } = await supabase
    .from("events")
    .select("id,event_ts,status,customer_name,location_note")
    .gte("event_ts", now.toISOString())
    .lte("event_ts", inSeven.toISOString())
    .order("event_ts", { ascending: true });

  return data ?? [];
};

export const insertRow = async (table, payload) => {
  const supabase = supabaseClient();
  if (!supabase) {
    return { error: { message: "Supabase not configured" } };
  }
  return supabase.from(table).insert(payload);
};

export const listTable = async (table, query = {}) => {
  const supabase = supabaseClient();
  if (!supabase) {
    return [];
  }
  let builder = supabase.from(table).select(query.select || "*");

  if (query.eq) {
    Object.entries(query.eq).forEach(([key, value]) => {
      // allow 0, but ignore null/undefined/empty string
      if (value !== null && value !== undefined && value !== "") {
        builder = builder.eq(key, value);
      }
    });
  }

  if (query.order) {
    builder = builder.order(query.order, { ascending: query.ascending ?? false });
  }

  const { data } = await builder;
  return data ?? [];
};

export const createPaymentWithPin = async (payload, sellerPin) => {
  const supabase = supabaseClient();
  if (!supabase) {
    return { error: { message: "Supabase not configured" } };
  }

  if (!currentUser) {
    return { error: { message: "Not authenticated" } };
  }

  const { data, error } = await supabase.rpc("confirm_payment_with_pin", {
    p_joint_id: payload.joint_id,
    p_seller_id: payload.seller_id,
    p_amount_ghs: payload.amount_ghs,
    p_note: payload.note || null,
    p_pin: sellerPin,
  });

  if (error) {
    return { error };
  }

  return { data };
};

export const createEventWithPricing = async (payload) => {
  const supabase = supabaseClient();
  if (!supabase) {
    return { error: { message: "Supabase not configured" } };
  }

  return supabase.rpc("create_event_with_pricing", {
    p_event: payload.event,
    p_pricing: payload.pricing,
  });
};
