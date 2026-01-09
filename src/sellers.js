// src/sellers.js
import { fetchReferenceData, listTable } from "./db.js";

/**
 * Render seller cards
 */
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
 * Fill joint filter dropdown. Keeps previous selection if still available.
 */
const buildJointFilterOptions = (filterSelect, joints) => {
  const previousValue = filterSelect.value || "";

  filterSelect.innerHTML = '<option value="">All joints</option>';

  (joints ?? [])
    .filter((j) => j && j.is_active !== false) // show active joints (or those without flag)
    .forEach((joint) => {
      const option = document.createElement("option");
      option.value = joint.id;
      option.textContent = joint.name;
      filterSelect.appendChild(option);
    });

  const previousStillExists =
    previousValue === "" ||
    Array.from(filterSelect.options).some((opt) => opt.value === previousValue);

  filterSelect.value = previousStillExists ? previousValue : "";
};

/**
 * Core loader: loads joints for filter + loads sellers list for selected joint (or all joints)
 */
export const loadSellers = async () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");
  if (!filterSelect || !listEl) return;

  // 1) Load reference data (joints)
  const { joints } = await fetchReferenceData();
  buildJointFilterOptions(filterSelect, joints);

  // 2) Determine selected joint
  const selectedJoint = filterSelect.value; // "" => all joints

  // 3) Query sellers
  // IMPORTANT: Only apply .eq when a joint is actually selected
  const sellers = await listTable("sellers", {
    select: "id,name,joint_id,is_active,joints(name)",
    eq: selectedJoint ? { joint_id: selectedJoint } : undefined,
    order: "name",
    ascending: true,
  });

  // 4) Format + render
  const formatted = (sellers ?? [])
    .filter((s) => s && s.is_active !== false) // hide inactive sellers if flag exists
    .map((seller) => ({
      ...seller,
      joint_name: seller.joints?.name,
    }));

  renderList(listEl, formatted);
};

/**
 * Initialize this module (attach listeners).
 * Call this once from your main bootstrap (e.g. ui.js / dashboard.js) when the Sellers tab is shown.
 */
export const initSellers = async () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  if (!filterSelect) return;

  // Avoid double-binding if initSellers() is called multiple times
  if (filterSelect.dataset.bound === "1") return;
  filterSelect.dataset.bound = "1";

  // Load initial list
  await loadSellers();

  // Reload list whenever filter changes
  filterSelect.addEventListener("change", async () => {
    await loadSellers();
  });
};
