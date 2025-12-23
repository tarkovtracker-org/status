const express = require("express");
const path = require("path");
const services = require("./services.json");

const app = express();
const port = process.env.PORT || 3000;
const timeoutMs = Number(process.env.STATUS_TIMEOUT_MS || 5000);

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

    return {
      id: service.id,
      name: service.name,
      type: service.type,
      url: service.url,
      ok: response.ok,
      status: response.status,
      responseTimeMs: elapsedMs,
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

app.get("/api/status", async (_req, res) => {
  const results = await Promise.all(services.map(checkService));

  res.json({
    updatedAt: new Date().toISOString(),
    services: results,
  });
});

app.listen(port, () => {
  console.log(`Status server listening on port ${port}`);
});
