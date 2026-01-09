// src/sellers.js
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

const populateJointFilter = (filterSelect, joints) => {
  // Preserve current selection (important when reloading)
  const previousValue = filterSelect.value ?? "";

  filterSelect.innerHTML = '<option value="">All joints</option>';

  (joints ?? []).forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id; // UUID
    option.textContent = joint.name;
    filterSelect.appendChild(option);
  });

  // Restore selection if still present; otherwise default to "All joints"
  const stillExists =
    previousValue === "" ||
    Array.from(filterSelect.options).some((o) => o.value === previousValue);

  filterSelect.value = stillExists ? previousValue : "";
};

const loadAndRenderSellers = async (selectedJointId) => {
  // IMPORTANT FIX:
  // If "All joints" is selected (empty string), do NOT apply eq filter.
  const query = {
    select: "id,name,joint_id,joints(name)",
    order: "name",
    ascending: true,
  };

  if (selectedJointId) {
    query.eq = { joint_id: selectedJointId };
  }

  const sellers = await listTable("sellers", query);

  const formatted = (sellers ?? []).map((seller) => ({
    ...seller,
    joint_name: seller.joints?.name,
  }));

  renderList(document.getElementById("sellerList"), formatted);
};

export const loadSellers = async () => {
  const { joints } = await fetchReferenceData();

  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");

  if (!filterSelect || !listEl) return;

  // 1) Populate filter dropdown (keep current selection if possible)
  populateJointFilter(filterSelect, joints);

  // 2) Initial load based on current selection
  await loadAndRenderSellers(filterSelect.value);

  // 3) React to filter changes (avoid stacking listeners)
  if (!filterSelect.dataset.bound) {
    filterSelect.addEventListener("change", async () => {
      await loadAndRenderSellers(filterSelect.value);
    });
    filterSelect.dataset.bound = "1";
  }
};
