import { fetchReferenceData, insertRow } from "./db.js";
import { closeModal } from "./ui.js";

let _bound = false;

const byName = (form, name) => form.querySelector(`[name="${name}"]`);
const setSelectOptions = (selectEl, options, { includeAll = false, allLabel = "All" } = {}) => {
  if (!selectEl) return;
  const current = selectEl.value || "";
  selectEl.innerHTML = "";

  if (includeAll) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = allLabel;
    selectEl.appendChild(opt);
  }

  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    selectEl.appendChild(opt);
  });

  // restore previous selection if still exists
  if ([...selectEl.options].some((o) => o.value === current)) {
    selectEl.value = current;
  }
};

const fillDeliveryForm = async () => {
  const { joints, suppliers } = await fetchReferenceData();

  const form = document.getElementById("deliveryForm");
  if (!form) return;

  const jointSelect =
    byName(form, "joint_id") ||
    form.querySelector("#deliveryJoint") ||
    form.querySelector("select");

  const supplierSelect =
    byName(form, "supplier_id") ||
    form.querySelector("#deliverySupplier");

  setSelectOptions(
    jointSelect,
    (joints ?? []).map((j) => ({ value: j.id, label: j.name })),
    { includeAll: false }
  );

  setSelectOptions(
    supplierSelect,
    [{ value: "", label: "— None —" }].concat(
      (suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))
    ),
    { includeAll: false }
  );
};

const handleDeliverySubmit = async (e) => {
  e.preventDefault();

  const form = e.currentTarget;
  const btn =
    form.querySelector('button[type="submit"]') ||
    document.getElementById("saveDeliveryBtn");

  if (btn) {
    btn.disabled = true;
    btn.dataset._oldText = btn.textContent || "";
    btn.textContent = "Saving...";
  }

  try {
    const jointId =
      (byName(form, "joint_id")?.value || form.querySelector("#deliveryJoint")?.value || "").trim();
    const supplierId =
      (byName(form, "supplier_id")?.value || form.querySelector("#deliverySupplier")?.value || "").trim();
    const qtyRaw =
      (byName(form, "qty")?.value || form.querySelector("#deliveryQty")?.value || "").trim();
    const note =
      (byName(form, "note")?.value || form.querySelector("#deliveryNote")?.value || "").trim();

    const qty = Number(qtyRaw);

    if (!jointId) throw new Error("Please select a joint.");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be a number > 0.");

    const payload = {
      joint_id: jointId,
      supplier_id: supplierId || null,
      qty,
      note: note || null,
    };

    const { error } = await insertRow("deliveries", payload);
    if (error) throw new Error(error.message || "Failed to save delivery.");

    // Erfolg
    closeModal();
    // Optional: du kannst hier loadStock() aufrufen, wenn du oben KPIs/Listen anzeigen willst
  } catch (err) {
    console.error("Save delivery failed:", err);
    alert(err?.message || "Save delivery failed.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = btn.dataset._oldText || "Save delivery";
    }
  }
};

export const loadStock = async () => {
  // Wenn du hier Stock-Listen/ KPIs lädst, kannst du das ergänzen.
  // Für Stabilität ist wichtig: KEINE Event Listener hier binden.
};

export const initStock = async () => {
  if (_bound) return;
  _bound = true;

  // Delivery form event binding (nur einmal)
  document.addEventListener("submit", async (e) => {
    const form = e.target;
    if (form?.id === "deliveryForm") {
      await handleDeliverySubmit(e);
    }
  });

  // Wenn Modal geöffnet wird und Delivery-Template gerendert ist:
  // Wir füllen die Selects kurz danach (Microtask), damit DOM sicher da ist.
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-open='delivery']");
    if (!btn) return;
    setTimeout(fillDeliveryForm, 0);
  });
};
