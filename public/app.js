const statusEndpoint = "/api/status";
const historyEndpoint = "/api/history";
const refreshIntervalMs = 30000;

const grid = document.getElementById("status-history-grid");
const lastUpdatedEl = document.getElementById("last-updated");

let renderedIds = "";

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function buildRows(services) {
  grid.innerHTML = services
    .map((service) => {
      const name = escapeHtml(service.name || service.id);
      const meta = escapeHtml(service.description || service.type || "Service");
      return `
        <div class="row">
          <article class="status-card" data-service="${escapeHtml(service.id)}">
            <div class="card-top">
              <h2>${name}</h2>
              <span class="badge checking" data-status>Checking...</span>
            </div>
            <p class="card-meta">${meta}</p>
            <div class="card-detail">Endpoint: <span data-endpoint></span></div>
            <div class="card-detail" data-detail>Waiting for response.</div>
          </article>

          <article class="history-card" data-history="${escapeHtml(service.id)}">
            <div class="history-top">
              <h3>Last 7 days</h3>
              <span class="history-total" data-total>-- incidents</span>
            </div>
            <svg class="history-chart" viewBox="0 0 260 80" role="img" aria-label="Incident chart"></svg>
            <div class="history-labels" data-labels></div>
          </article>
        </div>
      `;
    })
    .join("");
}

function ensureCards(services) {
  const ids = services.map((service) => service.id).join("|");
  if (ids !== renderedIds) {
    buildRows(services);
    renderedIds = ids;
  }
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
      : service.issueReason
        ? `${service.issueReason} · HTTP ${service.status || "--"}`
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

function buildSparkline(values, width, height) {
  const maxValue = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = step * index;
    const y = height - (value / maxValue) * (height - 10) - 5;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(" L ")}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;
  return { linePath, areaPath, points };
}

function renderHistoryCard(card, serviceHistory, labels) {
  const chart = card.querySelector(".history-chart");
  const totalEl = card.querySelector("[data-total]");
  const labelsEl = card.querySelector("[data-labels]");
  const values = serviceHistory.failures;
  const totalIncidents = values.reduce((sum, value) => sum + value, 0);

  const { linePath, areaPath, points } = buildSparkline(values, 260, 80);

  chart.innerHTML = `
    <path class="area" d="${areaPath}"></path>
    <path class="line" d="${linePath}"></path>
    ${points
      .map((point) => {
        const [x, y] = point.split(",");
        return `<circle class="point" cx="${x}" cy="${y}" r="3"></circle>`;
      })
      .join("")}
  `;

  totalEl.textContent = `${totalIncidents} incidents`;
  labelsEl.textContent = `${labels[0]} · ${labels[labels.length - 1]}`;
}

function applyHistory(historyData) {
  historyData.services.forEach((serviceHistory) => {
    const card = grid.querySelector(`[data-history="${serviceHistory.id}"]`);
    if (card) {
      renderHistoryCard(card, serviceHistory, historyData.labels);
    }
  });
}

async function loadHistory() {
  try {
    const response = await fetch(historyEndpoint, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("History fetch failed");
    }

    applyHistory(await response.json());
  } catch (error) {
    grid.querySelectorAll(".history-card").forEach((card) => {
      const chart = card.querySelector(".history-chart");
      const totalEl = card.querySelector("[data-total]");
      const labelsEl = card.querySelector("[data-labels]");
      chart.innerHTML = "";
      totalEl.textContent = "History unavailable";
      labelsEl.textContent = "--";
    });
  }
}

async function loadStatus() {
  try {
    const [statusResponse, historyResponse] = await Promise.all([
      fetch(statusEndpoint, { cache: "no-store" }),
      fetch(historyEndpoint, { cache: "no-store" }),
    ]);

    if (!statusResponse.ok) {
      throw new Error(`HTTP ${statusResponse.status}`);
    }

    const data = await statusResponse.json();
    ensureCards(data.services);

    data.services.forEach((service) => {
      const card = grid.querySelector(`[data-service="${service.id}"]`);
      if (card) {
        updateCard(card, service);
      }
    });

    lastUpdatedEl.textContent = `Last check: ${formatTime(data.updatedAt)}`;

    if (historyResponse.ok) {
      applyHistory(await historyResponse.json());
    } else {
      await loadHistory();
    }
  } catch (error) {
    grid.querySelectorAll(".status-card").forEach((card) => {
      const badge = card.querySelector("[data-status]");
      const detail = card.querySelector("[data-detail]");
      setBadge(badge, "issue");
      detail.textContent = "Status API unreachable";
    });

    lastUpdatedEl.textContent = "Last check: error";
    await loadHistory();
  }
}

loadStatus();
setInterval(loadStatus, refreshIntervalMs);
