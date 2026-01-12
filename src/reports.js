import { CONFIG } from "./config.js";
import { fetchReferenceData, listTable, createPaymentWithPin, insertRow } from "./db.js";
import { closeModal } from "./ui.js";

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

const handlePaymentSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    joint_id: form.joint_id.value,
    seller_id: form.seller_id.value,
    amount_ghs: Number(form.amount_ghs.value),
    note: form.note.value || null,
  };
  const { error } = await createPaymentWithPin(payload, form.seller_pin.value);
  if (error) {
    alert(error.message);
    return;
  }
  closeModal();
  await loadReports();
};

const handleAuditSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    joint_id: form.joint_id.value,
    seller_id: form.seller_id.value || null,
    counted_qty: Number(form.counted_qty.value),
    note: form.note.value || null,
  };
  const { error } = await insertRow("audits", payload);
  if (error) {
    alert(error.message);
    return;
  }
  closeModal();
  await loadReports();
};

const populateReportFilters = (joints, sellers) => {
  const jointFilter = document.getElementById("reportJointFilter");
  const sellerFilter = document.getElementById("reportSellerFilter");
  jointFilter.innerHTML = "<option value=\"\">All joints</option>";
  sellerFilter.innerHTML = "<option value=\"\">All sellers</option>";
  joints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;
    jointFilter.appendChild(option);
  });
  sellers.forEach((seller) => {
    const option = document.createElement("option");
    option.value = seller.id;
    option.textContent = seller.name;
    sellerFilter.appendChild(option);
  });
};

const populatePaymentForm = (joints, sellers) => {
  const template = document.getElementById("paymentFormTemplate");
  if (!template) {
    return;
  }
  const clone = template.content;
  const jointSelect = clone.querySelector("select[name='joint_id']");
  const sellerSelect = clone.querySelector("select[name='seller_id']");
  jointSelect.innerHTML = "<option value=\"\">Select joint</option>";
  sellerSelect.innerHTML = "<option value=\"\">Select seller</option>";
  joints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;
    jointSelect.appendChild(option);
  });
  sellers.forEach((seller) => {
    const option = document.createElement("option");
    option.value = seller.id;
    option.textContent = seller.name;
    sellerSelect.appendChild(option);
  });
};

const populateAuditForm = (joints, sellers) => {
  const template = document.getElementById("auditFormTemplate");
  if (!template) {
    return;
  }
  const clone = template.content;
  const jointSelect = clone.querySelector("select[name='joint_id']");
  const sellerSelect = clone.querySelector("select[name='seller_id']");
  jointSelect.innerHTML = "<option value=\"\">Select joint</option>";
  sellerSelect.innerHTML = "<option value=\"\">Optional seller</option>";
  joints.forEach((joint) => {
    const option = document.createElement("option");
    option.value = joint.id;
    option.textContent = joint.name;
    jointSelect.appendChild(option);
  });
  sellers.forEach((seller) => {
    const option = document.createElement("option");
    option.value = seller.id;
    option.textContent = seller.name;
    sellerSelect.appendChild(option);
  });
};

let listenersBound = false;

const bindListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("submit", (event) => {
    if (event.target?.id === "paymentForm") {
      handlePaymentSubmit(event);
    }
    if (event.target?.id === "auditForm") {
      handleAuditSubmit(event);
    }
  });
};

export const loadReports = async () => {
  const { joints, sellers } = await fetchReferenceData();
  populateReportFilters(joints, sellers);

  const jointId = document.getElementById("reportJointFilter").value;
  const sellerId = document.getElementById("reportSellerFilter").value;

  const [payments, audits] = await Promise.all([
    listTable("payments", {
      select: "id,amount_ghs,created_at,confirmed_by_seller,note",
      eq: { joint_id: jointId, seller_id: sellerId },
      order: "created_at",
    }),
    listTable("audits", {
      select: "id,counted_qty,created_at,note",
      eq: { joint_id: jointId, seller_id: sellerId },
      order: "created_at",
    }),
  ]);

  renderList(document.getElementById("paymentList"), payments, (row) => {
    const equivalent = row.amount_ghs / CONFIG.BASIS_UNIT_PRICE;
    const status = row.confirmed_by_seller ? "Confirmed" : "Unconfirmed";
    return `<strong>${row.amount_ghs} GHS</strong>
      <p class="muted">≈ ${equivalent.toFixed(1)} coconuts · ${status}</p>
      <p class="muted">${new Date(row.created_at).toLocaleString()}</p>
      <p class="muted">${row.note || ""}</p>`;
  });

  renderList(document.getElementById("auditList"), audits, (row) => {
    return `<strong>${row.counted_qty} counted</strong>
      <p class="muted">${new Date(row.created_at).toLocaleString()}</p>
      <p class="muted">${row.note || ""}</p>`;
  });

  bindListeners();

  populatePaymentForm(joints, sellers);
  populateAuditForm(joints, sellers);
};
