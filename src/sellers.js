import { fetchReferenceData, listTable } from "./db.js";

const renderList = (listEl, rows) => {
  listEl.innerHTML = "";
  if (rows.length === 0) {
    listEl.innerHTML = "<p class=\"muted\">No sellers found.</p>";
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "card";
    item.innerHTML = `<strong>${row.name}</strong><p class="muted">Joint: ${row.joint_name || "Unassigned"}</p>`;
    listEl.appendChild(item);
  });
};

export const loadSellers = async () => {
  const { joints } = await fetchReferenceData();
  const filterSelect = document.getElementById("sellerJointFilter");
  filterSelect.innerHTML = "<option value=\"\">All joints</option>";
  joints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;
    filterSelect.appendChild(option);
  });

  const selectedJoint = filterSelect.value;
  const sellers = await listTable("sellers", {
    select: "id,name,joint_id,joints(name)",
    eq: { joint_id: selectedJoint },
    order: "name",
    ascending: true,
  });

  const formatted = sellers.map((seller) => ({
    ...seller,
    joint_name: seller.joints?.name,
  }));

  renderList(document.getElementById("sellerList"), formatted);
};
