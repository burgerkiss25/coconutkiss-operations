import { initAuth } from "./auth.js";
import { loadDashboard } from "./dashboard.js";
import { loadStock } from "./stock.js";
import { loadSellers } from "./sellers.js";
import { loadSuppliers } from "./suppliers.js";
import { loadReports } from "./reports.js";
import { loadEvents } from "./events.js";

const tabs = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".tab-panel");

const modal = document.getElementById("modal");
const modalOverlay = document.getElementById("modalOverlay");
const closeModalBtn = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");

const fab = document.getElementById("fab");
const fabMenu = document.getElementById("fabMenu");

export const updateConnectionState = (connected) => {
  const indicator = document.getElementById("connectionState");
  if (!indicator) return;
  indicator.textContent = connected ? "Connected" : "Offline";
  indicator.classList.toggle("pill", true);
};

export const renderRole = (email, role) => {
  const emailEl = document.getElementById("userEmail");
  const roleEl = document.getElementById("userRole");
  if (emailEl) emailEl.textContent = email || "";
  if (roleEl) roleEl.textContent = role ? `Role: ${role}` : "";
};

const openModal = (title, content) => {
  if (!modal || !modalOverlay || !modalTitle || !modalBody) return;

  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(content);
  modal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");
};

export const closeModal = () => {
  if (!modal || !modalOverlay || !modalBody) return;

  modal.classList.add("hidden");
  modalOverlay.classList.add("hidden");
  modalBody.innerHTML = "";
};

const setActiveTab = (tab) => {
  tabs.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  panels.forEach((panel) => panel.classList.toggle("hidden", panel.id !== `tab-${tab}`));
};

const tabLoaders = {
  dashboard: loadDashboard,
  stock: loadStock,
  sellers: loadSellers,
  suppliers: loadSuppliers,
  reports: loadReports,
};

const openAction = (action) => {
  const templates = {
    delivery: "deliveryFormTemplate",
    allocation: "allocationFormTemplate",
    payment: "paymentFormTemplate",
    audit: "auditFormTemplate",
    events: "eventFormTemplate",
  };
  const titles = {
    delivery: "Record delivery",
    allocation: "Give coconuts",
    payment: "Receive payment",
    audit: "Audit count",
    events: "Manage event",
  };

  const templateId = templates[action];
  const title = titles[action];
  if (!templateId || !title) return;

  const template = document.getElementById(templateId);
  if (!template) return;

  const content = template.content.cloneNode(true);
  openModal(title, content);

  // Side-effects
  if (action === "events") loadEvents();
};

fab?.addEventListener("click", () => {
  fabMenu?.classList.toggle("hidden");
});

// Zentrale Click-Delegation: zuverlässig via closest("[data-open]")
document.addEventListener("click", (event) => {
  const trigger = event.target.closest?.("[data-open]");
  if (!trigger) return;

  const action = trigger.dataset.open;
  if (!action) return;

  // Verhindert “komische” Doppel-Events / bubbling-Probleme
  event.preventDefault();
  event.stopPropagation();

  // FAB Menü nach Auswahl schließen
  fabMenu?.classList.add("hidden");

  openAction(action);
});

closeModalBtn?.addEventListener("click", closeModal);
modalOverlay?.addEventListener("click", closeModal);

for (const tab of tabs) {
  tab.addEventListener("click", async () => {
    setActiveTab(tab.dataset.tab);
    const loader = tabLoaders[tab.dataset.tab];
    if (loader) await loader();
  });
}

// Bessere Fehlersichtbarkeit (hilft bei "stack depth limit exceeded")
window.addEventListener("error", (e) => {
  console.error("Window error:", e?.error || e?.message || e);
});

window.addEventListener("unhandledrejection", (e) => {
  console.error("Unhandled promise rejection:", e?.reason || e);
});

window.addEventListener("load", async () => {
  await initAuth();
  setActiveTab("dashboard");
  await loadDashboard();
});
