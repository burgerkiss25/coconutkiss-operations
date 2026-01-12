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

const buildJointOptions = (selectEl, joints) => {
  selectEl.innerHTML = '<option value="">All joints</option>';
  joints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;
    selectEl.appendChild(option);
  });
};

export const loadSellers = async () => {
  const filterSelect = document.getElementById("sellerJointFilter");
  const listEl = document.getElementById("sellerList");

  if (!filterSelect || !listEl) return;

  // 1) Load joints for filter dropdown
  const { joints } = await fetchReferenceData();
  buildJointOptions(filterSelect, joints);

  // 2) Read selected joint AFTER options exist
  const selectedJoint = filterSelect.value || "";

  // 3) Load all sellers
  const sellers = await listTable("sellers", {
    select: "id,name",
    order: "name",
    ascending: true,
  });

  // 4) Load active assignments (your table has: seller_id, joint_id, active, ... )
  //    We also join joints(name) for display.
  const assignments = await listTable("seller_assignments", {
    select: "seller_id,joint_id,active,joints(name)",
    eq: { active: true },
  });

  // Map: seller_id -> { joint_id, joint_name }
  const assignmentBySeller = new Map();
  for (const a of assignments) {
    assignmentBySeller.set(a.seller_id, {
      joint_id: a.joint_id,
      joint_name: a.joints?.name || null,
    });
  }

  // 5) Combine + optionally filter by joint
  let combined = sellers.map((s) => {
    const asg = assignmentBySeller.get(s.id);
    return {
      ...s,
      joint_id: asg?.joint_id || null,
      joint_name: asg?.joint_name || null,
    };
  });

  if (selectedJoint) {
    combined = combined.filter((s) => s.joint_id === selectedJoint);
  }

  renderList(listEl, combined);

  // 6) Filter change handler (attach once)
  if (!filterSelect.dataset.bound) {
    filterSelect.dataset.bound = "1";
    filterSelect.addEventListener("change", async () => {
      await loadSellers();
    });
  }
};

// Backward compatibility: some older ui.js versions imported initSellers
export const initSellers = loadSellers;
