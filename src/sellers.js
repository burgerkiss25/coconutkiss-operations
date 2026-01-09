/* src/sellers.js */
import { fetchReferenceData, fetchAssignedSellers } from "./db.js";

const renderList = (listEl, rows) => {
  listEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    listEl.innerHTML = '<p class="muted">No sellers found.</p>';
    return;
  }

  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "card";

    // Row structure comes from fetchAssignedSellers()
    const sellerName = row.seller_name || row.name || "Unknown";
    const jointName = row.joint_name || "Unknown";

    const noteLine = row.note ? `<p class="muted">${row.note}</p>` : "";

    item.innerHTML = `
      <strong>${sellerName}</strong>
      <p class="muted">Joint: ${jointName}</p>
      ${noteLine}
    `;

    listEl.appendChild(item);
  });
};

export const loadSellers = async () => {
  const sellerListEl = document.getElementById("sellerList");
  const filterSelect = document.getElementById("sellerJointFilter");

  // Safety: if tab is not mounted yet
  if (!sellerListEl || !filterSelect) return;

  // Build filter options
  const { joints } = await fetchReferenceData();

  // Preserve previous selection (so it doesn't reset on reload)
  const previousValue = filterSelect.value;

  filterSelect.innerHTML = '<option value="">All joints</option>';
  (joints ?? [])
    .filter((j) => j.is_active !== false)
    .forEach((joint) => {
      const option = document.createElement("option");
      option.value = joint.id;
      option.textContent = joint.name;
      filterSelect.appendChild(option);
    });

  // Restore previous value if still exists
  if (previousValue) {
    const stillExists = Array.from(filterSelect.options).some((o) => o.value === previousValue);
    if (stillExists) filterSelect.value = previousValue;
  }

  const loadAndRender = async () => {
    const selectedJoint = filterSelect.value || null;

    // NEW FLEX LOGIC:
    // show sellers based on current active assignments (seller_assignments),
    // not sellers.joint_id.
    const assigned = await fetchAssignedSellers({ jointId: selectedJoint });

    renderList(sellerListEl, assigned);
  };

  // Ensure we do not attach multiple listeners if loadSellers is called many times
  if (!filterSelect.dataset.bound) {
    filterSelect.addEventListener("change", loadAndRender);
    filterSelect.dataset.bound = "true";
  }

  await loadAndRender();
};
