import { listTable, createEventWithPricing } from "./db.js";
import { closeModal } from "./ui.js";

const renderEventList = (listEl, rows) => {
  listEl.innerHTML = "";
  if (rows.length === 0) {
    listEl.innerHTML = "<p class=\"muted\">No events scheduled.</p>";
    return;
  }
  rows.forEach((row) => {
    const total =
      row.event_pricing?.coconut_qty * row.event_pricing?.coconut_unit_price +
      (row.event_pricing?.delivery_fee || 0) +
      (row.event_pricing?.opening_fee || 0) +
      (row.event_pricing?.other_fee || 0);
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `<strong>${new Date(row.event_ts).toLocaleString()}</strong>
      <p class="muted">${row.customer_name || "Guest"} · ${row.status}</p>
      <p class="muted">Total: ${Number.isNaN(total) ? "--" : total.toFixed(2)} GHS</p>`;
    listEl.appendChild(card);
  });
};

const renderEventFormTotals = (form) => {
  const qty = Number(form.coconut_qty.value || 0);
  const unit = Number(form.coconut_unit_price.value || 0);
  const delivery = Number(form.delivery_fee.value || 0);
  const opening = Number(form.opening_fee.value || 0);
  const other = Number(form.other_fee.value || 0);
  const total = qty * unit + delivery + opening + other;
  const note = form.querySelector(".event-total");
  if (note) {
    note.textContent = `Total estimate: ${total.toFixed(2)} GHS`;
  }
};

const handleEventSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const payload = {
    event: {
      event_ts: new Date(form.event_ts.value).toISOString(),
      joint_id: form.joint_id.value,
      customer_name: form.customer_name.value || null,
      customer_phone: form.customer_phone.value || null,
      location_note: form.location_note.value || null,
      status: form.status.value,
      note: form.note.value || null,
    },
    pricing: {
      coconut_qty: Number(form.coconut_qty.value || 0),
      coconut_unit_price: Number(form.coconut_unit_price.value || 0),
      delivery_fee: Number(form.delivery_fee.value || 0),
      opening_fee: Number(form.opening_fee.value || 0),
      other_fee: Number(form.other_fee.value || 0),
      other_fee_note: form.other_fee_note.value || null,
    },
  };

  const { error } = await createEventWithPricing(payload);
  if (error) {
    alert(error.message);
    return;
  }
  closeModal();
  await loadEvents();
};

let listenersBound = false;

const bindListeners = () => {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("submit", (event) => {
    if (event.target?.id === "eventForm") {
      handleEventSubmit(event);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target?.form?.id === "eventForm") {
      renderEventFormTotals(event.target.form);
    }
  });
};

export const loadEvents = async () => {
  const listContainer = document.getElementById("modalBody");
  if (listContainer) {
    const list = document.createElement("div");
    list.className = "stack";
    const events = await listTable("events", {
      select: "id,event_ts,status,customer_name,event_pricing(coconut_qty,coconut_unit_price,delivery_fee,opening_fee,other_fee)",
      order: "event_ts",
      ascending: true,
    });
    renderEventList(list, events);
    listContainer.prepend(list);
  }

  bindListeners();
};
