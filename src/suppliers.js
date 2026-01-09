import { listTable } from "./db.js";

export const loadSuppliers = async () => {
  const suppliers = await listTable("suppliers", { order: "name", ascending: true });
  const list = document.getElementById("supplierList");
  list.innerHTML = "";
  if (suppliers.length === 0) {
    list.innerHTML = "<p class=\"muted\">No suppliers yet.</p>";
    return;
  }
  suppliers.forEach((supplier) => {
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<strong>${supplier.name}</strong>
      <p class="muted">${supplier.phone_whatsapp || "No phone"}</p>
      <p class="muted">${supplier.note || ""}</p>`;
    list.appendChild(row);
  });
};
