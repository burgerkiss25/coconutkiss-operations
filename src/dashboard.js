import { fetchDashboardMetrics, fetchUpcomingEvents } from "./db.js";

export const loadDashboard = async () => {
  const metrics = await fetchDashboardMetrics();
  document.getElementById("expectedStock").textContent = metrics.expectedStock.toFixed(0);
  document.getElementById("expectedSeller").textContent = metrics.expectedSeller.toFixed(1);

  const activityList = document.getElementById("latestActivity");
  activityList.innerHTML = "";
  if (metrics.activity.length === 0) {
    activityList.innerHTML = "<p class=\"muted\">No recent activity yet.</p>";
  } else {
    metrics.activity.forEach((item) => {
      const row = document.createElement("div");
      row.className = "card";
      row.innerHTML = `<strong>${item.type}</strong><p class="muted">${new Date(
        item.created_at
      ).toLocaleString()}</p>`;
      activityList.appendChild(row);
    });
  }

  const upcoming = await fetchUpcomingEvents();
  const eventsList = document.getElementById("upcomingEvents");
  eventsList.innerHTML = "";
  if (upcoming.length === 0) {
    eventsList.innerHTML = "<p class=\"muted\">No upcoming events.</p>";
  } else {
    upcoming.forEach((event) => {
      const row = document.createElement("div");
      row.className = "card";
      row.innerHTML = `<strong>${new Date(event.event_ts).toLocaleString()}</strong>
        <p class="muted">${event.customer_name || "Guest"} · ${event.status}</p>
        <p class="muted">${event.location_note || "No location note"}</p>`;
      eventsList.appendChild(row);
    });
  }
};
