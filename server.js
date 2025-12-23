const express = require("express");
const path = require("path");
const services = require("./services.json");

const app = express();
const port = process.env.PORT || 3000;
const timeoutMs = Number(process.env.STATUS_TIMEOUT_MS || 5000);
const historyIntervalMs = Number(process.env.HISTORY_INTERVAL_MS || 300000);
const historyWindowDays = 7;

const historyStore = new Map();
let lastResults = [];

app.use(express.static(path.join(__dirname)));

async function checkService(service) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(service.url, {
      method: service.method || "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    const elapsedMs = Date.now() - start;
    const serverHeader = response.headers.get("server") || "";
    const isCloudflare = serverHeader.toLowerCase().includes("cloudflare");
    const isBadGateway = response.status === 502;
    const isCloudflareError = isCloudflare && response.status >= 500;
    const ok = response.ok && !isBadGateway && !isCloudflareError;

    return {
      id: service.id,
      name: service.name,
      type: service.type,
      url: service.url,
      ok,
      status: response.status,
      responseTimeMs: elapsedMs,
      issueReason: isBadGateway
        ? "Bad gateway"
        : isCloudflareError
          ? "Cloudflare error"
          : null,
    };
  } catch (error) {
    return {
      id: service.id,
      name: service.name,
      type: service.type,
      url: service.url,
      ok: false,
      status: null,
      responseTimeMs: null,
      error: error.name || "Error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function recordHistory(results) {
  const cutoff = Date.now() - historyWindowDays * 24 * 60 * 60 * 1000;

  results.forEach((result) => {
    if (!historyStore.has(result.id)) {
      historyStore.set(result.id, []);
    }

    historyStore.get(result.id).push({
      timestamp: Date.now(),
      ok: result.ok,
    });
  });

  historyStore.forEach((entries) => {
    while (entries.length && entries[0].timestamp < cutoff) {
      entries.shift();
    }
  });
}

function summarizeHistory() {
  const today = new Date();
  const days = Array.from({ length: historyWindowDays }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (historyWindowDays - 1 - index));
    day.setHours(0, 0, 0, 0);
    return day;
  });

  const labels = days.map((day) => day.toISOString().slice(0, 10));

  const servicesSummary = services.map((service) => {
    const entries = historyStore.get(service.id) || [];
    const failures = Array(historyWindowDays).fill(0);
    const totals = Array(historyWindowDays).fill(0);

    entries.forEach((entry) => {
      const entryDate = new Date(entry.timestamp);
      entryDate.setHours(0, 0, 0, 0);
      const index = days.findIndex(
        (day) => day.getTime() === entryDate.getTime()
      );

      if (index !== -1) {
        totals[index] += 1;
        if (!entry.ok) {
          failures[index] += 1;
        }
      }
    });

    return {
      id: service.id,
      name: service.name,
      failures,
      totals,
    };
  });

  return {
    labels,
    services: servicesSummary,
  };
}

async function runScheduledChecks() {
  const results = await Promise.all(services.map(checkService));
  lastResults = results;
  recordHistory(results);
}

app.get("/api/status", async (_req, res) => {
  await runScheduledChecks();

  res.json({
    updatedAt: new Date().toISOString(),
    services: lastResults,
  });
});

app.get("/api/history", (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString(),
    ...summarizeHistory(),
  });
});

runScheduledChecks();
setInterval(runScheduledChecks, historyIntervalMs);

app.listen(port, () => {
  console.log(`Status server listening on port ${port}`);
});
