import { fetchReferenceData, listTable } from "./db.js";

const renderList = (listEl, rows) => {
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = `<p class="muted">No sellers found.</p>`;
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

export const loadSellers = async () => {
  const { joints } = await fetchReferenceData();

  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");
  if (!filterSelect || !listEl) return;

  // Filter Dropdown befüllen (Wert beibehalten)
  const prev = filterSelect.value || "";
  filterSelect.innerHTML = `<option value="">All joints</option>`;
  joints.forEach((joint) => {
    const opt = document.createElement("option");
    opt.value = joint.id;
    opt.textContent = joint.name;
    filterSelect.appendChild(opt);
  });
  filterSelect.value = prev;

  const selectedJoint = filterSelect.value || "";

  // Aktive Assignments laden
  const assignments = await listTable("seller_assignments", {
    select: `
      id,
      seller_id,
      joint_id,
      active,
      start_at,
      end_at,
      sellers(id,name),
      joints(id,name)
    `,
    eq: selectedJoint ? { joint_id: selectedJoint, active: true } : { active: true },
    order: "start_at",
    ascending: false,
  });

  const formatted = (assignments ?? []).map((a) => ({
    id: a.sellers?.id ?? a.seller_id,
    name: a.sellers?.name ?? "Unknown",
    joint_name: a.joints?.name ?? null,
  }));

  renderList(listEl, formatted);
};

// Optional: nur wenn du in ui.js noch init brauchst
export const initSellers = () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  if (filterSelect) {
    filterSelect.addEventListener("change", loadSellers);
  }
};
