import { initAuth } from "./auth.js";
import { loadDashboard } from "./dashboard.js";
import { loadStock } from "./stock.js";
import { initSellers } from "./sellers.js"; // ✅ statt loadSellers
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
  indicator.textContent = connected ? "Connected" : "Offline";
  indicator.classList.toggle("pill", true);
};

export const renderRole = (email, role) => {
  document.getElementById("userEmail").textContent = email || "";
  document.getElementById("userRole").textContent = role ? `Role: ${role}` : "";
};

const openModal = (title, content) => {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(content);
  modal.classList.remove("hidden");
  modalOverlay.classList.remove("hidden");
};

export const closeModal = () => {
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
  sellers: initSellers, // ✅ wichtig: init statt load
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
  const template = document.getElementById(templates[action]);
  if (!template) {
    return;
  }
  const content = template.content.cloneNode(true);
  openModal(titles[action], content);
  if (action === "events") {
    loadEvents();
  }
};

const handleActionClick = (event) => {
  const action = event.target.dataset.open;
  if (action) {
    openAction(action);
  }
};

fab?.addEventListener("click", () => {
  fabMenu.classList.toggle("hidden");
});

fabMenu?.addEventListener("click", handleActionClick);

document.addEventListener("click", (event) => {
  if (event.target.matches("[data-open]")) {
    handleActionClick(event);
  }
});

closeModalBtn?.addEventListener("click", closeModal);
modalOverlay?.addEventListener("click", closeModal);

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
    tabLoaders[tab.dataset.tab]?.();
  });
}

window.addEventListener("load", async () => {
  await initAuth();
  setActiveTab("dashboard");
  await loadDashboard();
});
