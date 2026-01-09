/* src/db.js */
import { CONFIG, supabaseClient } from "./config.js";
import { currentUser } from "./auth.js";

/**
 * Notes:
 * - Sellers are now "flexible" via public.seller_assignments (active + start_at/end_at).
 * - We still keep sellers.joint_id in DB (legacy), but UI logic uses assignments.
 * - This file also fixes the "Multiple GoTrueClient instances" warning by caching the supabase client.
 */

let _cachedSupabase = null;
const getSupabase = () => {
  if (_cachedSupabase) return _cachedSupabase;
  _cachedSupabase = supabaseClient();
  return _cachedSupabase;
};

export const fetchReferenceData = async () => {
  const supabase = getSupabase();
  if (!supabase) {
    return { joints: [], sellers: [], suppliers: [] };
  }

  const [jointsRes, sellersRes, suppliersRes] = await Promise.all([
    supabase.from("joints").select("id,name,is_active").order("name"),
    // IMPORTANT: sellers no longer require joint_id to display; fetched for admin screens/forms if needed
    supabase.from("sellers").select("id,name,is_active").order("name"),
    supabase
      .from("suppliers")
      .select("id,name,phone_whatsapp,note,is_active")
      .order("name"),
  ]);

  return {
    joints: jointsRes.data ?? [],
    sellers: sellersRes.data ?? [],
    suppliers: suppliersRes.data ?? [],
  };
};

export const fetchDashboardMetrics = async () => {
  const supabase = getSupabase();
  if (!supabase) {
    return { expectedStock: 0, expectedSeller: 0, activity: [] };
  }

  const [deliveries, allocations, payments] = await Promise.all([
    supabase
      .from("deliveries")
      .select("qty,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
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

  const totalDeliveries = (deliveries.data ?? []).reduce((sum, row) => sum + (row.qty || 0), 0);
  const totalAllocations = (allocations.data ?? []).reduce(
    (sum, row) => sum + (row.qty_basis || 0),
    0
  );
  const totalPayments = (payments.data ?? []).reduce((sum, row) => {
    const amount = row.amount_ghs || 0;
    return sum + amount / CONFIG.BASIS_UNIT_PRICE;
  }, 0);

  const activity = [
    ...((deliveries.data ?? []).map((row) => ({ type: "Delivery", created_at: row.created_at }))),
    ...((allocations.data ?? []).map((row) => ({
      type: "Allocation",
      created_at: row.created_at,
    }))),
    ...((payments.data ?? []).map((row) => ({ type: "Payment", created_at: row.created_at }))),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  return {
    expectedStock: totalDeliveries - totalAllocations,
    expectedSeller: totalAllocations - totalPayments,
    activity: activity.slice(0, 6),
  };
};

export const fetchUpcomingEvents = async () => {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { message: "Supabase not configured" } };
  }
  return supabase.from(table).insert(payload);
};

export const listTable = async (table, query = {}) => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  let builder = supabase.from(table).select(query.select || "*");

  if (query.eq) {
    Object.entries(query.eq).forEach(([key, value]) => {
      // Allow false/0; only ignore null/undefined/""
      if (value !== undefined && value !== null && value !== "") {
        builder = builder.eq(key, value);
      }
    });
  }

  if (query.order) {
    builder = builder.order(query.order, { ascending: query.ascending ?? false });
  }

  const { data, error } = await builder;
  if (error) {
    console.error("listTable error:", table, error);
    return [];
  }
  return data ?? [];
};

/**
 * NEW: Flexible seller logic
 * Returns the "currently assigned" sellers.
 * - If jointId is provided: only sellers actively assigned to that joint.
 * - If jointId is empty/null: all active assignments across joints.
 *
 * Requires table public.seller_assignments with columns:
 * seller_id, joint_id, active, start_at, end_at
 */
export const fetchAssignedSellers = async ({ jointId } = {}) => {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const nowIso = new Date().toISOString();

  // We treat "active assignment" as:
  // active = true
  // start_at <= now
  // (end_at is null OR end_at > now)
  let query = supabase
    .from("seller_assignments")
    .select(
      `
      id,
      seller_id,
      joint_id,
      active,
      start_at,
      end_at,
      note,
      sellers ( id, name, is_active ),
      joints ( id, name, is_active )
    `
    )
    .eq("active", true)
    .lte("start_at", nowIso)
    .or(`end_at.is.null,end_at.gt.${nowIso}`);

  if (jointId) {
    query = query.eq("joint_id", jointId);
  }

  const { data, error } = await query.order("start_at", { ascending: false });
  if (error) {
    console.error("fetchAssignedSellers error:", error);
    return [];
  }

  // Normalize to flat rows for UI
  return (data ?? [])
    .filter((row) => row?.sellers?.is_active !== false) // hide disabled sellers
    .map((row) => ({
      assignment_id: row.id,
      seller_id: row.seller_id,
      seller_name: row.sellers?.name || "Unknown",
      joint_id: row.joint_id,
      joint_name: row.joints?.name || "Unknown",
      start_at: row.start_at,
      end_at: row.end_at,
      note: row.note || "",
    }));
};

export const createPaymentWithPin = async (payload, sellerPin) => {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  if (!supabase) {
    return { error: { message: "Supabase not configured" } };
  }

  return supabase.rpc("create_event_with_pricing", {
    p_event: payload.event,
    p_pricing: payload.pricing,
  });
};
