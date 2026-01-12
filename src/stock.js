import { fetchReferenceData, insertRow, listTable } from "./db.js";
import { closeModal } from "./ui.js";

const setSelectOptions = (select, options, placeholder = "Select") => {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.textContent = placeholder;
  select.appendChild(option);
  options.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    select.appendChild(opt);
  });
};

const populateFormSelects = (templateId, joints, sellers, suppliers) => {
  const template = document.getElementById(templateId);
  if (!template) {
    return;
  }
  const clone = template.content;
  const jointSelect = clone.querySelector("select[name='joint_id']");
  if (jointSelect) {
    setSelectOptions(jointSelect, joints, "Select joint");
  }
  const sellerSelect = clone.querySelector("select[name='seller_id']");
  if (sellerSelect) {
    setSelectOptions(sellerSelect, sellers, "Select seller");
  }
  const supplierSelect = clone.querySelector("select[name='supplier_id']");
  if (supplierSelect) {
    setSelectOptions(supplierSelect, suppliers, "Select supplier");
  }
};

const renderList = (listEl, rows, formatter) => {
  listEl.innerHTML = "";
  if (rows.length === 0) {
    listEl.innerHTML = "<p class=\"muted\">No entries yet.</p>";
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "card";
    item.innerHTML = formatter(row);
    listEl.appendChild(item);
  });
};

const handleDeliverySubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    joint_id: form.joint_id.value,
    supplier_id: form.supplier_id.value || null,
    qty: Number(form.qty.value),
    note: form.note.value || null,
  };
  const { error } = await insertRow("deliveries", payload);
  if (error) {
    alert(error.message);
    return;
  }
  closeModal();
  await loadStock();
};

const handleAllocationSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    joint_id: form.joint_id.value,
    seller_id: form.seller_id.value,
    qty_basis: Number(form.qty_basis.value),
    note: form.note.value || null,
  };
  const { error } = await insertRow("allocations", payload);
  if (error) {
    alert(error.message);
    return;
  }
  closeModal();
  await loadStock();
};

let listenersBound = false;

const bindListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("submit", (event) => {
    if (event.target?.id === "deliveryForm") {
      handleDeliverySubmit(event);
    }
    if (event.target?.id === "allocationForm") {
      handleAllocationSubmit(event);
    }
  });
};

export const loadStock = async () => {
  const { joints, sellers, suppliers } = await fetchReferenceData();
  setSelectOptions(document.getElementById("stockJointFilter"), joints, "All joints");

  const deliveryList = document.getElementById("deliveryList");
  const allocationList = document.getElementById("allocationList");
  const selectedJoint = document.getElementById("stockJointFilter").value;

  const [deliveries, allocations] = await Promise.all([
    listTable("deliveries", { select: "id,qty,created_at,joint_id,note", eq: { joint_id: selectedJoint }, order: "created_at" }),
    listTable("allocations", {
      select: "id,qty_basis,created_at,joint_id,note",
      eq: { joint_id: selectedJoint },
      order: "created_at",
    }),
  ]);

  renderList(deliveryList, deliveries, (row) => {
    return `<strong>${row.qty} coconuts</strong><p class="muted">${new Date(
      row.created_at
    ).toLocaleString()}</p><p class="muted">${row.note || ""}</p>`;
  });

  renderList(allocationList, allocations, (row) => {
    return `<strong>${row.qty_basis} basis coconuts</strong><p class="muted">${new Date(
      row.created_at
    ).toLocaleString()}</p><p class="muted">${row.note || ""}</p>`;
  });

  bindListeners();

  populateFormSelects("deliveryFormTemplate", joints, sellers, suppliers);
  populateFormSelects("allocationFormTemplate", joints, sellers, suppliers);
};
