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

const openModal = (title, contentNode) => {
  if (!modal || !modalOverlay || !modalTitle || !modalBody) return;
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(contentNode);
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
  const template = templateId ? document.getElementById(templateId) : null;
  if (!template) return;

  const content = template.content.cloneNode(true);
  openModal(titles[action] || "Action", content);

  if (action === "events") {
    // Events only when the modal is open
    loadEvents();
  }
};

const handleActionClick = (event) => {
  const target = event.target.closest("[data-open]");
  if (!target) return;
  const action = target.dataset.open;
  if (!action) return;

  // close the FAB menu after selecting an action
  fabMenu?.classList.add("hidden");
  openAction(action);
};

fab?.addEventListener("click", (e) => {
  e.preventDefault();
  fabMenu?.classList.toggle("hidden");
});

fabMenu?.addEventListener("click", handleActionClick);

document.addEventListener("click", (event) => {
  // global delegate for any [data-open] elements (including inside modal)
  if (event.target.closest("[data-open]")) {
    handleActionClick(event);
  }
});

closeModalBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  closeModal();
});

modalOverlay?.addEventListener("click", (e) => {
  e.preventDefault();
  closeModal();
});

for (const tab of tabs) {
  tab.addEventListener("click", async () => {
    const t = tab.dataset.tab;
    setActiveTab(t);
    await tabLoaders[t]?.();
  });
}

window.addEventListener("load", async () => {
  // If ui.js fails to load, login will be dead — so this MUST run.
  await initAuth();
  setActiveTab("dashboard");
  await loadDashboard();
});
