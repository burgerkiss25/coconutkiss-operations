import { fetchReferenceData, listTable } from "./db.js";

const renderList = (listEl, rows) => {
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = '<p class="muted">No sellers found.</p>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "card";
    item.innerHTML = `
      <strong>${row.name}</strong>
      <p class="muted">Joint: ${row.joint_name || "Unassigned"}</p>
    `;
    listEl.appendChild(item);
  });
};

/**
 * Loads sellers based on active seller assignments (preferred),
 * with fallback to sellers.joint_id legacy logic if assignments table is not available.
 */
export const loadSellers = async () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");

  // 1) Populate filter dropdown (always from joints reference data)
  const { joints } = await fetchReferenceData();

  if (filterSelect) {
    const current = filterSelect.value || "";
    filterSelect.innerHTML = '<option value="">All joints</option>';

    (joints || []).forEach((joint) => {
      const option = document.createElement("option");
      option.value = joint.id;
      option.textContent = joint.name;
      filterSelect.appendChild(option);
    });

    // Keep selection if possible
    filterSelect.value = current;
  }

  const selectedJoint = filterSelect?.value || "";

  // 2) Preferred: seller_assignments (active = true) joined to sellers + joints
  try {
    const assignments = await listTable("seller_assignments", {
      select: "id,active,seller_id,joint_id,sellers(id,name),joints(id,name)",
      eq: {
        active: true,
        joint_id: selectedJoint || undefined, // only filter when selectedJoint is set
      },
      order: "id",
      ascending: true,
    });

    const formatted = (assignments || [])
      .map((a) => ({
        id: a.seller_id,
        name: a.sellers?.name || "(Unnamed)",
        joint_id: a.joint_id,
        joint_name: a.joints?.name || "Unassigned",
      }))
      // stable sorting by seller name
      .sort((x, y) => (x.name || "").localeCompare(y.name || ""));

    renderList(listEl, formatted);
    return;
  } catch (e) {
    console.warn("Sellers: seller_assignments query failed, falling back to sellers.joint_id.", e?.message || e);
  }

  // 3) Fallback: old logic using sellers.joint_id + join joints(name)
  try {
    const sellers = await listTable("sellers", {
      select: "id,name,joint_id,joints(name)",
      eq: selectedJoint ? { joint_id: selectedJoint } : {},
      order: "name",
      ascending: true,
    });

    const formatted = (sellers || []).map((seller) => ({
      ...seller,
      joint_name: seller.joints?.name,
    }));

    renderList(listEl, formatted);
  } catch (e) {
    console.error("Sellers: fallback query failed:", e?.message || e);
    renderList(listEl, []);
  }
};

/**
 * Optional init function (keeps compatibility if any module still imports initSellers).
 * It wires the filter change event once.
 */
export const initSellers = () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  if (filterSelect && !filterSelect.dataset.bound) {
    filterSelect.addEventListener("change", () => {
      loadSellers();
    });
    filterSelect.dataset.bound = "1";
  }
};
