import { fetchReferenceData, listTable } from "./db.js";

/* =========================
   RENDER
========================= */
const renderList = (listEl, rows) => {
  listEl.innerHTML = "";

  if (!rows || rows.length === 0) {
    listEl.innerHTML = `<p class="muted">No sellers found.</p>`;
    return;
  }

  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <strong>${row.name}</strong>
      <p class="muted">
        Joint: ${row.joint_name || "Unassigned"}
      </p>
    `;

    listEl.appendChild(card);
  });
};

/* =========================
   LOAD SELLERS
========================= */
export const loadSellers = async () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");

  if (!filterSelect || !listEl) return;

  // Load joints for filter
  const { joints } = await fetchReferenceData();

  filterSelect.innerHTML = `<option value="">All joints</option>`;
  joints.forEach((joint) => {
    const opt = document.createElement("option");
    opt.value = joint.id;
    opt.textContent = joint.name;
    filterSelect.appendChild(opt);
  });

  const selectedJoint = filterSelect.value || null;

  // Flexible seller logic via seller_assignments
  const sellers = await listTable("seller_assignments", {
    select: `
      id,
      sellers(id,name),
      joints(id,name)
    `,
    eq: selectedJoint ? { joint_id: selectedJoint, active: true } : { active: true },
    order: "created_at",
    ascending: false,
  });

  const formatted = sellers.map((row) => ({
    id: row.sellers.id,
    name: row.sellers.name,
    joint_name: row.joints?.name ?? null,
  }));

  renderList(listEl, formatted);
};

/* =========================
   INIT (🔥 DAS FEHLTE)
========================= */
export const initSellers = () => {
  const filter = document.getElementById("sellerJointFilter");
  if (filter) {
    filter.addEventListener("change", loadSellers);
  }
};
