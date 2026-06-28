<div align="center">

<table border="0"><tr>
<td valign="middle"><img src="https://tarkovtracker.org/img/logos/tarkovtrackerlogo-light.webp" alt="TarkovTracker logo" width="120" /></td>
<td valign="middle"><h1>Status Page</h1></td>
</tr></table>

Live service status page for the [TarkovTracker.org](https://tarkovtracker.org) community. Runs lightweight health checks against each service and shows a 7-day incident history.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/tarkovtracker-org/status/pulls)

</div>

## Overview

A small Express server serves a static dashboard and exposes two JSON endpoints:

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/status` | Runs a live health check against every configured service and returns the latest result. |
| `GET /api/history` | Returns a 7-day rolling summary of failed checks per service. |

The frontend refreshes automatically every 30 seconds. A service is flagged when it times out, returns a non-2xx status, or returns a Cloudflare/bad-gateway error.

Requires **Node.js 18+**.

## Getting started

```bash
npm install
npm run start
```

Open `http://localhost:3000`.

## Configure monitored services

Edit `config/services.json`. Each entry describes one health check:

```json
{
  "id": "tarkovtracker",
  "name": "TarkovTracker.org",
  "type": "web",
  "url": "https://tarkovtracker.org",
  "method": "GET"
}
```

The dashboard renders one card per service automatically.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on. |
| `STATUS_TIMEOUT_MS` | `5000` | Per-check request timeout in milliseconds. |
| `HISTORY_INTERVAL_MS` | `300000` | How often background checks run for history tracking. |

## Project structure

```
status/
├── server.js              # Express server: health checks + API
├── config/
│   └── services.json      # List of monitored services
└── public/                # Static dashboard
    ├── index.html
    ├── styles.css
    └── app.js
```

## License

Released under the [MIT License](LICENSE).
