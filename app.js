const statusEndpoint = "/api/status";
const refreshIntervalMs = 30000;

const grid = document.getElementById("status-grid");
const lastUpdatedEl = document.getElementById("last-updated");

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setBadge(badge, state) {
  badge.classList.remove("ok", "issue", "checking");
  badge.classList.add(state);

  if (state === "ok") {
    badge.textContent = "Operational";
  } else if (state === "issue") {
    badge.textContent = "Issue detected";
  } else {
    badge.textContent = "Checking...";
  }
}

function updateCard(card, service) {
  const badge = card.querySelector("[data-status]");
  const endpoint = card.querySelector("[data-endpoint]");
  const detail = card.querySelector("[data-detail]");

  endpoint.textContent = service.url;

  if (service.ok) {
    setBadge(badge, "ok");
    detail.textContent = `HTTP ${service.status} · ${service.responseTimeMs} ms`;
  } else {
    setBadge(badge, "issue");
    detail.textContent = service.error
      ? `No response · ${service.error}`
      : `HTTP ${service.status || "--"}`;
  }
}

function setCheckingState() {
  grid.querySelectorAll(".status-card").forEach((card) => {
    const badge = card.querySelector("[data-status]");
    const detail = card.querySelector("[data-detail]");
    setBadge(badge, "checking");
    detail.textContent = "Checking now...";
  });
}

async function loadStatus() {
  setCheckingState();

  try {
    const response = await fetch(statusEndpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    data.services.forEach((service) => {
      const card = document.querySelector(`[data-service="${service.id}"]`);
      if (card) {
        updateCard(card, service);
      }
    });

    lastUpdatedEl.textContent = `Last check: ${formatTime(data.updatedAt)}`;
  } catch (error) {
    grid.querySelectorAll(".status-card").forEach((card) => {
      const badge = card.querySelector("[data-status]");
      const detail = card.querySelector("[data-detail]");
      setBadge(badge, "issue");
      detail.textContent = "Status API unreachable";
    });

    lastUpdatedEl.textContent = "Last check: error";
  }
}

loadStatus();
setInterval(loadStatus, refreshIntervalMs);
