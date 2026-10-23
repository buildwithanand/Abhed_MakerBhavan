# ABHED — Multi-Sensor Field Awareness Platform

[![Tests](https://github.com/OWNER/REPO/actions/workflows/tests.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/tests.yml) [![Python](https://img.shields.io/badge/python-3.10%2B-3776AB.svg)](https://www.python.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> When you create the GitHub repository, replace `OWNER/REPO` in the workflow badge URL with your repository path.

> A continuously operating, multi-sensor field-awareness platform for detecting, cross-checking, and reporting activity so operators can prioritise where human attention is needed.

ABHED brings distributed sensor nodes into one operator workspace. This repository contains a polished dashboard, a working local API, a demo telemetry simulator, incident-review actions, event export, and a normalised ingestion contract for an edge gateway or sensor firmware.

**Important:** the default dashboard starts in clearly labelled **demo simulation** mode. Its node positions, sensor readings, and incident candidates are sample data. They are not live detections, not geographically accurate, and must not be treated as operational evidence.

## What works in this repository

- **Operations overview:** node availability, open incident candidates, simulated detections, and network health indicators.
- **Schematic field map:** interactive registered-node markers, logical links, health states, and unresolved incident overlays. This is a schematic, not a GIS map.
- **Sensor network:** per-node status, battery estimate, supported channel list, latest normalised readings, and software-level self-tests.
- **Incident workflow:** filter by status, acknowledge a candidate, resolve it with an operator note, and preserve these actions in the event trail.
- **Event timeline:** inspect sensor-ingest and operator-action events; export the log to CSV.
- **Configuration:** change workspace name, refresh interval, confidence threshold, and demo simulation state.
- **Sensor API:** authenticated JSON ingestion at `POST /api/ingest/sensor` with payload validation.
- **Serial bridge helper:** optional JSON-lines serial-to-HTTP adapter for firmware/gateway output that has already been normalised to the documented schema.
- **Tests:** Flask API tests for health, settings validation, incident workflow, and authenticated ingestion.

## Quick start

Requirements: Python 3.10 or newer.

### Windows (PowerShell)

```powershell
cd abhed-github-repo
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

Open `.env` and set `ABHED_INGEST_API_KEY` to a long random secret before sending any sensor data. For local demo viewing, the other defaults are suitable.

```powershell
python run.py
```

Open **http://127.0.0.1:5000** in your browser.

### Linux / macOS

```bash
cd abhed-github-repo
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cp .env.example .env
# Edit .env and replace ABHED_INGEST_API_KEY before ingesting data.
python run.py
```

The dashboard uses plain HTML, CSS, and JavaScript served by Flask; no Node.js or front-end build step is required.

## Connect a normalised sensor feed

1. Start ABHED and keep the dashboard reachable from the edge gateway on the same trusted LAN.
2. Configure a strong `ABHED_INGEST_API_KEY` in `.env`, then restart the service.
3. Send `POST /api/ingest/sensor` with the `X-API-Key` header and the normalised JSON fields described in [`docs/api.md`](docs/api.md).
4. Confirm the incoming value appears in the node's latest readings and event timeline.
5. If you send a detection candidate, include a boolean `detection` and a calibrated confidence score between `0` and `1`. Candidates above the configured threshold may create an incident record. The record is a prompt for operator review, not a verified conclusion.

Sample publisher:

```bash
# Set the same key as ABHED_INGEST_API_KEY in .env.
# Windows PowerShell: $env:ABHED_INGEST_API_KEY="your-secret"
python scripts/publish_sample.py --node ABH-N01 --sensor mmWave --value 5.4 --unit m
```

Optional serial adapter for a device that emits **one complete JSON object per line** over USB/UART:

```bash
python scripts/serial_bridge.py --port COM5 --baud 115200
# Linux example: python scripts/serial_bridge.py --port /dev/ttyACM0 --baud 115200
```

The bridge forwards already-normalised JSON. It does **not** decode a manufacturer's native sensor protocol automatically. For DFRobot C4001, MLX90640, geophone, microphone, or camera hardware, implement and validate the relevant acquisition/driver on the device first, then map its output to ABHED's schema. See [`docs/hardware-integration.md`](docs/hardware-integration.md).

## API at a glance

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/health` | Service health and version |
| `GET` | `/api/snapshot` | Dashboard snapshot |
| `GET` | `/api/nodes` | Registered node telemetry |
| `POST` | `/api/nodes` | Register a node before its first heartbeat |
| `GET` | `/api/incidents?status=active` | Filter incident candidates |
| `POST` | `/api/incidents/{id}/acknowledge` | Acknowledge a candidate |
| `POST` | `/api/incidents/{id}/resolve` | Resolve a candidate and add a note |
| `GET` | `/api/events?limit=50` | Recent event log |
| `GET` | `/api/export/events.csv` | Download event CSV |
| `GET` / `PUT` | `/api/config` | Read/update local configuration |
| `POST` | `/api/nodes/{id}/self-test` | Software-level heartbeat check |
| `POST` | `/api/ingest/sensor` | Authenticated normalised sensor ingestion |

Full payload details and examples are in [`docs/api.md`](docs/api.md).

## Run tests

```bash
pytest -q
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `ABHED_HOST` | `127.0.0.1` | Bind interface. Keep local by default. |
| `ABHED_PORT` | `5000` | HTTP port |
| `ABHED_DEBUG` | `false` | Flask debug mode; leave off except local development |
| `ABHED_SIMULATION` | `true` | Generate sample telemetry on startup |
| `ABHED_INGEST_API_KEY` | placeholder / ingestion disabled | Secret required for sensor writes |
| `ABHED_SITE_NAME` | `ABHED Field Operations` | Workspace title in API metadata |
| `ABHED_DETECTION_THRESHOLD` | `0.72` | Candidate threshold, configurable in the UI |

## Architecture and limitations

```text
Sensors / edge firmware
        │  calibrated driver + local fusion (device-specific)
        ▼
Normalised JSON over trusted LAN or JSON-lines serial bridge
        │  POST /api/ingest/sensor + X-API-Key
        ▼
Flask API ── in-memory state ── incident/event workflow
        │
        ▼
Browser dashboard (HTML + CSS + JavaScript, polling API)
```

- The repository is a **prototype / integration scaffold**, not a certified safety or defence system.
- State is held in process memory and is lost when the app restarts. Use a persistent database, authentication, role-based access, encrypted transport, audit retention, backups, and deployment hardening before multi-user or field use.
- The included self-test validates the dashboard's software path only; it cannot prove a physical sensor is aligned, calibrated, unobstructed, or operating correctly.
- A sensor reading alone does not establish a person's identity, intent, or a hostile event. Verify candidate events with independent evidence and human review.
- Do not expose the development server directly to the public internet. Use a secured deployment architecture and a network/security review before real sensor integration.

## Suggested GitHub repository description

**ABHED is a multi-sensor field-awareness dashboard for edge-node health, cross-sensor event review, and operator incident reporting. Includes demo simulation, a Flask API, sensor ingestion scaffold, and CSV audit export.**

## License

MIT — see [`LICENSE`](LICENSE).
#   A b h e d _ M a k e r B h a v a n  
 